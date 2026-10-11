/**
 * Datas para o código compartilhado com o servidor (sem date-fns nem aliases).
 * Datas são texto YYYY-MM-DD; a conta é feita ao meio-dia UTC para não sofrer com fuso.
 */

const toUTC = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);

/** "Hoje" num fuso, como YYYY-MM-DD. */
export function localDate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export const addDays = (iso: string, days: number) => fromUTC(new Date(toUTC(iso).getTime() + days * 86_400_000));

/** 0 = domingo ... 6 = sábado. */
export const weekday = (iso: string) => toUTC(iso).getUTCDay();

export function lastDayOfMonth(iso: string): number {
  const d = toUTC(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** O dia `day` do mês cai em `iso`? (dia 31 em mês de 30 dias cai no dia 30). */
export function isMonthDay(iso: string, day: number): boolean {
  return Number(iso.slice(8, 10)) === Math.min(day, lastDayOfMonth(iso));
}

/** Segunda-feira da semana de `iso`. */
export function mondayOf(iso: string): string {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}
