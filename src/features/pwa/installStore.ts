import { create } from 'zustand';

/** Evento do Chrome/Android que permite abrir o diálogo nativo de instalação. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'desktop';

interface InstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

export const useInstallStore = create<InstallState>()(() => ({
  deferredPrompt: null,
  installed: isStandalone(),
}));

/** Já está rodando como app instalado (tela cheia, fora do navegador)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari do iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS se identifica como Mac; o toque denuncia.
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** No iOS só o Safari instala apps; outros navegadores não têm "Adicionar à Tela de Início". */
export function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return detectPlatform() === 'ios' && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** Abre o diálogo nativo. Retorna true se o usuário aceitou. */
export async function promptInstall(): Promise<boolean> {
  const event = useInstallStore.getState().deferredPrompt;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // O evento só pode ser usado uma vez.
  useInstallStore.setState({ deferredPrompt: null });
  return outcome === 'accepted';
}

// Registrado no carregamento do módulo: o evento pode disparar antes do React montar.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // guarda para mostrar no nosso banner, no momento certo
    useInstallStore.setState({ deferredPrompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    useInstallStore.setState({ deferredPrompt: null, installed: true });
  });
}

/* ───────── Lembrar quando o usuário dispensou o convite ───────── */

const DISMISS_KEY = 'sisifo:install-dismissed';
const SNOOZE_DAYS = 14;

export function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Sem storage (aba privada): o convite volta na próxima visita, sem problema.
  }
}
