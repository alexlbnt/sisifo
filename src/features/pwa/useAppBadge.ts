import { useEffect } from 'react';
import { pendingToday } from '@/features/personal/selectors';
import { usePersonalStore } from '@/features/personal/store';
import { todayISO } from '@/lib/dates';

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Número no ícone do app com o que falta hoje (tarefas e hábitos pendentes).
 * No iPhone (iOS 16.4+), só aparece com o app instalado e as notificações permitidas.
 */
export function useAppBadge() {
  const tasks = usePersonalStore((s) => s.tasks);
  const habits = usePersonalStore((s) => s.habits);

  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge) return;
    const pending = pendingToday(tasks, habits, todayISO());
    const update = pending > 0 ? nav.setAppBadge(pending) : nav.clearAppBadge?.();
    void update?.catch(() => undefined);
  }, [tasks, habits]);
}

/** Pede ao navegador para não apagar os dados locais quando faltar espaço. */
export function requestPersistentStorage() {
  void navigator.storage?.persist?.().catch(() => undefined);
}
