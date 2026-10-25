import { useEffect } from 'react';
import type { ISODate } from '@/lib/dates';
import { api } from '@/features/sync/api';
import { useAuthStore } from '@/features/sync/authStore';
import { usePanelStore } from './panelStore';

/** Agenda muda pouco: 5 minutos bastam e poupam o aparelho e a cota do Google. */
const REFRESH_MS = 5 * 60 * 1000;

/** Busca os compromissos do dia no servidor (só com login), sem repetir enquanto a leitura é recente. */
export function useAgendaRefresh(today: ISODate) {
  const ready = useAuthStore((s) => s.phase === 'ready');

  useEffect(() => {
    if (!ready) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let busy = false;
    const refresh = async () => {
      const last = usePanelStore.getState().agenda;
      const fresh = last?.date === today && Date.now() - last.fetchedAt < REFRESH_MS - 5000;
      if (busy || fresh || document.visibilityState !== 'visible' || !navigator.onLine) return;
      busy = true;
      try {
        const res = await api.agenda(today, timeZone);
        usePanelStore.getState().setAgenda({ ...res, fetchedAt: Date.now() });
      } catch {
        // Offline ou calendário fora: mantém a última leitura do dia.
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [ready, today]);
}
