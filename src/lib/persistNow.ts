import type { StoreApi } from 'zustand';

/**
 * O `persist` do Zustand só grava na primeira alteração. Sem isto, os dados de
 * exemplo nunca chegariam ao localStorage e seriam gerados de novo (com ids novos)
 * a cada recarga, o que a sincronização entenderia como "apagou tudo e criou outro".
 */
export function persistInitialState(store: StoreApi<unknown>, storageKey: string) {
  try {
    if (localStorage.getItem(storageKey) === null) store.setState({});
  } catch {
    // Storage indisponível (aba privada restrita): segue só em memória.
  }
}
