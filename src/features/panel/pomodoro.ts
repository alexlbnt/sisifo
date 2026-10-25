import type { ISODate } from '@/lib/dates';

/**
 * Máquina de estados do Pomodoro, pura e baseada em horários (epoch ms).
 *
 * Nada aqui conta segundos: o tempo restante é sempre `endsAt - agora`. Se a
 * tela travar, a aba for suspensa ou a página recarregar, o próximo `tick`
 * resolve de uma vez todas as etapas que venceram nesse meio-tempo.
 */

export type PomodoroPhase = 'focus' | 'short' | 'long';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
  focusMin: number;
  shortMin: number;
  longMin: number;
  /** Pausa longa a cada N focos concluídos. */
  longEvery: number;
  /** Ao terminar uma etapa, já começa a próxima. */
  autoStart: boolean;
}

export interface PomodoroState {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  /** Rodando: quando a etapa termina. */
  endsAt: number | null;
  /** Parado ou pausado: quanto falta. */
  remainingMs: number;
  /** Rodando: início do trecho atual (para registrar o tempo de foco). */
  segmentStart: number | null;
  /** Focos concluídos desde a última pausa longa. */
  streak: number;
  /** Dia dos contadores abaixo. */
  day: ISODate;
  cyclesToday: number;
  focusMsToday: number;
  /** Tarefa do Sísifo ligada ao foco. */
  taskId: string | null;
}

/** Tempo de foco a creditar numa tarefa (ou em nenhuma). */
export interface FocusCredit {
  taskId: string | null;
  ms: number;
}

export interface Transition {
  state: PomodoroState;
  /** Etapas que terminaram sozinhas (para tocar o alerta). */
  ended: { phase: PomodoroPhase; at: number }[];
  credits: FocusCredit[];
}

export const DEFAULT_POMODORO: PomodoroSettings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStart: false,
};

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: 'Foco',
  short: 'Pausa curta',
  long: 'Pausa longa',
};

const MIN = 60_000;

export function phaseDuration(phase: PomodoroPhase, settings: PomodoroSettings): number {
  const minutes = phase === 'focus' ? settings.focusMin : phase === 'short' ? settings.shortMin : settings.longMin;
  return Math.max(1, minutes) * MIN;
}

export function initialPomodoro(settings: PomodoroSettings, day: ISODate): PomodoroState {
  return {
    phase: 'focus',
    status: 'idle',
    endsAt: null,
    remainingMs: phaseDuration('focus', settings),
    segmentStart: null,
    streak: 0,
    day,
    cyclesToday: 0,
    focusMsToday: 0,
    taskId: null,
  };
}

/** Quanto falta agora, em ms (nunca negativo). */
export function remainingAt(state: PomodoroState, now: number): number {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - now);
  return state.remainingMs;
}

/** Fração já cumprida da etapa (0 a 1), para a barra de progresso. */
export function progressAt(state: PomodoroState, settings: PomodoroSettings, now: number): number {
  const total = phaseDuration(state.phase, settings);
  return Math.min(1, Math.max(0, 1 - remainingAt(state, now) / total));
}

/** "24:59"; acima de uma hora, "1:04:59". Arredonda para cima: "00:00" só no fim. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* ───────── Transições ───────── */

const none = (state: PomodoroState): Transition => ({ state, ended: [], credits: [] });

/** Zera os contadores do dia quando a data muda. */
function rollDay(state: PomodoroState, today: ISODate): PomodoroState {
  return state.day === today ? state : { ...state, day: today, cyclesToday: 0, focusMsToday: 0, streak: 0 };
}

/** Credita o foco do trecho [segmentStart, until] e devolve o estado com o trecho reiniciado. */
function settleFocus(state: PomodoroState, until: number, credits: FocusCredit[]): PomodoroState {
  if (state.phase !== 'focus' || state.segmentStart === null) return state;
  const ms = Math.max(0, until - state.segmentStart);
  if (ms > 0) credits.push({ taskId: state.taskId, ms });
  return { ...state, focusMsToday: state.focusMsToday + ms, segmentStart: until };
}

