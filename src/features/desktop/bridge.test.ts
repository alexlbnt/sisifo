import { describe, expect, it } from 'vitest';
import { BridgeTimeout, createBridgeClient, createBridgeHost, type BridgeSummary, type Transport } from './bridge';

/** Transporte em memória: entrega assíncrona, como os eventos do Tauri. */
function memoryTransport(): Transport {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    send: async (channel, payload) => {
      for (const h of handlers.get(channel) ?? []) queueMicrotask(() => h(payload));
    },
    on: (channel, handler) => {
      if (!handlers.has(channel)) handlers.set(channel, new Set());
      handlers.get(channel)!.add(handler);
      return () => handlers.get(channel)!.delete(handler);
    },
  };
}

const summary: BridgeSummary = { pending: 2, day: '2026-11-24' };

describe('ponte entre janelas', () => {
  it('request devolve a resposta do host', async () => {
    const t = memoryTransport();
    createBridgeHost(t, { handle: () => ({ ok: true, message: 'x' }), summary: () => summary });
    const client = createBridgeClient(t);
    await expect(client.request({ type: 'capture.submit', text: 'café 8,50' })).resolves.toEqual({ ok: true, message: 'x' });
  });

  it('duas requisições ao mesmo tempo recebem cada uma a sua resposta', async () => {
    const t = memoryTransport();
    createBridgeHost(t, {
      handle: async (cmd) => {
        if (cmd.text === 'a') await new Promise((r) => setTimeout(r, 20));
        return { ok: true, message: `eco ${cmd.text}` };
      },
      summary: () => summary,
    });
    const client = createBridgeClient(t);
    const [a, b] = await Promise.all([
      client.request({ type: 'capture.submit', text: 'a' }),
      client.request({ type: 'capture.submit', text: 'b' }),
    ]);
    expect(a).toEqual({ ok: true, message: 'eco a' });
    expect(b).toEqual({ ok: true, message: 'eco b' });
  });

  it('request rejeita com BridgeTimeout quando nenhum host responde', async () => {
    const client = createBridgeClient(memoryTransport(), { timeoutMs: 50 });
    await expect(client.request({ type: 'capture.preview', text: 'x' })).rejects.toBeInstanceOf(BridgeTimeout);
  });

  it('erro no host vira rejeição no cliente', async () => {
    const t = memoryTransport();
    createBridgeHost(t, {
      handle: () => {
        throw new Error('falhou');
      },
      summary: () => summary,
    });
    await expect(createBridgeClient(t).request({ type: 'capture.preview', text: 'x' })).rejects.toThrow('falhou');
  });

  it('onSummary recebe o resumo ao se inscrever e a cada publish()', async () => {
    const t = memoryTransport();
    let current = summary;
    const host = createBridgeHost(t, { handle: () => null, summary: () => current });
    const seen: BridgeSummary[] = [];
    createBridgeClient(t).onSummary((s) => seen.push(s));
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([summary]);
    current = { pending: 3, day: '2026-11-24' };
    host.publish();
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([summary, current]);
  });
});
