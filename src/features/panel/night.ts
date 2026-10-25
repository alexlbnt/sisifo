/** Minutos desde a meia-noite de "HH:MM". */
export function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

/** O horário `minutes` cai na faixa noturna [from, to)? A faixa pode virar a meia-noite (19:00 → 07:00). */
export function isNight(minutes: number, from: string, to: string): boolean {
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a === b) return false;
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}
