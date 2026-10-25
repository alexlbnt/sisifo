import { CalendarOff, CircleCheck, ListTodo } from 'lucide-react';
import { fmt, startOfWeekISO, type ISODate } from '@/lib/dates';
import { useAgendaStore } from '@/features/agenda/agendaStore';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/features/sync/authStore';
import { classifyAgenda, type AgendaSlot } from '../agenda';
import { NextUp, useTodayAgenda } from '../components/NextUp';
import { hhmm } from '../format';
import { useNow } from '../useNow';

const SLOT_STYLE: Record<AgendaSlot, string> = {
  allDay: 'border-line bg-surface-2',
  past: 'border-transparent opacity-50',
  now: 'border-accent bg-accent-soft',
  next: 'border-ink-3 bg-surface',
  later: 'border-line bg-surface',
};

function AgendaNotice({ today }: { today: ISODate }) {
  const phase = useAuthStore((s) => s.phase);
  const agenda = useAgendaStore((s) => s.weeks[startOfWeekISO(today)]);
  let text: string | null = null;
  if (phase === 'local') text = 'Sem sincronização: mostrando só as tarefas com horário.';
  else if (agenda && !agenda.configured) text = 'Google Calendar não configurado (GOOGLE_ICAL_URL).';
  else if (agenda && Date.now() - agenda.fetchedAt > 30 * 60 * 1000) text = `Agenda lida às ${hhmm(agenda.fetchedAt)}.`;
  return text ? <p className="px-1 text-sm text-ink-3">{text}</p> : null;
}

export function AgendaTab({ today }: { today: ISODate }) {
  const items = useTodayAgenda(today);
  const now = useNow(60_000);
  const slots = classifyAgenda(items, now);

  return (
    <div className="split-layout">
      <div className="flex min-h-0 flex-col justify-center gap-3">
        <h2 className="text-[clamp(1.5rem,5vmin,2.5rem)] leading-tight font-semibold first-letter:uppercase">
          {fmt.long(today)}
        </h2>
        <NextUp today={today} />
        <AgendaNotice today={today} />
      </div>

      <ol className="scroll-y flex min-h-0 flex-col gap-2 pb-2" aria-label="Agenda de hoje">
        {items.length === 0 && (
          <li className="flex items-center gap-3 rounded-2xl border border-line p-4 text-lg text-ink-2">
            <CalendarOff className="size-6 shrink-0" aria-hidden />
            Nenhum compromisso hoje.
          </li>
        )}
        {items.map((item) => {
          const slot = slots.get(item.id) ?? 'later';
          return (
            <li key={item.id} className={cn('flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-2', SLOT_STYLE[slot])}>
              <span className="w-[4.5ch] shrink-0 text-lg font-semibold tabular">
                {item.allDay ? 'Dia' : hhmm(item.start)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('line-clamp-2 block text-lg leading-snug', item.done && 'text-ink-3 line-through')}>{item.title}</span>
                {!item.allDay && item.end > item.start && (
                  <span className="block text-sm text-ink-3 tabular">até {hhmm(item.end)}</span>
                )}
              </span>
              {slot === 'now' && <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-semibold text-accent-ink">agora</span>}
              {slot === 'next' && <span className="rounded-full border border-ink-3 px-2.5 py-0.5 text-sm font-semibold">próximo</span>}
              {item.source === 'task' &&
                (item.done ? (
                  <CircleCheck className="size-5 shrink-0 text-income" aria-label="Tarefa concluída" />
                ) : (
                  <ListTodo className="size-5 shrink-0 text-ink-3" aria-label="Tarefa do Sísifo" />
                ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
