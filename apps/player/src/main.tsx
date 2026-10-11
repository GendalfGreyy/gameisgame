import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PlayerShell } from './PlayerShell.js';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <PlayerShell />
  </StrictMode>,
);
