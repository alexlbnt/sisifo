import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncResponse } from '@/shared/sync';

/**
 * O motor de ponta a ponta, com a API simulada: uma alteração numa store só
 * faz o motor comparar as coleções dela; de tempos em tempos, compara tudo.
 */

vi.mock('./api', () => ({
  api: { sync: vi.fn() },
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  NetworkError: class NetworkError extends Error {},
}));

vi.mock('@/features/errors/report', () => ({ reportError: vi.fn() }));

vi.mock('./diff', async (importOriginal) => {
  const original = await importOriginal<typeof import('./diff')>();
  return { ...original, detectChanges: vi.fn(original.detectChanges) };
});

const { api, HttpError } = await import('./api');
const { detectChanges } = await import('./diff');
const { startSync, syncNow, useSyncStore } = await import('./engine');
const { reportError } = await import('@/features/errors/report');
const { useFinanceStore } = await import('@/features/finance/store');

const sync = vi.mocked(api.sync);
const detect = vi.mocked(detectChanges);
const empty: SyncResponse = { changes: [], cursor: '1', more: false };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('motor: só as coleções alteradas', () => {
  it('lançamento novo compara só transactions; o poll faz a varredura completa', async () => {
    // Primeiro vínculo: o servidor já tem dados (substituem os de exemplo).
    sync.mockResolvedValueOnce({
      changes: [
        {
          collection: 'tasks',
          id: 'k1',
          data: { id: 'k1', title: 'Ligar pro banco', area: 'routine', status: 'todo', date: '2026-10-30', createdAt: '2026-10-29T10:00:00.000Z' },
          updatedAt: '2026-10-29T10:00:00.000Z',
        },
      ],
      cursor: '1',
      more: false,
    });
    sync.mockResolvedValue(empty);
    await startSync({ onUnauthorized: () => {} });
    // Começa sempre com a varredura completa.
    expect(detect.mock.calls.at(-1)?.[3]).toBeUndefined();
    await vi.runOnlyPendingTimersAsync();

    detect.mockClear();
    sync.mockClear();
    useFinanceStore.getState().addTransaction({ title: 'Café', amountCents: 850, type: 'expense', category: 'food', date: '2026-10-30' });
    await vi.advanceTimersByTimeAsync(400 + 1500 + 50);

    const [current, , , scope] = detect.mock.calls[0]!;
    expect(scope).toEqual(new Set(['transactions']));
    expect([...current.keys()].every((k) => k.startsWith('transactions|'))).toBe(true);
    const sent = sync.mock.calls.flatMap(([body]) => body.changes);
    expect(sent.map((c) => c.collection)).toEqual(['transactions']);
    expect(sent[0]?.data).toMatchObject({ title: 'Café', amountCents: 850 });

    // Rede de segurança: na 10ª rodada do poll (~10 min), compara tudo.
    detect.mockClear();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(detect.mock.calls.some((call) => call[3] === undefined)).toBe(true);
  });
});

describe('motor: erro de sincronização visível e registrado', () => {
  // Continua do teste anterior: o motor já está ligado e vinculado.
  it('conta as falhas seguidas, registra cada uma e zera ao voltar', async () => {
    sync.mockRejectedValue(new HttpError(500, 'Erro no servidor.'));
    for (let i = 0; i < 3; i++) await syncNow();
    expect(useSyncStore.getState()).toMatchObject({ status: 'error', error: 'Erro no servidor.', failures: 3 });
    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(reportError).mock.calls[0]![0]).toBe('sync');

    sync.mockResolvedValue(empty);
    await syncNow();
    expect(useSyncStore.getState()).toMatchObject({ status: 'synced', failures: 0 });
  });
});
