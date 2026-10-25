import type { ISODate } from '@/lib/dates';
import { uid } from '@/lib/id';
import type { PlanExercise, SetLog, WorkoutKind, WorkoutPlan, WorkoutSession, WorkoutSessionInput } from '../types';
import { lastPerformance } from './progress';

/**
 * Um treino em andamento no modo "no treino". Funções puras: a store só guarda
 * o resultado (e o persiste, para sobreviver a uma recarga na academia).
 */

export interface RunSet {
  reps: number;
  /** null: sem carga (peso do corpo). */
  load: number | null;
  done: boolean;
}

export interface RunExercise {
  id: string;
  name: string;
  /** Alvo da divisão, ex.: "8-10". */
  target?: string;
  restSec: number;
  sets: RunSet[];
  /** O que foi feito da última vez, para mostrar ao lado. */
  last?: { date: ISODate; sets: SetLog[] };
}

export interface WorkoutRun {
  label: string;
  kind: WorkoutKind;
  date: ISODate;
  planId?: string;
  /** Editando as séries de uma sessão já registrada. */
  editingId?: string;
  startedAt: number;
  exercises: RunExercise[];
  /** Exercício na tela. */
  current: number;
  /** Descanso rodando: quando termina e quanto durava. */
  restEndsAt: number | null;
  restTotalMs: number;
}

export const DEFAULT_REST_SEC = 90;

/** Primeiro número do alvo ("8-10" → 8). */
function targetReps(target: string | undefined): number | null {
  const n = Number(/\d+/.exec(target ?? '')?.[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Séries iniciais: as da última vez (mesma ordem), completando com o alvo da divisão. */
export function prefillSets(count: number, target: string | undefined, last: SetLog[] | undefined): RunSet[] {
  const n = Math.max(1, count || last?.length || 1);
  return Array.from({ length: n }, (_, i) => {
    const src = last?.[i] ?? last?.at(-1);
    return { reps: src?.reps ?? targetReps(target) ?? 10, load: src?.load ?? null, done: false };
  });
}

function fromPlanExercise(ex: PlanExercise, sessions: WorkoutSession[]): RunExercise {
  const last = lastPerformance(sessions, ex.name) ?? undefined;
  return {
    id: ex.id,
    name: ex.name,
    target: ex.reps,
    restSec: ex.restSec,
    sets: prefillSets(ex.sets, ex.reps, last?.sets),
    ...(last && { last }),
  };
}

/** Novo treino a partir de um da divisão (ou avulso, sem plano). */
export function runFromPlan(plan: WorkoutPlan | null, sessions: WorkoutSession[], date: ISODate, now: number): WorkoutRun {
  return {
    label: plan?.label ?? 'Treino avulso',
    kind: plan?.kind ?? 'strength',
    date,
    ...(plan && { planId: plan.id }),
    startedAt: now,
    exercises: (plan?.exercises ?? []).map((ex) => fromPlanExercise(ex, sessions)),
    current: 0,
    restEndsAt: null,
    restTotalMs: 0,
  };
}

/** Reabre as séries de uma sessão registrada, todas marcadas como feitas. */
export function runFromSession(session: WorkoutSession, sessions: WorkoutSession[], plans: WorkoutPlan[], now: number): WorkoutRun {
  const plan = plans.find((p) => p.id === session.planId);
  return {
    label: session.label,
    kind: session.kind,
    date: session.date,
    ...(session.planId && { planId: session.planId }),
    editingId: session.id,
    startedAt: now,
    exercises: (session.exercises ?? []).map((ex) => {
      const fromPlan = plan?.exercises?.find((p) => p.id === ex.id);
      const last = lastPerformance(sessions, ex.name, session.id) ?? undefined;
      return {
        id: ex.id,
        name: ex.name,
        ...(fromPlan && { target: fromPlan.reps }),
        restSec: fromPlan?.restSec ?? DEFAULT_REST_SEC,
        sets: ex.sets.map((s) => ({ reps: s.reps, load: s.load ?? null, done: true })),
        ...(last && { last }),
      };
    }),
    current: 0,
    restEndsAt: null,
    restTotalMs: 0,
  };
}

/** Exercício avulso adicionado durante o treino. */
export function newExercise(name: string, sessions: WorkoutSession[]): RunExercise {
  return fromPlanExercise({ id: uid(), name: name.trim(), sets: 3, reps: '', restSec: DEFAULT_REST_SEC }, sessions);
}

export function progressOf(run: WorkoutRun): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of run.exercises) {
    total += ex.sets.length;
    done += ex.sets.filter((s) => s.done).length;
  }
  return { done, total };
}

function updateExercise(run: WorkoutRun, index: number, fn: (ex: RunExercise) => RunExercise): WorkoutRun {
  return { ...run, exercises: run.exercises.map((ex, i) => (i === index ? fn(ex) : ex)) };
}

/**
 * Marca ou desmarca uma série. Marcar começa o descanso e, se o exercício
 * terminou, passa para o próximo que ainda tem séries a fazer.
 */
export function toggleSet(run: WorkoutRun, ei: number, si: number, now: number): WorkoutRun {
  const ex = run.exercises[ei];
  const set = ex?.sets[si];
  if (!ex || !set) return run;
  const done = !set.done;
  let next = updateExercise(run, ei, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, done } : s)) }));
  if (!done) return next;

  const updated = next.exercises[ei]!;
  const finishedAll = progressOf(next).done === progressOf(next).total;
  if (ex.restSec > 0 && !finishedAll) {
    next = { ...next, restEndsAt: now + ex.restSec * 1000, restTotalMs: ex.restSec * 1000 };
  }
  if (updated.sets.every((s) => s.done)) {
    const order = [...next.exercises.keys()].map((k) => (ei + 1 + k) % next.exercises.length);
    const pending = order.find((k) => next.exercises[k]!.sets.some((s) => !s.done));
    if (pending !== undefined) next = { ...next, current: pending };
  }
  return next;
}

