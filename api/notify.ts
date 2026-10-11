import {
  buildNotifications,
  DEFAULT_NOTIFY_PREFS,
  localDate,
  type DigestRecord,
  type NotifyPrefs,
  type NotifySlot,
} from '../src/shared/digest.js';
import { getDb, isDatabaseConfigured } from '../server/db.js';
import { errorResponse, json } from '../server/http.js';
import { isPushConfigured, sendPush } from '../server/push.js';

/** Coleções que o resumo usa (o resto dos dados nem sai do banco). */
const COLLECTIONS = ['tasks', 'habits', 'habitLogs', 'recurring', 'accounts', 'reviews'];

/**
 * Agendado pela Vercel (vercel.json → crons): 8h e 20h de Brasília.
 * Só aceita chamadas com o `CRON_SECRET`, que a Vercel envia sozinha.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return errorResponse(401, 'Não autorizado.');
  }
  if (!isDatabaseConfigured() || !isPushConfigured()) return json({ sent: 0, skipped: 'não configurado' });

  const slot = new URL(request.url).searchParams.get('slot');
  if (slot !== 'morning' && slot !== 'evening') return errorResponse(400, 'Use ?slot=morning ou ?slot=evening.');

  const db = getDb();
  const subscriptions = await db.pushSubscription.findMany();
  if (!subscriptions.length) return json({ sent: 0 });

  const recent = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.$queryRaw<DigestRecord[]>`
    SELECT collection, data FROM sync_records
    WHERE data IS NOT NULL AND collection = ANY(${COLLECTIONS})
      AND (collection NOT IN ('tasks', 'habitLogs') OR data->>'date' >= ${recent})`;

  let sent = 0;
  const now = new Date();
  for (const sub of subscriptions) {
    const prefs = { ...DEFAULT_NOTIFY_PREFS, ...(sub.prefs as Partial<NotifyPrefs>) };
    const today = localDate(now, sub.timeZone);
    for (const notification of buildNotifications(rows, today, slot as NotifySlot, prefs)) {
      try {
        if (!(await sendPush(sub, notification))) break; // inscrição expirada: já foi apagada
        sent++;
      } catch (error) {
        console.error('[notify] falha ao enviar', error);
      }
    }
  }
  return json({ sent, devices: subscriptions.length });
}
