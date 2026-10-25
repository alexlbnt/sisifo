import { describe, expect, it } from 'vitest';
import type { Task } from '@/features/personal/types';
import { classifyAgenda, headline, mergeAgenda } from './agenda';
import { isNight } from './night';
import { dueGroup, pendingByDue } from './tasks';

const DAY = '2026-10-26';
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00`).getTime();

const task = (over: Partial<Task>): Task => ({
  id: over.id ?? over.title ?? 't',
  title: 't',
  area: 'routine',
  status: 'todo',
  date: DAY,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

describe('agenda', () => {
  const events = [
    { id: 'a', title: 'Reunião', start: at('09:00'), end: at('10:00'), allDay: false },
    { id: 'b', title: 'Feriado', start: at('00:00'), end: at('23:59'), allDay: true },
    { id: 'c', title: 'Almoço', start: at('12:00'), end: at('13:00'), allDay: false },
  ];
  const tasks = [
    task({ id: '1', title: 'Ligar', time: '11:00' }),
    task({ id: '2', title: 'Sem hora' }),
    task({ id: '3', title: 'Ontem', time: '11:00', date: '2026-10-25' }),
  ];

  it('junta eventos e tarefas com horário do dia', () => {
    expect(mergeAgenda(events, tasks, DAY).map((i) => i.title)).toEqual(['Feriado', 'Reunião', 'Ligar', 'Almoço']);
  });

  it('marca agora e próximo', () => {
    const items = mergeAgenda(events, tasks, DAY);
    const slots = classifyAgenda(items, at('09:30'));
    expect(Object.fromEntries(slots)).toEqual({ b: 'allDay', a: 'now', 'task:1': 'next', c: 'later' });
    expect(headline(items, at('09:30'))?.item.id).toBe('a');
    expect(headline(items, at('10:30'))).toMatchObject({ slot: 'next', item: { id: 'task:1' } });
    expect(headline(items, at('14:00'))).toBeNull();
  });

  it('tarefa concluída não é a próxima', () => {
    const items = mergeAgenda([], [task({ id: '1', time: '11:00', status: 'done' }), task({ id: '2', time: '12:00' })], DAY);
    expect(headline(items, at('10:00'))?.item.id).toBe('task:2');
  });
});

describe('tarefas pendentes', () => {
  it('ordena por prazo, horário e prioridade, sem as concluídas', () => {
    const list = pendingByDue([
      task({ id: 'amanha', date: '2026-10-27' }),
      task({ id: 'hoje-sem-hora', priority: 'high' }),
      task({ id: 'hoje-8h', time: '08:00' }),
      task({ id: 'atrasada', date: '2026-10-20' }),
      task({ id: 'feita', status: 'done', date: '2026-10-01' }),
    ]);
    expect(list.map((t) => t.id)).toEqual(['atrasada', 'hoje-8h', 'hoje-sem-hora', 'amanha']);
    expect(list.map((t) => dueGroup(t, DAY))).toEqual(['overdue', 'today', 'today', 'upcoming']);
  });
});

describe('isNight', () => {
  it('faixa que vira a meia-noite', () => {
    expect(isNight(20 * 60, '19:00', '07:00')).toBe(true);
    expect(isNight(3 * 60, '19:00', '07:00')).toBe(true);
    expect(isNight(7 * 60, '19:00', '07:00')).toBe(false);
    expect(isNight(12 * 60, '19:00', '07:00')).toBe(false);
  });
  it('faixa no mesmo dia e faixa vazia', () => {
    expect(isNight(13 * 60, '12:00', '14:00')).toBe(true);
    expect(isNight(15 * 60, '12:00', '14:00')).toBe(false);
    expect(isNight(15 * 60, '10:00', '10:00')).toBe(false);
  });
});
