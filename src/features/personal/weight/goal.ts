import type { ISODate } from '@/lib/dates';
import type { BodyWeight, Goal } from '../types';
import { change14, plateauWeeks, trendAt, weeklyRate } from './trend';

/** Faixa de ritmo padrão, em kg/semana: ganho limpo para ectomorfo e perda sem exagero. */
export const DEFAULT_PACE = { gain: { min: 0.25, max: 0.5 }, lose: { min: 0.25, max: 0.75 } } as const;

/** Andar mais que isto para o lado contrário em 14 dias é "recuando". */
const REVERSING_KG = 0.2;

export type PaceState = 'reached' | 'noData' | 'reversing' | 'stalled' | 'tooFast' | 'slow' | 'onPace';

/** Na ordem em que os estados são avaliados. */
export const PACE_LABELS: Record<PaceState, string> = {
  reached: 'Alvo atingido',
  noData: 'Sem dados',
  reversing: 'Recuando',
  stalled: 'Parado',
  tooFast: 'Rápido demais',
  slow: 'Devagar',
  onPace: 'Dentro da faixa',
};

export interface WeightStatus {
  state: PaceState;
  /** 1: ganhar peso; -1: perder. */
  direction: 1 | -1;
  /** kg/semana, com sinal; null com poucas pesagens. */
  rate: number | null;
  min: number;
  max: number;
  stalledWeeks: number;
  /** Média de 7 dias hoje; null sem pesagem. */
  trend: number | null;
  target: number;
}

const isWeightGoal = (goal: Goal) => goal.kind === 'numeric' && goal.source?.type === 'bodyweight';

/** A meta de peso criada por último, ou null. Não depende de estar concluída, para o card não trocar de alvo. */
export function activeWeightGoal(goals: Goal[]): Goal | null {
  let found: Goal | null = null;
  for (const goal of goals) if (isWeightGoal(goal) && (!found || goal.createdAt > found.createdAt)) found = goal;
  return found;
}

/** Direção da meta: ganhar (alvo acima do início) ou perder. */
export const goalDirection = (goal: Goal): 1 | -1 => ((goal.target ?? 0) >= (goal.start ?? 0) ? 1 : -1);

/** Estado do ritmo de uma meta de peso, avaliado na ordem de `PACE_LABELS`. */
export function paceStatus(goal: Goal, weights: BodyWeight[], today: ISODate): WeightStatus {
  const direction = goalDirection(goal);
  const range = direction === 1 ? DEFAULT_PACE.gain : DEFAULT_PACE.lose;
  const source = goal.source?.type === 'bodyweight' ? goal.source : undefined;
  const min = source?.minPerWeek ?? range.min;
  const max = source?.maxPerWeek ?? range.max;
  const target = goal.target ?? 0;
  const trend = trendAt(weights, today);
  const rate = weeklyRate(weights, today);
  const stalledWeeks = plateauWeeks(weights, today, direction);
  const base = { direction, rate, min, max, stalledWeeks, trend, target };

  const state = ((): PaceState => {
    if (trend !== null && trend * direction >= target * direction) return 'reached';
    if (rate === null) return 'noData';
    const recent = change14(weights, today);
    if (recent !== null && recent * direction < -REVERSING_KG) return 'reversing';
    if (stalledWeeks > 0) return 'stalled';
    const towards = rate * direction;
    if (towards > max) return 'tooFast';
    if (towards < min) return 'slow';
    return 'onPace';
  })();
  return { ...base, state };
}
