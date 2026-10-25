import { describe, expect, it } from 'vitest';
import type { Task, WorkoutPlan } from '@/features/personal/types';
import { dayItems, ridgeLevels, ridgePath } from './weekRidge';

const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m).getTime();
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  area: 'routine',
  status: 'todo',
  date: '2026-10-26',
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});
const plan: WorkoutPlan = { id: 'p', label: 'Treino A', kind: 'strength', weekdays: [1], durationMin: 60 };

describe('visão da semana', () => {
  it('ordena dia inteiro, horários e treinos; tarefas sem horário viram contagem', () => {
    const { items, untimedTasks } = dayItems(
      [
        { id: 'r', title: 'Reunião', start: at(10), end: at(11), allDay: false },
        { id: 'f', title: 'Feriado', start: at(0), end: at(23, 59), allDay: true },
      ],
      [task('ligar', { time: '09:15' }), task('sem hora'), task('outra'), task('feita', { time: '08:00', status: 'done' })],
      [{ plan, done: false }],
    );
    expect(items.map((i) => [i.time, i.title])).toEqual([
      ['Dia todo', 'Feriado'],
      ['09:15', 'ligar'],
      ['10:00', 'Reunião'],
      [null, 'Treino A'],
    ]);
    expect(untimedTasks).toBe(2);
  });

  it('a serra usa o dia mais pesado (ou o limite de dia cheio) como topo', () => {
    expect(ridgeLevels([0, 4, 8])).toEqual([0, 0.5, 1]);
    expect(ridgeLevels([0, 5, 10])).toEqual([0, 0.5, 1]);
  });

  it('desenha um caminho fechado que cobre a largura toda', () => {
    const d = ridgePath([0, 1, 0.5], 300, 60);
    expect(d.startsWith('M0 60 L0 ')).toBe(true);
    expect(d.endsWith('L300 60 Z')).toBe(true);
    // O pico do dia mais pesado chega ao topo (y = 6).
    expect(d).toContain(' 150.0 6.0');
  });
});
