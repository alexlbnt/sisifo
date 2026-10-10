import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Executa `action` uma vez quando a URL traz `?param=1` (atalhos do ícone do app)
 * e limpa o parâmetro, para que voltar ou recarregar não repita a ação.
 */
export function useShortcutParam(param: string, action: () => void) {
  const [params, setParams] = useSearchParams();
  const active = params.get(param) === '1';

  useEffect(() => {
    if (!active) return;
    action();
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
    // Roda só quando o parâmetro aparece; `action` fica fora das dependências de propósito.
  }, [active, param, setParams]);
}
