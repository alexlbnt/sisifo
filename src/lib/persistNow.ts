import type { StoreApi } from 'zustand';
import { wasEmptyOnLoad, type PersistedStore } from './storage';

/**
 * O `persist` do Zustand só grava na primeira alteração. Sem isto, os dados de
 * exemplo nunca chegariam ao aparelho e seriam gerados de novo (com ids novos)
 * a cada recarga, o que a sincronização entenderia como "apagou tudo e criou outro".
 * Roda depois da leitura e só se não havia nada salvo.
 */
export function persistInitialState(store: StoreApi<unknown> & PersistedStore, storageKey: string) {
  store.persist.onFinishHydration(() => {
    if (wasEmptyOnLoad(storageKey)) store.setState({});
  });
}
