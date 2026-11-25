import { describe, expect, it } from 'vitest';
import { todayISO } from '@/lib/dates';
import { createPersonalMock } from '../mock';
import { activeWeightGoal, paceStatus } from './goal';
import { weeklyRate } from './trend';

describe('dados de exemplo: peso', () => {
  const mock = createPersonalMock();
  const today = todayISO();

  it('trazem ~4 meses de pesagens, 4 a 5 por semana, uma por dia', () => {
    const n = mock.bodyWeights.length;
    expect(n).toBeGreaterThanOrEqual(65);
    expect(n).toBeLessThanOrEqual(90);
    expect(new Set(mock.bodyWeights.map((w) => w.date)).size).toBe(n);
    expect(mock.bodyWeights.every((w) => w.id === w.date && w.date <= today)).toBe(true);
  });

  it('sobem no período e têm uma meta de peso com faixa de ritmo', () => {
    const sorted = [...mock.bodyWeights].sort((a, b) => a.date.localeCompare(b.date));
    expect(sorted.at(-1)!.kg - sorted[0]!.kg).toBeGreaterThan(2);
    expect(weeklyRate(mock.bodyWeights, today)).not.toBeNull();
    const goal = activeWeightGoal(mock.goals);
    expect(goal?.source).toEqual({ type: 'bodyweight', minPerWeek: 0.25, maxPerWeek: 0.5 });
    expect(paceStatus(goal!, mock.bodyWeights, today).state).not.toBe('noData');
  });
});
