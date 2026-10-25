import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDaysISO, type ISODate } from '@/lib/dates';
import type { AgendaEvent } from '@/shared/agenda';
import { api } from '@/features/sync/api';
import { useAuthStore } from '@/features/sync/authStore';

/**
 * Compromissos do Google Calendar, guardados por semana (segunda-feira). Usados
 * pela tela Hoje, pelo planejamento da semana e pelo Modo Painel. Ficam no
 * aparelho para abrir sem internet mostrando a última leitura.
 */

export interface AgendaWeek {
  /** false: o servidor não tem GOOGLE_ICAL_URL. */
  configured: boolean;
  events: AgendaEvent[];
  fetchedAt: number;
}

interface AgendaStore {
  weeks: Record<ISODate, AgendaWeek>;
  setWeek: (monday: ISODate, week: AgendaWeek) => void;
}

/** Semanas guardadas no aparelho (as mais recentes). */
const KEEP_WEEKS = 6;

export const useAgendaStore = create<AgendaStore>()(
  persist(
    (set) => ({
      weeks: {},
      setWeek: (monday, week) =>
        set((s) => {
          const weeks = { ...s.weeks, [monday]: week };
          const keep = Object.keys(weeks)
            .sort((a, b) => weeks[b]!.fetchedAt - weeks[a]!.fetchedAt)
            .slice(0, KEEP_WEEKS);
          return { weeks: Object.fromEntries(keep.map((k) => [k, weeks[k]!])) };
        }),
    }),
    { name: 'sisifo:agenda', version: 1 },
  ),
);

/** Agenda muda pouco: 5 minutos bastam e poupam o aparelho e o Google. */
const REFRESH_MS = 5 * 60 * 1000;
const inFlight = new Set<ISODate>();

async function refreshWeek(monday: ISODate) {
  const last = useAgendaStore.getState().weeks[monday];
  const fresh = last && Date.now() - last.fetchedAt < REFRESH_MS - 5000;
  if (fresh || inFlight.has(monday) || document.visibilityState !== 'visible' || !navigator.onLine) return;
  inFlight.add(monday);
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await api.agenda(monday, timeZone, 7);
    useAgendaStore.getState().setWeek(monday, { configured: res.configured, events: res.events, fetchedAt: Date.now() });
  } catch {
    // Offline ou calendário fora: fica a última leitura.
  } finally {
    inFlight.delete(monday);
  }
}

/** Compromissos da semana que começa em `monday`, atualizados enquanto a tela está aberta (só com login). */
export function useAgendaWeek(monday: ISODate): AgendaWeek | null {
  const ready = useAuthStore((s) => s.phase === 'ready');
  const week = useAgendaStore((s) => s.weeks[monday] ?? null);

  useEffect(() => {
    if (!ready) return;
    const refresh = () => void refreshWeek(monday);
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [ready, monday]);

  return week;
}

/** Meia-noite local de um dia, em epoch ms. */
function localMidnight(day: ISODate): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

/** Eventos que acontecem (ao menos em parte) no dia local `day`. */
export function eventsOnLocalDay(events: AgendaEvent[], day: ISODate): AgendaEvent[] {
  const from = localMidnight(day);
  const to = localMidnight(addDaysISO(day, 1));
  return events.filter((e) => e.start < to && (e.end > from || (e.end === e.start && e.start >= from)));
}

/** Horas ocupadas por compromissos com horário no dia, recortando o que passa da meia-noite. */
export function busyHours(events: AgendaEvent[], day: ISODate): number {
  const from = localMidnight(day);
  const to = localMidnight(addDaysISO(day, 1));
  return events
    .filter((e) => !e.allDay)
    .reduce((sum, e) => sum + Math.max(0, Math.min(e.end, to) - Math.max(e.start, from)) / 3_600_000, 0);
}
