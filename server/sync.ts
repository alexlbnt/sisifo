import type { SyncChange, SyncRequest, SyncResponse } from '../src/shared/sync.js';
import { MAX_PULL } from '../src/shared/sync.js';
import { getDb } from './db.js';

/**
 * Grava as alterações do aparelho. Regra: a alteração mais recente vence
 * (`updatedAt` do aparelho). Cada escrita aceita recebe um `seq` novo, que
 * é o que os outros aparelhos usam para saber o que mudou.
 */
export async function applyChanges(changes: SyncRequest['changes']): Promise<void> {
  if (!changes.length) return;

  // Um item repetido no mesmo lote quebraria o ON CONFLICT: fica só a versão mais nova.
  const latest = new Map<string, SyncRequest['changes'][number]>();
  for (const c of changes) {
    const key = `${c.collection}|${c.id}`;
    const current = latest.get(key);
    if (!current || current.updatedAt < c.updatedAt) latest.set(key, c);
  }

  // Um único comando para o lote inteiro: atômico e com uma só ida ao banco.
  await getDb().$executeRaw`
    INSERT INTO sync_records (collection, id, data, "updatedAt")
    SELECT c.collection, c.id, NULLIF(c.data, 'null'::jsonb), c."updatedAt"
    FROM jsonb_to_recordset(${JSON.stringify([...latest.values()])}::jsonb)
      AS c(collection text, id text, data jsonb, "updatedAt" timestamptz)
    ON CONFLICT (collection, id) DO UPDATE
      SET data = EXCLUDED.data,
          "updatedAt" = EXCLUDED."updatedAt",
          seq = nextval(pg_get_serial_sequence('sync_records', 'seq'))
      WHERE sync_records."updatedAt" < EXCLUDED."updatedAt"`;
}

interface Row {
  collection: string;
  id: string;
  data: unknown;
  updatedAt: Date;
  seq: bigint;
}

/** Tudo o que mudou depois do cursor, em ordem de escrita. */
export async function pullChanges(cursor: string | null): Promise<SyncResponse> {
  const db = getDb();
  const after = BigInt(cursor ?? '0');
  const rows = await db.$queryRaw<Row[]>`
    SELECT collection, id, data, "updatedAt", seq
    FROM sync_records
    WHERE seq > ${after}
    ORDER BY seq
    LIMIT ${MAX_PULL}`;

  const changes: SyncChange[] = rows.map((r) => ({
    collection: r.collection as SyncChange['collection'],
    id: r.id,
    data: r.data ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));
  const last = rows[rows.length - 1];
  return {
    changes,
    cursor: last ? last.seq.toString() : cursor,
    more: rows.length === MAX_PULL,
  };
}
