import { describe, expect, it } from 'vitest';
import type { WorkoutPlan, WorkoutSession } from '../types';
import { weekStatsLine } from './statsLine';

const plan = (id: string): WorkoutPlan => ({ id, label: id, kind: 'strength', weekdays: [1], durationMin: 60 }) as WorkoutPlan;
const session = (date: string, min: number): WorkoutSession =>
  ({ id: date, date, kind: 'strength', label: 'A', durationMin: min, intensity: 3 }) as WorkoutSession;
const day = (date: string, planned: WorkoutPlan[], sessions: WorkoutSession[]) => ({ date, planned, sessions });

describe('weekStatsLine', () => {
  const week = [day('2026-11-16', [plan('A')], [session('2026-11-16', 50)]), day('2026-11-17', [plan('B')], [])];

  it('usa os números da semana mostrada, não os da semana atual', () => {
    expect(weekStatsLine(week, null)).toBe('1 de 2 previstos · 50 min');
  });

  it('na semana atual acrescenta a sequência e os últimos 30 dias', () => {
    expect(weekStatsLine(week, { streak: 3, last30: 1 })).toBe('1 de 2 previstos · 50 min · 3 semanas seguidas · 1 dia em 30');
  });

  it('acerta o singular e a semana sem previsto', () => {
    expect(weekStatsLine([day('2026-11-16', [plan('A')], [])], { streak: 1, last30: 6 })).toBe('0 de 1 previsto · 0 min · 1 semana seguida · 6 dias em 30');
    expect(weekStatsLine([day('2026-11-16', [], [session('2026-11-16', 40)])], null)).toBe('1 treino · 40 min');
  });
});
