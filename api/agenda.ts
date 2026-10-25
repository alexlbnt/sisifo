import type { AgendaResponse } from '../src/shared/agenda.js';
import { localDate } from '../src/shared/dates.js';
import { icalUrls, loadAgenda } from '../server/agenda.js';
import { errorResponse, isAuthenticated, json } from '../server/http.js';
import { timeZoneOf } from '../server/shortcuts.js';

/** Compromissos (Google Calendar via iCal). `?date=YYYY-MM-DD&days=1..14&tz=...` */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthenticated(request)) return errorResponse(401, 'Entre no Sísifo para ver a agenda.');

  const timeZone = timeZoneOf(request);
  const asked = new URL(request.url).searchParams.get('date');
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : localDate(new Date(), timeZone);
  const days = Math.min(14, Math.max(1, Math.floor(Number(new URL(request.url).searchParams.get('days')) || 1)));

  if (!icalUrls().length) return json({ configured: false, date, days, events: [] } satisfies AgendaResponse);
  try {
    const events = await loadAgenda(date, timeZone, days);
    return json({ configured: true, date, days, events } satisfies AgendaResponse);
  } catch (error) {
    // Sem o endereço na mensagem: ele é a credencial do calendário.
    console.error('agenda:', error instanceof Error ? error.message : 'falha desconhecida');
    return errorResponse(502, 'Não foi possível ler o Google Calendar agora.');
  }
}
