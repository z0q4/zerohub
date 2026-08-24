import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import {
  CaseWorkspaceProvider,
} from './features/cases/CaseWorkspaceContext';
import {
  AuthenticationGate,
} from './components/auth/AuthenticationGate';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AuthenticationGate>
      <CaseWorkspaceProvider>
        <App />
      </CaseWorkspaceProvider>
    </AuthenticationGate>
  </React.StrictMode>,
);
