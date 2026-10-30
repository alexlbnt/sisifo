import { createHash, randomUUID } from 'node:crypto';
import { cleanReport, fingerprintOf, type ErrorReport } from '../src/shared/errors.js';
import { getDb, isDatabaseConfigured } from './db.js';

/** Envios por IP a cada 10 minutos: um erro em laço não enche o banco. */
export const MAX_REPORTS = 30;
const WINDOW_MS = 10 * 60 * 1000;
/** Linhas guardadas (as mais recentes). */
const KEEP_ROWS = 500;

export const hashIp = (ip: string) => createHash('sha256').update(ip).digest('hex').slice(0, 32);

/** Grava (ou soma, se já existe igual) um erro limpo. Devolve false se passou do limite. */
export async function recordError(report: ErrorReport, ip: string): Promise<boolean> {
  const db = getDb();
  const ipHash = hashIp(ip);
  const recent = await db.errorLog.count({ where: { ipHash, lastSeenAt: { gte: new Date(Date.now() - WINDOW_MS) } } });
  if (recent >= MAX_REPORTS) return false;

  const clean = cleanReport(report);
  const fingerprint = fingerprintOf(clean);
  const now = new Date();
  const details = {
    stack: clean.stack ?? null,
    route: clean.route ?? null,
    appVersion: clean.appVersion ?? null,
    device: clean.device ?? null,
    ipHash,
    lastSeenAt: now,
  };
  await db.errorLog.upsert({
    where: { fingerprint },
    create: { id: randomUUID(), fingerprint, kind: clean.kind, message: clean.message, ...details },
    update: { ...details, count: { increment: 1 } },
  });
  // Limpeza oportunista: só as linhas mais recentes importam.
  await db.$executeRaw`
    DELETE FROM error_logs WHERE id IN (
      SELECT id FROM error_logs ORDER BY "lastSeenAt" DESC OFFSET ${KEEP_ROWS})`;
  return true;
}

/** Erro da própria API (ex.: o cron do backup): grava sem quebrar quem chamou. */
export async function logServerError(route: string, error: unknown): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await recordError(
      {
        kind: 'api',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        route,
      },
      'servidor',
    );
  } catch {
    // Sem banco agora: fica só o console.
  }
}

export async function recentErrors(limit = 50) {
  return getDb().errorLog.findMany({
    orderBy: { lastSeenAt: 'desc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      message: true,
      stack: true,
      route: true,
      appVersion: true,
      device: true,
      count: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });
}
