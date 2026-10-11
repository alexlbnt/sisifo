import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './db.js';

/** Prefixo para a chave ser reconhecível (e fácil de achar se vazar num print). */
const PREFIX = 'sis_';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Cria uma chave nova. Devolve a chave em texto uma única vez; o banco guarda só o hash. */
export async function createApiToken(name: string): Promise<{ id: string; token: string }> {
  const token = PREFIX + randomBytes(24).toString('base64url');
  const id = randomUUID();
  await getDb().apiToken.create({ data: { id, name, tokenHash: hashToken(token) } });
  return { id, token };
}

/**
 * Confere o `Authorization: Bearer sis_...`. Atalhos não mandam cookie, por isso
 * as rotas deles usam chave. A busca é pelo hash: a chave nunca é comparada em texto.
 */
export async function verifyApiToken(request: Request): Promise<{ id: string; name: string } | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token.startsWith(PREFIX) || token.length > 100) return null;
  const db = getDb();
  const row = await db.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row) return null;
  await db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return { id: row.id, name: row.name };
}
