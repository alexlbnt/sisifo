import { addMonthsISO, type ISODate } from '@/lib/dates';
import type { BodyWeight } from '../types';
import { trendAt } from './trend';

export type WeightPeriod = '1m' | '3m' | '6m' | 'all';

export const PERIOD_LABELS: Record<WeightPeriod, string> = { '1m': '1 mês', '3m': '3 meses', '6m': '6 meses', all: 'Tudo' };

const MONTHS: Record<Exclude<WeightPeriod, 'all'>, number> = { '1m': 1, '3m': 3, '6m': 6 };

/** Primeiro dia mostrado no gráfico; null em "tudo". */
export function periodStart(period: WeightPeriod, today: ISODate): ISODate | null {
  return period === 'all' ? null : addMonthsISO(today, -MONTHS[period]);
}

/** A pesagem mais recente, ou null. */
export function latestWeight(weights: BodyWeight[]): BodyWeight | null {
  let last: BodyWeight | null = null;
  for (const w of weights) if (!last || w.date > last.date) last = w;
  return last;
}

/**
 * Variação da tendência no período: a de hoje menos a do começo. Se o período
 * começa antes da primeira pesagem, vale a primeira. null com menos de duas pesagens.
 */
export function periodChange(weights: BodyWeight[], from: ISODate | null, today: ISODate): number | null {
  if (weights.length < 2) return null;
  const first = weights.reduce((a, b) => (b.date < a.date ? b : a)).date;
  const end = trendAt(weights, today);
  const begin = trendAt(weights, from && from > first ? from : first);
  return end === null || begin === null ? null : end - begin;
}
