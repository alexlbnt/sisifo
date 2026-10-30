import { createBackup, isBlobConfigured, latestBackup, readBackup } from '../server/backup.js';
import { isDatabaseConfigured } from '../server/db.js';
import { errorResponse, isAuthenticated, json } from '../server/http.js';

/**
 * Backup automático. Uma rota só para as duas pontas (o plano Hobby limita a
 * 12 funções por deploy):
 * - Vercel Cron (vercel.json, domingo 6h UTC), com o `CRON_SECRET`: grava o backup;
 * - o app, com a sessão: `GET` diz o último backup; `?download=1` baixa o arquivo.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return runScheduled();

  if (!isAuthenticated(request)) return errorResponse(401, 'Sessão expirada. Entre de novo.');
  if (!isDatabaseConfigured() || !isBlobConfigured()) return json({ configured: false, latest: null });

  const latest = await latestBackup();
  if (new URL(request.url).searchParams.get('download') !== '1') {
    return json({
      configured: true,
      latest: latest && { uploadedAt: latest.uploadedAt.toISOString(), size: latest.size },
    });
  }

  const file = latest && (await readBackup(latest.pathname));
  if (!file) return errorResponse(404, 'Ainda não há backup automático.');
  return new Response(file.stream, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${latest.pathname.slice(latest.pathname.lastIndexOf('/') + 1)}"`,
      'X-Content-Type-Options': 'nosniff',
      // Dados pessoais: nunca em cache.
      'Cache-Control': 'private, no-store',
    },
  });
}

async function runScheduled(): Promise<Response> {
  if (!isDatabaseConfigured() || !isBlobConfigured()) return json({ saved: false, skipped: 'não configurado' });
  try {
    return json({ saved: true, ...(await createBackup()) });
  } catch (error) {
    console.error('[backup] falhou:', error instanceof Error ? error.message : error);
    return errorResponse(500, 'Falha ao gravar o backup.');
  }
}
