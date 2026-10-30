import { Link } from 'react-router';
import { ChevronRight, CloudAlert, CloudCheck, CloudOff, CloudUpload, RefreshCw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from './authStore';
import { useSyncStore, type SyncStatus } from './engine';

const LABELS: Record<SyncStatus, { icon: LucideIcon; text: string; tone: string }> = {
  disabled: { icon: CloudOff, text: 'Só neste aparelho', tone: 'text-ink-3' },
  syncing: { icon: RefreshCw, text: 'Sincronizando…', tone: 'text-ink-2' },
  synced: { icon: CloudCheck, text: 'Sincronizado', tone: 'text-ink-3' },
  offline: { icon: CloudOff, text: 'Sem internet · salvo no aparelho', tone: 'text-warn' },
  error: { icon: CloudAlert, text: 'Erro ao sincronizar', tone: 'text-expense' },
  'needs-link': { icon: CloudUpload, text: 'Escolha como sincronizar', tone: 'text-accent' },
};

export function useSyncLabel() {
  const status = useSyncStore((s) => s.status);
  const pending = useSyncStore((s) => s.pending);
  const base = LABELS[status];
  const text =
    status === 'synced' && pending > 0
      ? `${pending} ${pending === 1 ? 'alteração' : 'alterações'} para enviar`
      : base.text;
  return { ...base, text, status };
}

/** Linha de status na sidebar (desktop). */
export function SyncStatusLine() {
  const phase = useAuthStore((s) => s.phase);
  const { icon: Icon, text, tone, status } = useSyncLabel();
  const error = useSyncStore((s) => s.error);
  if (phase !== 'ready') return null;
  return (
    <Link
      to="/settings"
      title={status === 'error' && error ? error : undefined}
      className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs hover:bg-surface-2', tone)}
      aria-live="polite"
    >
      <Icon className={cn('size-3.5 shrink-0', status === 'syncing' && 'animate-spin')} aria-hidden />
      <span className="truncate">{text}</span>
    </Link>
  );
}

/** Ícone no cabeçalho do celular. */
export function SyncStatusIcon() {
  const phase = useAuthStore((s) => s.phase);
  const { icon: Icon, text, tone, status } = useSyncLabel();
  if (phase !== 'ready') return null;
  return (
    <Link
      to="/settings"
      aria-label={text}
      title={text}
      className={cn('relative inline-flex size-10 items-center justify-center rounded-lg hover:bg-surface-2', tone)}
    >
      <Icon className={cn('size-4', status === 'syncing' && 'animate-spin')} aria-hidden />
      {status === 'error' && <span className="absolute top-2 right-2 size-2 rounded-full bg-expense" aria-hidden />}
    </Link>
  );
}

/** A partir de tantas rodadas seguidas com erro, o aviso sai do ícone e vai para o topo da tela. */
const FAILURES_TO_WARN = 3;

/** Faixa no topo quando a sincronização falha de novo e de novo (antes passava despercebido). */
export function SyncErrorBanner() {
  const phase = useAuthStore((s) => s.phase);
  const status = useSyncStore((s) => s.status);
  const failures = useSyncStore((s) => s.failures);
  const error = useSyncStore((s) => s.error);
  if (phase !== 'ready' || status !== 'error' || failures < FAILURES_TO_WARN) return null;
  return (
    <Link
      to="/settings"
      role="alert"
      className="flex items-start gap-2 bg-danger-soft px-4 py-2.5 text-sm text-expense hover:underline"
    >
      <CloudAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        A sincronização está falhando{error ? `: ${error}` : '.'} O que você fizer continua salvo neste aparelho.
      </span>
      <ChevronRight className="mt-0.5 size-4 shrink-0" aria-hidden />
    </Link>
  );
}
