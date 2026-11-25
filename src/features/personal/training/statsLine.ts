import type { WorkoutPlan, WorkoutSession } from '../types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Linha de números do card da semana: treinos e minutos da semana mostrada.
 * Sequência e "dias em 30" só fazem sentido na semana atual (`current`).
 */
export function weekStatsLine(
  week: Array<{ planned: WorkoutPlan[]; sessions: WorkoutSession[] }>,
  current: { streak: number; last30: number } | null,
): string {
  const sessions = week.flatMap((d) => d.sessions);
  const planned = week.reduce((n, d) => n + d.planned.length, 0);
  const minutes = sessions.reduce((n, s) => n + s.durationMin, 0);
  const parts = [
    planned ? `${sessions.length} de ${plural(planned, 'previsto', 'previstos')}` : plural(sessions.length, 'treino', 'treinos'),
    `${minutes} min`,
  ];
  if (current) parts.push(plural(current.streak, 'semana seguida', 'semanas seguidas'), `${plural(current.last30, 'dia', 'dias')} em 30`);
  return parts.join(' · ');
}
