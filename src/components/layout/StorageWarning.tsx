import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { storageMode, type StorageMode } from '@/lib/storage';

/** Onde os dados deste aparelho estão guardados (Configurações e aviso de falha). */
export function useStorageMode(): StorageMode | null {
  const [mode, setMode] = useState<StorageMode | null>(null);
  useEffect(() => {
    void storageMode().then(setMode);
  }, []);
  return mode;
}

/**
 * Os dados já estão no IndexedDB, mas ele não abriu nesta sessão: o app segue
 * só em memória (sem gravar por cima de nada). Precisa ficar visível.
 */
export function StorageWarning() {
  if (useStorageMode() !== 'memory') return null;
  return (
    <div role="alert" className="flex items-start gap-2 bg-warn-soft px-4 py-2.5 text-sm text-warn">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Não foi possível abrir os dados deste aparelho. Feche o app e abra de novo: o que fizer agora não fica salvo aqui.
    </div>
  );
}
