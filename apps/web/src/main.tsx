import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { StudioApp } from './StudioApp.js';
import './index.css';
import { initAnalytics } from './shared/lib/analytics.js';
import { bootstrapThemeStore } from './shared/lib/theme.js';
import { applyTelegramTheme } from './shared/lib/telegram.js';

bootstrapThemeStore();
applyTelegramTheme();
initAnalytics();

const queryClient = new QueryClient();
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const Root = import.meta.env.VITE_STUDIO_ONLY === 'true' ? StudioApp : App;

if (import.meta.env.VITE_STUDIO_ONLY === 'true') {
  document.title = 'Creator Studio';
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>,
);
