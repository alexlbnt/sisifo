import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../types';
import {
  estimated1RM,
  exerciseHistory,
  exerciseKey,
  exerciseRecords,
  formatSets,
  lastPerformance,
  recordFor,
} from './progress';

const session = (id: string, date: string, exercises: WorkoutSession['exercises']): WorkoutSession => ({
  id,
  date,
  kind: 'strength',
  label: 'Treino A',
  durationMin: 60,
  intensity: 3,
  exercises,
});

const sessions = [
  session('s1', '2026-10-01', [{ id: 'e', name: 'Supino reto', sets: [{ reps: 8, load: 60 }, { reps: 8, load: 60 }] }]),
  session('s2', '2026-10-08', [
    { id: 'e', name: 'supino  RETO', sets: [{ reps: 6, load: 65 }, { reps: 5, load: 65 }] },
    { id: 'f', name: 'Barra fixa', sets: [{ reps: 8 }, { reps: 6 }] },
  ]),
  session('s3', '2026-10-15', [{ id: 'e', name: 'Supino reto', sets: [{ reps: 10, load: 62.5 }] }]),
  session('s4', '2026-10-16', undefined),
];

describe('exercícios', () => {
  it('reconhece o mesmo exercício com grafias diferentes', () => {
    expect(exerciseKey('  Supino   Réto ')).toBe(exerciseKey('supino reto'));
  });

  it('acha a última vez, pulando a sessão em edição', () => {
    expect(lastPerformance(sessions, 'SUPINO RETO')).toEqual({ date: '2026-10-15', sets: [{ reps: 10, load: 62.5 }] });
    expect(lastPerformance(sessions, 'Supino reto', 's3')?.date).toBe('2026-10-08');
    expect(lastPerformance(sessions, 'Agachamento')).toBeNull();
  });

  it('monta o histórico com a maior carga de cada sessão', () => {
    const h = exerciseHistory(sessions, 'Supino reto');
    expect(h.map((p) => [p.date, p.topLoad, p.topReps, p.volume])).toEqual([
      ['2026-10-01', 60, 8, 960],
      ['2026-10-08', 65, 6, 715],
      ['2026-10-15', 62.5, 10, 625],
    ]);
  });

  it('calcula recordes de carga, força e repetições', () => {
    const records = exerciseRecords(sessions);
    expect(records.map((r) => r.name)).toEqual(['Supino reto', 'Barra fixa']);
    const supino = records[0]!;
    expect(supino.bestLoad).toEqual({ load: 65, reps: 6, date: '2026-10-08' });
    // 62,5 × 10 → 83,3 de 1RM estimado, acima de 65 × 6 (78).
    expect(supino.best1RM?.date).toBe('2026-10-15');
    expect(supino.sessions).toBe(3);
    expect(records[1]!.bestReps.reps).toBe(8);
  });

  it('diz quando uma série bate recorde', () => {
    const [supino, barra] = exerciseRecords(sessions);
    expect(recordFor(supino, { reps: 3, load: 67.5 })).toBe('load');
    expect(recordFor(supino, { reps: 12, load: 62.5 })).toBe('1rm');
    expect(recordFor(supino, { reps: 8, load: 60 })).toBeNull();
    expect(recordFor(barra, { reps: 9 })).toBe('reps');
    expect(recordFor(undefined, { reps: 9, load: 100 })).toBeNull();
  });

  it('formata cargas e séries', () => {
    expect(estimated1RM({ reps: 1, load: 100 })).toBe(100);
    expect(formatSets([{ reps: 8, load: 60 }, { reps: 7, load: 60 }])).toBe('60 kg × 8, 7');
    expect(formatSets([{ reps: 10 }, { reps: 8 }])).toBe('10, 8 reps');
    expect(formatSets([{ reps: 8, load: 60 }, { reps: 6, load: 62.5 }])).toBe('60×8, 62,5×6');
  });
});
