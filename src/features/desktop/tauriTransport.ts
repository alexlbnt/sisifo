import type { Transport } from './bridge';

/**
 * Transporte da ponte pelos eventos do Tauri (chegam a todas as janelas).
 * Importado sob demanda: no navegador, o pacote do Tauri nem é baixado.
 */
export async function tauriTransport(): Promise<Transport> {
  const { emit, listen } = await import('@tauri-apps/api/event');
  return {
    send: (channel, payload) => emit(channel, payload),
    on: (channel, handler) => {
      let off: (() => void) | null = null;
      let disposed = false;
      void listen(channel, (event) => handler(event.payload)).then((unlisten) => {
        if (disposed) unlisten();
        else off = unlisten;
      });
      return () => {
        disposed = true;
        off?.();
      };
    },
  };
}
