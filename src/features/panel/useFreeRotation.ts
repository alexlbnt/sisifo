import { useEffect } from 'react';

type Lockable = ScreenOrientation & { lock?: (orientation: 'any') => Promise<void> };

/**
 * Deixa o painel girar com o aparelho.
 *
 * O manifest do painel já pede orientação livre, mas, aberto dentro do app
 * principal (travado em retrato), ele herdaria a trava. Pedir `lock('any')`
 * troca a trava do app pela do sensor. O navegador só aceita isso em app
 * instalado ou em tela cheia; numa aba comum, o primeiro toque põe o painel em
 * tela cheia (que ele já pede) e tenta de novo. Sem suporte, não faz nada.
 */
export function useFreeRotation() {
  useEffect(() => {
    const orientation = screen.orientation as Lockable | undefined;
    const unlock = () => void orientation?.lock?.('any').catch(() => {});

    const installed = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    const touch = matchMedia('(pointer: coarse)').matches;
    const goFullscreen = () => {
      if (document.fullscreenElement || !document.fullscreenEnabled) return;
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(unlock, () => {});
    };

    unlock();
    document.addEventListener('fullscreenchange', unlock);
    if (!installed && touch) window.addEventListener('pointerup', goFullscreen, { once: true });
    return () => {
      document.removeEventListener('fullscreenchange', unlock);
      window.removeEventListener('pointerup', goFullscreen);
    };
  }, []);
}
