import { z } from 'zod';
import { isAuthConfigured } from '../server/auth.js';
import { getDb, isDatabaseConfigured } from '../server/db.js';
import { checkMutation, errorResponse, isAuthenticated, json, readJson } from '../server/http.js';
import { isPushConfigured, sendPush } from '../server/push.js';

/** Manda uma notificação de teste para este aparelho. */
export async function POST(request: Request): Promise<Response> {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  if (!isDatabaseConfigured() || !isAuthConfigured() || !isPushConfigured()) {
    return errorResponse(503, 'Notificações não configuradas no servidor.');
  }
  if (!isAuthenticated(request)) return errorResponse(401, 'Sessão expirada. Entre de novo.');

  const parsed = z.object({ endpoint: z.url().max(1000) }).safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'Aparelho inválido.');
  const sub = await getDb().pushSubscription.findUnique({ where: { endpoint: parsed.data.endpoint } });
  if (!sub) return errorResponse(404, 'Este aparelho não está inscrito.');

  const sent = await sendPush(sub, {
    title: 'Sísifo',
    body: 'Notificações ligadas. Até amanhã de manhã!',
    url: '/settings',
    tag: 'sisifo-test',
  });
  return sent ? json({ ok: true }) : errorResponse(410, 'A inscrição deste aparelho expirou. Ative de novo.');
}
