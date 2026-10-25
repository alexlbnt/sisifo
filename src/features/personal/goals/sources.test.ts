import { describe, expect, it } from 'vitest';
import { goalMetrics } from '../selectors';
import type { Goal, Habit, WorkoutSession } from '../types';
import { sourceValue } from './sources';

const session = (date: string, kind: WorkoutSession['kind'], load?: number): WorkoutSession => ({
  id: `${date}-${kind}`,
  date,
  kind,
  label: 'Treino',
  durationMin: 60,
  intensity: 3,
  ...(load && { exercises: [{ id: 'e', name: 'Supino Reto', sets: [{ reps: 5, load }, { reps: 8, load: load - 10 }] }] }),
});

const sessions = [
  session('2026-09-20', 'strength', 70),
  session('2026-10-02', 'strength', 75),
  session('2026-10-05', 'muay_thai'),
  session('2026-10-09', 'strength', 72.5),
];

const goal = (over: Partial<Goal>): Goal => ({
  id: 'g',
  title: 'Meta',
  horizon: 'short',
  area: 'training',
  subtasks: [],
  kind: 'numeric',
  target: 100,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

const habit: Habit = {
  id: 'h',
  title: 'Ler',
  area: 'routine',
  schedule: [0, 1, 2, 3, 4, 5, 6],
  completions: ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04'],
  archived: false,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const water: Habit = { ...habit, id: 'w', kind: 'quantity', target: 8, amounts: { '2026-09-30': 8, '2026-10-02': 5, '2026-10-03': 8 } };

const data = { sessions, habits: [habit, water] };

describe('metas que se atualizam sozinhas', () => {
  it('recorde de carga de um exercício, até a data', () => {
    const g = goal({ source: { type: 'exercise', exercise: 'supino reto' }, start: 60 });
    expect(sourceValue(g, g.source!, data, '2026-10-31')).toBe(75);
    expect(sourceValue(g, g.source!, data, '2026-09-30')).toBe(70);
    // Antes de qualquer carga, vale o ponto de partida.
    expect(sourceValue(g, g.source!, data, '2026-09-01')).toBe(60);
  });

  it('conta treinos desde a criação da meta, por modalidade', () => {
    const all = goal({ source: { type: 'workouts' } });
    const strength = goal({ source: { type: 'workouts', kind: 'strength' }, start: 10 });
    expect(sourceValue(all, all.source!, data, '2026-10-31')).toBe(3);
    expect(sourceValue(strength, strength.source!, data, '2026-10-31')).toBe(12);
  });

  it('soma marcações ou quantidades de um hábito desde a criação', () => {
    const days = goal({ source: { type: 'habit', habitId: 'h' } });
    const amount = goal({ source: { type: 'habit', habitId: 'w' } });
    expect(sourceValue(days, days.source!, data, '2026-10-31')).toBe(3);
    expect(sourceValue(amount, amount.source!, data, '2026-10-31')).toBe(13);
    expect(sourceValue(goal({ source: { type: 'habit', habitId: 'x' } }), { type: 'habit', habitId: 'x' }, data, '2026-10-31')).toBe(0);
  });

  it('entra no cálculo de progresso da meta', () => {
    const g = goal({ source: { type: 'exercise', exercise: 'Supino reto' }, start: 60, target: 80 });
    const metrics = goalMetrics(g, [], {
      today: '2026-10-31',
      sourceValue: (x, upTo) => (x.source ? sourceValue(x, x.source, data, upTo) : null),
    });
    expect(metrics.current).toBe(75);
    expect(metrics.progress).toBeCloseTo(0.75);
  });
});
