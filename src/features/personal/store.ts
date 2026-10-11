import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ISODate } from '@/lib/dates';
import { uid } from '@/lib/id';
import { persistInitialState } from '@/lib/persistNow';
import { defaultAreas } from './defaultAreas';
import { createPersonalMock } from './mock';
import type {
  Area,
  AreaDef,
  AreaInput,
  Goal,
  GoalInput,
  HabitInput,
  PersonalState,
  Task,
  TaskInput,
  TaskStatus,
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

  /* Tarefas */
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: TaskInput) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTask: (id: string) => void;
  moveTasksToDay: (ids: string[], date: ISODate) => void;
  deleteTask: (id: string) => void;

  /* Hábitos */
  addHabit: (input: HabitInput) => void;
  updateHabit: (id: string, input: HabitInput) => void;
  toggleHabitDay: (id: string, day: ISODate) => void;
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

/** Aplica um novo status e mantém a subtask ligada em sincronia. */
function applyTaskStatus(state: PersonalState, id: string, status: TaskStatus) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return {};
  const updated: Task = {
    ...task,
    status,
    completedAt: status === 'done' ? new Date().toISOString() : undefined,
  };
  const tasks = state.tasks.map((t) => (t.id === id ? updated : t));
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

      /* ───────── Tarefas ───────── */

      addTask: (input) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            { ...input, id: uid(), status: 'todo', createdAt: new Date().toISOString() },
          ],
        })),

      updateTask: (id, input) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...input } : t)) })),

      setTaskStatus: (id, status) => set((s) => applyTaskStatus(s, id, status)),

      toggleTask: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          return task ? applyTaskStatus(s, id, task.status === 'done' ? 'todo' : 'done') : {};
        }),

      moveTasksToDay: (ids, date) =>
        set((s) => ({ tasks: s.tasks.map((t) => (ids.includes(t.id) ? { ...t, date } : t)) })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      /* ───────── Hábitos ───────── */

      addHabit: (input) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              ...input,
              id: uid(),
              completions: [],
              archived: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateHabit: (id, input) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...input } : h)) })),

      toggleHabitDay: (id, day) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const has = h.completions.includes(day);
            return {
              ...h,
              completions: has
                ? h.completions.filter((d) => d !== day)
                : [...h.completions, day].sort(),
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
      version: 2,
      partialize: ({ areas, goals, tasks, habits, workoutPlans, workoutSessions }): PersonalState => ({
        areas,
        goals,
        tasks,
        habits,
        workoutPlans,
        workoutSessions,
      }),
      // v2: áreas editáveis e ordem fixa nas etapas das metas.
      migrate: (persisted) => withDefaults(persisted as PersonalState),
    },
  ),
);

persistInitialState(usePersonalStore, PERSONAL_STORAGE_KEY);

function nextOrder(goal: Goal): number {
  return goal.subtasks.reduce((max, s) => Math.max(max, s.order + 1), 0);
}

/**
 * Completa dados antigos ou incompletos: sem nenhuma área, volta a lista de
 * fábrica; etapas sem ordem (formato antigo) recebem a posição em que estão.
 */
export function withDefaults<T extends Partial<PersonalState>>(state: T): T & { areas: AreaDef[] } {
  const goals = state.goals?.map((g) =>
    g.subtasks.every((st) => typeof st.order === 'number')
      ? g
      : { ...g, subtasks: g.subtasks.map((st, i) => ({ ...st, order: st.order ?? i })) },
  );
  return {
    ...state,
    ...(goals && { goals }),
    areas: state.areas?.length ? state.areas : defaultAreas(),
  };
}
