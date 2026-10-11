import { localDate } from '../src/shared/dates.js';
import { daySummary, summaryText } from '../src/shared/summary.js';
import { isDatabaseConfigured } from '../server/db.js';
import { loadRecords, reply, timeZoneOf } from '../server/shortcuts.js';
import { verifyApiToken } from '../server/tokens.js';

/** "Como estou hoje?": saldo, quanto dá para gastar, o que falta e o que vence. Para os Atalhos. */
export async function GET(request: Request): Promise<Response> {
  if (!isDatabaseConfigured()) return reply(request, 'O Sísifo ainda não tem banco configurado.', {}, 503);
  if (!(await verifyApiToken(request))) return reply(request, 'Chave inválida ou revogada. Gere outra em Configurações → Atalhos do iPhone.', {}, 401);

  const today = localDate(new Date(), timeZoneOf(request));
  const records = await loadRecords(['transactions', 'recurring', 'accounts', 'tasks', 'habits', 'habitLogs']);
  const summary = daySummary(records, today);
  return reply(request, summaryText(summary), { summary });
}
