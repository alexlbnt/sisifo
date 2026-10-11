import { z } from 'zod';
import { isAuthConfigured } from '../server/auth.js';
import { getDb, isDatabaseConfigured } from '../server/db.js';
import { checkMutation, errorResponse, isAuthenticated, json, readJson } from '../server/http.js';
import { createApiToken } from '../server/tokens.js';

/** Chaves dos Atalhos do iPhone. Gerenciadas pelo app (sessão por cookie). */
function guard(request: Request, mutation: boolean): Response | null {
  if (mutation) {
    const rejected = checkMutation(request);
    if (rejected) return rejected;
  }
  if (!isDatabaseConfigured() || !isAuthConfigured()) return errorResponse(503, 'Sincronização não configurada no servidor.');
  if (!isAuthenticated(request)) return errorResponse(401, 'Sessão expirada. Entre de novo.');
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const rejected = guard(request, false);
  if (rejected) return rejected;
  const rows = await getDb().apiToken.findMany({
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return json({ tokens: rows });
}

export async function POST(request: Request): Promise<Response> {
  const rejected = guard(request, true);
  if (rejected) return rejected;
  const parsed = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'Dê um nome à chave (ex.: iPhone).');
  if ((await getDb().apiToken.count()) >= 10) return errorResponse(400, 'Limite de 10 chaves. Revogue uma antes de criar outra.');
  return json(await createApiToken(parsed.data.name));
}

export async function DELETE(request: Request): Promise<Response> {
  const rejected = guard(request, true);
  if (rejected) return rejected;
  const parsed = z.object({ id: z.string().min(1).max(100) }).safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(400, 'Chave inválida.');
  await getDb().apiToken.deleteMany({ where: { id: parsed.data.id } });
  return json({ ok: true });
}
