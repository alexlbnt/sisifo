import type { ReactNode } from 'react';
import { Share, SquarePlus } from 'lucide-react';

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 align-middle font-medium whitespace-nowrap text-ink">
      {children}
    </span>
  );
}

/** Passo a passo do Safari, que não tem botão de instalação automático. */
export function IOSInstallSteps() {
  return (
    <ol className="flex flex-col gap-2 text-sm text-ink-2">
      <Step n={1}>
        Toque em{' '}
        <Chip>
          <Share className="size-3.5" aria-hidden /> Compartilhar
        </Chip>{' '}
        na barra do Safari
      </Step>
      <Step n={2}>
        Escolha{' '}
        <Chip>
          <SquarePlus className="size-3.5" aria-hidden /> Adicionar à Tela de Início
        </Chip>
      </Step>
    </ol>
  );
}
