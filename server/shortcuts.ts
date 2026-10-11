import type { DigestRecord } from '../src/shared/digest.js';
import { getDb } from './db.js';
import { json } from './http.js';

/** Fuso usado quando o Atalho não informa (`?tz=`). */
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export function timeZoneOf(request: Request, body?: { timeZone?: unknown }): string {
  const fromQuery = new URL(request.url).searchParams.get('tz');
  const value = typeof body?.timeZone === 'string' ? body.timeZone : fromQuery;
  return value && value.length <= 60 ? value : DEFAULT_TIME_ZONE;
}

/**
 * Resposta para os Atalhos: com `?format=text`, texto puro (o Atalho mostra
 * direto numa notificação); senão, JSON com `message`.
 */
export function reply(request: Request, message: string, extra: Record<string, unknown> = {}, status = 200): Response {
  if (new URL(request.url).searchParams.get('format') === 'text') {
    return new Response(message, {
      status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return json({ ok: status < 400, message, ...extra }, { status });
}

/** Registros atuais (sem lápides) das coleções pedidas. */
export async function loadRecords(collections: string[]): Promise<DigestRecord[]> {
  return getDb().$queryRaw<DigestRecord[]>`
    SELECT collection, data FROM sync_records
    WHERE data IS NOT NULL AND collection = ANY(${collections})`;
}
