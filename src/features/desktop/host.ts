import { applyCapture, captureContext } from '@/features/capture/apply';
import { parseCapture } from '@/features/capture/parse';
import { pendingToday } from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { syncNow } from '@/features/sync/engine';
import { todayISO, type ISODate } from '@/lib/dates';
import { createBridgeHost, type BridgeCommand, type BridgeSummary } from './bridge';
import { native } from './native';
import { tauriTransport } from './tauriTransport';

/**
 * A janela principal do desktop é a dona dos dados: atende os comandos das
 * janelas leves e publica o resumo (número de pendências para a bandeja).
 * Roda no app e no painel (as duas entradas), com ou sem login: os dados são locais.
 */

/** Evento que as janelas leves emitem ao aparecer: hora de sincronizar. */
export const WINDOW_FOCUSED = 'sisifo:window-focused';

export function createHostHandlers(deps: { today?: () => ISODate } = {}) {
  const today = deps.today ?? todayISO;

  const handle = async (cmd: BridgeCommand): Promise<unknown> => {
    switch (cmd.type) {
      case 'capture.preview':
        return parseCapture(cmd.text, captureContext(today()), cmd.force);
      case 'capture.submit': {
        const text = cmd.text.trim();
        if (!text) return { ok: false, message: 'Nada para registrar.' };
        const day = today();
        const guess = parseCapture(text, captureContext(day), cmd.force);
        if (!guess) return { ok: false, message: 'Nada para registrar.' };
        if (cmd.force === 'transaction' && guess.kind === 'task') {
          return { ok: false, message: `Inclua um valor na frase, ex.: "${text} 25,00".` };
        }
        return { ok: true, message: applyCapture(guess, { today: day }) };
      }
    }
  };

  const summary = (): BridgeSummary => {
    const day = today();
    const { tasks, habits } = usePersonalStore.getState();
    return { pending: pendingToday(tasks, habits, day), day };
  };

  return { handle, summary };
}

const PUBLISH_DEBOUNCE_MS = 300;
const DAY_CHECK_MS = 60_000;

export async function installDesktopHost(): Promise<void> {
  const transport = await tauriTransport();
  const handlers = createHostHandlers();
  const host = createBridgeHost(transport, handlers);

  const publish = () => {
    host.publish();
    void native.setTrayPending(handlers.summary().pending).catch(() => undefined);
  };
  publish();

  let timer: ReturnType<typeof setTimeout> | undefined;
  usePersonalStore.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(publish, PUBLISH_DEBOUNCE_MS);
  });

  // Virada do dia com a janela aberta: o único timer, uma vez por minuto.
  let day = todayISO();
  setInterval(() => {
    if (todayISO() === day) return;
    day = todayISO();
    publish();
  }, DAY_CHECK_MS);

  transport.on(WINDOW_FOCUSED, () => void syncNow());
}
