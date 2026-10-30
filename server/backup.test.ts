import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A rota do backup com o banco e o Blob simulados. */

const blob = vi.hoisted(() => ({
  put: vi.fn(),
  list: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
}));
vi.mock('@vercel/blob', () => blob);

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock('./db.js', () => ({
  isDatabaseConfigured: () => Boolean(process.env.DATABASE_URL),
  getDb: () => ({ $queryRaw: queryRaw }),
}));

const { GET } = await import('../api/backup');
const { createSessionToken, SESSION_COOKIE } = await import('./auth');

const SECRET = 'segredo-do-cron';
const cron = () => new Request('https://sisifo.test/api/backup', { headers: { authorization: `Bearer ${SECRET}` } });
const app = (query = '') =>
  new Request(`https://sisifo.test/api/backup${query}`, { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken()}` } });

const stored = (date: string) => ({
  pathname: `backups/sisifo-backup-${date}.json`,
  uploadedAt: new Date(`${date}T06:00:00Z`),
  size: 1234,
});

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
  process.env.SISIFO_PASSWORD_HASH = 'scrypt:placeholder';
  process.env.DATABASE_URL = 'postgres://teste';
  process.env.BLOB_STORE_ID = 'store_teste';
  for (const fn of Object.values(blob)) fn.mockReset();
  queryRaw.mockReset();
});

afterEach(() => {
  for (const key of ['CRON_SECRET', 'SESSION_SECRET', 'SISIFO_PASSWORD_HASH', 'DATABASE_URL', 'BLOB_STORE_ID']) delete process.env[key];
});

describe('GET /api/backup', () => {
  it('sem segredo do cron nem sessão: 401', async () => {
    expect((await GET(new Request('https://sisifo.test/api/backup'))).status).toBe(401);
    const wrong = new Request('https://sisifo.test/api/backup', { headers: { authorization: 'Bearer outro' } });
    expect((await GET(wrong)).status).toBe(401);
  });

  it('cron sem Blob configurado responde skipped, como o notify', async () => {
    delete process.env.BLOB_STORE_ID;
    expect(await (await GET(cron())).json()).toEqual({ saved: false, skipped: 'não configurado' });
    expect(blob.put).not.toHaveBeenCalled();
  });

  it('cron grava privado, com nome datado, e apaga além das 8 cópias', async () => {
    queryRaw.mockResolvedValue([{ collection: 'tasks', id: 'k1', data: { id: 'k1', title: 'X', area: 'routine', status: 'todo', date: '2026-11-01', createdAt: 'x' } }]);
    const dates = Array.from({ length: 9 }, (_, i) => `2026-0${(i % 9) + 1}-01`);
    blob.list.mockResolvedValue({ blobs: dates.map(stored) });

    const res = await GET(cron());
    expect(res.status).toBe(200);
    const [pathname, body, options] = blob.put.mock.calls[0]!;
    expect(pathname).toMatch(/^backups\/sisifo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(options).toMatchObject({ access: 'private', allowOverwrite: true, addRandomSuffix: false });
    expect(JSON.parse(body as string)).toMatchObject({ app: 'sisifo', version: 3, personal: { tasks: [{ id: 'k1' }] } });
    expect(blob.del).toHaveBeenCalledWith(['backups/sisifo-backup-2026-01-01.json']);
  });

  it('app logado vê a data do último backup', async () => {
    blob.list.mockResolvedValue({ blobs: [stored('2026-10-25'), stored('2026-11-01')] });
    expect(await (await GET(app())).json()).toEqual({
      configured: true,
      latest: { uploadedAt: '2026-11-01T06:00:00.000Z', size: 1234 },
    });
  });

  it('app logado baixa o mais recente, sem cache', async () => {
    blob.list.mockResolvedValue({ blobs: [stored('2026-11-01')] });
    blob.get.mockResolvedValue({ statusCode: 200, stream: new Response('{"app":"sisifo"}').body });
    const res = await GET(app('?download=1'));
    expect(blob.get).toHaveBeenCalledWith('backups/sisifo-backup-2026-11-01.json', { access: 'private' });
    expect(res.headers.get('content-disposition')).toContain('sisifo-backup-2026-11-01.json');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.text()).toBe('{"app":"sisifo"}');
  });

  it('app sem Blob configurado: avisa, sem erro', async () => {
    delete process.env.BLOB_STORE_ID;
    expect(await (await GET(app())).json()).toEqual({ configured: false, latest: null });
  });
});
