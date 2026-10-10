import { syncRequestSchema } from '../src/shared/sync.js';
import { isAuthConfigured } from '../server/auth.js';
import { isDatabaseConfigured } from '../server/db.js';
import { checkMutation, errorResponse, isAuthenticated, json, readJson } from '../server/http.js';
import { applyChanges, pullChanges } from '../server/sync.js';

/**
 * Uma rodada de sincronização: grava o que o aparelho mudou e devolve
 * o que mudou no servidor depois do cursor do aparelho.
 */
export async function POST(request: Request): Promise<Response> {
  const rejected = checkMutation(request);
  if (rejected) return rejected;
  if (!isDatabaseConfigured() || !isAuthConfigured()) {
    return errorResponse(503, 'Sincronização não configurada no servidor.');
  }
  if (!isAuthenticated(request)) return errorResponse(401, 'Sessão expirada. Entre de novo.');

  const parsed = syncRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorResponse(400, `Dados inválidos (${issue?.path.join('.') || 'corpo'}: ${issue?.message}).`);
  }

  await applyChanges(parsed.data.changes);
  return json(await pullChanges(parsed.data.cursor));
}
