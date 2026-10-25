import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POMODORO,
  formatClock,
  initialPomodoro,
  pause,
  remainingAt,
  reset,
  skip,
  start,
  tick,
  type PomodoroSettings,
} from './pomodoro';

const MIN = 60_000;
const DAY = '2026-10-26';
const T0 = Date.parse('2026-10-26T12:00:00Z');
const cfg = DEFAULT_POMODORO;

describe('pomodoro', () => {
  it('conta pelo horário de fim, não por intervalos', () => {
    const s = start({ ...initialPomodoro(cfg, DAY), taskId: 't1' }, T0);
    expect(remainingAt(s, T0 + 10 * MIN)).toBe(15 * MIN);
    // A tela "dormiu" 40 minutos: ao acordar, o foco já terminou na hora certa.
    const { state, ended, credits } = tick(s, cfg, T0 + 40 * MIN, DAY);
    expect(ended).toEqual([{ phase: 'focus', at: T0 + 25 * MIN }]);
    expect(credits).toEqual([{ taskId: 't1', ms: 25 * MIN }]);
    expect(state).toMatchObject({ phase: 'short', status: 'idle', cyclesToday: 1, streak: 1, remainingMs: 5 * MIN });
  });

  it('não muda nada antes do fim', () => {
    const s = start(initialPomodoro(cfg, DAY), T0);
    expect(tick(s, cfg, T0 + MIN, DAY).state).toBe(s);
  });

  it('pausa longa a cada 4 focos e volta a contar', () => {
    let s = initialPomodoro(cfg, DAY);
    let now = T0;
    const phases: string[] = [];
    for (let i = 0; i < 9; i++) {
      s = start(s, now);
      now = s.endsAt!;
      s = tick(s, cfg, now, DAY).state;
      phases.push(s.phase);
    }
    expect(phases).toEqual(['short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus', 'short']);
    expect(s.cyclesToday).toBe(5);
  });

  it('com início automático, encadeia as etapas vencidas a partir do fim de cada uma', () => {
    const auto: PomodoroSettings = { ...cfg, autoStart: true };
    const s = start(initialPomodoro(auto, DAY), T0);
    const { state, ended } = tick(s, auto, T0 + 32 * MIN, DAY);
    expect(ended.map((e) => e.phase)).toEqual(['focus', 'short']);
    expect(state).toMatchObject({ phase: 'focus', status: 'running', endsAt: T0 + 55 * MIN });
    expect(remainingAt(state, T0 + 32 * MIN)).toBe(23 * MIN);
  });

  it('pausar guarda o restante e credita o foco feito', () => {
    const s = start({ ...initialPomodoro(cfg, DAY), taskId: 'x' }, T0);
    const paused = pause(s, T0 + 10 * MIN);
    expect(paused.state).toMatchObject({ status: 'paused', remainingMs: 15 * MIN, focusMsToday: 10 * MIN });
    expect(paused.credits).toEqual([{ taskId: 'x', ms: 10 * MIN }]);
    // Pausado não corre, mesmo horas depois.
    expect(tick(paused.state, cfg, T0 + 5 * 60 * MIN, DAY).ended).toEqual([]);
    const resumed = start(paused.state, T0 + 60 * MIN);
    expect(resumed.endsAt).toBe(T0 + 75 * MIN);
  });

  it('pular o foco não conta ciclo; resetar recomeça a etapa', () => {
    const s = start(initialPomodoro(cfg, DAY), T0);
    const skipped = skip(s, cfg, T0 + 5 * MIN);
    expect(skipped.state).toMatchObject({ phase: 'short', status: 'idle', cyclesToday: 0, streak: 0 });
    expect(skipped.credits).toEqual([{ taskId: null, ms: 5 * MIN }]);

    const again = start(skipped.state, T0 + 6 * MIN);
    expect(reset(again, cfg, T0 + 7 * MIN).state).toMatchObject({ phase: 'short', status: 'idle', remainingMs: 5 * MIN });
  });

  it('zera os contadores quando o dia muda', () => {
    const s = { ...initialPomodoro(cfg, DAY), cyclesToday: 6, focusMsToday: 150 * MIN, streak: 2 };
    expect(tick(s, cfg, T0, '2026-10-27').state).toMatchObject({ day: '2026-10-27', cyclesToday: 0, focusMsToday: 0 });
  });

  it('formata o relógio arredondando para cima', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(64 * MIN)).toBe('1:04:00');
  });
});
