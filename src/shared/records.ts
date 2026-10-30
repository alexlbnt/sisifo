/**
 * Itens das stores ⇄ registros sincronizados, em funções puras. Usado pelo app
 * (src/features/sync/collections.ts) e pela API (backup automático): só
 * imports relativos com `.js` e, das features, só tipos.
 *
 * Quase todo item vira um registro "coleção|id". Duas exceções, para que
 * alterações feitas em aparelhos diferentes não se apaguem:
 * - cada etapa de meta é um registro em `subtasks` (a meta sobe sem elas);
 * - cada dia marcado de um hábito é um registro em `habitLogs` (o hábito sobe sem eles).
 * O orçamento é o documento settings|budgets.
 */
import type { Budgets, FinanceState } from '../features/finance/types.js';
import type { Goal, Habit, PersonalState, Subtask } from '../features/personal/types.js';
import { COLLECTION_NAMES, type CollectionName } from './sync.js';

export const FINANCE_LISTS = ['transactions', 'recurring', 'categories', 'accounts'] as const satisfies readonly (keyof FinanceState)[];
export const PERSONAL_LISTS = [
  'areas',
  'tasks',
  'goalEntries',
  'reviews',
  'workoutPlans',
  'workoutSessions',
] as const satisfies readonly (keyof PersonalState)[];

type FinanceList = (typeof FINANCE_LISTS)[number];
type PersonalList = (typeof PERSONAL_LISTS)[number];

/** Escopo de uma varredura: só estas coleções. */
export type Scope = ReadonlySet<CollectionName>;

export const BUDGETS_ID = 'budgets';

export interface LocalRecord {
  collection: CollectionName;
  id: string;
  data: unknown;
}

export interface SubtaskRecord extends Subtask {
  goalId: string;
}

export interface HabitLogRecord {
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

/** Meta diária: 1 nos hábitos de marcar; `target` nos de quantidade. */
export const habitTarget = (habit: Pick<Habit, 'kind' | 'target'>): number =>
  habit.kind === 'quantity' ? (habit.target && habit.target > 0 ? habit.target : 1) : 1;

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

/* ───────── Registros → store ───────── */

export interface Rebuilt {
  finance: FinanceState;
  personal: PersonalState;
  orphans: Map<string, LocalRecord>;
}

const byOrder = (a: Subtask, b: Subtask) => a.order - b.order || a.id.localeCompare(b.id);

/**
 * Monta o estado das stores a partir dos registros. Não completa categorias,
 * contas e áreas de fábrica: isso fica com quem chama (o app e a importação).
 */
export function rebuildRecords(records: Map<string, LocalRecord>): Rebuilt {
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

  return { finance, personal, orphans: left };
}
