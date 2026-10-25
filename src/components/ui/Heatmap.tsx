import { useEffect, useRef, useState } from 'react';
import { addDaysISO, fmt, startOfWeekISO, todayISO, type ISODate } from '@/lib/dates';
import { cn } from '@/lib/cn';

export type HeatState = 'done' | 'missed' | 'off' | 'future';

interface HeatmapProps {
  weeks: number;
  state: (date: ISODate) => HeatState;
  /** Texto do tooltip de cada célula. */
  describe?: (date: ISODate, state: HeatState) => string;
  label: string;
  cellClassName?: string;
  /** Mostra as semanas mais recentes que couberem na largura, até `weeks`. */
  fit?: boolean;
}

/** Largura de uma coluna: célula de 10px + 3px de espaço. */
const COLUMN_PX = 13;

/** Quantas semanas cabem no elemento (só no modo `fit`). */
function useFittingWeeks(max: number, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(max);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      setWeeks(Math.max(4, Math.min(max, Math.floor((width + 3) / COLUMN_PX))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [max, enabled]);
  return { ref, weeks: enabled ? weeks : max };
}

const STATE_CLASS: Record<HeatState, string> = {
  done: 'bg-accent',
  missed: 'bg-slope',
  off: 'bg-transparent border border-dashed border-line',
  future: 'bg-transparent',
};

const ROW_LABELS = ['Seg', '', 'Qua', '', 'Sex', '', ''];

/** Grade estilo GitHub: colunas são semanas (seg→dom), da mais antiga para a atual. */
export function Heatmap({ weeks: maxWeeks, state, describe, label, cellClassName, fit = false }: HeatmapProps) {
  const { ref, weeks } = useFittingWeeks(maxWeeks, fit);
  const today = todayISO();
  const firstMonday = addDaysISO(startOfWeekISO(today), -7 * (weeks - 1));
  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDaysISO(firstMonday, w * 7 + d)),
  );

  return (
    <div className="flex gap-1.5" role="img" aria-label={label}>
      <div className="flex flex-col gap-[3px] pr-0.5 text-[10px] leading-none text-ink-3" aria-hidden>
        {ROW_LABELS.map((l, i) => (
          <span key={i} className={cn('flex h-2.5 items-center', cellClassName)}>
            {l}
          </span>
        ))}
      </div>
      <div ref={ref} className={cn('flex gap-[3px] overflow-hidden', fit && 'min-w-0 flex-1')}>
        {columns.map((days) => (
          <div key={days[0]} className="flex shrink-0 flex-col gap-[3px]">
            {days.map((date) => {
              const s = date > today ? 'future' : state(date);
              return (
                <span
                  key={date}
                  title={describe ? describe(date, s) : fmt.short(date)}
                  className={cn(
                    'size-2.5 rounded-[3px]',
                    STATE_CLASS[s],
                    date === today && 'ring-1 ring-ink-3 ring-offset-1 ring-offset-surface',
                    cellClassName,
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
