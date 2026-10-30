import { IDBFactory } from 'fake-indexeddb';
import { createStore, get, set, type UseStore } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  createGuardedStorage,
  MARKER_KEY,
  openStorage,
  whenHydrated,
  type Backend,
} from './storage';
import { MemoryStorage } from './testing/memoryStorage';

const FINANCE = JSON.stringify({ state: { transactions: [{ id: 't1', amountCents: 850 }] }, version: 3 });
const PERSONAL = JSON.stringify({ state: { tasks: [{ id: 'k1' }] }, version: 3 });
const THEME = JSON.stringify({ state: { theme: 'dark' }, version: 1 });

let idb: UseStore;
let local: MemoryStorage;

beforeEach(() => {
  // Banco novo a cada teste.
  globalThis.indexedDB = new IDBFactory();
  idb = createStore('sisifo', 'kv');
  local = new MemoryStorage();
  local.setItem('sisifo:finance', FINANCE);
  local.setItem('sisifo:personal', PERSONAL);
  local.setItem('sisifo:theme', THEME);
});

/** Store que grava outro valor numa chave: simula uma cópia que não confere. */
function corrupting(store: UseStore, key: string): UseStore {
  return (mode, callback) =>
    store(mode, (s) =>
      callback(
        new Proxy(s, {
          get(target, prop) {
            if (prop === 'put') return (value: unknown, k: IDBValidKey) => target.put(k === key ? 'corrompido' : value, k);
            const v = Reflect.get(target, prop) as unknown;
            return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
          },
        }),
      ),
    );
}

const failing: UseStore = () => Promise.reject(new Error('IndexedDB indisponível'));

describe('migração localStorage → IndexedDB', () => {
  it('copia, confere e só então apaga a origem', async () => {
    const backend = await openStorage({ local, idb });
    expect(backend.mode).toBe('idb');
    expect(await get('sisifo:finance', idb)).toBe(FINANCE);
    expect(await get('sisifo:personal', idb)).toBe(PERSONAL);
    expect(local.getItem('sisifo:finance')).toBeNull();
    expect(local.getItem('sisifo:personal')).toBeNull();
    expect(local.getItem(MARKER_KEY)).toBe('idb');
    // Preferências pequenas continuam no localStorage.
    expect(local.getItem('sisifo:theme')).toBe(THEME);
    expect(await backend.get('sisifo:finance')).toBe(FINANCE);
  });

  it('não apaga a origem se a cópia não confere, e desfaz o que copiou', async () => {
    const backend = await openStorage({ local, idb: corrupting(idb, 'sisifo:personal') });
    expect(backend.mode).toBe('local');
    expect(local.getItem('sisifo:finance')).toBe(FINANCE);
    expect(local.getItem('sisifo:personal')).toBe(PERSONAL);
    expect(local.getItem(MARKER_KEY)).toBeNull();
    expect(await get('sisifo:finance', idb)).toBeUndefined();
    expect(await backend.get('sisifo:personal')).toBe(PERSONAL);
  });

  it('é idempotente: abrir de novo não muda nada', async () => {
    await openStorage({ local, idb });
    const again = await openStorage({ local, idb });
    expect(again.mode).toBe('idb');
    expect(await get('sisifo:finance', idb)).toBe(FINANCE);
    expect(local.getItem('sisifo:finance')).toBeNull();
  });

  it('sobra de migração interrompida (marcador idb): o IndexedDB vale e a sobra sai', async () => {
    await set('sisifo:finance', 'mais-novo-no-idb', idb);
    local.setItem(MARKER_KEY, 'idb');
    await openStorage({ local, idb });
    expect(await get('sisifo:finance', idb)).toBe('mais-novo-no-idb');
    expect(local.getItem('sisifo:finance')).toBeNull();
  });

  it('depois de uma volta ao localStorage, o localStorage é o mais novo e substitui o IndexedDB', async () => {
    await set('sisifo:finance', 'antigo', idb);
    local.setItem(MARKER_KEY, 'local');
    await openStorage({ local, idb });
    expect(await get('sisifo:finance', idb)).toBe(FINANCE);
    expect(local.getItem(MARKER_KEY)).toBe('idb');
  });

  it('sem IndexedDB usa o localStorage, como antes', async () => {
    expect((await openStorage({ local, idb: null })).mode).toBe('local');
    expect((await openStorage({ local, idb: failing })).mode).toBe('local');
    expect(local.getItem('sisifo:finance')).toBe(FINANCE);
  });

  it('dados já migrados e IndexedDB fora do ar: só memória, sem gravar exemplo por cima', async () => {
    await openStorage({ local, idb });
    const backend = await openStorage({ local, idb: failing });
    expect(backend.mode).toBe('memory');
    expect(await backend.get('sisifo:finance')).toBeNull();
  });

  it('reversão: devolve tudo ao localStorage e a próxima migração traz de volta', async () => {
    await openStorage({ local, idb });
    const back = await openStorage({ local, idb, forceLocal: true });
    expect(back.mode).toBe('local');
    expect(local.getItem('sisifo:finance')).toBe(FINANCE);
    expect(local.getItem(MARKER_KEY)).toBe('local');

    local.setItem('sisifo:finance', 'alterado-no-local');
    const again = await openStorage({ local, idb });
    expect(again.mode).toBe('idb');
    expect(await get('sisifo:finance', idb)).toBe('alterado-no-local');
  });
});

describe('trava de escrita antes da leitura', () => {
  const memory = (initial: Record<string, string> = {}): Backend & { data: Map<string, string> } => {
    const data = new Map(Object.entries(initial));
    return {
      data,
      mode: 'memory',
      get: async (k) => data.get(k) ?? null,
      set: async (k, v) => void data.set(k, v),
      del: async (k) => void data.delete(k),
    };
  };

  it('setState antes da hidratação não grava o estado inicial por cima do salvo', async () => {
    const saved = JSON.stringify({ state: { value: 'real' }, version: 1 });
    const backend = memory({ key: saved });
    const guarded = createGuardedStorage(async () => backend);
    const useStore = create<{ value: string }>()(
      persist(() => ({ value: 'exemplo' }), { name: 'key', version: 1, storage: createJSONStorage(() => guarded.storage) }),
    );
    // Ex.: recorrentes ou dados de exemplo gravados antes de a leitura terminar.
    useStore.setState({ value: 'exemplo' });
    expect(backend.data.get('key')).toBe(saved);

    await whenHydrated(useStore);
    await guarded.flush();
    expect(useStore.getState().value).toBe('real');
    expect(backend.data.get('key')).toBe(saved);

    useStore.setState({ value: 'editado' });
    await guarded.flush();
    expect(JSON.parse(backend.data.get('key')!).state.value).toBe('editado');
  });

  it('marca a chave vazia na leitura (aparelho novo) até a primeira gravação', async () => {
    const guarded = createGuardedStorage(async () => memory());
    expect(await guarded.storage.getItem('novo')).toBeNull();
    expect(guarded.wasEmptyOnLoad('novo')).toBe(true);
    await guarded.storage.setItem('novo', '{}');
    expect(guarded.wasEmptyOnLoad('novo')).toBe(false);
  });

  it('leitura com erro bloqueia a escrita daquela chave', async () => {
    const backend = memory({ key: 'salvo' });
    const guarded = createGuardedStorage(async () => ({ ...backend, get: () => Promise.reject(new Error('falhou')) }));
    expect(await guarded.storage.getItem('key')).toBeNull();
    await guarded.storage.setItem('key', 'por cima');
    expect(backend.data.get('key')).toBe('salvo');
  });
});
