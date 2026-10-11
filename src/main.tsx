import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
// Importado cedo para capturar o convite de instalação antes do React montar.
import '@/features/pwa/installStore';
import { requestPersistentStorage } from '@/features/pwa/useAppBadge';
import './index.css';

requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
