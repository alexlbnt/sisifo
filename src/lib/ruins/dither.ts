import { seededRandom } from '@/lib/random';

/*
 * Ruínas em pontilhado (dither). As formas são desenhadas numa grade de
 * luminância (0 = vazio, 1 = luz total) e cada célula vira um ponto ou nada,
 * pela matriz Bayer 4×4. Tudo determinístico: a mesma semente desenha sempre
 * a mesma coluna, então as ruínas não "mudam de lugar" a cada abertura.
 */

export interface Grid {
  cols: number;
  rows: number;
  lum: Float32Array;
}

/** Teto da grade: numa tela enorme os pontos ficam maiores, mas a memória não explode. */
export const MAX_CELLS = 250_000;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** Realça os meios-tons para o pontilhado não ficar ralo demais. */
const GAMMA = 0.7;

export function createGrid(cols: number, rows: number): Grid {
  const k = Math.min(1, Math.sqrt(MAX_CELLS / Math.max(1, cols * rows)));
  const c = Math.max(1, Math.floor(cols * k));
  const r = Math.max(1, Math.floor(rows * k));
  return { cols: c, rows: r, lum: new Float32Array(c * r) };
}

/** Acende uma célula. Índice fracionário não grava em Float32Array: por isso o arredondamento. */
export function plot(g: Grid, x: number, y: number, v: number): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= g.cols || py >= g.rows) return;
  const i = py * g.cols + px;
  if (v > (g.lum[i] ?? 0)) g.lum[i] = v;
}

/** Sombra de um cilindro com luz vinda da esquerda (u de -1 a 1 na largura). */
function shade(u: number): number {
  return 0.1 + 0.85 * Math.max(0, 0.6 * Math.sqrt(Math.max(0, 1 - u * u)) - 0.45 * u);
}

export interface ColumnSpec {
  /** Centro, em células. */
  x: number;
  /** Linha do chão (a base da coluna apoia aqui). */
  base: number;
  height: number;
  width: number;
  /** 0 = inteira; 0..1 = quebrada nessa fração da altura, sem capitel. */
  broken?: number;
  /** Chance de cada ponto estar gasto. */
  decay?: number;
  /** Intensidade máxima (colunas ao fundo ficam mais apagadas). */
  depth?: number;
  seed: number;
}

/** Coluna jônica: base, fuste com caneluras, capitel com volutas (ou topo quebrado e serrilhado). */
export function drawColumn(g: Grid, spec: ColumnSpec): void {
  const { broken = 0, decay = 0.07, depth = 1 } = spec;
  const x = Math.round(spec.x);
  const base = Math.round(spec.base);
  const height = Math.round(spec.height);
  const width = Math.round(spec.width);
  const rnd = seededRandom(spec.seed).next;

  const capH = Math.max(4, Math.round(width * 0.8));
  const baseH = Math.max(3, Math.round(width * 0.45));
  const top = base - height;
  const shaftTop = top + capH;
  const shaftBot = base - baseH;
  const cut = broken ? Math.round(top + height * broken) : null;
  const jag = new Map<number, number>();

  const put = (px: number, py: number, v: number) => {
    if (cut !== null) {
      let j = jag.get(px);
      if (j === undefined) {
        j = Math.round(rnd() * 6 - 1);
        jag.set(px, j);
      }
      if (py < cut + j) return;
    }
    plot(g, px, py, (rnd() < decay ? v * 0.2 : v) * depth);
  };
  const band = (y: number, half: number, flutes: boolean, mul = 1) => {
    for (let px = Math.round(x - half); px <= Math.round(x + half); px++) {
      const u = (px - x) / half;
      if (Math.abs(u) > 1) continue;
      let v = shade(u);
      if (flutes) v *= 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(u * Math.PI * 7));
      put(px, y, v * mul);
    }
  };

  for (let y = shaftBot; y < base; y++) {
    const k = (y - shaftBot) / baseH;
    band(y, width * 0.5 * (k < 0.5 ? 1.25 : 1.5), false, k > 0.45 && k < 0.6 ? 0.5 : 1);
  }
  for (let y = shaftTop; y < shaftBot; y++) {
    const k = (y - shaftTop) / Math.max(1, shaftBot - shaftTop);
    band(y, width * 0.5 * (0.86 + 0.14 * k), true);
  }
  if (!broken) {
    for (let y = top; y < shaftTop; y++) {
      const k = (y - top) / capH;
      const half = k < 0.28 ? width * 0.5 * 1.65 : width * 0.5 * (1.45 - (0.5 * (k - 0.28)) / 0.72);
      band(y, half, false, k < 0.28 && (y - top) % 2 ? 0.6 : 1);
    }
    const vr = Math.max(1.5, capH * 0.3);
    const vy = top + capH * 0.48;
    for (const side of [-1, 1]) {
      for (let a = 0; a < 6.3; a += 0.2) put(x + side * width * 0.66 + Math.cos(a) * vr, vy + Math.sin(a) * vr, 0.95);
    }
  }
  // Entulho no pé da coluna.
  for (let i = 0; i < width * 1.5; i++) plot(g, x + (rnd() - 0.5) * width * 3, base - rnd() * 2, 0.4 * depth);
}

