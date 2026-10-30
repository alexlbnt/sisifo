import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { todayISO, type ISODate } from '@/lib/dates';
import { uid } from '@/lib/id';
import { persistInitialState } from '@/lib/persistNow';
import { localData } from '@/lib/storage';
import { defaultAreas } from './defaultAreas';
import { createPersonalMock } from './mock';
import { nextOccurrence } from './recurrence';
import { completionsFromAmounts, habitTarget } from './selectors';
import type {
  Area,
  AreaDef,
  AreaInput,
  Goal,
  GoalEntry,
  GoalInput,
  Habit,
  HabitInput,
  PersonalState,
  Task,
  TaskInput,
  TaskStatus,
  WeeklyReview,
  WorkoutPlanInput,
  WorkoutSessionInput,
} from './types';

interface PersonalActions {
  /* Áreas */
  addArea: (input: AreaInput) => void;
  updateArea: (id: Area, input: AreaInput) => void;
  setAreaArchived: (id: Area, archived: boolean) => void;
  /** Só exclui área sem uso (metas, tarefas ou hábitos). Devolve se excluiu. */
  deleteArea: (id: Area) => boolean;

  /* Metas */
  addGoal: (input: GoalInput, subtaskTitles?: string[]) => void;
  updateGoal: (id: string, input: GoalInput) => void;
  deleteGoal: (id: string) => void;
  addSubtask: (goalId: string, title: string) => void;
  renameSubtask: (goalId: string, subtaskId: string, title: string) => void;
  toggleSubtask: (goalId: string, subtaskId: string) => void;
  deleteSubtask: (goalId: string, subtaskId: string) => void;
  addGoalEntry: (input: Omit<GoalEntry, 'id'>) => void;
  deleteGoalEntry: (id: string) => void;

  /* Revisão semanal */
  saveReview: (review: Omit<WeeklyReview, 'createdAt'>) => void;

  /* Tarefas */
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: TaskInput) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTask: (id: string) => void;
  moveTasksToDay: (ids: string[], date: ISODate) => void;
  /** Recomeça uma tarefa adiada demais: nova data e contagem de adiamentos zerada. */
  restartTask: (id: string, date: ISODate) => void;
  deleteTask: (id: string) => void;

  /* Hábitos */
  addHabit: (input: HabitInput) => void;
  updateHabit: (id: string, input: HabitInput) => void;
  /** Marca/desmarca o dia. Em hábitos de quantidade, alterna entre a meta e zero. */
  toggleHabitDay: (id: string, day: ISODate) => void;
  /** Quantidade do dia (hábitos de quantidade). 0 apaga o registro. */
  setHabitAmount: (id: string, day: ISODate, value: number) => void;
  /** Pula o dia com uma justificativa (não conta nem quebra a sequência); null desfaz. */
  setHabitSkip: (id: string, day: ISODate, reason: string | null) => void;
  setHabitArchived: (id: string, archived: boolean) => void;
  deleteHabit: (id: string) => void;

  /* Treino */
  addPlan: (input: WorkoutPlanInput) => void;
  updatePlan: (id: string, input: WorkoutPlanInput) => void;
  deletePlan: (id: string) => void;
  addSession: (input: WorkoutSessionInput) => void;
  updateSession: (id: string, input: WorkoutSessionInput) => void;
  deleteSession: (id: string) => void;

  replaceAll: (state: PersonalState) => void;
}

export type PersonalStore = PersonalState & PersonalActions;

export const PERSONAL_STORAGE_KEY = 'sisifo:personal';

function setSubtaskDone(goals: Goal[], goalId: string, subtaskId: string, done: boolean): Goal[] {
  return goals.map((g) =>
    g.id === goalId
      ? { ...g, subtasks: g.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)) }
      : g,
  );
}

/**
 * Próxima tarefa de uma série. O id é determinístico (série + data): dois
 * aparelhos concluindo a mesma tarefa criam o mesmo registro, sem duplicar.
 */
