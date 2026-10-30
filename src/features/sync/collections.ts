import { defaultAccounts } from '@/features/finance/accounts';
import { defaultCategories } from '@/features/finance/defaultCategories';
import { useFinanceStore } from '@/features/finance/store';
import type { Budgets, FinanceState } from '@/features/finance/types';
import { defaultAreas } from '@/features/personal/defaultAreas';
import { usePersonalStore } from '@/features/personal/store';
import { habitTarget } from '@/features/personal/selectors';
import type { Goal, Habit, PersonalState, Subtask } from '@/features/personal/types';
import { localData } from '@/lib/storage';
import { COLLECTION_NAMES, type CollectionName, type SyncChange } from '@/shared/sync';

/**
 * Ponte entre as stores do app e os registros sincronizados.
 *
 * Quase todo item vira um registro "coleção|id". Duas exceções, para que
 * alterações feitas em aparelhos diferentes não se apaguem:
 * - cada etapa de meta é um registro em `subtasks` (a meta sobe sem elas);
 * - cada dia marcado de um hábito é um registro em `habitLogs` (o hábito sobe sem eles).
 * O orçamento é o documento settings|budgets.
 */

const FINANCE_LISTS = ['transactions', 'recurring', 'categories', 'accounts'] as const satisfies readonly (keyof FinanceState)[];
const PERSONAL_LISTS = [
  'areas',
  'tasks',
  'goalEntries',
  'reviews',
  'workoutPlans',
  'workoutSessions',
] as const satisfies readonly (keyof PersonalState)[];

type FinanceList = (typeof FINANCE_LISTS)[number];
type PersonalList = (typeof PERSONAL_LISTS)[number];

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

/** Escopo de uma varredura: só estas coleções. */
export type Scope = ReadonlySet<CollectionName>;

const BUDGETS_ID = 'budgets';

/** Coleções que só existem por causa de outra; não contam como "dado próprio" do aparelho. */
const STRUCTURAL: readonly CollectionName[] = ['settings', 'categories', 'areas', 'accounts'];

export interface LocalRecord {
  collection: CollectionName;
  id: string;
  data: unknown;
}

interface SubtaskRecord extends Subtask {
  goalId: string;
}

interface HabitLogRecord {
  habitId: string;
  date: string;
  /** Quantidade do dia (hábitos de quantidade). */
  value?: number;
  /** Dia pulado, com a justificativa. */
  skip?: string;
}

export const recordKey = (collection: string, id: string) => `${collection}|${id}`;

export function parseKey(key: string): { collection: CollectionName; id: string } {
  const at = key.indexOf('|');
  return { collection: key.slice(0, at) as CollectionName, id: key.slice(at + 1) };
}

export const habitLogId = (habitId: string, date: string) => `${habitId}:${date}`;

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
 * Registros de um estado. Função pura: é o inverso de `rebuild`. Com `scope`,
 * só monta as coleções pedidas (e nem lê as outras partes das stores).
 */
export function toRecords(finance: FinanceState, personal: PersonalState, scope?: Scope): Map<string, LocalRecord> {
  const records = new Map<string, LocalRecord>();
  const wants = (name: CollectionName) => !scope || scope.has(name);
  const put = (collection: CollectionName, id: string, data: unknown) => {
    if (wants(collection)) records.set(recordKey(collection, id), { collection, id, data });
  };

  for (const name of FINANCE_LISTS) if (wants(name)) for (const item of finance[name]) put(name, item.id, item);
  for (const name of PERSONAL_LISTS) if (wants(name)) for (const item of personal[name]) put(name, item.id, item);

  if (wants('goals') || wants('subtasks')) {
    for (const { subtasks, ...goal } of personal.goals) {
      put('goals', goal.id, goal);
      for (const st of subtasks) put('subtasks', st.id, { ...st, goalId: goal.id } satisfies SubtaskRecord);
    }
  }
  if (wants('habits') || wants('habitLogs')) {
    for (const { completions, amounts = {}, skips = {}, ...habit } of personal.habits) {
      put('habits', habit.id, habit);
      const dates = new Set([...completions, ...Object.keys(amounts), ...Object.keys(skips)]);
      for (const date of dates) {
        const log: HabitLogRecord = { habitId: habit.id, date };
        if (amounts[date] !== undefined) log.value = amounts[date];
        if (skips[date] !== undefined) log.skip = skips[date];
        put('habitLogs', habitLogId(habit.id, date), log);
      }
    }
  }
  if (wants('settings')) put('settings', BUDGETS_ID, finance.budgets);
  return records;
}

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

