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
  /** compact: uma linha, para o relógio. */
  variant?: 'card' | 'compact';
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
          {top.slot === 'now' ? 'Agora' : hhmm(top.item.start)} · {top.item.title}
        </span>
      </p>
    );
  }

  return (
    <section
      className={cn(
        'rounded-2xl border p-4',
        top?.slot === 'now' ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
        className,
      )}
      aria-label="Próximo compromisso"
    >
      <p className="text-sm font-semibold tracking-wide text-ink-3 uppercase">
        {top?.slot === 'now' ? 'Agora' : 'Próximo'}
      </p>
      {top ? (
        <>
          <p className="mt-1 line-clamp-2 text-xl leading-tight font-semibold">{top.item.title}</p>
          <p className="mt-1 text-base text-ink-2 tabular">
            {hhmm(top.item.start)}
            {top.item.end > top.item.start && ` – ${hhmm(top.item.end)}`}
            <span className="text-ink-3">
              {' · '}
              {top.slot === 'now' ? `termina ${untilLabel(top.item.end - now)}` : untilLabel(top.item.start - now)}
            </span>
          </p>
          {top.item.location && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-ink-3">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {top.item.location}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-lg text-ink-2">Nada mais na agenda hoje.</p>
      )}
    </section>
  );
}
