import { describe, expect, it } from 'vitest';
import { createGrid, drawColumn, drawSlope, forEachDot, MAX_CELLS, plot, toDotPath } from './dither';

const max = (lum: Float32Array) => lum.reduce((m, v) => Math.max(m, v), 0);

describe('dither', () => {
  it('createGrid limita o total de células', () => {
    const g = createGrid(2000, 2000);
    expect(g.cols * g.rows).toBeLessThanOrEqual(MAX_CELLS);
    expect(g.cols).toBe(g.rows); // mantém a proporção
  });

  it('plot ignora fora da grade e guarda o maior valor', () => {
    const g = createGrid(4, 4);
    plot(g, -1, 0, 1);
    plot(g, 9, 9, 1);
    plot(g, 1, 1, 0.3);
    plot(g, 1, 1, 0.8);
    plot(g, 1, 1, 0.5);
    expect(g.lum[1 * 4 + 1]).toBeCloseTo(0.8);
    expect(max(g.lum)).toBeCloseTo(0.8);
  });

  it('coordenadas fracionárias não se perdem', () => {
    const g = createGrid(40, 80);
    drawColumn(g, { x: 20.5, base: 70.5, height: 50.5, width: 7.5, seed: 1 });
    expect(max(g.lum)).toBeGreaterThan(0);
  });

  it('mesma semente, mesma coluna', () => {
    const a = createGrid(40, 80);
    const b = createGrid(40, 80);
    drawColumn(a, { x: 20, base: 70, height: 50, width: 8, seed: 7 });
    drawColumn(b, { x: 20, base: 70, height: 50, width: 8, seed: 7 });
    expect(a.lum).toEqual(b.lum);
  });

  it('coluna quebrada não tem nada acima do corte (com folga da serrilha)', () => {
    const g = createGrid(40, 80);
    drawColumn(g, { x: 20, base: 70, height: 50, width: 8, broken: 0.5, seed: 3 });
    const cut = 70 - 50 + 50 * 0.5 - 2;
    for (let y = 0; y < cut; y++) for (let x = 0; x < 40; x++) expect(g.lum[y * 40 + x]).toBe(0);
  });

  it('depth limita a luminância', () => {
    const g = createGrid(40, 80);
    drawColumn(g, { x: 20, base: 70, height: 50, width: 8, depth: 0.35, seed: 3 });
    expect(max(g.lum)).toBeLessThanOrEqual(0.35 + 1e-6);
  });

  it('drawSlope marca a linha da encosta de ponta a ponta', () => {
    const g = createGrid(50, 50);
    drawSlope(g, { from: { x: 0, y: 40 }, to: { x: 49, y: 10 }, thickness: 8, seed: 1 });
    expect(g.lum[40 * 50 + 0]).toBeGreaterThan(0.8);
    expect(g.lum[10 * 50 + 49]).toBeGreaterThan(0.8);
    expect(g.lum[5 * 50 + 0]).toBe(0); // acima da encosta fica vazio
  });

  it('forEachDot acende mais pontos onde a luminância é maior', () => {
    const count = (v: number) => {
      const g = createGrid(16, 16);
      g.lum.fill(v);
      let n = 0;
      forEachDot(g, () => n++);
      return n;
    };
    expect(count(0)).toBe(0);
    expect(count(0.3)).toBeLessThan(count(0.7));
    expect(count(1)).toBe(256);
  });

  it('toDotPath gera um quadrado por ponto', () => {
    const g = createGrid(2, 1);
    g.lum.fill(1);
    expect(toDotPath(g, 2, 1.2)).toBe('M0 0h1.2v1.2h-1.2zM2 0h1.2v1.2h-1.2z');
  });
});
