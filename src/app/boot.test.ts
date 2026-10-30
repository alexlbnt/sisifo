import { IDBFactory } from 'fake-indexeddb';
import { createStore, get } from 'idb-keyval';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '@/lib/testing/memoryStorage';

/**
 * De ponta a ponta com as stores reais: um aparelho com dados da versão
 * anterior (tudo no localStorage) abre a versão nova.
 */

const FINANCE = JSON.stringify({
  state: {
    transactions: [
      { id: 't1', title: 'Café', amountCents: 850, type: 'expense', category: 'food', date: '2026-10-29', createdAt: '2026-10-29T10:00:00.000Z' },
    ],
    recurring: [],
    categories: [],
    accounts: [],
    budgets: { food: 50000 },
  },
  version: 3,
});
const PERSONAL = JSON.stringify({
  state: {
    areas: [],
    goals: [],
    goalEntries: [],
    reviews: [],
    tasks: [{ id: 'k1', title: 'Ligar pro banco', area: 'routine', status: 'todo', date: '2026-10-30', createdAt: '2026-10-29T10:00:00.000Z' }],
    habits: [],
    workoutPlans: [],
    workoutSessions: [],
  },
  version: 3,
});
const SYNC = JSON.stringify({
  cursor: '42',
  linked: true,
  shadow: {},
  outbox: { 'tasks|k1': { collection: 'tasks', id: 'k1', data: null, updatedAt: '2026-10-29T10:00:00.000Z' } },
  lastSyncAt: null,
});

let local: MemoryStorage;

// Carrega os módulos uma vez: com a suíte inteira em paralelo, a primeira importação é lenta.
beforeAll(async () => {
  await import('./boot');
}, 60_000);

beforeEach(() => {
  vi.resetModules();
  local = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, 'indexedDB');
});

async function boot() {
  const { loadLocalData } = await import('./boot');
  await loadLocalData();
  const { flushStorage } = await import('@/lib/storage');
  await flushStorage();
  expect(await (await import('@/lib/storage')).storageMode()).toBe('idb');
  return {
    finance: (await import('@/features/finance/store')).useFinanceStore.getState(),
    personal: (await import('@/features/personal/store')).usePersonalStore.getState(),
    sync: (await import('@/features/sync/engine')).useSyncStore.getState(),
  };
}

describe('abrir a versão nova com dados antigos', { timeout: 30_000 }, () => {
  it('as stores chegam com os dados do aparelho, que passam para o IndexedDB', async () => {
    local.setItem('sisifo:finance', FINANCE);
    local.setItem('sisifo:personal', PERSONAL);
    local.setItem('sisifo:sync', SYNC);

    const { finance, personal, sync } = await boot();

    expect(finance.transactions.map((t) => t.id)).toEqual(['t1']);
    expect(finance.budgets).toEqual({ food: 50000 });
    expect(personal.tasks.map((t) => t.id)).toEqual(['k1']);
    expect(sync.pending).toBe(1);

    expect(local.getItem('sisifo:finance')).toBeNull();
    expect(local.getItem('sisifo:sync')).toBeNull();
    const idb = createStore('sisifo', 'kv');
    expect(JSON.parse((await get<string>('sisifo:finance', idb))!).state.transactions[0].id).toBe('t1');
    expect(await get('sisifo:sync', idb)).toBe(SYNC);
  });

  it('aparelho novo: grava os dados de exemplo uma vez, e eles voltam iguais na próxima abertura', async () => {
    const first = await boot();
    expect(first.finance.transactions.length).toBeGreaterThan(0);
    const ids = first.finance.transactions.map((t) => t.id);

    vi.resetModules(); // "fecha e abre o app" com o mesmo IndexedDB
    const second = await boot();
    expect(second.finance.transactions.map((t) => t.id)).toEqual(ids);
  });
});
