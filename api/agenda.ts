import type { AgendaResponse } from '../src/shared/agenda.js';
import { localDate } from '../src/shared/dates.js';
import { icalUrls, loadAgenda } from '../server/agenda.js';
import { errorResponse, isAuthenticated, json } from '../server/http.js';
import { timeZoneOf } from '../server/shortcuts.js';

/** Compromissos do dia (Google Calendar via iCal) para o Modo Painel. `?date=YYYY-MM-DD&tz=...` */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthenticated(request)) return errorResponse(401, 'Entre no Sísifo para ver a agenda.');

  const timeZone = timeZoneOf(request);
  const asked = new URL(request.url).searchParams.get('date');
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : localDate(new Date(), timeZone);

  if (!icalUrls().length) return json({ configured: false, date, events: [] } satisfies AgendaResponse);
  try {
    const events = await loadAgenda(date, timeZone);
    return json({ configured: true, date, events } satisfies AgendaResponse);
  } catch (error) {
    // Sem o endereço na mensagem: ele é a credencial do calendário.
    console.error('agenda:', error instanceof Error ? error.message : 'falha desconhecida');
    return errorResponse(502, 'Não foi possível ler o Google Calendar agora.');
  }
}
