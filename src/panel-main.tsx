import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadLocalData } from '@/app/boot';
import { Splash } from '@/components/layout/Splash';
import { PanelApp } from '@/features/panel/PanelApp';
// Importado cedo para capturar o convite de instalação antes do React montar.
import '@/features/pwa/installStore';
import { requestPersistentStorage } from '@/features/pwa/useAppBadge';
import './index.css';
import '@/features/panel/panel.css';

requestPersistentStorage();

const root = createRoot(document.getElementById('root')!);
root.render(<Splash />);
// O painel só monta com os dados do aparelho já lidos.
void loadLocalData().then(() =>
  root.render(
    <StrictMode>
      <PanelApp />
    </StrictMode>,
  ),
);