export interface Rebuilt {
  finance: FinanceState;
  personal: PersonalState;
  orphans: Map<string, LocalRecord>;
}

const byOrder = (a: Subtask, b: Subtask) => a.order - b.order || a.id.localeCompare(b.id);

/** Monta o estado das stores a partir dos registros. */
export function rebuild(records: Map<string, LocalRecord>): Rebuilt {
  const finance: FinanceState = { transactions: [], recurring: [], categories: [], accounts: [], budgets: {} };
  const personal: PersonalState = {
    areas: [],
    goals: [],
    goalEntries: [],
    reviews: [],
    tasks: [],
    habits: [],
    workoutPlans: [],
    workoutSessions: [],
  };
  const left = new Map<string, LocalRecord>();
  const goals: Array<Goal & { subtasks?: Subtask[] }> = [];
  const habits: Array<Habit & { completions?: string[] }> = [];
  const subtasksOf = new Map<string, LocalRecord[]>();
  const logsOf = new Map<string, LocalRecord[]>();
  const known = new Set<string>(COLLECTION_NAMES);

  const group = (index: Map<string, LocalRecord[]>, parent: string, record: LocalRecord) => {
    const list = index.get(parent);
    if (list) list.push(record);
    else index.set(parent, [record]);
  };

  for (const [key, record] of records) {
    const { collection, data } = record;
    if ((FINANCE_LISTS as readonly string[]).includes(collection)) {
      (finance[collection as FinanceList] as unknown[]).push(data);
    } else if ((PERSONAL_LISTS as readonly string[]).includes(collection)) {
      (personal[collection as PersonalList] as unknown[]).push(data);
    } else if (collection === 'goals') {
      goals.push(data as Goal);
    } else if (collection === 'habits') {
      habits.push(data as Habit);
    } else if (collection === 'subtasks') {
      group(subtasksOf, (data as SubtaskRecord).goalId, record);
    } else if (collection === 'habitLogs') {
      group(logsOf, (data as HabitLogRecord).habitId, record);
    } else if (collection === 'settings' && record.id === BUDGETS_ID) {
      finance.budgets = (data as Budgets | null) ?? {};
    } else if (!known.has(collection) || collection === 'settings') {
      left.set(key, record); // de uma versão mais nova do app: guarda sem mexer
    }
  }

  for (const goal of goals) {
    const own = subtasksOf.get(goal.id);
    subtasksOf.delete(goal.id);
    const subtasks: Subtask[] = own
      ? own.map((r) => {
          const { goalId: _, ...st } = r.data as SubtaskRecord;
          return st;
        })
      : // Formato antigo: etapas dentro da meta. Só vale enquanto não há registros próprios.
        (goal.subtasks ?? []).map((st, i) => ({ ...st, order: st.order ?? i }));
    personal.goals.push({ ...goal, subtasks: subtasks.sort(byOrder) });
  }

  for (const habit of habits) {
    const own = logsOf.get(habit.id);
    logsOf.delete(habit.id);
    const { completions: legacy, amounts: _a, skips: _s, ...rest } = habit;
    if (!own) {
      // Formato antigo: marcações dentro do hábito. Só vale enquanto não há registros próprios.
      personal.habits.push({ ...rest, completions: [...new Set(legacy ?? [])].sort() });
      continue;
    }
    const target = habitTarget(habit);
    const completions: string[] = [];
    const amounts: Record<string, number> = {};
    const skips: Record<string, string> = {};
    for (const { data } of own) {
      const log = data as HabitLogRecord;
      if (log.value !== undefined) amounts[log.date] = log.value;
      if (log.skip !== undefined) skips[log.date] = log.skip;
      else if (habit.kind === 'quantity' ? (log.value ?? target) >= target : true) completions.push(log.date);
    }
    personal.habits.push({
      ...rest,
      completions: [...new Set(completions)].sort(),
      ...(Object.keys(amounts).length && { amounts }),
      ...(Object.keys(skips).length && { skips }),
    });
  }

  for (const list of [...subtasksOf.values(), ...logsOf.values()]) {
    for (const record of list) left.set(recordKey(record.collection, record.id), record);
  }

  // Dados de antes das categorias/áreas editáveis: volta a lista de fábrica.
  if (!finance.categories.length) finance.categories = defaultCategories();
  if (!finance.accounts.length) finance.accounts = defaultAccounts();
  if (!personal.areas.length) personal.areas = defaultAreas();

  return { finance, personal, orphans: left };
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
