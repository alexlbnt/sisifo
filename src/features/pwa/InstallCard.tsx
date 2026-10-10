import { CircleCheck, Download, Smartphone } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { detectPlatform, isIOSSafari, promptInstall, useInstallStore } from './installStore';
import { IOSInstallSteps } from './IOSInstallSteps';

/** Cartão fixo em Configurações, para quem dispensou o convite e quer instalar depois. */
export function InstallCard() {
  const deferredPrompt = useInstallStore((s) => s.deferredPrompt);
  const installed = useInstallStore((s) => s.installed);
  const platform = detectPlatform();

  let body;
  if (installed) {
    body = (
      <p className="flex items-center gap-2 text-sm text-income">
        <CircleCheck className="size-4" aria-hidden /> O Sísifo já está instalado neste aparelho.
      </p>
    );
  } else if (deferredPrompt) {
    body = (
      <Button icon={Download} onClick={() => promptInstall()}>
        Instalar app
      </Button>
    );
  } else if (platform === 'ios') {
    body = isIOSSafari() ? (
      <IOSInstallSteps />
    ) : (
      <p className="text-sm text-ink-2">No iPhone, abra este endereço no Safari para instalar.</p>
    );
  } else {
    body = (
      <p className="flex items-start gap-2 text-sm text-ink-2">
        <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
        Abra no celular pelo Chrome ou Safari e use "Adicionar à tela inicial". No computador, use o ícone de
        instalação na barra de endereço do Chrome ou Edge.
      </p>
    );
  }

  return (
    <Card
      title="Instalar como app"
      description="Ícone na tela inicial, abertura em tela cheia e uso sem internet."
    >
      {body}
    </Card>
  );
}
