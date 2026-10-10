import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';
import {
  detectPlatform,
  isIOSSafari,
  promptInstall,
  rememberDismiss,
  useInstallStore,
  wasDismissedRecently,
} from './installStore';
import { IOSInstallSteps } from './IOSInstallSteps';

/** Atraso antes de convidar: primeiro a pessoa vê o app funcionando. */
const SHOW_AFTER_MS = 4000;

/**
 * Convite para instalar, só no celular e só fora do app instalado.
 * Android: botão que abre o diálogo nativo. iPhone: passo a passo do Safari.
 */
export function InstallBanner() {
  const deferredPrompt = useInstallStore((s) => s.deferredPrompt);
  const installed = useInstallStore((s) => s.installed);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(wasDismissedRecently);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const platform = detectPlatform();
  const ios = platform === 'ios' && isIOSSafari();
  const canShow = ready && !hidden && !installed && platform !== 'desktop' && (ios || deferredPrompt);
  if (!canShow) return null;

  const dismiss = () => {
    rememberDismiss();
    setHidden(true);
  };

  return (
    <aside
      aria-label="Instalar o Sísifo"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-line bg-surface p-4 shadow-xl lg:hidden"
    >
      <div className="flex items-start gap-3">
        <img src="/pwa-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Instale o Sísifo no celular</p>
          <p className="text-sm text-ink-3">
            Abre em tela cheia pelo ícone e funciona sem internet.
          </p>
        </div>
        <IconButton icon={X} label="Agora não" size="sm" className="-mt-1 -mr-1" onClick={dismiss} />
      </div>
      <div className="mt-3">
        {ios ? (
          <IOSInstallSteps />
        ) : (
          <Button
            icon={Download}
            className="w-full"
            onClick={async () => {
              const accepted = await promptInstall();
              if (!accepted) dismiss();
            }}
          >
            Instalar app
          </Button>
        )}
      </div>
    </aside>
  );
}
