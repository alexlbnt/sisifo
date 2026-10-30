import { seededRandom } from '@/lib/random';
import { createGrid, drawColumn, drawDrum, drawSlope, plot, type Grid } from './dither';

/*
 * As cenas das ruínas, proporcionais à grade (servem de 320 a 1920 px).
 * As sementes são fixas: cada cena é sempre a mesma.
 */

export type SceneKind = 'backdrop' | 'summit' | 'login';

/** Intensidade máxima das colunas atrás das telas: marca d'água, nunca disputa com os números. */
export const BACKDROP_DEPTH = 0.35;

/** Encosta da tela Hoje em coordenadas relativas (0..1) da caixa da cena. */
export const SUMMIT_SLOPE = { from: { x: 0, y: 0.86 }, to: { x: 1, y: 0.4 } } as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function buildScene(kind: SceneKind, cols: number, rows: number): Grid {
  const g = createGrid(cols, rows);
  const c = g.cols;
  const r = g.rows;

  if (kind === 'backdrop') {
    // Uma coluna em cada borda (uma inteira, uma quebrada) e um tambor caído.
    const w = clamp(c * 0.09, 12, 38);
    drawColumn(g, { x: c * 0.1, base: r, height: r * 0.86, width: w, depth: BACKDROP_DEPTH, seed: 11 });
    drawColumn(g, { x: c * 0.9, base: r, height: r * 0.76, width: w * 0.9, broken: 0.3, depth: BACKDROP_DEPTH * 0.85, seed: 12 });
    drawDrum(g, { x: c * 0.3, y: r - w * 0.35, length: w * 1.6, radius: w * 0.3, depth: BACKDROP_DEPTH * 0.8, seed: 13 });
  }

  if (kind === 'summit') {
    // A encosta sobe da esquerda para a direita; no topo, o templo que Sísifo nunca conquista de vez.
    const line = (fx: number) => r * (SUMMIT_SLOPE.from.y + (SUMMIT_SLOPE.to.y - SUMMIT_SLOPE.from.y) * fx);
    const w = clamp(c * 0.035, 6, 16);
    drawSlope(g, { from: { x: 0, y: line(0) }, to: { x: c - 1, y: line(1) }, thickness: r * 0.14, seed: 23 });
    const temple: [fx: number, fh: number, broken: number][] = [
      [0.79, 0.27, 0.35],
      [0.87, 0.35, 0],
      [0.95, 0.3, 0.2],
    ];
    temple.forEach(([fx, fh, broken], i) =>
      drawColumn(g, { x: c * fx, base: line(fx) + 1, height: r * fh, width: w, broken, seed: 31 + i }),
    );
  }

  if (kind === 'login') {
    // Três colunas altas, a do meio mais baixa com o capitel à mostra, como na referência.
    const w = clamp(c * 0.1, 12, 40);
    drawColumn(g, { x: c * 0.2, base: r - 4, height: r * 0.9, width: w, broken: 0.04, seed: 41 });
    drawColumn(g, { x: c * 0.52, base: r - 4, height: r * 0.68, width: w * 0.95, seed: 42 });
    drawColumn(g, { x: c * 0.82, base: r - 4, height: r * 0.95, width: w * 1.05, seed: 43 });
    drawDrum(g, { x: c * 0.32, y: r - 6, length: w * 1.4, radius: w * 0.28, seed: 44 });
    const rnd = seededRandom(45).next;
    for (let i = 0; i < c * 1.2; i++) plot(g, rnd() * c, r - 1 - rnd() * 6, 0.35 + 0.4 * rnd());
  }

  return g;
}

/** Templo pequeno (3 colunas, 2 quebradas) para pôr no topo de uma encosta desenhada em SVG. */
export function buildTemple(widthCells: number, heightCells: number): Grid {
  const g = createGrid(widthCells, heightCells);
  const w = Math.max(4, Math.round(g.cols * 0.16));
  const columns: [fx: number, fh: number, broken: number][] = [
    [0.2, 0.62, 0.35],
    [0.5, 0.95, 0],
    [0.8, 0.8, 0.2],
  ];
  columns.forEach(([fx, fh, broken], i) =>
    drawColumn(g, { x: g.cols * fx, base: g.rows - 1, height: g.rows * fh, width: w, broken, decay: 0.03, seed: 51 + i }),
  );
  return g;
}
