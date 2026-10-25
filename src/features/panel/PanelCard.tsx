import { MonitorSmartphone } from 'lucide-react';
import { Card } from '@/components/ui';

/** Cartão em Configurações que leva ao Modo Painel. */
export function PanelCard() {
  return (
    <Card
      title="Modo Painel"
      description="Pomodoro, agenda e tarefas em tela cheia, para um celular fixo na mesa"
    >
      <p className="mb-3 text-sm text-ink-2">
        Abra no aparelho que vai ficar de painel e use "Instalar o painel" nos ajustes dele (ou "Adicionar à tela
        inicial" no Chrome). Ele é instalado como um app separado, em tela cheia, e gira com o aparelho.
      </p>
      <a
        href="/painel.html"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-hover"
      >
        <MonitorSmartphone className="size-4" aria-hidden />
        Abrir o painel
      </a>
    </Card>
  );
}
