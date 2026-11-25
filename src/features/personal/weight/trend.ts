import { addDaysISO, daysBetween, type ISODate } from '@/lib/dates';
import type { BodyWeight } from '../types';

/**
 * Tendência do peso, em funções puras. O peso do dia varia de 0,5 a 1,5 kg
 * (água, comida), então o que importa é a média de 7 dias e o ritmo das
 * últimas semanas, não a pesagem isolada.
 */

const AVG_DAYS = 7;
const RATE_DAYS = 28;
const RATE_MIN_WEIGHINGS = 4;
const RATE_MIN_SPAN = 14;
const PLATEAU_DAYS = 14;
const PLATEAU_MIN_WEIGHINGS = 4;
/** Abaixo disto, em 14 dias e na direção da meta, o peso está parado. */
const PLATEAU_KG = 0.1;

const byDate = (a: BodyWeight, b: BodyWeight) => a.date.localeCompare(b.date);

/** Pesagens com data em (from, to], em ordem de data. */
function between(weights: BodyWeight[], from: ISODate, to: ISODate): BodyWeight[] {
  return weights.filter((x) => x.date > from && x.date <= to).sort(byDate);
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** Média das pesagens nos 7 dias de calendário que terminam em `date` (null sem nenhuma). */
function avgEnding(weights: BodyWeight[], date: ISODate): number | null {
  const inWindow = between(weights, addDaysISO(date, -AVG_DAYS), date);
  return inWindow.length ? mean(inWindow.map((x) => x.kg)) : null;
}

/** Média de 7 dias em cada data com pesagem, em ordem de data. */
export function trendSeries(weights: BodyWeight[]): Array<{ date: ISODate; kg: number; avg: number }> {
  return [...weights].sort(byDate).map((x) => ({ date: x.date, kg: x.kg, avg: avgEnding(weights, x.date)! }));
}

/** Média de 7 dias da última pesagem até `date`, levada adiante; null sem pesagem até a data. */
export function trendAt(weights: BodyWeight[], date: ISODate): number | null {
  let last: ISODate | null = null;
  for (const x of weights) if (x.date <= date && (!last || x.date > last)) last = x.date;
  return last ? avgEnding(weights, last) : null;
}

/**
 * Ritmo em kg/semana: inclinação da regressão linear das pesagens dos últimos
 * 28 dias. null com menos de 4 pesagens ou cobrindo menos de 14 dias.
 */
export function weeklyRate(weights: BodyWeight[], today: ISODate): number | null {
  const recent = between(weights, addDaysISO(today, -RATE_DAYS), today);
  if (recent.length < RATE_MIN_WEIGHINGS) return null;
  const first = recent[0]!.date;
  if (daysBetween(first, recent.at(-1)!.date) < RATE_MIN_SPAN) return null;

  const xs = recent.map((x) => daysBetween(first, x.date));
  const ys = recent.map((x) => x.kg);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? null : (num / den) * 7;
}

/** Tendência de hoje menos a de 14 dias atrás; null se faltar um dos lados. */
export function change14(weights: BodyWeight[], today: ISODate): number | null {
  const now = trendAt(weights, today);
  const before = trendAt(weights, addDaysISO(today, -PLATEAU_DAYS));
  return now === null || before === null ? null : now - before;
}

/** A janela de 14 dias que termina em `date` está parada na direção dada. */
function stalledAt(weights: BodyWeight[], date: ISODate, direction: 1 | -1): boolean {
  if (between(weights, addDaysISO(date, -PLATEAU_DAYS), date).length < PLATEAU_MIN_WEIGHINGS) return false;
  const change = change14(weights, date);
  return change !== null && change * direction < PLATEAU_KG;
}

/**
 * Há quantas semanas o peso não anda na direção dada (1 ganho, -1 perda).
 * 0 sem platô; senão 2 (a janela de 14 dias) + as semanas para trás em que
 * a janela continua parada.
 */
export function plateauWeeks(weights: BodyWeight[], today: ISODate, direction: 1 | -1): number {
  if (!stalledAt(weights, today, direction)) return 0;
  let weeks = 2;
  while (stalledAt(weights, addDaysISO(today, -7 * (weeks - 1)), direction)) weeks++;
  return weeks;
}
