import { describe, expect, it } from 'vitest';
import { BACKDROP_DEPTH, buildScene, buildTemple, SUMMIT_SLOPE } from './scenes';

const max = (lum: Float32Array) => lum.reduce((m, v) => Math.max(m, v), 0);

describe('cenas', () => {
  it('backdrop nunca passa de BACKDROP_DEPTH', () => {
    for (const [c, r] of [
      [160, 400],
      [960, 540],
    ] as const) {
      const g = buildScene('backdrop', c, r);
      expect(max(g.lum)).toBeGreaterThan(0);
      expect(max(g.lum)).toBeLessThanOrEqual(BACKDROP_DEPTH + 1e-6);
    }
  });

  it('as cenas são determinísticas', () => {
    expect(buildScene('summit', 200, 130).lum).toEqual(buildScene('summit', 200, 130).lum);
  });

  it('summit: o canto de cima à esquerda (área do título) fica vazio', () => {
    const g = buildScene('summit', 200, 130);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 80; x++) expect(g.lum[y * 200 + x]).toBe(0);
  });

  it('summit: as colunas do templo apoiam na encosta', () => {
    const g = buildScene('summit', 200, 130);
    const x = Math.round(200 * 0.87); // a coluna inteira do templo
    const { from, to } = SUMMIT_SLOPE;
    const lineY = Math.round(130 * (from.y + (to.y - from.y) * (x / 199)));
    expect(g.lum[(lineY - 10) * 200 + x]).toBeGreaterThan(0); // há coluna logo acima da linha
  });

  it('buildTemple cabe na caixa pedida', () => {
    const g = buildTemple(30, 24);
    expect([g.cols, g.rows]).toEqual([30, 24]);
    expect(max(g.lum)).toBeGreaterThan(0);
  });
});
