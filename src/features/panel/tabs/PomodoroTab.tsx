import { Link2, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import type { ISODate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { usePersonalStore } from '@/features/personal/store';
import { unlockAudio } from '../alarm';
import { ClockStrip } from '../components/ClockStrip';
import { Hill } from '../components/Hill';
import { NextUp } from '../components/NextUp';
import { minutesLabel } from '../format';
import { usePanelStore } from '../panelStore';
import { formatClock, PHASE_LABEL, progressAt, remainingAt } from '../pomodoro';
import { useNow } from '../useNow';

/** Redesenha a cada segundo só com o timer rodando. */
function useTimerNow() {
  const running = usePanelStore((s) => s.timer.status === 'running');
  return useNow(running ? 1000 : 60_000);
}

function TimerDigits() {
  const timer = usePanelStore((s) => s.timer);
  const now = useTimerNow();
  return (
    <p className="numerals pomo-timer text-(--phase)" role="timer" aria-live="off">
      {formatClock(remainingAt(timer, now))}
    </p>
  );
}

/** No foco a pedra sobe; na pausa ela rola de volta, a partir de onde o foco terminou. */
function TimerHill() {
  const timer = usePanelStore((s) => s.timer);
  const settings = usePanelStore((s) => s.settings.pomodoro);
  const now = useTimerNow();
  const done = progressAt(timer, settings, now);
  const at = timer.phase === 'focus' ? done : 1 - done;
  return <Hill at={at} label={`${PHASE_LABEL[timer.phase]}: ${Math.round(done * 100)}% da etapa`} />;
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
      aria-label={primary ? undefined : label}
      onClick={() => {
        unlockAudio();
        onClick();
      }}
      className={cn(
        'flex min-h-14 items-center justify-center gap-2 rounded-full text-lg font-semibold active:opacity-80',
        primary ? 'min-w-[9.5rem] bg-(--phase) px-6 text-bg' : 'min-w-14 text-ink-2 ring-1 ring-line ring-inset',
      )}
    >
      <Icon className="size-6" aria-hidden />
      {/* Secundários só com ícone: a linha de controles cabe em qualquer orientação. */}
      {primary && label}
    </button>
  );
}

function SetMarks() {
  const streak = usePanelStore((s) => s.timer.streak);
  const longEvery = usePanelStore((s) => Math.max(1, s.settings.pomodoro.longEvery));
  return (
    <span className="flex gap-1.5" role="img" aria-label={`${streak} de ${longEvery} focos até a pausa longa`}>
      {Array.from({ length: longEvery }, (_, i) => (
        <span key={i} className={cn('size-3 rounded-full ring-2 ring-(--focus) ring-inset', i < streak && 'bg-(--focus)')} />
      ))}
    </span>
  );
}

export function PomodoroTab({ today, onPickTask }: { today: ISODate; onPickTask: () => void }) {
  const phase = usePanelStore((s) => s.timer.phase);
  const status = usePanelStore((s) => s.timer.status);
  const taskId = usePanelStore((s) => s.timer.taskId);
  const cyclesToday = usePanelStore((s) => s.timer.cyclesToday);
  const focusMsToday = usePanelStore((s) => s.timer.focusMsToday);
  const focusOnTask = usePanelStore((s) => (taskId ? (s.focusByTask[taskId] ?? 0) : 0));
  const { startTimer, pauseTimer, skipTimer, resetTimer } = usePanelStore.getState();
  const task = usePersonalStore((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined));

  return (
    <div className={cn('pomo-scene', `phase-${phase}`)}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 [grid-area:head]">
        <ClockStrip />
        <p className="flex items-center gap-3 text-lg">
          <span className="font-semibold text-(--phase)">
            {PHASE_LABEL[phase]}
            {status === 'paused' && <span className="font-normal text-ink-3">, pausado</span>}
          </span>
          <SetMarks />
          <span className="text-ink-3">
            <span className="tabular">{cyclesToday}</span> hoje
          </span>
        </p>
      </header>

      <section className="flex min-h-0 flex-col items-center justify-center gap-[clamp(0.5rem,2vh,1.25rem)] [grid-area:timer]">
        <TimerDigits />
        <div className="flex items-center gap-4">
          <ControlButton icon={RotateCcw} label="Zerar" onClick={() => resetTimer()} />
          {status === 'running' ? (
            <ControlButton primary icon={Pause} label="Pausar" onClick={() => pauseTimer()} />
          ) : (
            <ControlButton primary icon={Play} label={status === 'paused' ? 'Continuar' : 'Iniciar'} onClick={() => startTimer()} />
          )}
          <ControlButton icon={SkipForward} label="Pular" onClick={() => skipTimer()} />
        </div>
      </section>

      <div className="-mx-3 [grid-area:hill]">
        <TimerHill />
      </div>

      <aside className="flex min-h-0 min-w-0 flex-col justify-center gap-3 [grid-area:info]">
        <NextUp today={today} variant="plain" />
        <button type="button" onClick={onPickTask} className="flex min-h-14 items-center gap-3 border-t border-line pt-3 text-left">
          <Link2 className="size-6 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0 flex-1">
            {task ? (
              <>
                <span className="block truncate text-lg font-medium">{task.title}</span>
                <span className="block text-base text-ink-3">{minutesLabel(focusOnTask)} de foco nesta tarefa</span>
              </>
            ) : (
              <>
                <span className="block text-lg text-ink-2">Ligar a uma tarefa</span>
                <span className="block text-base text-ink-3">{minutesLabel(focusMsToday)} de foco hoje</span>
              </>
            )}
          </span>
        </button>
      </aside>
    </div>
  );
}
