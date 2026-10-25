import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/cn';
import { hhmm } from '../format';
import { usePanelStore } from '../panelStore';
import { useNow } from '../useNow';
import { describeWeather } from '../weather';

/** Hora, data e clima numa linha: o painel nunca fica sem relógio. */
export function ClockStrip({ className }: { className?: string }) {
  const now = useNow(60_000);
  const weather = usePanelStore((s) => s.weather);
  const fresh = weather && now - weather.fetchedAt < 3 * 60 * 60 * 1000 ? weather : null;
  const Icon = fresh ? describeWeather(fresh.code).icon : null;

  return (
    <div className={cn('flex min-w-0 items-baseline gap-x-3', className)}>
      <p className="numerals text-[clamp(2rem,7vmin,3.25rem)]">{hhmm(now)}</p>
      <p className="truncate text-lg text-ink-2 first-letter:uppercase">{format(now, "EEE, d 'de' MMM", { locale: ptBR })}</p>
      {fresh && Icon && (
        <p className="flex shrink-0 items-center gap-1 self-center text-lg text-ink-2">
          <Icon className="size-[1.1em]" aria-label={describeWeather(fresh.code).label} />
          <span className="tabular">{Math.round(fresh.temp)}°</span>
        </p>
      )}
    </div>
  );
}
