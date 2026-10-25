import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CalendarDays, Clock, ListChecks, Settings, Timer, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/cn';
import { startOfWeekISO, toISODate } from '@/lib/dates';
import { useAgendaWeek } from '@/features/agenda/agendaStore';
import { useFinanceStore } from '@/features/finance/store';
import { useAuthStore } from '@/features/sync/authStore';
import { LoginScreen } from '@/features/sync/LoginScreen';
import { playAlarm } from './alarm';
import { PanelSettings } from './components/PanelSettings';
import { TaskPicker } from './components/TaskPicker';
import { isNight } from './night';
import { isTimerActive, PANEL_TABS, usePanelStore, type PanelTab } from './panelStore';
import { AgendaTab } from './tabs/AgendaTab';
import { ClockView } from './tabs/ClockView';
import { PomodoroTab } from './tabs/PomodoroTab';
import { TasksTab } from './tabs/TasksTab';
import { useFreeRotation } from './useFreeRotation';
import { useNow } from './useNow';
import { useWakeLock } from './useWakeLock';
import { useWeatherRefresh } from './weather';

const TAB_META: Record<PanelTab, { label: string; icon: LucideIcon }> = {
  pomodoro: { label: 'Pomodoro', icon: Timer },
  agenda: { label: 'Agenda', icon: CalendarDays },
  tasks: { label: 'Tarefas', icon: ListChecks },
};

/** Distância mínima (px) do gesto lateral que troca de aba. */
const SWIPE_PX = 60;
/** Com o Pomodoro rodando, volta para ele depois deste tempo sem toque. */
const RETURN_TO_TIMER_MS = 20_000;
/** Etapa que terminou há mais que isso (tela suspensa) não toca alerta ao acordar. */
const LATE_ALARM_MS = 2 * 60 * 1000;

/* ───────── Motor do timer ───────── */

/** Agenda um despertador para o fim exato da etapa e resolve o que venceu ao voltar à tela. */
function useTimerEngine(today: string) {
  const endsAt = usePanelStore((s) => (s.timer.status === 'running' ? s.timer.endsAt : null));

  useEffect(() => {
    const settle = () => {
      const ended = usePanelStore.getState().tickTimer();
      const last = ended.at(-1);
      if (last && Date.now() - last.at < LATE_ALARM_MS) playAlarm(last.phase, usePanelStore.getState().settings);
    };
    settle();
    const onVisibility = () => document.visibilityState === 'visible' && settle();
    document.addEventListener('visibilitychange', onVisibility);
    // setTimeout é só o despertador; a hora certa vem de endsAt.
    const timer = endsAt === null ? undefined : setTimeout(settle, Math.max(0, endsAt - Date.now()) + 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [endsAt, today]);
}

/* ───────── Tema por horário ───────── */

const BAR_COLOR = { light: '#eceee9', dark: '#000000' } as const;

function usePanelTheme(now: number) {
  const { theme, darkFrom, darkTo } = usePanelStore((s) => s.settings);
  const d = new Date(now);
  const dark = theme === 'dark' || (theme === 'auto' && isNight(d.getHours() * 60 + d.getMinutes(), darkFrom, darkTo));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[dark ? 'dark' : 'light']);
  }, [dark]);
}

/* ───────── Atualização silenciosa ───────── */

/** O painel não tem quem toque em "Atualizar": instala a versão nova quando está ocioso no relógio. */
function useQuietUpdate(idle: boolean) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => navigator.onLine && registration.update(), 60 * 60 * 1000);
    },
  });
  useEffect(() => {
    if (needRefresh && idle) void updateServiceWorker(true);
  }, [needRefresh, idle, updateServiceWorker]);
}

/* ───────── Painel ───────── */

function NavButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'grid min-h-12 min-w-12 flex-1 place-items-center rounded-xl landscape:flex-none landscape:px-1',
        active ? 'text-accent' : 'text-ink-3 opacity-70',
      )}
    >
      <Icon className="size-6" aria-hidden />
    </button>
  );
}

