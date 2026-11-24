/** O app está rodando dentro do executável (Tauri), e não num navegador. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
