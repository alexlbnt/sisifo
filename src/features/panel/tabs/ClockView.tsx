import { fmt, type ISODate } from '@/lib/dates';
import { NextUp } from '../components/NextUp';
import { hhmm } from '../format';
import { usePanelStore } from '../panelStore';
import { useNow } from '../useNow';
import { describeWeather } from '../weather';

function Weather() {
  const weather = usePanelStore((s) => s.weather);
  // Leitura com mais de 3 horas não vale mais como "agora".
  if (!weather || Date.now() - weather.fetchedAt > 3 * 60 * 60 * 1000) return null;
  const { label, icon: Icon } = describeWeather(weather.code);
  return (
    <p className="flex items-center gap-3 text-[clamp(1.25rem,4.5vmin,2.25rem)]">
      <Icon className="size-[1.4em] shrink-0 text-ink-2" aria-hidden />
      <span className="font-semibold tabular">{Math.round(weather.temp)}°</span>
      <span className="text-ink-3">
        {label} · {Math.round(weather.min)}° / {Math.round(weather.max)}°
      </span>
    </p>
  );
}

/** Modo relógio/ambiente: hora grande, data, clima e o próximo compromisso. Tocar em qualquer lugar sai. */
export function ClockView({ today, onExit }: { today: ISODate; onExit: () => void }) {
  const now = useNow(60_000);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExit}
      onKeyDown={onExit}
      aria-label="Voltar ao painel"
      className="panel-fade absolute inset-0 z-10 bg-bg p-4"
    >
      <div className="clock-layout">
        <p className="clock-time tabular">{hhmm(now)}</p>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[clamp(1.5rem,5.5vmin,3rem)] leading-tight font-semibold first-letter:uppercase">
            {fmt.long(today)}
          </p>
          <Weather />
          <NextUp today={today} variant="compact" className="text-[clamp(1.1rem,4vmin,1.75rem)]" />
        </div>
      </div>
    </div>
  );
}
