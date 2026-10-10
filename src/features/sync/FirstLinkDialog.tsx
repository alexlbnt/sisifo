import { useState } from 'react';
import { CloudUpload, Eraser } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { resolveFirstLink, useSyncStore } from './engine';

/** Primeira sincronização com o servidor vazio: o que fazer com os dados deste aparelho? */
export function FirstLinkDialog() {
  const status = useSyncStore((s) => s.status);
  const [busy, setBusy] = useState(false);
  if (status !== 'needs-link') return null;

  const choose = async (choice: 'upload' | 'empty') => {
    setBusy(true);
    await resolveFirstLink(choice);
    setBusy(false);
  };

  return (
    <Modal
      open
      onClose={() => {}}
      dismissible={false}
      title="Primeira sincronização"
      description="O servidor ainda está vazio. O que fazer com o que já está neste aparelho?"
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => choose('upload')}
          className="flex items-start gap-3 rounded-xl border border-accent bg-accent-soft/50 p-4 text-left hover:bg-accent-soft disabled:opacity-60"
        >
          <CloudUpload className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            <span className="block font-medium text-ink">Enviar os dados deste aparelho</span>
            <span className="text-sm text-ink-2">
              Tudo o que está aqui vai para o servidor e aparece nos seus outros dispositivos.
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => choose('empty')}
          className="flex items-start gap-3 rounded-xl border border-line p-4 text-left hover:bg-surface-2 disabled:opacity-60"
        >
          <Eraser className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
          <span>
            <span className="block font-medium text-ink">Começar do zero</span>
            <span className="text-sm text-ink-2">
              Apaga os dados deste aparelho (como os de exemplo) e começa com tudo vazio.
            </span>
          </span>
        </button>
        {busy && (
          <Button variant="ghost" disabled className="self-center">
            Sincronizando…
          </Button>
        )}
      </div>
    </Modal>
  );
}
