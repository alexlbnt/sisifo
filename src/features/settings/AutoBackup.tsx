import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CloudDownload } from 'lucide-react';
import { Button } from '@/components/ui';

interface Status {
  configured: boolean;
  latest: { uploadedAt: string; size: number } | null;
}

/** Baixa o arquivo pela sessão (cookie) e entrega como download, igual ao "Exportar backup". */
async function downloadLatest() {
  const response = await fetch('/api/backup?download=1', { credentials: 'same-origin', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Não foi possível baixar o backup automático.');
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'sisifo-backup.json';
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Linha do backup semanal no servidor (Vercel Blob), dentro do cartão Backup. */
export function AutoBackup() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/backup', { credentials: 'same-origin', signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('application/json') ? (r.json() as Promise<Status>) : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;
  if (!status.configured) {
    return (
      <p className="mt-3 text-xs text-ink-3">
        Backup automático desativado: conecte um Blob privado ao projeto na Vercel (veja o README).
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-sm text-ink-2">
        <span className="font-medium text-ink">Backup automático</span> todo domingo de madrugada, com as 8 últimas semanas.
        <span className="block text-xs text-ink-3">
          {status.latest
            ? `Último: ${format(parseISO(status.latest.uploadedAt), "EEEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}`
            : 'Ainda não rodou nenhuma vez.'}
        </span>
      </p>
      {status.latest && (
        <div>
          <Button
            variant="secondary"
            icon={CloudDownload}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await downloadLatest();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Erro ao baixar.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Baixar o mais recente
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm text-expense" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
