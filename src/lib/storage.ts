import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/**
 * Onde ficam os dados volumosos do aparelho: IndexedDB (sem o limite de ~5 MB
 * do localStorage e sem travar a tela ao gravar). Tema, login, convite de
 * instalação, Modo Painel e treino em andamento continuam no localStorage:
 * são pequenos e alguns são lidos antes do React (tema no index.html e no painel.html).
 *
 * Na primeira abertura, as chaves abaixo são copiadas do localStorage, conferidas
 * e só então apagadas de lá. Sem IndexedDB (aba privada, Safari antigo), segue no
 * localStorage como antes.
 */

export const IDB_KEYS = [
  'sisifo:finance',
  'sisifo:personal',
  'sisifo:sync',
  'sisifo:sync-orphans',
  'sisifo:agenda',
] as const;

/** Onde estão os dados: 'idb' depois da migração; 'local' depois de uma volta ao localStorage. */
export const MARKER_KEY = 'sisifo:storage';

/**
 * Reversão de emergência: com `true`, os dados voltam do IndexedDB para o
 * localStorage e o app passa a usá-lo de novo (ver README → Armazenamento).
 */
const FORCE_LOCAL = false;

/**
 * Abrir o IndexedDB pode travar em alguns Safari: depois disso, desiste.
 * Folgado de propósito: na abertura a frio de um aparelho lento, um falso
 * "travou" deixaria o app só em memória.
 */
const PROBE_MS = 5000;

export type StorageMode = 'idb' | 'local' | 'memory';

export interface Backend {
  mode: StorageMode;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
}

export interface StorageEnv {
  local: Storage | null;
  idb: UseStore | null;
  forceLocal?: boolean;
}

/* ───────── Backends ───────── */

const idbBackend = (store: UseStore): Backend => ({
  mode: 'idb',
  get: async (key) => {
    const value = await get<unknown>(key, store);
    return typeof value === 'string' ? value : null;
  },
  set: (key, value) => set(key, value, store),
  del: (key) => del(key, store),
});

const localBackend = (local: Storage): Backend => ({
  mode: 'local',
  get: async (key) => local.getItem(key),
  set: async (key, value) => local.setItem(key, value),
  del: async (key) => local.removeItem(key),
});

function memoryBackend(): Backend {
  const data = new Map<string, string>();
  return {
    mode: 'memory',
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    del: async (key) => void data.delete(key),
  };
}

/* ───────── Abertura e migração ───────── */

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tempo esgotado')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function probe(store: UseStore): Promise<boolean> {
  try {
    return await withTimeout(
      (async () => {
        await set('__probe', 1, store);
        return (await get('__probe', store)) === 1;
      })(),
      PROBE_MS,
    );
  } catch {
    return false;
  }
}

/**
 * Copia as chaves do localStorage para o IndexedDB. Se a chave existe no
 * localStorage, ela é a versão mais nova (dados de antes da migração, ou de
 * uma sessão que voltou ao localStorage), exceto quando o marcador já diz
 * 'idb': aí é sobra de uma migração interrompida e o IndexedDB vale.
 * Qualquer divergência na releitura desfaz o que foi copiado e devolve false.
 */
export async function migrateToIdb(store: UseStore, local: Storage): Promise<boolean> {
  const marker = local.getItem(MARKER_KEY);
  const previous = new Map<string, unknown>();
  const copied: string[] = [];
  try {
    for (const key of IDB_KEYS) {
      const value = local.getItem(key);
      if (value === null) continue;
      const current = await get<unknown>(key, store);
      if (marker === 'idb' && current !== undefined) {
        local.removeItem(key);
        continue;
      }
      previous.set(key, current);
      await set(key, value, store);
      if ((await get<unknown>(key, store)) !== value) throw new Error(`cópia divergente em ${key}`);
      copied.push(key);
    }
    // Primeiro o marcador, depois a limpeza: se parar no meio, a próxima abertura sabe quem vale.
    local.setItem(MARKER_KEY, 'idb');
    for (const key of copied) local.removeItem(key);
    return true;
  } catch (error) {
    console.error('[storage] migração para o IndexedDB desfeita:', error);
    for (const [key, value] of previous) {
      try {
        if (value === undefined) await del(key, store);
        else await set(key, value, store);
      } catch {
        // Fica a cópia; o marcador não diz 'idb', então o localStorage continua valendo.
      }
    }
    return false;
  }
}

