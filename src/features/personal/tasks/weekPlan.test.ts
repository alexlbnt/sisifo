import { describe, expect, it } from 'vitest';
import { withDate } from '../store';
import type { Task } from '../types';
import { dayLoad, loadLabel } from './weekPlan';

describe('carga do dia', () => {
  it('marca o dia cheio por tarefas, horas ou pela soma', () => {
    expect(dayLoad(6, 0, 0).heavy).toBe(true);
    expect(dayLoad(0, 6, 0).heavy).toBe(true);
    expect(dayLoad(4, 3, 2).heavy).toBe(true);
    expect(dayLoad(3, 2, 1).heavy).toBe(false);
  });

  it('descreve a carga em português', () => {
    expect(loadLabel(dayLoad(0, 0, 0))).toBe('');
    expect(loadLabel(dayLoad(1, 0, 0))).toBe('1 tarefa');
    expect(loadLabel(dayLoad(3, 2.5, 1))).toBe('3 tarefas, 2h30 de compromissos e treino');
    expect(loadLabel(dayLoad(0, 0.5, 2))).toBe('30 min de compromissos e 2 treinos');
    expect(loadLabel(dayLoad(0, 1.95, 0))).toBe('2h de compromissos');
  });
});

describe('adiar tarefas', () => {
  const task = (date: string, over: Partial<Task> = {}): Task => ({
    id: 't',
    title: 't',
    area: 'routine',
    status: 'todo',
    date,
    createdAt: '2026-10-01T00:00:00Z',
    ...over,
  });
  const TODAY = '2026-10-26';

  it('conta quando uma tarefa do dia ou atrasada vai para depois', () => {
    expect(withDate(task(TODAY), '2026-10-27', TODAY).postponed).toBe(1);
    expect(withDate(task('2026-10-20', { postponed: 2 }), TODAY, TODAY).postponed).toBe(3);
  });

  it('não conta reorganizar dias futuros, antecipar ou mexer em tarefa feita', () => {
    expect(withDate(task('2026-10-28'), '2026-10-30', TODAY).postponed).toBeUndefined();
    expect(withDate(task(TODAY), '2026-10-25', TODAY).postponed).toBeUndefined();
    expect(withDate(task(TODAY, { status: 'done' }), '2026-10-27', TODAY).postponed).toBeUndefined();
  });
});
