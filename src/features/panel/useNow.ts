import { useEffect, useState } from 'react';

/**
 * Hora atual, atualizada na virada de cada `stepMs` (segundo, minuto).
 * Para enquanto a tela está oculta e acerta na hora ao voltar: o aparelho
 * não gasta nada desenhando um relógio que ninguém vê.
 */
export function useNow(stepMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const t = Date.now();
      setNow(t);
      // Alinha à virada (ex.: :00 de cada minuto), com folga para não cair antes dela.
      timer = setTimeout(schedule, stepMs - (t % stepMs) + 20);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [stepMs]);

  return now;
}
