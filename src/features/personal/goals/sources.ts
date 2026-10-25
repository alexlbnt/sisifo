import type { ISODate } from '@/lib/dates';
import { WORKOUT_KINDS } from '../meta';
import { exerciseKey } from '../training/progress';
import type { Goal, GoalSource, Habit, WorkoutSession } from '../types';

/**
 * Metas que se atualizam sozinhas: o valor vem do treino ou dos hábitos, sem
 * registro manual. Funções puras, para o app e para a revisão semanal.
 */

export interface SourceData {
  sessions: WorkoutSession[];
  habits: Habit[];
}

/** Dia em que a meta começou a contar (contagens de treinos e hábitos partem daqui). */
const sinceOf = (goal: Goal): ISODate => goal.createdAt.slice(0, 10);

/** Maior carga já feita no exercício até a data (0 se nunca fez com carga). */
function bestLoad(sessions: WorkoutSession[], exercise: string, upTo: ISODate): number {
  const key = exerciseKey(exercise);
  let best = 0;
  for (const session of sessions) {
    if (session.date > upTo) continue;
    for (const ex of session.exercises ?? []) {
      if (exerciseKey(ex.name) !== key) continue;
      for (const set of ex.sets) if ((set.load ?? 0) > best) best = set.load ?? 0;
    }
  }
  return best;
}

/** Valor atual de uma meta com fonte, numa data. */
export function sourceValue(goal: Goal, source: GoalSource, data: SourceData, upTo: ISODate): number {
  const start = goal.start ?? 0;
  const since = sinceOf(goal);
  switch (source.type) {
    case 'exercise':
      return Math.max(start, bestLoad(data.sessions, source.exercise, upTo));
    case 'workouts':
      return (
        start +
        data.sessions.filter((s) => s.date >= since && s.date <= upTo && (!source.kind || s.kind === source.kind)).length
      );
    case 'habit': {
      const habit = data.habits.find((h) => h.id === source.habitId);
      if (!habit) return start;
      const inRange = (d: ISODate) => d >= since && d <= upTo;
      if (habit.kind === 'quantity') {
        return start + Object.entries(habit.amounts ?? {}).reduce((sum, [d, v]) => (inRange(d) ? sum + v : sum), 0);
      }
      return start + habit.completions.filter(inRange).length;
    }
  }
}

/** Unidade sugerida para a fonte (o formulário usa quando a pessoa não escolhe outra). */
export function sourceUnit(source: GoalSource, habits: Habit[]): string {
  if (source.type === 'exercise') return 'kg';
  if (source.type === 'workouts') return 'treinos';
  return habits.find((h) => h.id === source.habitId)?.unit || 'dias';
}

/** "Recorde de carga no Supino reto", para mostrar no cartão da meta. */
export function sourceLabel(source: GoalSource, habits: Habit[]): string {
  if (source.type === 'exercise') return `Recorde de carga em ${source.exercise}`;
  if (source.type === 'workouts') return source.kind ? `Treinos de ${WORKOUT_KINDS[source.kind]} registrados` : 'Treinos registrados';
  const habit = habits.find((h) => h.id === source.habitId);
  return habit ? `Hábito "${habit.title}"` : 'Hábito removido';
}
