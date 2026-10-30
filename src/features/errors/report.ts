import { cleanReport, deviceLabel, fingerprintOf, type ErrorKind, type ErrorReport } from '@/shared/errors';

/**
 * Envia os erros do app para /api/log (Configurações → Erros recentes). Só a
 * mensagem limpa, a pilha, a rota, a versão e o tipo de aparelho; nunca os dados.
 * Sem servidor ou sem login, o envio falha e o erro fica só no console.
 */

/** Mesmo erro: no máximo uma vez a cada 5 minutos. */
const REPEAT_MS = 5 * 60 * 1000;
/** No máximo tantos envios por abertura do app (um erro em laço não vira enxurrada). */
const MAX_PER_SESSION = 20;

export function createThrottle(repeatMs = REPEAT_MS, max = MAX_PER_SESSION) {
  const lastAt = new Map<string, number>();
  let count = 0;
  return (fingerprint: string, now: number): boolean => {
    const last = lastAt.get(fingerprint);
    if (count >= max || (last !== undefined && now - last < repeatMs)) return false;
    lastAt.set(fingerprint, now);
    count++;
    return true;
  };
}

const allow = createThrottle();
const queue: ErrorReport[] = [];
let flushing = false;

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length) {
      try {
        await fetch('/api/log', {
          method: 'POST',
          credentials: 'same-origin',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queue[0]),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        return; // sem rede: tenta de novo quando a internet voltar
      }
      // Qualquer resposta (até 401 ou 429) encerra a tentativa deste erro.
      queue.shift();
    }
  } finally {
    flushing = false;
  }
}

/** Registra um erro. Nunca lança: falhar ao registrar não pode quebrar o app. */
export function reportError(kind: ErrorKind, error: unknown): void {
  try {
    const report = cleanReport({
      kind,
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      route: location.pathname,
      appVersion: __APP_VERSION__,
      device: deviceLabel(navigator.userAgent, isStandalone()),
    });
    if (!allow(fingerprintOf(report), Date.now())) return;
    queue.push(report);
    void flush();
  } catch {
    // ignora
  }
}

/** Erros que escaparam: extensões do navegador e o aviso inofensivo do ResizeObserver ficam de fora. */
function ignored(message: string, stack: string | undefined): boolean {
  return /ResizeObserver loop/.test(message) || /-extension:\/\//.test(stack ?? '');
}

export function installErrorReporting() {
  window.addEventListener('error', (event) => {
    const error: unknown = event.error ?? event.message;
    const stack = error instanceof Error ? error.stack : undefined;
    if (!event.message && !event.error) return;
    if (ignored(String(event.message), stack)) return;
    reportError('window', error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const stack = reason instanceof Error ? reason.stack : undefined;
    if (ignored(reason instanceof Error ? reason.message : String(reason), stack)) return;
    reportError('promise', reason);
  });
  window.addEventListener('online', () => void flush());
}
