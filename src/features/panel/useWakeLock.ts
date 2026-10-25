import { useEffect } from 'react';

/**
 * Mantém a tela ligada enquanto o painel está aberto (Screen Wake Lock API).
 * O sistema solta a trava quando a aba some; ela é pedida de novo ao voltar.
 * Sem suporte (ou sem HTTPS), não faz nada.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      if (disposed || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // Bateria fraca, economia de energia ou permissão negada: segue sem a trava.
      }
    };

    const onVisibility = () => void request();
    void request();
    document.addEventListener('visibilitychange', onVisibility);
    // Alguns Androids só liberam a trava depois de um toque.
    window.addEventListener('pointerdown', onVisibility, { passive: true });
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onVisibility);
      void sentinel?.release();
    };
  }, []);
}
