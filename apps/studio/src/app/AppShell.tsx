import { useEffect, type ReactNode } from 'react';

import { IconPlus, IconProjects, IconSettings } from '../components/icons.js';
import { goBack, navigate, type Route } from '../lib/router.js';
import { telegram } from '../lib/telegram.js';

type NavItem = {
  route: Route;
  label: string;
  icon: ReactNode;
  isActive: (route: Route) => boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    route: { name: 'dashboard' },
    label: 'Проекты',
    icon: <IconProjects />,
    isActive: (route) => route.name === 'dashboard' || route.name === 'project',
  },
  {
    route: { name: 'wizard' },
    label: 'Создать',
    icon: <IconPlus />,
    isActive: (route) => route.name === 'wizard',
  },
  {
    route: { name: 'settings' },
    label: 'Настройки',
    icon: <IconSettings />,
    isActive: (route) => route.name === 'settings',
  },
];

/** Telegram BackButton is visible on every screen except the dashboard. */
function useTelegramBackButton(route: Route): void {
  const isRoot = route.name === 'dashboard';
  useEffect(() => {
    const tg = telegram();
    if (isRoot) {
      tg.hideBackButton();
      return undefined;
    }
    tg.showBackButton();
    const off = tg.onBackButton(goBack);
    return () => {
      off();
    };
  }, [isRoot]);
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  useTelegramBackButton(route);

  const navButton = (item: NavItem, variant: 'side' | 'bottom') => {
    const active = item.isActive(route);
    return (
      <button
        key={item.label}
        type="button"
        className={`nav-${variant}__item${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          if (!active || route.name === 'project') {
            navigate(item.route);
          }
        }}
      >
        {item.icon}
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="shell" data-testid="app-shell">
      <aside className="nav-side" aria-label="Основная навигация">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            TG
          </span>
          <span className="brand__name">Creator Studio</span>
        </div>
        <nav className="nav-side__list">{NAV_ITEMS.map((item) => navButton(item, 'side'))}</nav>
      </aside>
      <main className="shell__main">{children}</main>
      <nav className="nav-bottom" aria-label="Основная навигация">
        {NAV_ITEMS.map((item) => navButton(item, 'bottom'))}
      </nav>
    </div>
  );
}
