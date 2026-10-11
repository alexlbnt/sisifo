import { z } from 'zod';
import { DEFAULT_NOTIFY_PREFS } from '../src/shared/digest.js';
import { isAuthConfigured } from '../server/auth.js';
import { getDb, isDatabaseConfigured } from '../server/db.js';
import { checkMutation, errorResponse, isAuthenticated, json, readJson } from '../server/http.js';
import { isPushConfigured } from '../server/push.js';

const prefsSchema = z.object({
  morning: z.boolean(),
  evening: z.boolean(),
  bills: z.boolean(),
  review: z.boolean(),
});

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.url().max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
  timeZone: z.string().min(1).max(60),
  prefs: prefsSchema.default(DEFAULT_NOTIFY_PREFS),
});

const endpointSchema = z.object({ endpoint: z.url().max(1000) });

function guard(request: Request, mutation: boolean): Response | null {
  if (mutation) {
    const rejected = checkMutation(request);
    if (rejected) return rejected;
  }
  if (!isDatabaseConfigured() || !isAuthConfigured()) return errorResponse(503, 'Sincronização não configurada no servidor.');
  if (!isPushConfigured()) return errorResponse(503, 'Notificações não configuradas no servidor (chaves VAPID).');
  if (!isAuthenticated(request)) return errorResponse(401, 'Sessão expirada. Entre de novo.');
  return null;
}

/**
 * Estado das notificações. Com `?endpoint=`, diz se este aparelho está
 * inscrito e com quais preferências. A chave pública vai junto para o aparelho
 * poder se inscrever.
 */
export async function GET(request: Request): Promise<Response> {
  const configured = isDatabaseConfigured() && isAuthConfigured() && isPushConfigured();
  if (!configured || !isAuthenticated(request)) {
    return json({ configured, publicKey: null, subscribed: false, prefs: null });
  }
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  const row = endpoint ? await getDb().pushSubscription.findUnique({ where: { endpoint } }) : null;
  return json({
    configured,
    publicKey: process.env.VAPID_PUBLIC_KEY,
    subscribed: Boolean(row),
    prefs: row?.prefs ?? null,
  });
}

/** Inscreve (ou atualiza) este aparelho. */
export async function POST(request: Request): Promise<Response> {
  const rejected = guard(request, true);
  if (rejected) return rejected;
  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'Inscrição inválida.');
  const { subscription, timeZone, prefs } = parsed.data;
  const data = { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, timeZone, prefs };
  await getDb().pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { endpoint: subscription.endpoint, ...data },
    update: data,
  });
  return json({ ok: true });
}

/** Cancela a inscrição deste aparelho. */
export async function DELETE(request: Request): Promise<Response> {
  const rejected = guard(request, true);
  if (rejected) return rejected;
  const parsed = endpointSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'Aparelho inválido.');
  await getDb().pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } });
  return json({ ok: true });
}
