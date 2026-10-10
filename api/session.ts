import type { SessionStatus } from '../src/shared/sync.js';
import {
  clearSessionCookie,
  createSessionToken,
  isAuthConfigured,
  sessionCookie,
  verifyPassword,
} from '../server/auth.js';
import { getDb, isDatabaseConfigured } from '../server/db.js';
import {
  checkMutation,
  clientIp,
  errorResponse,
  isAuthenticated,
  isSecure,
  json,
  readJson,
} from '../server/http.js';

const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

function configured(): boolean {
  return isDatabaseConfigured() && isAuthConfigured();
}

/** Estado da sessão: o app decide se mostra login, sincroniza ou roda só local. */
export function GET(request: Request): Response {
  const status: SessionStatus = {
    configured: configured(),
    authenticated: configured() && isAuthenticated(request),
  };
  return json(status);
}

/** Login com a senha única. Limita tentativas erradas por IP. */
export async function POST(request: Request): Promise<Response> {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  if (!configured()) return errorResponse(503, 'O servidor ainda não tem banco e senha configurados.');

  const body = (await readJson(request)) as { password?: unknown } | undefined;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || password.length > 200) return errorResponse(400, 'Digite a senha.');

  const db = getDb();
  const ip = clientIp(request);
  const since = new Date(Date.now() - WINDOW_MS);
  const failures = await db.loginAttempt.count({ where: { ip, ok: false, createdAt: { gte: since } } });
  if (failures >= MAX_FAILURES) {
    return errorResponse(429, 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.');
  }

  const ok = await verifyPassword(password, process.env.SISIFO_PASSWORD_HASH!);
  await db.loginAttempt.create({ data: { ip, ok } });
  // Limpeza oportunista: o histórico de tentativas só importa por 1 dia.
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });

  if (!ok) {
    const left = MAX_FAILURES - failures - 1;
    return errorResponse(
      401,
      left > 0
        ? `Senha incorreta. ${left} ${left === 1 ? 'tentativa restante' : 'tentativas restantes'}.`
        : 'Senha incorreta. Espere 15 minutos e tente de novo.',
    );
  }

  const status: SessionStatus = { configured: true, authenticated: true };
  return json(status, { headers: { 'Set-Cookie': sessionCookie(createSessionToken(), isSecure(request)) } });
}

/** Sair: apaga o cookie deste aparelho. */
export function DELETE(request: Request): Response {
  const status: SessionStatus = { configured: configured(), authenticated: false };
  return json(status, { headers: { 'Set-Cookie': clearSessionCookie(isSecure(request)) } });
}