export interface DrumSpec {
  x: number;
  y: number;
  length: number;
  radius: number;
  depth?: number;
  seed: number;
}

/** Tambor de coluna caído, deitado no chão. */
export function drawDrum(g: Grid, spec: DrumSpec): void {
  const { depth = 1 } = spec;
  const x = Math.round(spec.x);
  const y = Math.round(spec.y);
  const length = Math.round(spec.length);
  const radius = Math.max(1, Math.round(spec.radius));
  const rnd = seededRandom(spec.seed).next;
  for (let dy = -radius; dy <= radius; dy++) {
    const u = dy / radius;
    for (let dx = 0; dx < length; dx++) {
      let v = shade(u) * (0.6 + 0.4 * (0.5 + 0.5 * Math.cos(u * Math.PI * 4)));
      if (rnd() < 0.06) v *= 0.2;
      plot(g, x + dx, y + dy, v * depth);
    }
  }
}

export interface SlopeSpec {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Altura da faixa de terra abaixo da linha. */
  thickness: number;
  depth?: number;
  seed: number;
}

/** Encosta: a linha do chão bem marcada e a terra se apagando para baixo. */
export function drawSlope(g: Grid, spec: SlopeSpec): void {
  const { from, to, thickness, depth = 1 } = spec;
  const rnd = seededRandom(spec.seed).next;
  const span = to.x - from.x || 1;
  for (let x = Math.round(from.x); x <= Math.round(to.x); x++) {
    const ly = Math.round(from.y + ((to.y - from.y) * (x - from.x)) / span);
    plot(g, x, ly, 0.95 * depth);
    plot(g, x, ly + 1, 0.75 * depth);
    for (let y = ly + 2; y < ly + thickness; y++) {
      plot(g, x, y, (0.42 - ((y - ly) / thickness) * 0.4) * (0.75 + 0.5 * rnd()) * depth);
    }
  }
}

/**
 * Chama `cb` para cada célula que vira ponto. `mask` recebe a posição relativa
 * (0..1) e multiplica a luminância: serve para apagar as colunas atrás de textos.
 */
export function forEachDot(
  g: Grid,
  cb: (x: number, y: number) => void,
  mask?: (x: number, y: number) => number,
): void {
  for (let y = 0; y < g.rows; y++) {
    const thresholds = BAYER[y & 3]!;
    for (let x = 0; x < g.cols; x++) {
      let v = g.lum[y * g.cols + x] ?? 0;
      if (!v) continue;
      if (mask) v *= mask(x / g.cols, y / g.rows);
      if (Math.pow(v, GAMMA) > thresholds[x & 3]!) cb(x, y);
    }
  }
}

/** Os pontos como um único `path` SVG (para desenhos pequenos dentro de um SVG). */
export function toDotPath(g: Grid, cell: number, dot: number, ox = 0, oy = 0): string {
  const n = (v: number) => +v.toFixed(2);
  let d = '';
  forEachDot(g, (x, y) => {
    d += `M${n(ox + x * cell)} ${n(oy + y * cell)}h${dot}v${dot}h-${dot}z`;
  });
  return d;
}
