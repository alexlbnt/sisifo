import { errorReportSchema } from '../src/shared/errors.js';
import { isAuthConfigured } from '../server/auth.js';
import { getDb, isDatabaseConfigured } from '../server/db.js';
import { recentErrors, recordError } from '../server/errors.js';
import { checkMutation, clientIp, errorResponse, isAuthenticated, json, readJson } from '../server/http.js';

/**
 * Erros do app (sem dados pessoais), vistos em Configurações → Erros recentes.
 * POST registra, GET lista, DELETE limpa. Tudo com a sessão do app.
 */
function guard(request: Request, mutation: boolean): Response | null {
  if (mutation) {
    const rejected = checkMutation(request);
    if (rejected) return rejected;
  }
  if (!isDatabaseConfigured() || !isAuthConfigured()) return errorResponse(503, 'Sincronização não configurada no servidor.');
  if (!isAuthenticated(request)) return errorResponse(401, 'Sessão expirada. Entre de novo.');
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const rejected = guard(request, true);
  if (rejected) return rejected;
  const parsed = errorReportSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'Relatório de erro inválido.');
  if (!(await recordError(parsed.data, clientIp(request)))) {
    return errorResponse(429, 'Muitos erros enviados. Os próximos ficam para depois.');
  }
  return json({ ok: true });
}

export async function GET(request: Request): Promise<Response> {
  const rejected = guard(request, false);
  if (rejected) return rejected;
  return json({ errors: await recentErrors() });
}

export async function DELETE(request: Request): Promise<Response> {
  const rejected = guard(request, true);
  if (rejected) return rejected;
  await getDb().errorLog.deleteMany({});
  return json({ ok: true });
}
