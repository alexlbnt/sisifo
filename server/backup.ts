import { del, get, list, put, type ListBlobResultBlob } from '@vercel/blob';
import {
  BACKUP_PREFIX,
  backupFromRecords,
  backupPathname,
  backupsToDelete,
} from '../src/shared/backup.js';
import { localDate } from '../src/shared/dates.js';
import { getDb } from './db.js';
import { DEFAULT_TIME_ZONE } from './shortcuts.js';

/**
 * Backup automático no Vercel Blob privado. Na Vercel, a SDK se autentica por
 * OIDC (`BLOB_STORE_ID`, criado ao conectar o store ao projeto); fora dela, pelo
 * `BLOB_READ_WRITE_TOKEN`.
 */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

interface Row {
  collection: string;
  id: string;
  data: unknown;
}

/** Grava o backup de hoje (fuso de Brasília) e apaga as cópias além das 8 mais novas. */
export async function createBackup(now = new Date()) {
  const rows = await getDb().$queryRaw<Row[]>`
    SELECT collection, id, data FROM sync_records WHERE data IS NOT NULL`;
  const body = JSON.stringify(backupFromRecords(rows, now.toISOString()));
  const pathname = backupPathname(localDate(now, DEFAULT_TIME_ZONE));
  await put(pathname, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });

  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  const old = backupsToDelete(blobs);
  if (old.length) await del(old.map((b) => b.pathname));
  return { pathname, bytes: Buffer.byteLength(body), records: rows.length, deleted: old.length };
}

export async function latestBackup(): Promise<ListBlobResultBlob | null> {
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  return backupsToDelete(blobs, 0)[0] ?? null;
}

export async function readBackup(pathname: string) {
  const result = await get(pathname, { access: 'private' });
  return result?.statusCode === 200 ? result : null;
}
