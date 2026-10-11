import { useEffect } from 'react';

import { navigate, useRoute } from '../lib/router.js';
import { syncViewportCssVars } from '../lib/telegram.js';
import { AuthScreen } from '../screens/AuthScreen.js';
import { Dashboard } from '../screens/Dashboard.js';
import { ProjectPage } from '../screens/ProjectPage.js';
import { Settings } from '../screens/Settings.js';
import { Wizard } from '../screens/Wizard.js';
import { AppShell } from './AppShell.js';
import { AuthProvider, useAuth } from './auth.js';
import { ThemeProvider } from './theme.js';
import { ToastProvider } from './toast.js';

function Routes() {
  const route = useRoute();
  const { state } = useAuth();

  if (state.status !== 'ready') {
    return <AuthScreen state={state} />;
  }

  let screen;
  switch (route.name) {
    case 'dashboard':
      screen = <Dashboard />;
      break;
    case 'wizard':
      screen = (
        <>
          <Dashboard />
          <Wizard key={route.type ?? 'any'} initialType={route.type} />
        </>
      );
      break;
    case 'project':
      screen = <ProjectPage key={route.projectId} projectId={route.projectId} />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
    case 'notFound':
      screen = (
        <div className="page">
          <div className="state">
            <h1 className="state__title">Страница не найдена</h1>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate({ name: 'dashboard' }, { replace: true })}
            >
              К проектам
            </button>
          </div>
        </div>
      );
      break;
  }

  return <AppShell route={route}>{screen}</AppShell>;
}

export function App() {
  useEffect(() => syncViewportCssVars(), []);
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Routes />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
