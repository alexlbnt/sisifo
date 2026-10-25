const hhmmFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "09:30" */
export const hhmm = (ms: number) => hhmmFormat.format(ms);

/** "25 min", "1h 20min". */
export function minutesLabel(ms: number): string {
  const total = Math.round(ms / 60_000);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** "em 12 min", "em 2h 5min", "agora". */
export function untilLabel(ms: number): string {
  return ms < 60_000 ? 'agora' : `em ${minutesLabel(ms)}`;
}