/** Caminho de volta: copia o IndexedDB para o localStorage. Devolve false se não coube. */
export async function restoreToLocalStorage(store: UseStore, local: Storage): Promise<boolean> {
  try {
    for (const key of IDB_KEYS) {
      const value = await get<unknown>(key, store);
      if (typeof value === 'string') local.setItem(key, value);
    }
    local.setItem(MARKER_KEY, 'local');
    return true;
  } catch (error) {
    console.error('[storage] não foi possível voltar ao localStorage:', error);
    return false;
  }
}

export async function openStorage(env: StorageEnv): Promise<Backend> {
  const { local, idb } = env;
  let marker: string | null = null;
  try {
    marker = local?.getItem(MARKER_KEY) ?? null;
  } catch {
    // localStorage bloqueado: segue sem marcador.
  }
  const idbOk = idb ? (await probe(idb)) || (await probe(idb)) : false;

  if (!idb || !idbOk) {
    // Os dados já estão no IndexedDB e ele não abriu agora: nada é gravado, para
    // os dados de exemplo não irem parar no lugar dos verdadeiros.
    if (marker === 'idb' || !local) return memoryBackend();
    return localBackend(local);
  }
  if (!local) return idbBackend(idb);
  if (env.forceLocal) {
    if (marker !== 'idb' || (await restoreToLocalStorage(idb, local))) return localBackend(local);
    return idbBackend(idb);
  }
  return (await migrateToIdb(idb, local)) ? idbBackend(idb) : localBackend(local);
}

function defaultEnv(): StorageEnv {
  let local: Storage | null = null;
  try {
    local = typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Acesso negado (aba privada restrita).
  }
  const idb = typeof indexedDB === 'undefined' ? null : createStore('sisifo', 'kv');
  return { local, idb, forceLocal: FORCE_LOCAL };
}

/* ───────── Storage do persist, com trava de escrita ───────── */

export interface GuardedStorage {
  storage: StateStorage;
  /** A chave estava vazia na leitura (aparelho novo): o estado inicial ainda não foi salvo. */
  wasEmptyOnLoad: (name: string) => boolean;
  /** Espera as gravações em andamento. */
  flush: () => Promise<void>;
  mode: () => Promise<StorageMode>;
}

/**
 * O `persist` do Zustand grava a cada `setState`, mesmo antes de ler o que
 * está salvo. Com leitura assíncrona, isso gravaria o estado inicial (dados de
 * exemplo) por cima dos dados reais. Aqui, uma chave só aceita escrita depois
 * de lida com sucesso.
 */
export function createGuardedStorage(open: () => Promise<Backend>): GuardedStorage {
  let backend: Promise<Backend> | null = null;
  const ready = () => (backend ??= open());
  const loaded = new Set<string>();
  const empty = new Set<string>();
  const pending = new Set<Promise<void>>();

  const track = (work: Promise<void>) => {
    const p: Promise<void> = work
      .catch((error: unknown) => console.error('[storage] falha ao gravar:', error))
      .finally(() => pending.delete(p));
    pending.add(p);
    return p;
  };

  return {
    storage: {
      getItem: async (name) => {
        const b = await ready();
        try {
          const value = await b.get(name);
          loaded.add(name);
          if (value === null) empty.add(name);
          return value;
        } catch (error) {
          // Sem leitura, sem escrita: a chave fica só em memória nesta sessão.
          console.error('[storage] falha ao ler', name, error);
          return null;
        }
      },
      setItem: (name, value) => {
        if (!loaded.has(name)) return;
        empty.delete(name);
        return track(ready().then((b) => b.set(name, value)));
      },
      removeItem: (name) => {
        if (!loaded.has(name)) return;
        return track(ready().then((b) => b.del(name)));
      },
    },
    wasEmptyOnLoad: (name) => empty.has(name),
    flush: async () => {
      await Promise.all([...pending]);
    },
    mode: async () => (await ready()).mode,
  };
}

const appStorage = createGuardedStorage(() => openStorage(defaultEnv()));

export const localData = appStorage.storage;
export const wasEmptyOnLoad = appStorage.wasEmptyOnLoad;
export const flushStorage = appStorage.flush;
export const storageMode = appStorage.mode;

/** Store do Zustand com `persist` (só o que é usado aqui). */
export interface PersistedStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

export function whenHydrated(store: PersistedStore): Promise<void> {
  return new Promise((resolve) => {
    if (store.persist.hasHydrated()) return resolve();
    const off = store.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}
