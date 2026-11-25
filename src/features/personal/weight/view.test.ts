import { describe, expect, it } from 'vitest';
import type { BodyWeight } from '../types';
import { chartPoints, latestWeight, periodChange, periodStart, weightReplaced } from './view';

const w = (date: string, kg: number): BodyWeight => ({ id: date, date, kg, createdAt: `${date}T08:00:00.000Z` });
const TODAY = '2026-11-25';

describe('período do gráfico', () => {
  it('começa 1, 3 ou 6 meses antes; "tudo" não tem começo', () => {
    expect(periodStart('1m', TODAY)).toBe('2026-10-25');
    expect(periodStart('3m', TODAY)).toBe('2026-08-25');
    expect(periodStart('6m', TODAY)).toBe('2026-05-25');
    expect(periodStart('all', TODAY)).toBeNull();
  });

  it('variação do período: tendência hoje menos a do começo (ou da primeira pesagem)', () => {
    const ws = [w('2026-08-01', 64), w('2026-09-01', 65), w('2026-11-25', 67)];
    expect(periodChange(ws, '2026-09-10', TODAY)).toBeCloseTo(2);
    expect(periodChange(ws, null, TODAY)).toBeCloseTo(3);
    expect(periodChange(ws, '2026-01-01', TODAY)).toBeCloseTo(3);
    expect(periodChange([], null, TODAY)).toBeNull();
    expect(periodChange([w(TODAY, 67)], null, TODAY)).toBeNull();
  });

  it('latestWeight devolve a pesagem mais recente', () => {
    expect(latestWeight([w('2026-11-20', 68), w('2026-11-24', 69), w('2026-11-01', 70)])?.date).toBe('2026-11-24');
    expect(latestWeight([])).toBeNull();
  });
});

describe('chartPoints', () => {
  const ws = [w('2026-11-10', 60), w('2026-11-15', 62), w('2026-11-20', 64)];
  it('recorta por from e to, com a média calculada sobre todas as pesagens', () => {
    const cut = chartPoints(ws, '2026-11-12', '2026-11-18');
    expect(cut.map((p) => p.date)).toEqual(['2026-11-15']);
    expect(cut[0]!.avg).toBe(61);
    expect(chartPoints(ws, '2026-11-12').map((p) => p.date)).toEqual(['2026-11-15', '2026-11-20']);
    expect(chartPoints(ws, null, null)).toHaveLength(3);
  });
});

describe('weightReplaced', () => {
  const ws = [w('2026-11-20', 68), w('2026-11-24', 69)];
  it('acha a pesagem que seria substituída, ao registrar ou ao mover uma pesagem para outro dia', () => {
    expect(weightReplaced(ws, '2026-11-24')?.kg).toBe(69);
    expect(weightReplaced(ws, '2026-11-24', ws[0])?.kg).toBe(69);
    expect(weightReplaced(ws, '2026-11-24', ws[1])).toBeUndefined();
    expect(weightReplaced(ws, '2026-11-25')).toBeUndefined();
  });
});
