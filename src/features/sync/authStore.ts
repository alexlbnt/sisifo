import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, HttpError } from './api';
import { disableSync, resetSync, startSync, syncNow } from './engine';

/**
 * - checking: perguntando ao servidor (rápido; só aparece no primeiro acesso)
 * - local: servidor sem banco/senha configurados (ou sem API): app só no aparelho
 * - locked: servidor configurado e sem sessão: mostra o login
 * - ready: logado; sincroniza em segundo plano (inclusive voltando do offline)
 */
export type AuthPhase = 'checking' | 'local' | 'locked' | 'ready';

interface AuthState {
  phase: AuthPhase;
  /** Último estado conhecido: permite abrir o app offline sem pedir senha. */
  knownAuthenticated: boolean;
  check: () => Promise<void>;
  login: (password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const handlers = {
  onUnauthorized: () => useAuthStore.setState({ phase: 'locked', knownAuthenticated: false }),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      phase: 'checking',
      knownAuthenticated: false,

      check: async () => {
        // Já logado antes: abre direto e confirma em segundo plano.
        if (get().knownAuthenticated) set({ phase: 'ready' });
        if (!navigator.onLine) {
          if (get().knownAuthenticated) void startSync(handlers);
          else set({ phase: 'local' });
          return;
        }
        try {
          const session = await api.session();
          if (!session.configured) {
            disableSync();
            set({ phase: 'local', knownAuthenticated: false });
          } else if (session.authenticated) {
            set({ phase: 'ready', knownAuthenticated: true });
            void startSync(handlers);
          } else {
            disableSync();
            set({ phase: 'locked', knownAuthenticated: false });
          }
        } catch {
          // Sem resposta da API: segue com o que sabemos.
          if (get().knownAuthenticated) void startSync(handlers);
          else set({ phase: 'local' });
        }
      },

      login: async (password) => {
        try {
          await api.login(password);
          set({ phase: 'ready', knownAuthenticated: true });
          void startSync(handlers);
          return null;
        } catch (error) {
          if (error instanceof HttpError) return error.message;
          return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
        }
      },

      logout: async () => {
        // Última tentativa de enviar o que estiver pendente antes de apagar a cópia local.
        await syncNow();
        try {
          await api.logout();
        } catch {
          // Offline: o cookie expira sozinho; a cópia local é apagada mesmo assim.
        }
        resetSync();
        set({ phase: 'locked', knownAuthenticated: false });
      },
    }),
    {
      name: 'sisifo:auth',
      version: 1,
      partialize: ({ knownAuthenticated }) => ({ knownAuthenticated }),
    },
  ),
);
