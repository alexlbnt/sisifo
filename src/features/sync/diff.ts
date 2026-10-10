import type { SyncChange } from '@/shared/sync';
import { parseKey, recordKey, type LocalRecord } from './collections';

/** JSON com chaves ordenadas: o Postgres (jsonb) reordena chaves, e o hash não pode mudar por isso. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Hash curto (FNV-1a 32 bits): só para saber se um item mudou, não é segurança. */
export function hashValue(value: unknown): string {
  const text = stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export type Shadow = Record<string, string>;
export type Outbox = Record<string, SyncChange>;

/**
 * Compara a fotografia local com a última conhecida (`shadow`) e devolve
 * as alterações novas. Itens sumidos viram exclusões (`data: null`).
 */
export function detectChanges(
  current: Map<string, LocalRecord>,
  shadow: Shadow,
  now: string,
): { shadow: Shadow; changes: SyncChange[] } {
  const next: Shadow = {};
  const changes: SyncChange[] = [];

  for (const [key, record] of current) {
    const hash = hashValue(record.data);
    next[key] = hash;
    if (shadow[key] !== hash) {
      changes.push({ collection: record.collection, id: record.id, data: record.data, updatedAt: now });
    }
  }
  for (const key of Object.keys(shadow)) {
    if (!(key in next)) {
      const { collection, id } = parseKey(key);
      changes.push({ collection, id, data: null, updatedAt: now });
    }
  }
  return { shadow: next, changes };
}

/**
 * Filtra o que veio do servidor: descarta o que já temos igual e o que perde
 * para uma alteração local mais nova ainda não enviada.
 */
export function selectRemoteToApply(
  remote: SyncChange[],
  shadow: Shadow,
  outbox: Outbox,
): SyncChange[] {
  return remote.filter((change) => {
    const key = recordKey(change.collection, change.id);
    const pending = outbox[key];
    if (pending && pending.updatedAt > change.updatedAt) return false;
    const remoteHash = change.data === null ? undefined : hashValue(change.data);
    return shadow[key] !== remoteHash;
  });
}
