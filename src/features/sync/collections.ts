import { defaultAccounts } from '@/features/finance/accounts';
import { defaultCategories } from '@/features/finance/defaultCategories';
import { useFinanceStore } from '@/features/finance/store';
import type { FinanceState } from '@/features/finance/types';
import { defaultAreas } from '@/features/personal/defaultAreas';
import { usePersonalStore } from '@/features/personal/store';
import type { PersonalState } from '@/features/personal/types';
import { localData } from '@/lib/storage';
import { recordKey, rebuildRecords, toRecords, type LocalRecord, type Rebuilt, type Scope } from '@/shared/records';
import type { CollectionName, SyncChange } from '@/shared/sync';

/**
 * Ponte entre as stores do app e os registros sincronizados. A conversão em
 * si (funções puras) fica em `src/shared/records.ts`, que a API também usa.
 */

export { habitLogId, parseKey, recordKey, toRecords, type LocalRecord, type Rebuilt, type Scope } from '@/shared/records';

/**
 * Que coleções cada parte das stores alimenta. Meta e hábito levam junto os
 * registros filhos (etapas e marcações), que saem de dentro deles.
 */
const FINANCE_SLICES: Record<keyof FinanceState, readonly CollectionName[]> = {
  transactions: ['transactions'],
  recurring: ['recurring'],
  categories: ['categories'],
  accounts: ['accounts'],
  budgets: ['settings'],
};
const PERSONAL_SLICES: Record<keyof PersonalState, readonly CollectionName[]> = {
  areas: ['areas'],
  goals: ['goals', 'subtasks'],
  goalEntries: ['goalEntries'],
  reviews: ['reviews'],
  tasks: ['tasks'],
  habits: ['habits', 'habitLogs'],
  workoutPlans: ['workoutPlans'],
  workoutSessions: ['workoutSessions'],
};

/** Coleções que só existem por causa de outra; não contam como "dado próprio" do aparelho. */
const STRUCTURAL: readonly CollectionName[] = ['settings', 'categories', 'areas', 'accounts'];

/* ───────── Órfãos ─────────
 * Registros que ainda não têm onde morar: uma etapa cuja meta não chegou, uma
 * marcação de hábito que chegou antes do hábito, ou uma coleção de uma versão
 * mais nova do app. Ficam guardados à parte e entram na fotografia local; sem
 * isso, o motor acharia que foram apagados e mandaria excluí-los do servidor.
 */

const ORPHANS_KEY = 'sisifo:sync-orphans';
let orphans: Map<string, LocalRecord> | null = null;

/** Lê os órfãos guardados no aparelho. O motor espera isto antes de começar. */
export async function loadOrphans(): Promise<void> {
  try {
    const raw = await localData.getItem(ORPHANS_KEY);
    orphans = new Map(raw ? (Object.entries(JSON.parse(raw)) as [string, LocalRecord][]) : []);
  } catch {
    orphans = new Map();
  }
}

const currentOrphans = () => orphans ?? new Map<string, LocalRecord>();

function saveOrphans(next: Map<string, LocalRecord>) {
  orphans = next;
  // Sem storage, os órfãos ficam só em memória nesta sessão.
  if (next.size) void localData.setItem(ORPHANS_KEY, JSON.stringify(Object.fromEntries(next)));
  else void localData.removeItem(ORPHANS_KEY);
}

/* ───────── Store → registros ───────── */

/**
 * Fotografia dos itens locais (inclusive órfãos), indexada por "coleção|id".
 * Sem `scope`, de tudo; com ele, só das coleções que mudaram.
 */
export function snapshot(scope?: Scope): Map<string, LocalRecord> {
  const records = toRecords(useFinanceStore.getState(), usePersonalStore.getState(), scope);
  for (const [key, record] of currentOrphans()) {
    if (!records.has(key) && (!scope || scope.has(record.collection))) records.set(key, record);
  }
  return records;
}

/* ───────── Registros → store ───────── */

/** Monta o estado das stores a partir dos registros, com as categorias, contas e áreas de fábrica se faltarem. */
export function rebuild(records: Map<string, LocalRecord>): Rebuilt {
  const rebuilt = rebuildRecords(records);
  // Dados de antes das categorias/áreas editáveis: volta a lista de fábrica.
  if (!rebuilt.finance.categories.length) rebuilt.finance.categories = defaultCategories();
  if (!rebuilt.finance.accounts.length) rebuilt.finance.accounts = defaultAccounts();
  if (!rebuilt.personal.areas.length) rebuilt.personal.areas = defaultAreas();
  return rebuilt;
}

/** Aplica registros vindos do servidor. `replace` descarta tudo o que é local antes. */
export function applyRecords(changes: SyncChange[], mode: 'merge' | 'replace') {
  if (mode === 'replace') saveOrphans(new Map());
  const records = mode === 'replace' ? new Map<string, LocalRecord>() : snapshot();

  for (const change of changes) {
    const key = recordKey(change.collection, change.id);
    if (change.data === null) records.delete(key);
    else records.set(key, { collection: change.collection, id: change.id, data: change.data });
  }

  const next = rebuild(records);
  saveOrphans(next.orphans);
  useFinanceStore.setState(next.finance);
  usePersonalStore.setState(next.personal);

  // Uma regra recorrente pode ter chegado com meses pulados ou novos. Roda depois
  // de o motor terminar de aplicar, para a alteração ser enviada normalmente.
  queueMicrotask(() => useFinanceStore.getState().syncRecurring());
}

export function clearLocalData() {
  saveOrphans(new Map());
  useFinanceStore.setState({
    transactions: [],
    recurring: [],
    categories: defaultCategories(),
    accounts: defaultAccounts(),
    budgets: {},
  });
  usePersonalStore.setState({
    areas: defaultAreas(),
    goals: [],
    goalEntries: [],
    reviews: [],
    tasks: [],
    habits: [],
    workoutPlans: [],
    workoutSessions: [],
  });
}

/** Se o aparelho tem algum dado próprio (para decidir o que fazer na primeira sincronização). */
export function hasLocalData(): boolean {
  for (const record of snapshot().values()) {
    if (!STRUCTURAL.includes(record.collection)) return true;
    if (record.collection === 'settings' && Object.keys(record.data as object).length) return true;
  }
  return false;
}

/**
 * Coleções afetadas por uma alteração da store, comparando cada parte por
 * referência (as stores nunca alteram arrays no lugar). Uma parte que não está
 * no mapa devolve 'all': na dúvida, varre tudo.
 */
export function changedCollections<S extends object>(
  state: S,
  prev: S,
  slices: Partial<Record<keyof S, readonly CollectionName[]>>,
): Set<CollectionName> | 'all' {
  const changed = new Set<CollectionName>();
  for (const key of Object.keys(state) as (keyof S)[]) {
    const value = state[key];
    if (typeof value === 'function' || value === prev[key]) continue;
    const collections = slices[key];
    if (!collections) return 'all';
    for (const c of collections) changed.add(c);
  }
  return changed;
}

export type LocalChange = ReadonlySet<CollectionName> | 'all';

export function subscribeLocalChanges(listener: (changed: LocalChange) => void): () => void {
  const a = useFinanceStore.subscribe((state, prev) => listener(changedCollections(state, prev, FINANCE_SLICES)));
  const b = usePersonalStore.subscribe((state, prev) => listener(changedCollections(state, prev, PERSONAL_SLICES)));
  return () => {
    a();
    b();
  };
}
