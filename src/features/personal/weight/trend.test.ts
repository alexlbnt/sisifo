import { describe, expect, it } from 'vitest';
import { addDaysISO } from '@/lib/dates';
import type { BodyWeight } from '../types';
import { change14, plateauWeeks, trendAt, trendSeries, weeklyRate } from './trend';

const w = (date: string, kg: number): BodyWeight => ({ id: date, date, kg, createdAt: `${date}T08:00:00.000Z` });
const TODAY = '2026-11-25';

/** Pesagens a cada `step` dias, de `days` dias atrás até hoje, com o peso dado pela função do dia. */
function series(days: number, step: number, kgOf: (dayIndex: number) => number): BodyWeight[] {
  const out: BodyWeight[] = [];
  for (let i = 0; i <= days; i += step) out.push(w(addDaysISO(TODAY, i - days), kgOf(i)));
  return out;
}

describe('trendSeries', () => {
  it('faz a média dos 7 dias de calendário que terminam em cada pesagem', () => {
    const s = trendSeries([w('2026-11-08', 72), w('2026-11-01', 70), w('2026-11-03', 71)]);
    expect(s.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-03', '2026-11-08']);
    expect(s.map((p) => p.avg)).toEqual([70, 70.5, 71.5]); // 08/11 olha 02..08: 71 e 72
    expect(s.map((p) => p.kg)).toEqual([70, 71, 72]);
  });
});

describe('trendAt', () => {
  it('leva a última média adiante numa lacuna e é null antes da primeira pesagem', () => {
    const ws = [w('2026-11-01', 70), w('2026-11-03', 71)];
    expect(trendAt(ws, '2026-11-20')).toBe(70.5);
    expect(trendAt(ws, '2026-11-02')).toBe(70);
    expect(trendAt(ws, '2026-10-31')).toBeNull();
  });
});

describe('weeklyRate', () => {
  it('dá +0,3 kg/sem numa subida linear', () => {
    const ws = series(21, 3, (d) => 70 + (0.3 / 7) * d);
    expect(weeklyRate(ws, TODAY)).toBeCloseTo(0.3, 2);
  });

  it('olha só os últimos 28 dias', () => {
    const ws = series(56, 2, (d) => (d < 28 ? 60 + d : 88 - (0.5 / 7) * (d - 28)));
    expect(weeklyRate(ws, TODAY)).toBeCloseTo(-0.5, 1);
  });

  it('é null com 3 pesagens ou cobrindo menos de 14 dias', () => {
    expect(weeklyRate([w('2026-11-05', 70), w('2026-11-15', 71), w(TODAY, 72)], TODAY)).toBeNull();
    expect(weeklyRate(series(10, 2, () => 70), TODAY)).toBeNull();
  });
});

describe('plateauWeeks', () => {
  it('conta 2 + as semanas extras em que a janela de 14 dias continua parada', () => {
    const ws = series(28, 2, () => 70);
    expect(plateauWeeks(ws, TODAY, 1)).toBe(4);
  });

  it('peso caindo numa meta de ganho conta como platô; subindo, não', () => {
    expect(plateauWeeks(series(14, 2, (d) => 72 - d * 0.05), TODAY, 1)).toBe(2);
    expect(plateauWeeks(series(14, 2, (d) => 70 + d * 0.05), TODAY, 1)).toBe(0);
  });

  it('na perda, o platô é não descer', () => {
    expect(plateauWeeks(series(14, 2, () => 80), TODAY, -1)).toBe(2);
    expect(plateauWeeks(series(14, 2, (d) => 80 - d * 0.05), TODAY, -1)).toBe(0);
  });

  it('é 0 com menos de 4 pesagens nos 14 dias', () => {
    expect(plateauWeeks(series(14, 5, () => 70), TODAY, 1)).toBe(0); // dias 0, 5, 10: 3 pesagens
  });
});

describe('change14', () => {
  it('é a tendência de hoje menos a de 14 dias atrás', () => {
    const ws = [w(addDaysISO(TODAY, -14), 70), w(TODAY, 71)];
    expect(change14(ws, TODAY)).toBe(1);
    expect(change14([w(TODAY, 71)], TODAY)).toBeNull();
  });
});
