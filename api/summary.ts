import type { AgendaEvent } from '../src/shared/agenda.js';
import { localDate } from '../src/shared/dates.js';
import { daySummary, summaryText, widgetSummary } from '../src/shared/summary.js';
import { icalUrls, loadAgenda } from '../server/agenda.js';
import { isDatabaseConfigured } from '../server/db.js';
import { json } from '../server/http.js';
import { loadRecords, reply, timeZoneOf } from '../server/shortcuts.js';
import { verifyApiToken } from '../server/tokens.js';

/**
 * "Como estou hoje?": saldo, quanto dá para gastar, o que falta e o que vence. Para os Atalhos.
 * Com `?format=widget`, um JSON enxuto para o widget do Scriptable (scripts/widget/sisifo-widget.js).
 */
export async function GET(request: Request): Promise<Response> {
  if (!isDatabaseConfigured()) return reply(request, 'O Sísifo ainda não tem banco configurado.', {}, 503);
  if (!(await verifyApiToken(request))) return reply(request, 'Chave inválida ou revogada. Gere outra em Configurações → Atalhos do iPhone.', {}, 401);

  const timeZone = timeZoneOf(request);
  const today = localDate(new Date(), timeZone);
  const records = await loadRecords(['transactions', 'recurring', 'accounts', 'tasks', 'habits', 'habitLogs']);
  const summary = daySummary(records, today);
  if (new URL(request.url).searchParams.get('format') === 'widget') {
    return json(widgetSummary(summary, records, today, Date.now(), timeZone, await todayEvents(today, timeZone)));
  }
  return reply(request, summaryText(summary), { summary });
}

/** Agenda de hoje para o widget. Sem Google Calendar (ou fora do ar), null: o widget usa as tarefas. */
async function todayEvents(today: string, timeZone: string): Promise<AgendaEvent[] | null> {
  if (!icalUrls().length) return null;
  try {
    return await loadAgenda(today, timeZone, 1);
  } catch {
    return null;
  }
}
