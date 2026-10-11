import { useEffect, useRef, useState } from 'react';
import { useFinanceStore } from '@/features/finance/store';
import { syncNow, useSyncStore } from '@/features/sync/engine';
import { haptic } from '@/lib/haptics';

/** Quanto arrastar (px) para atualizar. */
const TRIGGER = 72;

export type PullState = { phase: 'idle' } | { phase: 'pulling'; distance: number } | { phase: 'refreshing' } | { phase: 'done'; text: string };

/**
 * "Puxar para atualizar" no topo da página. O app instalado não tem o gesto do
 * navegador, então este faz a sincronização na hora e gera os recorrentes do dia.
 */
export function usePullToRefresh(): PullState {
  const [state, setState] = useState<PullState>({ phase: 'idle' });
  const start = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    const canStart = () => window.scrollY <= 0 && !document.querySelector('[role="dialog"]');

    const onStart = (e: TouchEvent) => {
      start.current = canStart() ? (e.touches[0]?.clientY ?? null) : null;
      distance.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const d = (e.touches[0]?.clientY ?? 0) - start.current;
      if (d <= 0 || window.scrollY > 0) {
        if (distance.current) setState({ phase: 'idle' });
        distance.current = 0;
        return;
      }
      // Resistência: o indicador anda menos que o dedo.
      const eased = Math.min(120, d * 0.5);
      if (eased >= TRIGGER && distance.current < TRIGGER) haptic();
      distance.current = eased;
      setState({ phase: 'pulling', distance: eased });
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      if (distance.current < TRIGGER) {
        setState({ phase: 'idle' });
        return;
      }
      setState({ phase: 'refreshing' });
      useFinanceStore.getState().syncRecurring();
      await syncNow();
      const status = useSyncStore.getState().status;
      const text =
        status === 'synced' ? 'Sincronizado' : status === 'offline' ? 'Sem internet: fica salvo no aparelho' : status === 'error' ? 'Não deu para sincronizar' : 'Atualizado';
      setState({ phase: 'done', text });
      setTimeout(() => setState({ phase: 'idle' }), 1600);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return state;
}
