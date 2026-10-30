import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { loadLocalData } from '@/app/boot';
import { Splash } from '@/components/layout/Splash';
import { installErrorReporting } from '@/features/errors/report';
// Importado cedo para capturar o convite de instalação antes do React montar.
import '@/features/pwa/installStore';
import { requestPersistentStorage } from '@/features/pwa/useAppBadge';
import './index.css';

installErrorReporting();
requestPersistentStorage();

const root = createRoot(document.getElementById('root')!);
root.render(<Splash />);
// O app só monta com os dados do aparelho já lidos.
void loadLocalData().then(() =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
