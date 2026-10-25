import { useMemo } from 'react';
import { CalendarClock, MapPin } from 'lucide-react';
import type { ISODate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { usePersonalStore } from '@/features/personal/store';
import { headline, mergeAgenda, type AgendaItem } from '../agenda';
import { hhmm, untilLabel } from '../format';
import { usePanelStore } from '../panelStore';
import { useNow } from '../useNow';

/** Compromissos do Google e tarefas com horário de hoje, numa lista só. */
export function useTodayAgenda(today: ISODate): AgendaItem[] {
  const agenda = usePanelStore((s) => s.agenda);
  const tasks = usePersonalStore((s) => s.tasks);
  return useMemo(
    () => mergeAgenda(agenda?.date === today ? agenda.events : [], tasks, today),
    [agenda, tasks, today],
  );
}

interface NextUpProps {
  today: ISODate;
  /** card: destaque da Agenda. plain: texto solto, ao lado do Pomodoro. compact: uma linha, no relógio. */
  variant?: 'card' | 'plain' | 'compact';
  className?: string;
}

/** O que está acontecendo agora ou, senão, o próximo compromisso. */
export function NextUp({ today, variant = 'card', className }: NextUpProps) {
  const items = useTodayAgenda(today);
  const now = useNow(60_000);
  const top = headline(items, now);

  if (variant === 'compact') {
    if (!top) return null;
    return (
      <p className={cn('flex items-center gap-2 text-ink-2', className)}>
        <CalendarClock className="size-[1.2em] shrink-0" aria-hidden />
        <span className="line-clamp-2">
          {top.slot === 'now' ? 'Agora' : hhmm(top.item.start)}: {top.item.title}
        </span>
      </p>
    );
  }

  // "Próximo às 19:00, em 5h 31min" / "Agora, termina em 20 min".
  const when = top
    ? top.slot === 'now'
      ? `Agora, termina ${untilLabel(top.item.end - now)}`
      : `Próximo às ${hhmm(top.item.start)}, ${untilLabel(top.item.start - now)}`
    : null;

  return (
    <section
      aria-label="Próximo compromisso"
      className={cn(
        variant === 'card' && 'rounded-2xl border p-4',
        variant === 'card' && (top?.slot === 'now' ? 'border-accent bg-accent-soft' : 'border-line bg-surface'),
        className,
      )}
    >
      {top ? (
        <>
          <p className={cn('text-base', top.slot === 'now' ? 'font-semibold text-accent' : 'text-ink-3')}>{when}</p>
          <p className="mt-0.5 line-clamp-2 text-[1.375rem] leading-tight font-semibold">{top.item.title}</p>
          {top.item.location && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-base text-ink-3">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {top.item.location}
            </p>
          )}
        </>
      ) : (
        <p className="text-lg text-ink-3">Nada mais na agenda hoje.</p>
      )}
    </section>
  );
}
