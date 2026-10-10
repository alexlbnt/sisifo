import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const THEME_STORAGE_KEY = 'sisifo:theme';

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: THEME_STORAGE_KEY, version: 1 },
  ),
);

const darkQuery = '(prefers-color-scheme: dark)';

function subscribeSystem(callback: () => void) {
  const mq = window.matchMedia(darkQuery);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

/** Tema efetivo (resolve "system" pela preferência do sistema operacional). */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useThemeStore((s) => s.theme);
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(darkQuery).matches,
    () => false,
  );
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

/** Mesma cor do cabeçalho (--surface), para a barra do sistema emendar no app. */
const THEME_BAR_COLOR = { light: '#ffffff', dark: '#171c1a' } as const;

/** Aplica a classe `dark` no <html> sempre que o tema efetivo muda. */
export function useApplyTheme() {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // Barra de status do celular acompanha o tema escolhido no app, não só o do sistema.
    const color = THEME_BAR_COLOR[resolved];
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', color);
    });
  }, [resolved]);
}
