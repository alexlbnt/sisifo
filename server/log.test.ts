import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A rota /api/log com o banco simulado. */

const errorLog = vi.hoisted(() => ({
  count: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));
const executeRaw = vi.hoisted(() => vi.fn());
vi.mock('./db.js', () => ({
  isDatabaseConfigured: () => Boolean(process.env.DATABASE_URL),
  getDb: () => ({ errorLog, $executeRaw: executeRaw }),
}));

const { DELETE, GET, POST } = await import('../api/log');
const { createSessionToken, SESSION_COOKIE } = await import('./auth');
const { MAX_REPORTS } = await import('./errors');

const session = () => `${SESSION_COOKIE}=${createSessionToken()}`;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://sisifo.test/api/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session(), 'x-forwarded-for': '1.2.3.4', ...headers },
    body: JSON.stringify(body),
  });
const report = { kind: 'window', message: 'Falhou ao salvar "Consulta no dentista às 14h" de R$ 320,00', route: '/?captura=1' };

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
  process.env.SISIFO_PASSWORD_HASH = 'scrypt:placeholder';
  process.env.DATABASE_URL = 'postgres://teste';
  for (const fn of Object.values(errorLog)) fn.mockReset();
  executeRaw.mockReset();
  errorLog.count.mockResolvedValue(0);
});

afterEach(() => {
  for (const key of ['SESSION_SECRET', 'SISIFO_PASSWORD_HASH', 'DATABASE_URL']) delete process.env[key];
});

describe('POST /api/log', () => {
  it('sem sessão: 401; sem JSON: 415', async () => {
    expect((await POST(post(report, { cookie: '' }))).status).toBe(401);
    const text = new Request('https://sisifo.test/api/log', { method: 'POST', headers: { cookie: session() }, body: 'x' });
    expect((await POST(text)).status).toBe(415);
    expect(errorLog.upsert).not.toHaveBeenCalled();
  });

  it('relatório fora do formato: 400', async () => {
    expect((await POST(post({ kind: 'outro', message: 'x' }))).status).toBe(400);
  });

  it('grava limpo de novo no servidor (mesmo que o app não limpe) e agrupa iguais', async () => {
    expect((await POST(post(report))).status).toBe(200);
    const { create, update, where } = errorLog.upsert.mock.calls[0]![0];
    expect(create.message).toBe('Falhou ao salvar "…" de R$ #');
    expect(create.route).toBe('/');
    expect(create.ipHash).not.toContain('1.2.3.4');
    expect(where.fingerprint).toBe(create.fingerprint);
    expect(update.count).toEqual({ increment: 1 });
    expect(executeRaw).toHaveBeenCalled(); // limpeza das linhas antigas
  });

  it(`passou de ${MAX_REPORTS} envios em 10 minutos: 429`, async () => {
    errorLog.count.mockResolvedValue(MAX_REPORTS);
    expect((await POST(post(report))).status).toBe(429);
    expect(errorLog.upsert).not.toHaveBeenCalled();
  });
});

describe('GET e DELETE /api/log', () => {
  it('lista e limpa com a sessão', async () => {
    errorLog.findMany.mockResolvedValue([{ id: 'e1', message: 'x' }]);
    const list = await GET(new Request('https://sisifo.test/api/log', { headers: { cookie: session() } }));
    expect(await list.json()).toEqual({ errors: [{ id: 'e1', message: 'x' }] });

    const del = new Request('https://sisifo.test/api/log', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie: session() },
    });
    expect((await DELETE(del)).status).toBe(200);
    expect(errorLog.deleteMany).toHaveBeenCalled();
  });

  it('sem sessão não lista', async () => {
    expect((await GET(new Request('https://sisifo.test/api/log'))).status).toBe(401);
  });
});