function nextPhase(state: PomodoroState, settings: PomodoroSettings): { phase: PomodoroPhase; streak: number } {
  if (state.phase !== 'focus') return { phase: 'focus', streak: state.phase === 'long' ? 0 : state.streak };
  const streak = state.streak + 1;
  return { phase: streak >= Math.max(1, settings.longEvery) ? 'long' : 'short', streak };
}

/** Prepara a próxima etapa, parada ou já rodando a partir de `from`. */
function enter(state: PomodoroState, settings: PomodoroSettings, from: number, run: boolean): PomodoroState {
  const { phase, streak } = nextPhase(state, settings);
  const duration = phaseDuration(phase, settings);
  const base = { ...state, phase, streak: phase === 'long' ? 0 : streak, remainingMs: duration };
  return run
    ? { ...base, status: 'running', endsAt: from + duration, segmentStart: from }
    : { ...base, status: 'idle', endsAt: null, segmentStart: null };
}

/** Resolve as etapas que terminaram até `now` (várias, se a tela ficou suspensa com início automático). */
export function tick(state: PomodoroState, settings: PomodoroSettings, now: number, today: ISODate): Transition {
  let s = rollDay(state, today);
  const ended: Transition['ended'] = [];
  const credits: FocusCredit[] = [];
  // Teto de segurança: um dia inteiro de etapas de 1 minuto.
  for (let i = 0; i < 1440 && s.status === 'running' && s.endsAt !== null && now >= s.endsAt; i++) {
    const at = s.endsAt;
    s = settleFocus(s, at, credits);
    if (s.phase === 'focus') s = { ...s, cyclesToday: s.cyclesToday + 1 };
    ended.push({ phase: s.phase, at });
    s = enter(s, settings, at, settings.autoStart);
  }
  return s === state && !ended.length ? none(state) : { state: s, ended, credits };
}

export function start(state: PomodoroState, now: number): PomodoroState {
  if (state.status === 'running') return state;
  return { ...state, status: 'running', endsAt: now + state.remainingMs, segmentStart: now };
}

export function pause(state: PomodoroState, now: number): Transition {
  if (state.status !== 'running' || state.endsAt === null) return none(state);
  const credits: FocusCredit[] = [];
  const s = settleFocus(state, now, credits);
  return {
    state: { ...s, status: 'paused', remainingMs: Math.max(0, state.endsAt - now), endsAt: null, segmentStart: null },
    ended: [],
    credits,
  };
}

/** Pula para a próxima etapa. Pular um foco não conta como ciclo, mas o tempo já focado vale. */
export function skip(state: PomodoroState, settings: PomodoroSettings, now: number): Transition {
  const credits: FocusCredit[] = [];
  let s = state.status === 'running' ? settleFocus(state, now, credits) : state;
  // Sem contar o ciclo: o foco pulado não avança a sequência até a pausa longa.
  if (s.phase === 'focus') s = { ...s, streak: s.streak - 1 };
  s = enter(s, settings, now, false);
  return { state: s, ended: [], credits };
}

/** Recomeça a etapa atual do zero, parada. */
export function reset(state: PomodoroState, settings: PomodoroSettings, now: number): Transition {
  const credits: FocusCredit[] = [];
  const s = state.status === 'running' ? settleFocus(state, now, credits) : state;
  return {
    state: { ...s, status: 'idle', endsAt: null, segmentStart: null, remainingMs: phaseDuration(s.phase, settings) },
    ended: [],
    credits,
  };
}

/** Ajustes mudaram: a etapa parada passa a ter a duração nova. */
export function applySettings(state: PomodoroState, settings: PomodoroSettings): PomodoroState {
  return state.status === 'idle' ? { ...state, remainingMs: phaseDuration(state.phase, settings) } : state;
}
