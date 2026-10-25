import { describe, expect, it } from 'vitest';
import type { WorkoutPlan, WorkoutSession } from '../types';
import { addSet, prefillSets, progressOf, runFromPlan, runFromSession, toggleSet, toSessionInput } from './workoutRun';

const NOW = Date.parse('2026-10-26T12:00:00Z');

const plan: WorkoutPlan = {
  id: 'pa',
  label: 'Treino A',
  kind: 'strength',
  weekdays: [1],
  durationMin: 60,
  exercises: [
    { id: 'x1', name: 'Supino reto', sets: 3, reps: '8-10', restSec: 90 },
    { id: 'x2', name: 'Tríceps corda', sets: 2, reps: '12', restSec: 0 },
  ],
};

const previous: WorkoutSession = {
  id: 's1',
  date: '2026-10-19',
  kind: 'strength',
  label: 'Treino A',
  durationMin: 60,
  intensity: 3,
  planId: 'pa',
  exercises: [{ id: 'x1', name: 'supino reto', sets: [{ reps: 8, load: 60 }, { reps: 7, load: 62.5 }] }],
};

describe('treino em andamento', () => {
  it('preenche com a última vez e completa com o alvo', () => {
    expect(prefillSets(3, '8-10', [{ reps: 8, load: 60 }, { reps: 7, load: 62.5 }])).toEqual([
      { reps: 8, load: 60, done: false },
      { reps: 7, load: 62.5, done: false },
      { reps: 7, load: 62.5, done: false },
    ]);
    expect(prefillSets(2, '12', undefined)).toEqual([
      { reps: 12, load: null, done: false },
      { reps: 12, load: null, done: false },
    ]);
  });

  it('monta o treino da divisão com o histórico', () => {
    const run = runFromPlan(plan, [previous], '2026-10-26', NOW);
    expect(run.exercises[0]!.last?.date).toBe('2026-10-19');
    expect(run.exercises[0]!.sets[1]).toEqual({ reps: 7, load: 62.5, done: false });
    expect(run.exercises[1]!.sets).toHaveLength(2);
    expect(progressOf(run)).toEqual({ done: 0, total: 5 });
  });

  it('marcar uma série começa o descanso e, no fim do exercício, passa ao próximo', () => {
    let run = runFromPlan(plan, [previous], '2026-10-26', NOW);
    run = toggleSet(run, 0, 0, NOW);
    expect(run.restEndsAt).toBe(NOW + 90_000);
    run = toggleSet(run, 0, 1, NOW + 1);
    run = toggleSet(run, 0, 2, NOW + 2);
    expect(run.current).toBe(1);
    // Exercício sem descanso configurado não inicia descanso.
    run = { ...run, restEndsAt: null };
    run = toggleSet(run, 1, 0, NOW + 3);
    expect(run.restEndsAt).toBeNull();
    // Desmarcar não mexe no descanso nem no exercício atual.
    expect(toggleSet(run, 1, 0, NOW + 4).exercises[1]!.sets[0]!.done).toBe(false);
  });

  it('a última série do treino não inicia descanso', () => {
    let run = runFromPlan({ ...plan, exercises: [plan.exercises![0]!] }, [], '2026-10-26', NOW);
    run = addSet(run, 0);
    for (let i = 0; i < 4; i++) run = { ...toggleSet(run, 0, i, NOW + i), restEndsAt: i < 3 ? null : run.restEndsAt };
    expect(run.restEndsAt).toBeNull();
    expect(progressOf(run)).toEqual({ done: 4, total: 4 });
  });

  it('salva só as séries feitas, sem carga quando é peso do corpo', () => {
    let run = runFromPlan(plan, [], '2026-10-26', NOW);
    run = toggleSet(run, 1, 0, NOW);
    const input = toSessionInput(run, { durationMin: 45, intensity: 4 });
    expect(input).toMatchObject({ planId: 'pa', date: '2026-10-26', durationMin: 45 });
    expect(input.exercises).toEqual([{ id: 'x2', name: 'Tríceps corda', sets: [{ reps: 12 }] }]);
    expect(toSessionInput(runFromPlan(null, [], '2026-10-26', NOW), { durationMin: 30, intensity: 2 }).exercises).toBeUndefined();
  });

  it('reabre uma sessão registrada para editar, com tudo marcado', () => {
    const run = runFromSession(previous, [previous], [plan], NOW);
    expect(run.editingId).toBe('s1');
    expect(run.exercises[0]).toMatchObject({ target: '8-10', restSec: 90 });
    expect(run.exercises[0]!.last).toBeUndefined();
    expect(progressOf(run)).toEqual({ done: 2, total: 2 });
  });
});
