import { useRef, useState } from 'react';
import { CircleCheck, Download, Eraser, Layers, RotateCcw, Tags, Upload } from 'lucide-react';
import { Button, Card, ConfirmDialog, PageHeader } from '@/components/ui';
import { useStorageMode } from '@/components/layout/StorageWarning';
import { ThemeSelector } from '@/components/layout/ThemeToggle';
import { CategoriesModal } from '@/features/finance/components/CategoriesModal';
import { AreasModal } from '@/features/personal/areas/AreasModal';
import { ErrorsCard } from '@/features/errors/ErrorsCard';
import { NotificationsCard } from '@/features/notifications/NotificationsCard';
import { PanelCard } from '@/features/panel/PanelCard';
import { InstallCard } from '@/features/pwa/InstallCard';
import { ShortcutsCard } from '@/features/shortcuts/ShortcutsCard';
import { useAuthStore } from '@/features/sync/authStore';
import { SyncCard } from '@/features/sync/SyncCard';
import { cn } from '@/lib/cn';
import { AutoBackup } from './AutoBackup';
import { clearAllData, downloadBackup, importBackup, restoreSampleData } from './backup';

type Notice = { tone: 'good' | 'danger'; text: string } | null;

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<'restore' | 'clear' | null>(null);
  const [catalog, setCatalog] = useState<'categories' | 'areas' | null>(null);
  // Com sincronização ligada, apagar/restaurar/importar vale para todos os aparelhos.
  const synced = useAuthStore((s) => s.phase === 'ready');
  const scope = synced ? 'em todos os seus aparelhos' : 'deste navegador';

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const result = await importBackup(file);
    setNotice(
      result.ok
        ? { tone: 'good', text: 'Backup importado. Todos os dados foram substituídos pelos do arquivo.' }
        : { tone: 'danger', text: result.error },
    );
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <PageHeader title="Configurações" subtitle="Aparência e cuidados com os seus dados" />

      <div className="flex max-w-2xl flex-col gap-4">
        <SyncCard />

        <NotificationsCard />

        <ShortcutsCard />

        <InstallCard />

        <PanelCard />

        <Card title="Aparência">
          <ThemeSelector />
        </Card>

        <Card
          title="Categorias e áreas"
          description="Categorias organizam os lançamentos; áreas organizam metas, tarefas e hábitos."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Tags} onClick={() => setCatalog('categories')}>
              Categorias
            </Button>
            <Button variant="secondary" icon={Layers} onClick={() => setCatalog('areas')}>
              Áreas
            </Button>
          </div>
        </Card>

        <Card
          title="Backup"
          description={
            synced
              ? 'Uma cópia em arquivo, além da que está no servidor. Importar substitui os dados em todos os aparelhos.'
              : 'Os dados ficam só neste navegador. Limpar o cache apaga tudo, então exporte de vez em quando.'
          }
        >
          <div className="flex flex-wrap gap-2">
            <Button
              icon={Download}
              onClick={() => {
                downloadBackup();
                setNotice({ tone: 'good', text: 'Backup exportado. Guarde o arquivo em um lugar seguro.' });
              }}
            >
              Exportar backup
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
              Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])}
            />
          </div>
          {notice && (
            <p
              role="status"
              className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                notice.tone === 'good' ? 'bg-good-soft text-income' : 'bg-danger-soft text-expense'
              }`}
            >
              {notice.tone === 'good' && <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
              {notice.text}
            </p>
          )}
          {synced && <AutoBackup />}
        </Card>

        <ErrorsCard />

        <Card title="Dados" description="Recomece do zero ou volte aos dados de exemplo.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={RotateCcw} onClick={() => setConfirm('restore')}>
              Restaurar dados de exemplo
            </Button>
            <Button variant="danger" icon={Eraser} onClick={() => setConfirm('clear')}>
              Apagar todos os dados
            </Button>
          </div>
          <StorageLine />
        </Card>
      </div>

      <CategoriesModal open={catalog === 'categories'} onClose={() => setCatalog(null)} />
      <AreasModal open={catalog === 'areas'} onClose={() => setCatalog(null)} />

      <ConfirmDialog
        open={confirm === 'restore'}
        title="Restaurar dados de exemplo?"
        message={`Tudo o que você cadastrou será substituído pelos dados de demonstração ${scope}. Exporte um backup antes se quiser guardar.`}
        confirmLabel="Restaurar exemplo"
        onConfirm={() => {
          restoreSampleData();
          setNotice({ tone: 'good', text: 'Dados de exemplo restaurados.' });
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        title="Apagar todos os dados?"
        message={`Lançamentos, metas, tarefas, hábitos e treinos serão apagados ${scope}. Não dá para desfazer.`}
        confirmLabel="Apagar tudo"
        onConfirm={() => {
          clearAllData();
          setNotice({ tone: 'good', text: 'Todos os dados foram apagados.' });
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

const STORAGE_LABELS = {
  idb: 'Guardados neste aparelho (IndexedDB).',
  local: 'Guardados neste aparelho (localStorage: o navegador não ofereceu IndexedDB).',
  memory: 'Não foi possível abrir os dados deste aparelho nesta sessão. Feche o app e abra de novo.',
} as const;

/** Onde ficam os dados: ajuda a conferir a migração para o IndexedDB. */
function StorageLine() {
  const mode = useStorageMode();
  if (!mode) return null;
  return <p className={cn('mt-3 text-xs', mode === 'memory' ? 'text-warn' : 'text-ink-3')}>{STORAGE_LABELS[mode]}</p>;
}
