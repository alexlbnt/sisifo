import { uid } from '@/lib/id';
import type { CaptureGuess } from '@/shared/capture';

/**
 * Ponte entre as janelas do desktop. Só a janela principal carrega as stores e
 * a sincronização (o "host"); as janelas leves (captura, gaveta, mini-Pomodoro)
 * mandam comandos e recebem resumos prontos. Não depende do Tauri: o transporte
 * é injetado (eventos do Tauri no app, memória nos testes).
 */

export interface Transport {
  send(channel: string, payload: unknown): Promise<void>;
  on(channel: string, handler: (payload: unknown) => void): () => void;
}

export type BridgeCommand =
  | { type: 'capture.preview'; text: string; force?: CaptureGuess['kind'] }
  | { type: 'capture.submit'; text: string; force?: CaptureGuess['kind'] };

export interface BridgeReplies {
  'capture.preview': CaptureGuess | null;
  'capture.submit': { ok: boolean; message: string };
}

export interface BridgeSummary {
  pending: number;
  day: string;
}

export const CHANNEL = {
  command: 'sisifo:command',
  reply: 'sisifo:reply',
  summary: 'sisifo:summary',
  summaryRequest: 'sisifo:summary-request',
} as const;

/** Evento que as janelas leves emitem ao aparecer: hora de a janela principal sincronizar. */
export const WINDOW_FOCUSED = 'sisifo:window-focused';

export class BridgeTimeout extends Error {
  constructor() {
    super('A janela principal não respondeu a tempo.');
    this.name = 'BridgeTimeout';
  }
}

interface CommandMessage {
  id: string;
  cmd: BridgeCommand;
}

type ReplyMessage = { id: string; ok: true; value: unknown } | { id: string; ok: false; error: string };

export function createBridgeHost(
  t: Transport,
  h: {
    /** Do lado do host a resposta não é tipada: ela atravessa a ponte como JSON. */
    handle: (cmd: BridgeCommand) => unknown;
    summary: () => BridgeSummary;
  },
): { publish(): void; dispose(): void } {
  const publish = () => void t.send(CHANNEL.summary, h.summary());

  const offCommand = t.on(CHANNEL.command, async (payload) => {
    const { id, cmd } = payload as CommandMessage;
    let reply: ReplyMessage;
    try {
      reply = { id, ok: true, value: await h.handle(cmd) };
    } catch (e) {
      reply = { id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    await t.send(CHANNEL.reply, reply);
  });
  const offRequest = t.on(CHANNEL.summaryRequest, publish);

  return {
    publish,
    dispose: () => {
      offCommand();
      offRequest();
    },
  };
}

export function createBridgeClient(t: Transport, opts: { timeoutMs?: number } = {}) {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  const offReply = t.on(CHANNEL.reply, (payload) => {
    const reply = payload as ReplyMessage;
    const waiter = pending.get(reply.id);
    if (!waiter) return; // resposta de outra janela
    pending.delete(reply.id);
    if (reply.ok) waiter.resolve(reply.value);
    else waiter.reject(new Error(reply.error));
  });

  return {
    request<C extends BridgeCommand>(cmd: C): Promise<BridgeReplies[C['type']]> {
      const id = uid();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new BridgeTimeout());
        }, timeoutMs);
        pending.set(id, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v as BridgeReplies[C['type']]);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
        void t.send(CHANNEL.command, { id, cmd } satisfies CommandMessage);
      });
    },

    onSummary(cb: (s: BridgeSummary) => void): () => void {
      const off = t.on(CHANNEL.summary, (payload) => cb(payload as BridgeSummary));
      void t.send(CHANNEL.summaryRequest, null);
      return off;
    },

    dispose() {
      offReply();
      pending.clear();
    },
  };
}
