import { describe, expect, it } from 'vitest';
import type { Goal, Task, WorkoutSession } from '@/features/personal/types';
import { weekHighlights, weekSummary, type SummaryInput } from './summary';

const MONDAY = '2026-10-19';
const TODAY = '2026-10-25';

const session = (date: string, load: number, reps = 8): WorkoutSession => ({
  id: date,
  date,
  kind: 'strength',
  label: 'Treino A',
  durationMin: 60,
  intensity: 3,
  exercises: [{ id: 'e', name: 'Supino reto', sets: [{ reps, load }] }],
});

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  area: 'routine',
  status: 'todo',
  date: '2026-10-20',
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const autoGoal: Goal = {
  id: 'g',
  title: 'Supino 100 kg',
  horizon: 'short',
  area: 'training',
  subtasks: [],
  kind: 'numeric',
  target: 100,
  unit: 'kg',
  source: { type: 'exercise', exercise: 'Supino reto' },
  createdAt: '2026-09-01T00:00:00Z',
};

const input = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  tasks: [],
  habits: [],
  plans: [],
  sessions: [],
  transactions: [],
  budgets: {},
  categoryOrder: [],
  goals: [],
  goalEntries: [],
  ...over,
});

describe('revisão que se preenche sozinha', () => {
  it('acha recordes da semana, sem contar a primeira vez', () => {
    const sessions = [session('2026-10-12', 70), session('2026-10-20', 75, 5), session('2026-10-22', 75, 6)];
    const s = weekSummary(MONDAY, TODAY, input({ sessions }));
    expect(s.records).toEqual([{ name: 'Supino reto', load: 75, reps: 6 }]);
    expect(weekSummary(MONDAY, TODAY, input({ sessions: sessions.slice(1) })).records).toEqual([]);
  });

  it('mede o avanço das metas automáticas na semana', () => {
    const values: Record<string, number> = { '2026-10-18': 70, '2026-10-25': 75 };
    const s = weekSummary(MONDAY, TODAY, input({ goals: [autoGoal], goalValue: (_g, upTo) => values[upTo] ?? null }));
    expect(s.goals).toEqual([{ goal: autoGoal, delta: 5 }]);
  });

  it('lista as tarefas adiadas três vezes ou mais', () => {
    const tasks = [task('a', { postponed: 3 }), task('b', { postponed: 5 }), task('c', { postponed: 2 }), task('d', { postponed: 4, status: 'done' })];
    expect(weekSummary(MONDAY, TODAY, input({ tasks })).stalled.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('escreve os destaques só com o que foi bom', () => {
    const s = weekSummary(MONDAY, TODAY, input({ sessions: [session('2026-10-12', 70), session('2026-10-20', 75)], goals: [autoGoal], goalValue: (_g, upTo) => (upTo < MONDAY ? 70 : 75) }));
    expect(weekHighlights(s, (g, d) => `${g.title}: +${d} kg.`)).toEqual([
      '1 treino, 60 minutos no total.',
      'Recorde em Supino reto: 75 kg × 8.',
      'Supino 100 kg: +5 kg.',
    ]);
  });
});

describe('destaques com muitos recordes', () => {
  it('juntam os recordes numa linha a partir de três', () => {
    const names = ['Supino reto', 'Remada', 'Agachamento'];
    const sessions = names.flatMap((name, i) => [
      { ...session(`2026-10-1${i}`, 50), id: `a${i}`, exercises: [{ id: name, name, sets: [{ reps: 8, load: 50 }] }] },
      { ...session(`2026-10-2${i}`, 55), id: `b${i}`, exercises: [{ id: name, name, sets: [{ reps: 8, load: 55 }] }] },
    ]);
    const lines = weekHighlights(weekSummary(MONDAY, TODAY, input({ sessions })), () => '');
    expect(lines).toContain('3 recordes: Supino reto (55 kg × 8), Remada (55 kg × 8), Agachamento (55 kg × 8).');
  });
});
