import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/onest';
import '@fontsource-variable/unbounded';

import { App } from './app/App.js';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