function PanelShell() {
  useWakeLock();
  useFreeRotation();
  useWeatherRefresh();
  const minute = useNow(60_000);
  const today = toISODate(new Date(minute));
  usePanelTheme(minute);
  useAgendaWeek(startOfWeekISO(today));
  useTimerEngine(today);

  const status = usePanelStore((s) => s.timer.status);
  const taskId = usePanelStore((s) => s.timer.taskId);
  const [tab, setTab] = useState<PanelTab>('pomodoro');
  const [clock, setClock] = useState(false);
  const [overlay, setOverlay] = useState<'settings' | 'picker' | null>(null);
  useQuietUpdate(clock && status === 'idle');

  // Estado lido pelo laço de ociosidade sem redesenhar o painel a cada segundo.
  const lastTouch = useRef(Date.now());
  const lastSwitch = useRef(Date.now());
  const view = useRef({ tab, clock, overlay });
  view.current = { tab, clock, overlay };

  const goTo = (next: PanelTab) => {
    setTab(next);
    lastSwitch.current = Date.now();
  };
  const step = (dir: 1 | -1) => {
    const i = PANEL_TABS.indexOf(view.current.tab);
    goTo(PANEL_TABS[(i + dir + PANEL_TABS.length) % PANEL_TABS.length]!);
  };

  // Começou o Pomodoro (inclusive por outro caminho): o painel vai para ele.
  useEffect(() => {
    if (status === 'running') {
      setClock(false);
      setTab('pomodoro');
    }
  }, [status]);

  useEffect(() => {
    const touched = () => {
      lastTouch.current = Date.now();
    };
    window.addEventListener('pointerdown', touched, { capture: true, passive: true });
    window.addEventListener('keydown', touched, { capture: true });

    // Um laço leve: só compara horários; muda o estado apenas quando precisa.
    const loop = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const { settings, timer } = usePanelStore.getState();
      const { tab: current, clock: inClock, overlay: open } = view.current;
      if (open || inClock) return;
      const now = Date.now();
      const idleFor = now - lastTouch.current;

      if (!isTimerActive(timer) && settings.idleMin > 0 && idleFor >= settings.idleMin * 60_000) {
        setClock(true);
        return;
      }
      if (timer.status === 'running') {
        if (current !== 'pomodoro' && idleFor >= RETURN_TO_TIMER_MS) goTo('pomodoro');
        return;
      }
      if (timer.status === 'paused' || !settings.rotate) return;
      if (now - Math.max(lastTouch.current, lastSwitch.current) >= settings.rotateSec * 1000) step(1);
    }, 1000);

    return () => {
      clearInterval(loop);
      window.removeEventListener('pointerdown', touched, { capture: true });
      window.removeEventListener('keydown', touched, { capture: true });
    };
    // Roda uma vez: goTo e step só usam refs e setters estáveis.
  }, []);

  // Gesto lateral: troca de aba. Vertical fica com a rolagem das listas.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    swipe.current = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
  };
  const onPointerUp = (e: PointerEvent) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from || overlay) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  return (
    <div className="panel panel-shell">
      <main
        className="panel-main p-3"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        <div key={tab} className="panel-fade h-full">
          {tab === 'pomodoro' && <PomodoroTab today={today} onPickTask={() => setOverlay('picker')} />}
          {tab === 'agenda' && <AgendaTab today={today} />}
          {tab === 'tasks' && <TasksTab today={today} />}
        </div>

        {clock && (
          <ClockView
            today={today}
            onExit={() => {
              lastTouch.current = Date.now();
              setClock(false);
            }}
          />
        )}
        {overlay === 'picker' && (
          <TaskPicker
            today={today}
            selected={taskId}
            onClose={() => setOverlay(null)}
            onPick={(id) => {
              usePanelStore.getState().linkTask(id);
              setOverlay(null);
            }}
          />
        )}
        {overlay === 'settings' && <PanelSettings onClose={() => setOverlay(null)} />}
      </main>

      <nav className="panel-nav p-1" aria-label="Abas do painel">
        {PANEL_TABS.map((t) => (
          <NavButton
            key={t}
            icon={TAB_META[t].icon}
            label={TAB_META[t].label}
            active={!clock && !overlay && tab === t}
            onClick={() => {
              setClock(false);
              setOverlay(null);
              goTo(t);
            }}
          />
        ))}
        <NavButton icon={Clock} label="Relógio" active={clock} onClick={() => setClock((c) => !c)} />
        <NavButton icon={Settings} label="Ajustes" active={overlay === 'settings'} onClick={() => setOverlay((o) => (o === 'settings' ? null : 'settings'))} />
      </nav>
    </div>
  );
}

/** Raiz do Modo Painel (entrada painel.html). Mesmo login e mesmos dados do Sísifo. */
export function PanelApp() {
  const phase = useAuthStore((s) => s.phase);
  const check = useAuthStore((s) => s.check);
  const syncRecurring = useFinanceStore((s) => s.syncRecurring);

  useEffect(() => {
    void check();
    syncRecurring();
  }, [check, syncRecurring]);

  if (phase === 'checking') {
    return (
      <div className="grid h-dvh place-items-center bg-bg" aria-label="Carregando">
        <Logo />
      </div>
    );
  }
  if (phase === 'locked') return <LoginScreen />;
  return <PanelShell />;
}
