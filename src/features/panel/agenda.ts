import type { ISODate } from '@/lib/dates';
import type { Task } from '@/features/personal/types';
import type { AgendaEvent } from '@/shared/agenda';

/** Um item da aba Agenda: evento do Google Calendar ou tarefa do Sísifo com horário. */
export interface AgendaItem {
  id: string;
  title: string;
  start: number;
  /** Tarefas não têm duração: `end === start`. */
  end: number;
  allDay: boolean;
  source: 'calendar' | 'task';
  location?: string;
  done?: boolean;
}

export type AgendaSlot = 'allDay' | 'past' | 'now' | 'next' | 'later';

/** Instante local de "HH:MM" em `day`. */
function localTime(day: ISODate, time: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min).getTime();
}

/** Junta eventos e tarefas com horário do dia, em ordem (dia inteiro primeiro). */
export function mergeAgenda(events: AgendaEvent[], tasks: Task[], day: ISODate): AgendaItem[] {
  const fromTasks: AgendaItem[] = tasks
    .filter((t) => t.date === day && t.time)
    .map((t) => {
      const at = localTime(day, t.time!);
      return { id: `task:${t.id}`, title: t.title, start: at, end: at, allDay: false, source: 'task', done: t.status === 'done' };
    });
  const fromCalendar: AgendaItem[] = events.map((e) => ({ ...e, source: 'calendar' }));
  return [...fromCalendar, ...fromTasks].sort(
    (a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start || a.title.localeCompare(b.title),
  );
}

/**
 * Situação de cada item agora. "Agora": em andamento. "Próximo": o primeiro que
 * ainda vai começar (podem ser vários, se começam no mesmo horário).
 */
export function classifyAgenda(items: AgendaItem[], now: number): Map<string, AgendaSlot> {
  const slots = new Map<string, AgendaSlot>();
  const upcoming = items.filter((i) => !i.allDay && !i.done && i.start > now);
  const nextStart = upcoming.length ? Math.min(...upcoming.map((i) => i.start)) : null;
  for (const item of items) {
    let slot: AgendaSlot;
    if (item.allDay) slot = 'allDay';
    else if (item.start <= now && now < item.end) slot = 'now';
    else if (item.start > now && !item.done) slot = item.start === nextStart ? 'next' : 'later';
    else slot = item.start > now ? 'later' : 'past';
    slots.set(item.id, slot);
  }
  return slots;
}

/** O que mostrar em destaque: o que está acontecendo, senão o próximo. */
export function headline(items: AgendaItem[], now: number): { item: AgendaItem; slot: 'now' | 'next' } | null {
  const slots = classifyAgenda(items, now);
  const current = items.find((i) => slots.get(i.id) === 'now');
  if (current) return { item: current, slot: 'now' };
  const next = items.find((i) => slots.get(i.id) === 'next');
  return next ? { item: next, slot: 'next' } : null;
}
