import type { ProjectTypeDto } from '@tg-creator/shared';
import { useSyncExternalStore } from 'react';

const WIZARD_TYPES: readonly string[] = ['game3d', 'game2d', 'app'];

function isProjectType(value: string | null): value is ProjectTypeDto {
  return value !== null && WIZARD_TYPES.includes(value);
}

export type Route =
  | { name: 'dashboard' }
  | { name: 'wizard'; type?: ProjectTypeDto }
  | { name: 'project'; projectId: string }
  | { name: 'settings' }
  | { name: 'notFound' };

export function parseRoute(pathname: string, search = ''): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    return { name: 'dashboard' };
  }
  if (path === '/new') {
    const type = new URLSearchParams(search).get('type');
    return isProjectType(type) ? { name: 'wizard', type } : { name: 'wizard' };
  }
  if (path === '/settings') {
    return { name: 'settings' };
  }
  const project = /^\/projects\/([^/]+)$/.exec(path);
  if (project?.[1]) {
    return { name: 'project', projectId: decodeURIComponent(project[1]) };
  }
  return { name: 'notFound' };
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'dashboard':
      return '/';
    case 'wizard':
      return route.type ? `/new?type=${route.type}` : '/new';
    case 'settings':
      return '/settings';
    case 'project':
      return `/projects/${encodeURIComponent(route.projectId)}`;
    case 'notFound':
      return '/';
  }
}

const listeners = new Set<() => void>();
/** In-app history depth, so Back never leaves the Mini App from a deep link. */
let depth = 0;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    depth = Math.max(0, depth - 1);
    emit();
  });
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = routePath(route);
  if (options.replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
    depth += 1;
  }
  emit();
}

export function goBack(): void {
  if (depth > 0) {
    window.history.back();
    return;
  }
  navigate({ name: 'dashboard' }, { replace: true });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  const location = useSyncExternalStore(
    subscribe,
    () => `${window.location.pathname}${window.location.search}`,
    () => '/',
  );
  const url = new URL(location, 'http://local');
  return parseRoute(url.pathname, url.search);
}
