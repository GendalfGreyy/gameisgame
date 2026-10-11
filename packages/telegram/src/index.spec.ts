import { describe, expect, it, vi } from 'vitest';

import { createTelegramBridge } from './index.js';

function fakeWebApp(overrides: Record<string, unknown> = {}) {
  const handlers = new Map<string, Set<() => void>>();
  const backClicks = new Set<() => void>();
  const webApp = {
    initData: 'query_id=1&user=%7B%7D&auth_date=1&hash=abc',
    version: '8.0',
    platform: 'ios',
    colorScheme: 'dark',
    themeParams: { bg_color: '#17212b', text_color: '#f5f5f5', bogus: 42 },
    viewportHeight: 640,
    viewportStableHeight: 600,
    isExpanded: true,
    safeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
    contentSafeAreaInset: { top: 56 },
    ready: vi.fn(),
    expand: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    onEvent: (event: string, handler: () => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    },
    offEvent: (event: string, handler: () => void) => {
      handlers.get(event)?.delete(handler);
    },
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: (handler: () => void) => backClicks.add(handler),
      offClick: (handler: () => void) => backClicks.delete(handler),
    },
    ...overrides,
  };
  const emit = (event: string) => handlers.get(event)?.forEach((handler) => handler());
  const clickBack = () => backClicks.forEach((handler) => handler());
  return { root: { Telegram: { WebApp: webApp } }, webApp, emit, clickBack };
}

describe('createTelegramBridge', () => {
  it('falls back to a browser no-op bridge without the SDK', () => {
    const bridge = createTelegramBridge({});
    expect(bridge.isTelegram).toBe(false);
    expect(bridge.initData).toBe('');
    expect(bridge.colorScheme()).toBeNull();
    expect(bridge.safeAreaInset()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(() => {
      bridge.ready();
      bridge.showBackButton();
      bridge.onThemeChanged(() => undefined)();
    }).not.toThrow();
  });

  it('treats the SDK without initData as a plain browser', () => {
    const { root } = fakeWebApp({ initData: '' });
    expect(createTelegramBridge(root).isTelegram).toBe(false);
  });

  it('exposes raw initData, theme, viewport and safe areas', () => {
    const { root } = fakeWebApp();
    const bridge = createTelegramBridge(root);
    expect(bridge.isTelegram).toBe(true);
    expect(bridge.initData).toContain('hash=abc');
    expect(bridge.colorScheme()).toBe('dark');
    expect(bridge.themeParams()).toEqual({ bg_color: '#17212b', text_color: '#f5f5f5' });
    expect(bridge.viewport()).toEqual({ height: 640, stableHeight: 600, isExpanded: true });
    expect(bridge.safeAreaInset()).toEqual({ top: 44, right: 0, bottom: 34, left: 0 });
    expect(bridge.contentSafeAreaInset().top).toBe(56);
  });

  it('subscribes and unsubscribes Telegram events', () => {
    const { root, emit } = fakeWebApp();
    const bridge = createTelegramBridge(root);
    const handler = vi.fn();
    const off = bridge.onThemeChanged(handler);
    emit('themeChanged');
    off();
    emit('themeChanged');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('wires BackButton clicks', () => {
    const { root, webApp, clickBack } = fakeWebApp();
    const bridge = createTelegramBridge(root);
    const handler = vi.fn();
    const off = bridge.onBackButton(handler);
    bridge.showBackButton();
    clickBack();
    off();
    clickBack();
    expect(webApp.BackButton.show).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('skips features the client version does not support', () => {
    const { root, webApp } = fakeWebApp({ version: '6.0' });
    const bridge = createTelegramBridge(root);
    bridge.setHeaderColor('#111622');
    bridge.showBackButton();
    expect(webApp.setHeaderColor).not.toHaveBeenCalled();
    expect(webApp.BackButton.show).not.toHaveBeenCalled();
    expect(bridge.safeAreaInset().top).toBe(0);
  });

  it('prefers the SDK isVersionAtLeast when available', () => {
    const { root, webApp } = fakeWebApp({ version: '6.0', isVersionAtLeast: () => true });
    createTelegramBridge(root).setBackgroundColor('#111622');
    expect(webApp.setBackgroundColor).toHaveBeenCalledWith('#111622');
  });

  it('swallows errors thrown by old clients', () => {
    const { root } = fakeWebApp({
      expand: () => {
        throw new Error('unsupported');
      },
    });
    expect(() => createTelegramBridge(root).expand()).not.toThrow();
  });
});
