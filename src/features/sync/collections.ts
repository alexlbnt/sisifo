import { useFinanceStore } from '@/features/finance/store';
import type { Budgets, FinanceState } from '@/features/finance/types';
import { usePersonalStore } from '@/features/personal/store';
import type { PersonalState } from '@/features/personal/types';
import type { CollectionName, SyncChange } from '@/shared/sync';

/**
 * Ponte entre as stores do app e os registros sincronizados.
 * Cada item vira um registro "coleção|id"; o orçamento é o documento settings|budgets.
 */

type ListName = Exclude<CollectionName, 'settings'>;

const FINANCE_LISTS = ['transactions', 'recurring'] as const satisfies readonly (keyof FinanceState)[];
const PERSONAL_LISTS = [
  'goals',
  'tasks',
  'habits',
  'workoutPlans',
  'workoutSessions',
] as const satisfies readonly (keyof PersonalState)[];

type FinanceList = (typeof FINANCE_LISTS)[number];
type PersonalList = (typeof PERSONAL_LISTS)[number];

const BUDGETS_ID = 'budgets';

export interface LocalRecord {
  collection: CollectionName;
  id: string;
  data: unknown;
}

export const recordKey = (collection: string, id: string) => `${collection}|${id}`;

export function parseKey(key: string): { collection: CollectionName; id: string } {
  const at = key.indexOf('|');
  return { collection: key.slice(0, at) as CollectionName, id: key.slice(at + 1) };
}

/** Fotografia de todos os itens locais, indexada por "coleção|id". */
export function snapshot(): Map<string, LocalRecord> {
  const records = new Map<string, LocalRecord>();
  const finance = useFinanceStore.getState();
  const personal = usePersonalStore.getState();

  const add = (collection: ListName, items: { id: string }[]) => {
    for (const item of items) records.set(recordKey(collection, item.id), { collection, id: item.id, data: item });
  };
  for (const name of FINANCE_LISTS) add(name, finance[name]);
  for (const name of PERSONAL_LISTS) add(name, personal[name]);
  records.set(recordKey('settings', BUDGETS_ID), { collection: 'settings', id: BUDGETS_ID, data: finance.budgets });
  return records;
}

/** Aplica registros vindos do servidor. `replace` descarta tudo o que é local antes. */
export function applyRecords(changes: SyncChange[], mode: 'merge' | 'replace') {
  const finance = useFinanceStore.getState();
  const personal = usePersonalStore.getState();

  const lists = new Map<ListName, Map<string, unknown>>();
  const listFor = (name: ListName, current: { id: string }[]) => {
    let list = lists.get(name);
    if (!list) {
      list = new Map(mode === 'replace' ? [] : current.map((item) => [item.id, item]));
      lists.set(name, list);
    }
    return list;
  };
  const currentOf = (name: ListName): { id: string }[] =>
    (FINANCE_LISTS as readonly string[]).includes(name)
      ? finance[name as FinanceList]
      : personal[name as PersonalList];

  let budgets: Budgets | undefined = mode === 'replace' ? {} : undefined;

  for (const change of changes) {
    if (change.collection === 'settings') {
      if (change.id === BUDGETS_ID) budgets = (change.data as Budgets | null) ?? {};
      continue;
    }
    const list = listFor(change.collection, currentOf(change.collection));
    if (change.data === null) list.delete(change.id);
    else list.set(change.id, change.data);
  }
  // No modo replace, coleções que não vieram do servidor ficam vazias.
  if (mode === 'replace') {
    for (const name of [...FINANCE_LISTS, ...PERSONAL_LISTS]) listFor(name, []);
  }

  const financePatch: Partial<FinanceState> = {};
  const personalPatch: Partial<PersonalState> = {};
  for (const [name, items] of lists) {
    const values = [...items.values()];
    if ((FINANCE_LISTS as readonly string[]).includes(name)) {
      (financePatch as Record<string, unknown>)[name] = values;
    } else {
      (personalPatch as Record<string, unknown>)[name] = values;
    }
  }
  if (budgets) financePatch.budgets = budgets;

  if (Object.keys(financePatch).length) useFinanceStore.setState(financePatch);
  if (Object.keys(personalPatch).length) usePersonalStore.setState(personalPatch);
}

export function clearLocalData() {
  useFinanceStore.setState({ transactions: [], recurring: [], budgets: {} });
  usePersonalStore.setState({ goals: [], tasks: [], habits: [], workoutPlans: [], workoutSessions: [] });
}

/** Se o aparelho tem algum dado próprio (para decidir o que fazer na primeira sincronização). */
export function hasLocalData(): boolean {
  const records = snapshot();
  for (const record of records.values()) {
    if (record.collection !== 'settings') return true;
    if (Object.keys(record.data as object).length) return true;
  }
  return false;
}

export function subscribeLocalChanges(listener: () => void): () => void {
  const a = useFinanceStore.subscribe(listener);
  const b = usePersonalStore.subscribe(listener);
  return () => {
    a();
    b();
  };
}
