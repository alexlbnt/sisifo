import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO } from '@/lib/dates';
import {
  applySettings,
  DEFAULT_POMODORO,
  initialPomodoro,
  pause,
  reset,
  skip,
  start,
  tick,
  type FocusCredit,
  type PomodoroSettings,
  type PomodoroState,
  type Transition,
} from './pomodoro';

/**
 * Estado do Modo Painel. Fica só neste aparelho (não sincroniza): ajustes,
 * Pomodoro em andamento, tempo de foco por tarefa e a última leitura do clima
 * (para abrir sem internet mostrando o que já se sabia). A agenda fica na
 * store compartilhada (features/agenda).
 */

export type PanelTab = 'pomodoro' | 'agenda' | 'tasks';
export const PANEL_TABS: PanelTab[] = ['pomodoro', 'agenda', 'tasks'];

export type PanelThemeMode = 'auto' | 'light' | 'dark';

export interface PanelSettings {
  pomodoro: PomodoroSettings;
  sound: boolean;
  vibrate: boolean;
  /** Rotação automática entre as abas. */
  rotate: boolean;
  rotateSec: number;
  /** Minutos sem toque até o relógio; 0 desliga. */
  idleMin: number;
  /** auto: escuro entre `darkFrom` e `darkTo`. */
  theme: PanelThemeMode;
  darkFrom: string;
  darkTo: string;
  /** Coordenadas para o clima; sem elas, o clima não aparece. */
  weather: { lat: number; lon: number } | null;
}

export interface WeatherReading {
  temp: number;
  code: number;
  max: number;
  min: number;
  fetchedAt: number;
}

interface PanelStore {
  settings: PanelSettings;
  timer: PomodoroState;
  /** Tempo de foco (ms) acumulado por tarefa. */
  focusByTask: Record<string, number>;
  weather: WeatherReading | null;

  updateSettings: (patch: Partial<Omit<PanelSettings, 'pomodoro'>>) => void;
  updatePomodoro: (patch: Partial<PomodoroSettings>) => void;
  startTimer: (now?: number) => void;
  pauseTimer: (now?: number) => void;
  skipTimer: (now?: number) => void;
  resetTimer: (now?: number) => void;
  /** Resolve as etapas vencidas; devolve as que terminaram (para o alerta). */
  tickTimer: (now?: number) => Transition['ended'];
  linkTask: (taskId: string | null, now?: number) => void;
  clearFocusLog: () => void;
  setWeather: (weather: WeatherReading | null) => void;
}

export const PANEL_STORAGE_KEY = 'sisifo:panel';

export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
  pomodoro: DEFAULT_POMODORO,
  sound: true,
  vibrate: true,
  rotate: true,
  rotateSec: 20,
  idleMin: 5,
  theme: 'auto',
  darkFrom: '19:00',
  darkTo: '07:00',
  weather: null,
};

function addCredits(log: Record<string, number>, credits: FocusCredit[]): Record<string, number> {
  const withTask = credits.filter((c) => c.taskId);
  if (!withTask.length) return log;
  const next = { ...log };
  for (const { taskId, ms } of withTask) next[taskId!] = (next[taskId!] ?? 0) + ms;
  return next;
}

export const usePanelStore = create<PanelStore>()(
  persist(
    (set, get) => {
      /** Aplica uma transição da máquina do Pomodoro, creditando o foco nas tarefas. */
      const apply = ({ state, credits }: Transition) =>
        set((s) => ({ timer: state, focusByTask: addCredits(s.focusByTask, credits) }));
      const cfg = () => get().settings.pomodoro;
      // Antes de qualquer ação, resolve o que venceu (ex.: tocar "pausar" depois do fim).
      const settled = (now: number) => {
        const t = tick(get().timer, cfg(), now, todayISO());
        if (t.state !== get().timer) apply(t);
        return get().timer;
      };

      return {
        settings: DEFAULT_PANEL_SETTINGS,
        timer: initialPomodoro(DEFAULT_POMODORO, todayISO()),
        focusByTask: {},
        weather: null,

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        updatePomodoro: (patch) =>
          set((s) => {
            const pomodoro = { ...s.settings.pomodoro, ...patch };
            return { settings: { ...s.settings, pomodoro }, timer: applySettings(s.timer, pomodoro) };
          }),

        startTimer: (now = Date.now()) => set({ timer: start(settled(now), now) }),
        pauseTimer: (now = Date.now()) => apply(pause(settled(now), now)),
        skipTimer: (now = Date.now()) => apply(skip(settled(now), cfg(), now)),
        resetTimer: (now = Date.now()) => apply(reset(settled(now), cfg(), now)),
        tickTimer: (now = Date.now()) => {
          const t = tick(get().timer, cfg(), now, todayISO());
          if (t.state !== get().timer) apply(t);
          return t.ended;
        },
        linkTask: (taskId, now = Date.now()) => {
          // O foco feito até aqui fica com a tarefa anterior.
          const current = settled(now);
          if (current.status === 'running') {
            const paused = pause(current, now);
            apply({ ...paused, state: start({ ...paused.state, taskId }, now) });
          } else {
            set({ timer: { ...current, taskId } });
          }
        },
        clearFocusLog: () => set({ focusByTask: {} }),
        setWeather: (weather) => set({ weather }),
      };
    },
    {
      name: PANEL_STORAGE_KEY,
      version: 1,
      partialize: ({ settings, timer, focusByTask, weather }) => ({ settings, timer, focusByTask, weather }),
      // Ajustes novos em versões futuras ganham o valor padrão.
      merge: (persisted, current) => {
        // `agenda` de versões antigas fica de fora: a agenda agora é compartilhada.
        const { agenda: _old, ...p } = (persisted ?? {}) as Partial<PanelStore> & { agenda?: unknown };
        return {
          ...current,
          ...p,
          settings: {
            ...DEFAULT_PANEL_SETTINGS,
            ...p.settings,
            pomodoro: { ...DEFAULT_POMODORO, ...p.settings?.pomodoro },
          },
        };
      },
    },
  ),
);

/** Pomodoro rodando ou pausado: o painel não troca de aba nem entra no relógio. */
export const isTimerActive = (timer: PomodoroState) => timer.status !== 'idle';