export function editSet(run: WorkoutRun, ei: number, si: number, patch: Partial<Pick<RunSet, 'reps' | 'load'>>): WorkoutRun {
  return updateExercise(run, ei, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
}

/** Nova série igual à última (carga e repetições), ainda não feita. */
export function addSet(run: WorkoutRun, ei: number): WorkoutRun {
  return updateExercise(run, ei, (e) => {
    const last = e.sets.at(-1);
    return { ...e, sets: [...e.sets, { reps: last?.reps ?? 10, load: last?.load ?? null, done: false }] };
  });
}

export function removeSet(run: WorkoutRun, ei: number, si: number): WorkoutRun {
  return updateExercise(run, ei, (e) => (e.sets.length > 1 ? { ...e, sets: e.sets.filter((_, i) => i !== si) } : e));
}

export function addExercise(run: WorkoutRun, exercise: RunExercise): WorkoutRun {
  return { ...run, exercises: [...run.exercises, exercise], current: run.exercises.length };
}

export function removeExercise(run: WorkoutRun, ei: number): WorkoutRun {
  const exercises = run.exercises.filter((_, i) => i !== ei);
  return { ...run, exercises, current: Math.min(run.current, Math.max(0, exercises.length - 1)) };
}

/** A sessão para salvar: só as séries feitas; exercícios sem nenhuma ficam de fora. */
export function toSessionInput(
  run: WorkoutRun,
  extra: Pick<WorkoutSessionInput, 'durationMin' | 'intensity' | 'notes'>,
): WorkoutSessionInput {
  const exercises = run.exercises
    .map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets.filter((s) => s.done).map((s) => (s.load ? { reps: s.reps, load: s.load } : { reps: s.reps })),
    }))
    .filter((ex) => ex.sets.length);
  return {
    date: run.date,
    kind: run.kind,
    label: run.label,
    ...extra,
    ...(run.planId && { planId: run.planId }),
    ...(exercises.length && { exercises }),
  };
}
