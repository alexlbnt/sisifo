import { useMemo } from 'react';
import { fmt, type ISODate } from '@/lib/dates';
import { usePersonalStore } from '@/features/personal/store';
import { Hill } from '@/components/ui/Hill';
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
      <span className="numerals text-[1.4em]">{Math.round(weather.temp)}°</span>
      <span className="text-ink-3">
        {label}, {Math.round(weather.min)}° a {Math.round(weather.max)}°
      </span>
    </p>
  );
}

/** A pedra do dia: quanto das tarefas de hoje já foi feito, como na tela Hoje do app. */
function DayHill({ today }: { today: ISODate }) {
  const tasks = usePersonalStore((s) => s.tasks);
  const [done, total] = useMemo(() => {
    const ofToday = tasks.filter((t) => t.date === today);
    return [ofToday.filter((t) => t.status === 'done').length, ofToday.length];
  }, [tasks, today]);
  if (!total) return null;
  return (
    <div className="hill-row -mx-4 -mb-4">
      <p className="px-4 text-lg text-ink-3">
        {done === total ? 'A pedra chegou ao topo: tudo feito hoje.' : `${done} de ${total} tarefas de hoje feitas`}
      </p>
      <Hill at={done / total} label={`${done} de ${total} tarefas de hoje feitas`} />
    </div>
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
      className="panel-fade absolute inset-0 z-10 overflow-hidden bg-bg p-4"
    >
      <div className="clock-layout">
        <p className="numerals clock-time">{hhmm(now)}</p>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[clamp(1.5rem,5.5vmin,3rem)] leading-tight font-semibold first-letter:uppercase">{fmt.long(today)}</p>
          <Weather />
          <NextUp today={today} variant="compact" className="text-[clamp(1.1rem,4vmin,1.75rem)]" />
        </div>
        <DayHill today={today} />
      </div>
    </div>
  );
}
