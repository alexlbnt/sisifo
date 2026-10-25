import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/cn';
import { hhmm } from '../format';
import { usePanelStore } from '../panelStore';
import { useNow } from '../useNow';
import { describeWeather } from '../weather';

/** Hora, data e clima numa faixa, ao lado do Pomodoro: o painel nunca fica sem relógio. */
export function ClockStrip({ className }: { className?: string }) {
  const now = useNow(60_000);
  const weather = usePanelStore((s) => s.weather);
  const fresh = weather && now - weather.fetchedAt < 3 * 60 * 60 * 1000 ? weather : null;
  const Icon = fresh ? describeWeather(fresh.code).icon : null;

  return (
    <div className={cn('flex items-end gap-x-4 gap-y-1 px-1', className)}>
      <p className="font-display text-[clamp(2.25rem,9vmin,4rem)] leading-none font-semibold tabular">{hhmm(now)}</p>
      <div className="min-w-0 pb-0.5">
        <p className="truncate text-lg leading-tight font-medium first-letter:uppercase">
          {format(now, "EEE, d 'de' MMM", { locale: ptBR })}
        </p>
        {fresh && Icon && (
          <p className="flex items-center gap-1.5 text-base leading-tight text-ink-2">
            <Icon className="size-[1.1em]" aria-hidden />
            <span className="tabular">{Math.round(fresh.temp)}°</span>
            <span className="truncate text-ink-3">
              {Math.round(fresh.min)}° / {Math.round(fresh.max)}°
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
