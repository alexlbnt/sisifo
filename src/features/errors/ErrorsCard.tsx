import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bug, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, IconButton } from '@/components/ui';
import { useAuthStore } from '@/features/sync/authStore';
import type { ErrorKind } from '@/shared/errors';

interface ErrorRow {
  id: string;
  kind: ErrorKind;
  message: string;
  stack: string | null;
  route: string | null;
  appVersion: string | null;
  device: string | null;
  count: number;
  createdAt: string;
  lastSeenAt: string;
}

const KIND_LABELS: Record<ErrorKind, string> = {
  window: 'Tela',
  promise: 'Tela',
  sync: 'Sincronização',
  api: 'Servidor',
};

/** Quantos aparecem antes de "Ver todos". */
const PREVIEW = 5;

async function call<T>(init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/log', {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('A API do Sísifo não respondeu.');
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Erro no servidor.');
  return body;
}

/** Erros do app e da API (sem dados pessoais), para saber o que quebrou e onde. */
export function ErrorsCard() {
  const synced = useAuthStore((s) => s.phase === 'ready');
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(() => {
    setFailure(null);
    call<{ errors: ErrorRow[] }>()
      .then((r) => setRows(r.errors))
      .catch((e: Error) => setFailure(e.message));
  }, []);

  useEffect(() => {
    if (synced) load();
  }, [synced, load]);

  if (!synced) return null;
  const shown = rows && (all ? rows : rows.slice(0, PREVIEW));

  return (
    <Card
      title="Erros recentes"
      description="O que deu errado no app e no servidor. Só a mensagem, a tela, a versão e o tipo de aparelho; nunca os seus dados."
      action={<IconButton icon={RefreshCw} label="Atualizar a lista de erros" size="sm" onClick={load} />}
    >
      {failure && (
        <p className="text-sm text-expense" role="alert">
          {failure}
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <Bug className="size-4" aria-hidden />
          Nenhum erro registrado.
        </p>
      )}
      {shown && shown.length > 0 && (
        <>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {shown.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 break-words font-medium">{e.message}</span>
                  {e.count > 1 && <Badge>{e.count}×</Badge>}
                </div>
                <p className="text-xs text-ink-3">
                  {[
                    KIND_LABELS[e.kind],
                    e.route,
                    formatDistanceToNow(parseISO(e.lastSeenAt), { addSuffix: true, locale: ptBR }),
                    e.device,
                    e.appVersion && `v${e.appVersion}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {e.stack && (
                  <details className="text-xs text-ink-3">
                    <summary className="cursor-pointer select-none">Pilha</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre rounded-md bg-surface-2 p-2">{e.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {rows!.length > PREVIEW && (
              <Button variant="secondary" onClick={() => setAll((v) => !v)}>
                {all ? 'Mostrar menos' : `Ver todos (${rows!.length})`}
              </Button>
            )}
            <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
              Limpar
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title="Limpar os erros?"
        message="A lista volta a ficar vazia. Erros novos continuam sendo registrados."
        confirmLabel="Limpar"
        onConfirm={() => {
          void call({ method: 'DELETE' })
            .then(load)
            .catch((e: Error) => setFailure(e.message));
        }}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
