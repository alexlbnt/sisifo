import { SUMMIT_SLOPE } from '@/lib/ruins/scenes';

/** Posição da pedra (0..1 na caixa da cena) para o progresso do dia: anda sobre a linha da encosta. */
export function boulderAt(done: number, total: number): { t: number; x: number; y: number } {
  const t = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const { from, to } = SUMMIT_SLOPE;
  return { t, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
