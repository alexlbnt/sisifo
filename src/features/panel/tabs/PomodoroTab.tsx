import { Link2, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import type { ISODate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { usePersonalStore } from '@/features/personal/store';
import { unlockAudio } from '../alarm';
import { NextUp } from '../components/NextUp';
import { minutesLabel } from '../format';
import { usePanelStore } from '../panelStore';
import { formatClock, PHASE_LABEL, progressAt, remainingAt } from '../pomodoro';
import { useNow } from '../useNow';

/** Só esta parte redesenha a cada segundo. */
function TimerFace() {
  const timer = usePanelStore((s) => s.timer);
  const settings = usePanelStore((s) => s.settings.pomodoro);
  const now = useNow(timer.status === 'running' ? 1000 : 60_000);
  const left = remainingAt(timer, now);
  return (
    <>
      <p className="pomo-timer text-(--phase)" role="timer" aria-live="off">
        {formatClock(left)}
      </p>
      <div className="pomo-bar w-full max-w-[36rem]" aria-hidden>
        <span style={{ transform: `scaleX(${progressAt(timer, settings, now)})` }} />
      </div>
    </>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio();
        onClick();
      }}
      className={cn(
        'flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-lg font-semibold active:opacity-80',
        primary ? 'min-w-[9rem] bg-(--phase) text-bg' : 'min-w-16 border border-line bg-surface text-ink-2',
      )}
    >
      <Icon className="size-6" aria-hidden />
      {/* Secundários só com ícone: a linha de controles cabe em qualquer orientação. */}
      <span className={cn(!primary && 'sr-only')}>{label}</span>
    </button>
  );
}

export function PomodoroTab({ today, onPickTask }: { today: ISODate; onPickTask: () => void }) {
  const timer = usePanelStore((s) => s.timer);
  const longEvery = usePanelStore((s) => s.settings.pomodoro.longEvery);
  const focusOnTask = usePanelStore((s) => (s.timer.taskId ? (s.focusByTask[s.timer.taskId] ?? 0) : 0));
  const { startTimer, pauseTimer, skipTimer, resetTimer } = usePanelStore.getState();
  const task = usePersonalStore((s) => (timer.taskId ? s.tasks.find((t) => t.id === timer.taskId) : undefined));

  const running = timer.status === 'running';
  const dots = Math.max(1, longEvery);

  return (
    <div className={cn('pomo-layout', `phase-${timer.phase}`)}>
      <section className="flex min-h-0 flex-col items-center justify-center gap-[clamp(0.5rem,2vh,1.25rem)]">
        <p className="rounded-full bg-(--phase-soft) px-4 py-1 text-lg font-semibold text-(--phase)">
          {PHASE_LABEL[timer.phase]}
          {timer.status === 'paused' && ' · pausado'}
        </p>
        <TimerFace />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ControlButton icon={RotateCcw} label="Zerar" onClick={() => resetTimer()} />
          {running ? (
            <ControlButton primary icon={Pause} label="Pausar" onClick={() => pauseTimer()} />
          ) : (
            <ControlButton
              primary
              icon={Play}
              label={timer.status === 'paused' ? 'Continuar' : 'Iniciar'}
              onClick={() => startTimer()}
            />
          )}
          <ControlButton icon={SkipForward} label="Pular" onClick={() => skipTimer()} />
        </div>
      </section>

      <aside className="flex min-h-0 flex-col justify-center gap-3">
        <NextUp today={today} />

        <button
          type="button"
          onClick={onPickTask}
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-left"
        >
          <Link2 className="size-6 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0 flex-1">
            {task ? (
              <>
                <span className="block truncate text-lg font-medium">{task.title}</span>
                <span className="block text-sm text-ink-3">{minutesLabel(focusOnTask)} de foco nesta tarefa</span>
              </>
            ) : (
              <span className="block text-lg text-ink-2">Ligar a uma tarefa</span>
            )}
          </span>
        </button>

        <div className="flex items-center gap-3 px-1">
          <span className="flex gap-1.5" aria-label={`${timer.streak} de ${dots} focos até a pausa longa`}>
            {Array.from({ length: dots }, (_, i) => (
              <span
                key={i}
                className={cn('size-3.5 rounded-full border-2 border-(--focus)', i < timer.streak && 'bg-(--focus)')}
              />
            ))}
          </span>
          <span className="text-base text-ink-2">
            <strong className="text-ink tabular">{timer.cyclesToday}</strong>{' '}
            {timer.cyclesToday === 1 ? 'ciclo' : 'ciclos'} hoje · {minutesLabel(timer.focusMsToday)}
          </span>
        </div>
      </aside>
    </div>
  );
}
