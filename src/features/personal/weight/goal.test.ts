import { describe, expect, it } from 'vitest';
import { addDaysISO } from '@/lib/dates';
import type { BodyWeight, Goal } from '../types';
import { activeWeightGoal, DEFAULT_PACE, PACE_LABELS, paceStatus, plateauMessage, weightGoalError } from './goal';

const TODAY = '2026-11-25';
const w = (date: string, kg: number): BodyWeight => ({ id: date, date, kg, createdAt: `${date}T08:00:00.000Z` });

/** Pesagens a cada 2 dias nos últimos `days` dias, com o peso dado pela função do dia. */
function series(days: number, kgOf: (dayIndex: number) => number): BodyWeight[] {
  const out: BodyWeight[] = [];
  for (let i = 0; i <= days; i += 2) out.push(w(addDaysISO(TODAY, i - days), kgOf(i)));
  return out;
}
const perWeek = (start: number, rate: number) => (d: number) => start + (rate / 7) * d;

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g',
  title: 'Chegar a 72 kg',
  horizon: 'medium',
  area: 'training',
  subtasks: [],
  kind: 'numeric',
  start: 65,
  target: 72,
  unit: 'kg',
  source: { type: 'bodyweight' },
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

describe('paceStatus numa meta de ganho (faixa padrão 0,25–0,5)', () => {
  it('usa a faixa padrão e a direção de ganho', () => {
    const s = paceStatus(goal(), series(21, perWeek(68, 0.3)), TODAY);
    expect(s).toMatchObject({ direction: 1, min: DEFAULT_PACE.gain.min, max: DEFAULT_PACE.gain.max });
  });

  it.each([
    ['reached', series(21, () => 72.2)],
    ['noData', [w('2026-11-20', 68), w('2026-11-22', 68.2), w(TODAY, 68.4)]],
    ['reversing', series(28, (d) => 70.7 - 0.025 * d)],
    ['stalled', series(21, () => 70)],
    ['tooFast', series(21, perWeek(68, 0.8))],
    ['slow', series(21, perWeek(68, 0.15))],
    ['onPace', series(21, perWeek(68, 0.3))],
  ] as const)('estado %s', (state, weights) => {
    expect(paceStatus(goal(), [...weights], TODAY).state).toBe(state);
  });

  it('parado conta as semanas', () => {
    expect(paceStatus(goal(), series(21, () => 70), TODAY).stalledWeeks).toBe(3);
  });

  it('traz o ritmo e a tendência', () => {
    const s = paceStatus(goal(), series(21, perWeek(68, 0.3)), TODAY);
    expect(s.rate).toBeCloseTo(0.3, 2);
    expect(s.trend).toBeGreaterThan(68.7);
    expect(s.target).toBe(72);
  });
});

describe('paceStatus em outros casos', () => {
  it('meta de perda usa a faixa 0,25–0,75 e direção -1', () => {
    const s = paceStatus(goal({ start: 80, target: 75 }), series(21, perWeek(79, -0.5)), TODAY);
    expect(s).toMatchObject({ state: 'onPace', direction: -1, min: 0.25, max: 0.75 });
  });

  it('a faixa da fonte substitui o padrão', () => {
    const g = goal({ source: { type: 'bodyweight', minPerWeek: 0.1, maxPerWeek: 0.2 } });
    expect(paceStatus(g, series(21, perWeek(68, 0.3)), TODAY)).toMatchObject({ state: 'tooFast', min: 0.1, max: 0.2 });
  });

  it('todos os estados têm rótulo', () => {
    expect(Object.values(PACE_LABELS)).toEqual([
      'Alvo atingido',
      'Sem dados',
      'Recuando',
      'Parado',
      'Rápido demais',
      'Devagar',
      'Dentro da faixa',
    ]);
  });
});

describe('activeWeightGoal', () => {
  it('escolhe a meta de peso criada por último', () => {
    const books = goal({ id: 'b', source: undefined, createdAt: '2026-11-20T10:00:00.000Z' });
    const old = goal({ id: 'old', createdAt: '2026-08-01T10:00:00.000Z' });
    const recent = goal({ id: 'new', createdAt: '2026-10-01T10:00:00.000Z' });
    expect(activeWeightGoal([old, books, recent])?.id).toBe('new');
    expect(activeWeightGoal([books])).toBeNull();
  });
});

describe('plateauMessage', () => {
  it('fala em aumentar as calorias no ganho e em reduzir na perda; nada fora do platô', () => {
    const stalled = paceStatus(goal(), series(21, () => 70), TODAY);
    expect(plateauMessage(stalled)).toBe('Peso parado há 3 semanas. Para seguir ganhando, aumente as calorias.');
    const losing = paceStatus(goal({ start: 80, target: 75 }), series(21, () => 78), TODAY);
    expect(plateauMessage(losing)).toBe('Peso parado há 3 semanas. Para seguir perdendo, reduza as calorias.');
    expect(plateauMessage(paceStatus(goal(), series(21, perWeek(68, 0.3)), TODAY))).toBeNull();
  });
});

describe('weightGoalError', () => {
  it('exige o peso de partida, para a meta saber se é de ganho ou de perda', () => {
    expect(weightGoalError({ start: undefined, target: 68 })).toBe('Informe o peso de partida em "Começa em" (o de hoje, se ainda não há pesagens).');
    expect(weightGoalError({ start: 75, target: 75 })).toBe('O alvo precisa ser diferente do peso de partida.');
    expect(weightGoalError({ start: 75, target: 68 })).toBeNull();
  });
});
