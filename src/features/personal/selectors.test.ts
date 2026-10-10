import { describe, expect, it } from 'vitest';
import { computeStreak, goalProgress, trainingStats } from './selectors';
import type { Goal, Habit, WorkoutSession } from './types';

const habit = (schedule: number[], completions: string[]): Habit => ({
  id: 'h',
  title: 'h',
  area: 'routine',
  schedule,
  completions,
  archived: false,
  createdAt: '2026-09-01T00:00:00Z',
});

// 2026-10-09 é sexta-feira.
const TODAY = '2026-10-09';

describe('computeStreak', () => {
  it('conta dias seguidos e não quebra se hoje ainda está pendente', () => {
    const h = habit([0, 1, 2, 3, 4, 5, 6], ['2026-10-06', '2026-10-07', '2026-10-08']);
    expect(computeStreak(h, TODAY).current).toBe(3);
  });

  it('inclui hoje quando já foi feito', () => {
    const h = habit([0, 1, 2, 3, 4, 5, 6], ['2026-10-07', '2026-10-08', '2026-10-09']);
    expect(computeStreak(h, TODAY).current).toBe(3);
  });

  it('quebra quando um dia previsto passou em branco', () => {
    const h = habit([0, 1, 2, 3, 4, 5, 6], ['2026-10-05', '2026-10-06', '2026-10-08']);
    expect(computeStreak(h, TODAY).current).toBe(1);
    expect(computeStreak(h, TODAY).best).toBe(2);
  });

  it('dias fora da agenda não quebram a sequência', () => {
    // seg, qua, sex
    const h = habit([1, 3, 5], ['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09']);
    expect(computeStreak(h, TODAY).current).toBe(4);
  });

  it('taxa de 30 dias considera só dias previstos', () => {
    const h = habit([1, 3, 5], ['2026-10-05', '2026-10-07']);
    // previstos desde a criação (01/09): 26 dias previstos até 08/10 + hoje pendente não conta
    const { rate30 } = computeStreak(h, TODAY);
    expect(rate30).not.toBeNull();
    expect(rate30!).toBeGreaterThan(0);
    expect(rate30!).toBeLessThan(0.2);
  });
});

describe('goalProgress', () => {
  it('fração de subtasks concluídas', () => {
    const goal = {
      subtasks: [
        { id: '1', title: 'a', done: true },
        { id: '2', title: 'b', done: false },
        { id: '3', title: 'c', done: true },
        { id: '4', title: 'd', done: false },
      ],
    } as Goal;
    expect(goalProgress(goal)).toBe(0.5);
    expect(goalProgress({ ...goal, subtasks: [] })).toBe(0);
  });
});

describe('trainingStats', () => {
  const s = (date: string): WorkoutSession => ({
    id: date,
    date,
    kind: 'strength',
    label: 'A',
    durationMin: 60,
    intensity: 3,
  });

  it('conta semanas ativas seguidas', () => {
    const sessions = [s('2026-09-22'), s('2026-09-29'), s('2026-10-06')];
    const stats = trainingStats([], sessions, TODAY);
    expect(stats.sessionsThisWeek).toBe(1);
    expect(stats.minutesThisWeek).toBe(60);
    expect(stats.activeWeeksStreak).toBe(3);
  });
});
