import type { ISODate } from '@/lib/dates';
import type { SetLog, WorkoutSession } from '../types';

/**
 * Evolução por exercício, a partir das séries registradas nas sessões.
 * O exercício é identificado pelo nome normalizado ("Supino reto" = "supino  RETO"),
 * para valer entre treinos diferentes da divisão e treinos avulsos.
 */

export function exerciseKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 1RM estimado (Epley). Uma repetição vale a própria carga. */
export function estimated1RM(set: SetLog): number {
  if (!set.load || set.reps <= 0) return 0;
  return set.reps === 1 ? set.load : set.load * (1 + set.reps / 30);
}

/** "62,5 kg", "Peso do corpo". */
export function formatLoad(load: number | undefined): string {
  if (!load) return 'Peso do corpo';
  return `${load.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
}

/** "60 kg × 8, 8, 7" (carga igual) ou "60×8, 62,5×6". */
export function formatSets(sets: SetLog[]): string {
  if (!sets.length) return '';
  const loads = new Set(sets.map((s) => s.load ?? 0));
  if (loads.size === 1) {
    const load = sets[0]!.load;
    return `${load ? formatLoad(load) + ' × ' : ''}${sets.map((s) => s.reps).join(', ')}${load ? '' : ' reps'}`;
  }
  return sets.map((s) => `${(s.load ?? 0).toLocaleString('pt-BR')}×${s.reps}`).join(', ');
}

const newestFirst = (a: WorkoutSession, b: WorkoutSession) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

/** Séries da última vez que o exercício foi feito (antes de `excludeId`, se for uma edição). */
export function lastPerformance(
  sessions: WorkoutSession[],
  name: string,
  excludeId?: string,
): { date: ISODate; sets: SetLog[] } | null {
  const key = exerciseKey(name);
  for (const session of [...sessions].sort(newestFirst)) {
    if (session.id === excludeId) continue;
    const found = session.exercises?.find((e) => exerciseKey(e.name) === key && e.sets.length);
    if (found) return { date: session.date, sets: found.sets };
  }
  return null;
}

export interface ExercisePoint {
  date: ISODate;
  sessionId: string;
  /** Maior carga da sessão e as repetições feitas com ela. */
  topLoad: number;
  topReps: number;
  best1RM: number;
  /** Soma de carga × repetições. */
  volume: number;
  sets: number;
}

/** Uma linha por sessão em que o exercício aparece, da mais antiga para a mais nova. */
export function exerciseHistory(sessions: WorkoutSession[], name: string): ExercisePoint[] {
  const key = exerciseKey(name);
  const points: ExercisePoint[] = [];
  for (const session of sessions) {
    const sets = session.exercises?.filter((e) => exerciseKey(e.name) === key).flatMap((e) => e.sets) ?? [];
    if (!sets.length) continue;
    let top = sets[0]!;
    for (const set of sets) if ((set.load ?? 0) > (top.load ?? 0) || ((set.load ?? 0) === (top.load ?? 0) && set.reps > top.reps)) top = set;
    points.push({
      date: session.date,
      sessionId: session.id,
      topLoad: top.load ?? 0,
      topReps: top.reps,
      best1RM: Math.max(...sets.map(estimated1RM)),
      volume: sets.reduce((sum, s) => sum + (s.load ?? 0) * s.reps, 0),
      sets: sets.length,
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

export interface ExerciseRecord {
  key: string;
  /** Nome como foi escrito da última vez. */
  name: string;
  bestLoad: { load: number; reps: number; date: ISODate } | null;
  best1RM: { value: number; date: ISODate } | null;
  /** Mais repetições numa série (útil para exercícios sem carga). */
  bestReps: { reps: number; date: ISODate };
  sessions: number;
  lastDate: ISODate;
}

/** Recordes de cada exercício, do feito mais recentemente para o mais antigo. */
export function exerciseRecords(sessions: WorkoutSession[]): ExerciseRecord[] {
  const byKey = new Map<string, ExerciseRecord>();
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const session of ordered) {
    const seen = new Set<string>();
    for (const exercise of session.exercises ?? []) {
      if (!exercise.sets.length) continue;
      const key = exerciseKey(exercise.name);
      const rec =
        byKey.get(key) ??
        ({ key, name: exercise.name, bestLoad: null, best1RM: null, bestReps: { reps: 0, date: session.date }, sessions: 0, lastDate: session.date } satisfies ExerciseRecord);
      rec.name = exercise.name;
      rec.lastDate = session.date;
      if (!seen.has(key)) rec.sessions++;
      seen.add(key);
      for (const set of exercise.sets) {
        const load = set.load ?? 0;
        if (load > 0 && (!rec.bestLoad || load > rec.bestLoad.load || (load === rec.bestLoad.load && set.reps > rec.bestLoad.reps))) {
          rec.bestLoad = { load, reps: set.reps, date: session.date };
        }
        const e1 = estimated1RM(set);
        if (e1 > 0 && (!rec.best1RM || e1 > rec.best1RM.value)) rec.best1RM = { value: e1, date: session.date };
        if (set.reps > rec.bestReps.reps) rec.bestReps = { reps: set.reps, date: session.date };
      }
      byKey.set(key, rec);
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
}

export type RecordKind = 'load' | '1rm' | 'reps';

/**
 * A série bate um recorde do exercício? Compara com o que havia antes (sem
 * contar a sessão em edição). Primeira vez no exercício não conta como recorde.
 */
export function recordFor(previous: ExerciseRecord | undefined, set: SetLog): RecordKind | null {
  if (!previous) return null;
  const load = set.load ?? 0;
  if (load > 0) {
    if (!previous.bestLoad || load > previous.bestLoad.load) return 'load';
    if (previous.best1RM && estimated1RM(set) > previous.best1RM.value + 0.01) return '1rm';
    return null;
  }
  return !previous.bestLoad && set.reps > previous.bestReps.reps ? 'reps' : null;
}

export const RECORD_LABEL: Record<RecordKind, string> = {
  load: 'Recorde de carga',
  '1rm': 'Recorde de força',
  reps: 'Recorde de repetições',
};
