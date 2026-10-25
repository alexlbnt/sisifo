import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PanelApp } from '@/features/panel/PanelApp';
// Importado cedo para capturar o convite de instalação antes do React montar.
import '@/features/pwa/installStore';
import { requestPersistentStorage } from '@/features/pwa/useAppBadge';
import './index.css';
import '@/features/panel/panel.css';

requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>,
);
