import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LogOut, RefreshCw } from 'lucide-react';
import { Button, Card, ConfirmDialog } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuthStore } from './authStore';
import { syncNow, useSyncStore } from './engine';
import { useSyncLabel } from './SyncIndicator';

export function SyncCard() {
  const phase = useAuthStore((s) => s.phase);
  const logout = useAuthStore((s) => s.logout);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const error = useSyncStore((s) => s.error);
  const { icon: Icon, text, tone, status } = useSyncLabel();
  const [confirm, setConfirm] = useState(false);

  if (phase === 'local' || phase === 'checking') {
    return (
      <Card title="Sincronização" description="Desativada: o servidor ainda não tem banco e senha configurados.">
        <p className="text-sm text-ink-2">
          Por enquanto, tudo fica salvo só neste aparelho. Veja no README como conectar o Neon e definir a senha.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Sincronização" description="Os dados ficam neste aparelho e no servidor, sempre em sincronia.">
      <p className={cn('flex items-center gap-2 text-sm font-medium', tone)} aria-live="polite">
        <Icon className={cn('size-4', status === 'syncing' && 'animate-spin')} aria-hidden />
        {text}
      </p>
      {lastSyncAt && (
        <p className="mt-1 text-xs text-ink-3">
          Última sincronização{' '}
          {formatDistanceToNow(parseISO(lastSyncAt), { addSuffix: true, locale: ptBR })}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-expense">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={RefreshCw} disabled={status === 'syncing'} onClick={() => void syncNow()}>
          Sincronizar agora
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={() => setConfirm(true)}>
          Sair deste aparelho
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Sair deste aparelho?"
        message="Os dados deste aparelho serão apagados daqui depois de enviar o que estiver pendente. Eles continuam no servidor e voltam quando você entrar de novo."
        confirmLabel="Sair e apagar daqui"
        onConfirm={() => void logout()}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
