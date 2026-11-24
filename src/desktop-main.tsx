import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaptureBar } from '@/features/desktop/CaptureBar';
import './index.css';

/**
 * Entrada das janelas leves do executável (desktop.html). Não carrega stores
 * nem sincronização: quem cuida dos dados é a janela principal, pela ponte.
 * Não importe aqui @/app/boot, stores ou @/features/sync/engine.
 */

const views: Record<string, () => React.JSX.Element> = {
  '#/captura': () => <CaptureBar />,
};

const View = views[location.hash];
if (View) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <View />
    </StrictMode>,
  );
}
