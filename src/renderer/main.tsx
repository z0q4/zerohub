import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles/global.css';
import './styles/interface-v2.css';
import './styles/interface-v3.css';
import './styles/interface-v4.css';
import './styles/interface-v5.css';
import './styles/interface-v6.css';
import './styles/interface-v7.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
