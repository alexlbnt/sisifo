import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/cn';
import { startOfWeekISO, type ISODate } from '@/lib/dates';
import { eventsOnLocalDay, useAgendaWeek } from '@/features/agenda/agendaStore';
import { classifyAgenda, mergeAgenda } from '@/features/panel/agenda';
import { hhmm } from '@/features/panel/format';
import { useNow } from '@/features/panel/useNow';

/**
 * Compromissos do Google Calendar no topo das tarefas de hoje: planejar o dia
 * vendo o que já está ocupado. Sem calendário configurado (ou sem eventos), some.
 */
export function TodayAgenda({ today, className }: { today: ISODate; className?: string }) {
  const week = useAgendaWeek(startOfWeekISO(today));
  const now = useNow(60_000);
  const items = useMemo(() => mergeAgenda(week ? eventsOnLocalDay(week.events, today) : [], [], today), [week, today]);
  if (!items.length) return null;
  const slots = classifyAgenda(items, now);

  return (
    <section aria-label="Compromissos de hoje" className={cn('rounded-xl bg-surface-2 px-3 py-2', className)}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <CalendarDays className="size-3.5" aria-hidden />
        Compromissos
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const slot = slots.get(item.id);
          return (
            <li key={item.id} className={cn('flex items-baseline gap-2 py-0.5 text-sm', slot === 'past' && 'text-ink-3')}>
              <span className="w-[6.5rem] shrink-0 text-xs text-ink-3 tabular">
                {item.allDay ? 'Dia todo' : `${hhmm(item.start)} às ${hhmm(item.end)}`}
              </span>
              <span className={cn('min-w-0 flex-1 truncate', slot === 'now' && 'font-semibold text-accent')}>{item.title}</span>
              {slot === 'now' && <span className="text-xs font-semibold text-accent">agora</span>}
              {slot === 'next' && <span className="text-xs font-medium text-ink-2">próximo</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
