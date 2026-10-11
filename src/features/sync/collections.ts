import { defaultCategories } from '@/features/finance/defaultCategories';
import { useFinanceStore } from '@/features/finance/store';
import type { Budgets, FinanceState } from '@/features/finance/types';
import { defaultAreas } from '@/features/personal/defaultAreas';
import { usePersonalStore } from '@/features/personal/store';
import type { Goal, Habit, PersonalState, Subtask } from '@/features/personal/types';
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

const FINANCE_LISTS = ['transactions', 'recurring', 'categories'] as const satisfies readonly (keyof FinanceState)[];
const PERSONAL_LISTS = ['areas', 'tasks', 'workoutPlans', 'workoutSessions'] as const satisfies readonly (keyof PersonalState)[];

type FinanceList = (typeof FINANCE_LISTS)[number];
type PersonalList = (typeof PERSONAL_LISTS)[number];

const BUDGETS_ID = 'budgets';

/** Coleções que só existem por causa de outra; não contam como "dado próprio" do aparelho. */
const STRUCTURAL: readonly CollectionName[] = ['settings', 'categories', 'areas'];

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

function loadOrphans(): Map<string, LocalRecord> {
  if (orphans) return orphans;
  try {
    const raw = localStorage.getItem(ORPHANS_KEY);
    orphans = new Map(raw ? (Object.entries(JSON.parse(raw)) as [string, LocalRecord][]) : []);
  } catch {
    orphans = new Map();
  }
  return orphans;
}

function saveOrphans(next: Map<string, LocalRecord>) {
  orphans = next;
  try {
    if (next.size) localStorage.setItem(ORPHANS_KEY, JSON.stringify(Object.fromEntries(next)));
    else localStorage.removeItem(ORPHANS_KEY);
  } catch {
    // Sem storage: os órfãos ficam só em memória nesta sessão.
  }
}

/* ───────── Store → registros ───────── */

/** Registros de um estado. Função pura: é o inverso de `rebuild`. */
export function toRecords(finance: FinanceState, personal: PersonalState): Map<string, LocalRecord> {
  const records = new Map<string, LocalRecord>();
  const put = (collection: CollectionName, id: string, data: unknown) =>
    records.set(recordKey(collection, id), { collection, id, data });

  for (const name of FINANCE_LISTS) for (const item of finance[name]) put(name, item.id, item);
  for (const name of PERSONAL_LISTS) for (const item of personal[name]) put(name, item.id, item);

  for (const { subtasks, ...goal } of personal.goals) {
    put('goals', goal.id, goal);
    for (const st of subtasks) put('subtasks', st.id, { ...st, goalId: goal.id } satisfies SubtaskRecord);
  }
  for (const { completions, ...habit } of personal.habits) {
    put('habits', habit.id, habit);
    for (const date of completions) {
      put('habitLogs', habitLogId(habit.id, date), { habitId: habit.id, date } satisfies HabitLogRecord);
    }
  }
  put('settings', BUDGETS_ID, finance.budgets);
  return records;
}

/** Fotografia de todos os itens locais (inclusive órfãos), indexada por "coleção|id". */
export function snapshot(): Map<string, LocalRecord> {
  const records = toRecords(useFinanceStore.getState(), usePersonalStore.getState());
  for (const [key, record] of loadOrphans()) if (!records.has(key)) records.set(key, record);
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
  const finance: FinanceState = { transactions: [], recurring: [], categories: [], budgets: {} };
  const personal: PersonalState = {
    areas: [],
    goals: [],
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
    // Formato antigo: marcações dentro do hábito. Só vale enquanto não há registros próprios.
    const dates = own ? own.map((r) => (r.data as HabitLogRecord).date) : (habit.completions ?? []);
    personal.habits.push({ ...habit, completions: [...new Set(dates)].sort() });
  }

  for (const list of [...subtasksOf.values(), ...logsOf.values()]) {
    for (const record of list) left.set(recordKey(record.collection, record.id), record);
  }

  // Dados de antes das categorias/áreas editáveis: volta a lista de fábrica.
  if (!finance.categories.length) finance.categories = defaultCategories();
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
  useFinanceStore.setState({ transactions: [], recurring: [], categories: defaultCategories(), budgets: {} });
  usePersonalStore.setState({
    areas: defaultAreas(),
    goals: [],
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

export function subscribeLocalChanges(listener: () => void): () => void {
  const a = useFinanceStore.subscribe(listener);
  const b = usePersonalStore.subscribe(listener);
  return () => {
    a();
    b();
  };
}