function nextInSeries(task: Task, tasks: Task[]): Task | null {
  if (!task.repeat) return null;
  const seriesId = task.seriesId ?? task.id;
  const date = nextOccurrence(task.repeat, task.date);
  const id = `${seriesId}~${date}`;
  if (tasks.some((t) => t.id === id || ((t.seriesId ?? t.id) === seriesId && t.date >= date))) return null;
  return {
    id,
    title: task.title,
    area: task.area,
    status: 'todo',
    date,
    ...(task.time && { time: task.time }),
    ...(task.priority && { priority: task.priority }),
    ...(task.notes && { notes: task.notes }),
    repeat: task.repeat,
    seriesId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Nova data de uma tarefa, contando o adiamento: só conta quando a tarefa já
 * estava no dia (ou atrasada) e foi empurrada para depois, sem estar feita.
 * Reorganizar tarefas futuras entre si não é adiar.
 */
export function withDate(task: Task, date: ISODate, today: ISODate = todayISO()): Task {
  if (date === task.date) return task;
  const postponed = task.status !== 'done' && task.date <= today && date > task.date;
  return { ...task, date, ...(postponed && { postponed: (task.postponed ?? 0) + 1 }) };
}

/** Aplica um novo status e mantém a subtask ligada em sincronia. */
function applyTaskStatus(state: PersonalState, id: string, status: TaskStatus) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return {};
  const updated: Task = {
    ...task,
    status,
    completedAt: status === 'done' ? new Date().toISOString() : undefined,
  };
  let tasks = state.tasks.map((t) => (t.id === id ? updated : t));
  if (status === 'done' && task.status !== 'done') {
    const next = nextInSeries(updated, tasks);
    if (next) tasks = [...tasks, next];
  }
  if (!task.link || (task.status === 'done') === (status === 'done')) return { tasks };
  return {
    tasks,
    goals: setSubtaskDone(state.goals, task.link.goalId, task.link.subtaskId, status === 'done'),
  };
}

export const usePersonalStore = create<PersonalStore>()(
  persist(
    (set, get) => ({
      ...createPersonalMock(),

      /* ───────── Áreas ───────── */

      addArea: (input) =>
        set((s) => ({ areas: [...s.areas, { ...input, id: uid(), archived: false }] })),

      updateArea: (id, input) =>
        set((s) => ({ areas: s.areas.map((a) => (a.id === id ? { ...a, ...input } : a)) })),

      setAreaArchived: (id, archived) =>
        set((s) => ({ areas: s.areas.map((a) => (a.id === id ? { ...a, archived } : a)) })),

      deleteArea: (id) => {
        const s = get();
        const inUse =
          s.goals.some((g) => g.area === id) ||
          s.tasks.some((t) => t.area === id) ||
          s.habits.some((h) => h.area === id);
        if (inUse) return false;
        set({ areas: s.areas.filter((a) => a.id !== id) });
        return true;
      },

      /* ───────── Metas ───────── */

      addGoal: (input, subtaskTitles = []) =>
        set((s) => ({
          goals: [
            ...s.goals,
            {
              ...input,
              id: uid(),
              subtasks: subtaskTitles
                .map((t) => t.trim())
                .filter(Boolean)
                .map((title, order) => ({ id: uid(), title, done: false, order })),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateGoal: (id, input) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...input } : g)) })),

      deleteGoal: (id) =>
        set((s) => ({
          goals: s.goals.filter((g) => g.id !== id),
          goalEntries: s.goalEntries.filter((e) => e.goalId !== id),
          tasks: s.tasks.map((t) => (t.link?.goalId === id ? { ...t, link: undefined } : t)),
        })),

      addSubtask: (goalId, title) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  subtasks: [
                    ...g.subtasks,
                    { id: uid(), title: title.trim(), done: false, order: nextOrder(g) },
                  ],
                }
              : g,
          ),
        })),

      renameSubtask: (goalId, subtaskId, title) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  subtasks: g.subtasks.map((st) => (st.id === subtaskId ? { ...st, title } : st)),
                }
              : g,
          ),
        })),

      toggleSubtask: (goalId, subtaskId) =>
        set((s) => {
          const goal = s.goals.find((g) => g.id === goalId);
          const sub = goal?.subtasks.find((st) => st.id === subtaskId);
          if (!sub) return {};
          const done = !sub.done;
          return {
            goals: setSubtaskDone(s.goals, goalId, subtaskId, done),
            tasks: s.tasks.map((t) =>
              t.link?.subtaskId === subtaskId
                ? {
                    ...t,
                    status: done ? 'done' : 'todo',
                    completedAt: done ? new Date().toISOString() : undefined,
                  }
                : t,
            ),
          };
        }),

      deleteSubtask: (goalId, subtaskId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId ? { ...g, subtasks: g.subtasks.filter((st) => st.id !== subtaskId) } : g,
          ),
          tasks: s.tasks.map((t) =>
            t.link?.subtaskId === subtaskId ? { ...t, link: undefined } : t,
          ),
        })),

      addGoalEntry: (input) => set((s) => ({ goalEntries: [...s.goalEntries, { ...input, id: uid() }] })),

      deleteGoalEntry: (id) => set((s) => ({ goalEntries: s.goalEntries.filter((e) => e.id !== id) })),

      /* ───────── Revisão semanal ───────── */

      saveReview: (review) =>
        set((s) => {
          const existing = s.reviews.find((r) => r.id === review.id);
          const next: WeeklyReview = { ...review, createdAt: existing?.createdAt ?? new Date().toISOString() };
          return {
            reviews: existing ? s.reviews.map((r) => (r.id === review.id ? next : r)) : [...s.reviews, next],
          };
        }),

      /* ───────── Tarefas ───────── */

      addTask: (input) =>
        set((s) => {
          const id = uid();
          return {
            tasks: [
              ...s.tasks,
              { ...clean(input), id, status: 'todo', ...(input.repeat && { seriesId: id }), createdAt: new Date().toISOString() },
            ],
          };
        }),

      updateTask: (id, input) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            // Campos opcionais apagados no formulário saem do item.
            const { time: _t, priority: _p, notes: _n, repeat: _r, link: _l, ...rest } = t;
            const moved = withDate(t, input.date);
            return {
              ...rest,
              ...clean(input),
              ...(moved.postponed !== undefined && { postponed: moved.postponed }),
              ...(input.repeat && { seriesId: t.seriesId ?? t.id }),
            };
          }),
        })),

      setTaskStatus: (id, status) => set((s) => applyTaskStatus(s, id, status)),

      toggleTask: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          return task ? applyTaskStatus(s, id, task.status === 'done' ? 'todo' : 'done') : {};
        }),

      moveTasksToDay: (ids, date) =>
        set((s) => ({ tasks: s.tasks.map((t) => (ids.includes(t.id) ? withDate(t, date) : t)) })),

      restartTask: (id, date) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const { postponed: _p, ...rest } = t;
            return { ...rest, date };
          }),
        })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      /* ───────── Hábitos ───────── */

      addHabit: (input) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              ...clean(input),
              id: uid(),
              completions: [],
              archived: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateHabit: (id, input) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const { kind: _k, target: _t, unit: _u, frequency: _f, timesPerWeek: _w, ...rest } = h;
            const next: Habit = { ...rest, ...clean(input) };
            // Mudou a meta diária: os dias feitos passam a seguir a nova meta.
            return next.kind === 'quantity'
              ? { ...next, completions: completionsFromAmounts(next, next.amounts ?? {}) }
              : next;
          }),
        })),

      toggleHabitDay: (id, day) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const has = h.completions.includes(day);
            const skips = withoutKey(h.skips, day);
            if (h.kind === 'quantity') {
              const amounts = has ? withoutKey(h.amounts, day) : { ...h.amounts, [day]: habitTarget(h) };
              return { ...h, skips, amounts, completions: completionsFromAmounts(h, amounts ?? {}) };
            }
            return {
              ...h,
              skips,
              completions: has ? h.completions.filter((d) => d !== day) : [...h.completions, day].sort(),
            };
          }),
        })),

      setHabitAmount: (id, day, value) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const amounts = value > 0 ? { ...h.amounts, [day]: value } : withoutKey(h.amounts, day);
            return {
              ...h,
              amounts,
              skips: value > 0 ? withoutKey(h.skips, day) : h.skips,
              completions: completionsFromAmounts(h, amounts ?? {}),
            };
          }),
        })),

      setHabitSkip: (id, day, reason) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            if (reason === null) return { ...h, skips: withoutKey(h.skips, day) };
            return {
              ...h,
              skips: { ...h.skips, [day]: reason.trim() || 'Pulado' },
              completions: h.completions.filter((d) => d !== day),
              amounts: withoutKey(h.amounts, day),
            };
          }),
        })),

      setHabitArchived: (id, archived) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, archived } : h)) })),

      deleteHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

      /* ───────── Treino ───────── */

      addPlan: (input) =>
        set((s) => ({ workoutPlans: [...s.workoutPlans, { ...input, id: uid() }] })),

      updatePlan: (id, input) =>
        set((s) => ({
          workoutPlans: s.workoutPlans.map((p) => (p.id === id ? { ...input, id } : p)),
        })),

      deletePlan: (id) =>
        set((s) => ({ workoutPlans: s.workoutPlans.filter((p) => p.id !== id) })),

      addSession: (input) =>
        set((s) => ({ workoutSessions: [...s.workoutSessions, { ...input, id: uid() }] })),

      updateSession: (id, input) =>
        set((s) => ({
          workoutSessions: s.workoutSessions.map((x) => (x.id === id ? { ...input, id } : x)),
        })),

      deleteSession: (id) =>
        set((s) => ({ workoutSessions: s.workoutSessions.filter((x) => x.id !== id) })),

      replaceAll: (state) => set(withDefaults(state)),
    }),
    {
      name: PERSONAL_STORAGE_KEY,
      version: 3,
      storage: createJSONStorage(() => localData),
      partialize: ({
        areas,
        goals,
        goalEntries,
        reviews,
        tasks,
        habits,
        workoutPlans,
        workoutSessions,
      }): PersonalState => ({
        areas,
        goals,
        goalEntries,
        reviews,
        tasks,
        habits,
        workoutPlans,
        workoutSessions,
      }),
      // v2: áreas editáveis e ordem fixa nas etapas das metas.
      // v3: registros de metas numéricas/poupança e revisões semanais.
      migrate: (persisted) => withDefaults(persisted as PersonalState),
    },
  ),
);

