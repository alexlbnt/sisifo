import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThrottle } from './report';

describe('limite de envios', () => {
  it('o mesmo erro só volta depois de 5 minutos', () => {
    const allow = createThrottle(5 * 60_000, 20);
    expect(allow('a', 0)).toBe(true);
    expect(allow('a', 60_000)).toBe(false);
    expect(allow('b', 60_000)).toBe(true);
    expect(allow('a', 5 * 60_000)).toBe(true);
  });

  it('no máximo N por abertura do app', () => {
    const allow = createThrottle(0, 3);
    expect([1, 2, 3, 4].map((i) => allow(`e${i}`, i))).toEqual([true, true, true, false]);
  });
});

describe('reportError', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { pathname: '/finance/transactions' });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1' });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), addEventListener: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('envia só o relatório limpo, sem os dados', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}'));
    const { reportError } = await import('./report');
    reportError('window', new TypeError('Não salvou "Aluguel do apartamento da praia" de R$ 2.500,00'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/log');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ kind: 'window', route: '/finance/transactions', device: 'iOS 18 · Safari · instalado' });
    expect(body.message).toBe('TypeError: Não salvou "…" de R$ #');
    expect(JSON.stringify(body)).not.toMatch(/Aluguel|2\.500/);
  });

  it('o mesmo erro repetido em seguida não sai de novo', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}'));
    const { reportError } = await import('./report');
    for (let i = 0; i < 5; i++) reportError('sync', new Error('Erro no servidor.'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('sem rede, guarda e tenta de novo depois', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(new Response('{"ok":true}'));
    const { reportError } = await import('./report');
    reportError('sync', new Error('primeiro'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    reportError('sync', new Error('segundo')); // o envio do segundo leva o primeiro junto
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const messages = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string).message);
    expect(messages).toEqual(['Error: primeiro', 'Error: primeiro', 'Error: segundo']);
  });
});
