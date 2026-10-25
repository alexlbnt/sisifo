import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO, type ISODate } from '@/lib/dates';
import { usePersonalStore } from '../store';
import type { WorkoutPlan, WorkoutSession, WorkoutSessionInput } from '../types';
import {
  addExercise,
  addSet,
  editSet,
  newExercise,
  removeExercise,
  removeSet,
  runFromPlan,
  runFromSession,
  toggleSet,
  toSessionInput,
  type RunSet,
  type WorkoutRun,
} from './workoutRun';

/**
 * Treino em andamento no modo "no treino". Fica só neste aparelho (é rascunho):
 * vai para a sincronização quando é concluído, como uma sessão normal.
 */
interface RunStore {
  run: WorkoutRun | null;
  startFromPlan: (plan: WorkoutPlan | null, date?: ISODate) => void;
  editSession: (session: WorkoutSession) => void;
  goTo: (index: number) => void;
  toggleSet: (ei: number, si: number) => void;
  editSet: (ei: number, si: number, patch: Partial<Pick<RunSet, 'reps' | 'load'>>) => void;
  addSet: (ei: number) => void;
  removeSet: (ei: number, si: number) => void;
  addExercise: (name: string) => void;
  removeExercise: (ei: number) => void;
  extendRest: (seconds: number) => void;
  endRest: () => void;
  finish: (extra: Pick<WorkoutSessionInput, 'durationMin' | 'intensity' | 'notes'>) => void;
  discard: () => void;
}

export const useRunStore = create<RunStore>()(
  persist(
    (set, get) => {
      const update = (fn: (run: WorkoutRun) => WorkoutRun) => {
        const { run } = get();
        if (run) set({ run: fn(run) });
      };
      const sessions = () => usePersonalStore.getState().workoutSessions;

      return {
        run: null,
        startFromPlan: (plan, date = todayISO()) => set({ run: runFromPlan(plan, sessions(), date, Date.now()) }),
        editSession: (session) =>
          set({ run: runFromSession(session, sessions(), usePersonalStore.getState().workoutPlans, Date.now()) }),
        goTo: (index) => update((r) => ({ ...r, current: Math.max(0, Math.min(index, r.exercises.length - 1)) })),
        toggleSet: (ei, si) => update((r) => toggleSet(r, ei, si, Date.now())),
        editSet: (ei, si, patch) => update((r) => editSet(r, ei, si, patch)),
        addSet: (ei) => update((r) => addSet(r, ei)),
        removeSet: (ei, si) => update((r) => removeSet(r, ei, si)),
        addExercise: (name) => update((r) => addExercise(r, newExercise(name, sessions()))),
        removeExercise: (ei) => update((r) => removeExercise(r, ei)),
        extendRest: (seconds) =>
          update((r) => (r.restEndsAt ? { ...r, restEndsAt: r.restEndsAt + seconds * 1000, restTotalMs: r.restTotalMs + seconds * 1000 } : r)),
        endRest: () => update((r) => ({ ...r, restEndsAt: null })),
        finish: (extra) => {
          const { run } = get();
          if (!run) return;
          const input = toSessionInput(run, extra);
          const personal = usePersonalStore.getState();
          // A sessão montada tem todos os campos; na edição, ela substitui a original inteira.
          if (run.editingId) {
            personal.updateSession(run.editingId, input);
          } else {
            personal.addSession(input);
          }
          set({ run: null });
        },
        discard: () => set({ run: null }),
      };
    },
    { name: 'sisifo:workout-run', version: 1 },
  ),
);
