import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/lib/dates';

export function scheduleLabel(schedule: number[]): string {
  if (schedule.length === 7) return 'Todos os dias';
  if (schedule.length === 5 && [1, 2, 3, 4, 5].every((d) => schedule.includes(d))) return 'Dias úteis';
  if (schedule.length === 2 && schedule.includes(0) && schedule.includes(6)) return 'Fins de semana';
  return WEEKDAY_ORDER.filter((d) => schedule.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ');
}
