import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CircleCheck, RefreshCw, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';

/** Verifica se há versão nova a cada hora enquanto o app está aberto. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Registra o service worker e avisa quando há versão nova ou quando o modo offline fica pronto. */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  // O aviso de "pronto para offline" é só informativo: some sozinho.
  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-xl lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto"
    >
      {needRefresh ? (
        <>
          <RefreshCw className="size-4 shrink-0 text-accent" aria-hidden />
          <p className="flex-1 text-sm text-ink">Nova versão do Sísifo disponível.</p>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Atualizar
          </Button>
          <IconButton icon={X} label="Depois" size="sm" onClick={() => setNeedRefresh(false)} />
        </>
      ) : (
        <>
          <CircleCheck className="size-4 shrink-0 text-income" aria-hidden />
          <p className="flex-1 text-sm text-ink">Pronto para usar sem internet.</p>
        </>
      )}
    </div>
  );
}
