import { useAgendaStore } from '@/features/agenda/agendaStore';
import { useFinanceStore } from '@/features/finance/store';
import { usePersonalStore } from '@/features/personal/store';
import { loadSyncState } from '@/features/sync/engine';
import { whenHydrated } from '@/lib/storage';

/**
 * Lê os dados do aparelho (IndexedDB) antes do React montar. Assim nada roda
 * sobre uma store ainda vazia: recorrentes, sincronização, Modo Painel.
 * Usado pelas duas entradas (index.html e painel.html).
 */
export async function loadLocalData(): Promise<void> {
  await Promise.all([
    whenHydrated(useFinanceStore),
    whenHydrated(usePersonalStore),
    whenHydrated(useAgendaStore),
    loadSyncState(),
  ]);
}
