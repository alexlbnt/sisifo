import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** /api/summary com o banco, a chave e a agenda simulados. */

const verifyApiToken = vi.hoisted(() => vi.fn());
vi.mock('./tokens.js', () => ({ verifyApiToken }));

const loadRecords = vi.hoisted(() => vi.fn());
vi.mock('./shortcuts.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./shortcuts')>()),
  loadRecords,
}));

const loadAgenda = vi.hoisted(() => vi.fn());
vi.mock('./agenda.js', () => ({
  icalUrls: () => (process.env.GOOGLE_ICAL_URL ? [process.env.GOOGLE_ICAL_URL] : []),
  loadAgenda,
}));

const { GET } = await import('../api/summary');

const widget = (headers: Record<string, string> = { authorization: 'Bearer sis_teste' }) =>
  new Request('https://sisifo.test/api/summary?format=widget&tz=America/Sao_Paulo', { headers });

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://teste';
  verifyApiToken.mockReset().mockResolvedValue({ id: 't1', name: 'iPhone' });
  loadRecords.mockReset().mockResolvedValue([{ collection: 'tasks', data: { title: 'Mercado', status: 'todo', date: '2099-01-01' } }]);
  loadAgenda.mockReset();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.GOOGLE_ICAL_URL;
});

describe('GET /api/summary?format=widget', () => {
  it('sem chave válida: 401 em JSON, que o widget mostra', async () => {
    verifyApiToken.mockResolvedValue(null);
    const res = await GET(widget({}));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, message: expect.stringContaining('Chave inválida') });
  });

  it('JSON enxuto, sem cache', async () => {
    const res = await GET(widget());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ['allowance', 'allowanceCents', 'habits', 'line', 'next', 'nextTasks', 'overdue', 'pendingHabits', 'tasks', 'today', 'v'].sort(),
    );
    expect(loadAgenda).not.toHaveBeenCalled(); // sem Google Calendar configurado
  });

  it('Google Calendar fora do ar não derruba o widget', async () => {
    process.env.GOOGLE_ICAL_URL = 'https://calendar.test/secreto.ics';
    loadAgenda.mockRejectedValue(new Error('timeout'));
    const res = await GET(widget());
    expect(res.status).toBe(200);
    expect((await res.json()).v).toBe(1);
  });

  it('sem format=widget, segue o resumo de sempre', async () => {
    const res = await GET(new Request('https://sisifo.test/api/summary?format=text', { headers: { authorization: 'Bearer sis_teste' } }));
    expect(res.headers.get('content-type')).toContain('text/plain');
  });
});