persistInitialState(usePersonalStore, PERSONAL_STORAGE_KEY);

/** Remove chaves com valor vazio, para campos opcionais apagados não ficarem como "". */
function clean<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as T;
}

/** Cópia do registro sem a chave; devolve undefined se ficar vazio. */
function withoutKey<V>(record: Record<string, V> | undefined, key: string): Record<string, V> | undefined {
  if (!record || !(key in record)) return record;
  const { [key]: _, ...rest } = record;
  return Object.keys(rest).length ? rest : undefined;
}

function nextOrder(goal: Goal): number {
  return goal.subtasks.reduce((max, s) => Math.max(max, s.order + 1), 0);
}

/**
 * Completa dados antigos ou incompletos: sem nenhuma área, volta a lista de
 * fábrica; etapas sem ordem (formato antigo) recebem a posição em que estão.
 */
export function withDefaults<T extends Partial<PersonalState>>(
  state: T,
): T & { areas: AreaDef[]; goalEntries: GoalEntry[]; reviews: WeeklyReview[] } {
  const goals = state.goals?.map((g) =>
    g.subtasks.every((st) => typeof st.order === 'number')
      ? g
      : { ...g, subtasks: g.subtasks.map((st, i) => ({ ...st, order: st.order ?? i })) },
  );
  return {
    ...state,
    ...(goals && { goals }),
    areas: state.areas?.length ? state.areas : defaultAreas(),
    goalEntries: state.goalEntries ?? [],
    reviews: state.reviews ?? [],
  };
}
