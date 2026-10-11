/**
 * Isolated wrapper over `window.Telegram.WebApp`.
 *
 * The SDK object is read through `Reflect.get` with runtime type checks, so a
 * missing script, an old Telegram client or a plain browser all degrade to
 * no-ops instead of throwing. `initDataUnsafe` is deliberately not exposed:
 * only raw `initData` is forwarded, and only the server may trust it.
 */

export type TelegramColorScheme = 'dark' | 'light';

export type TelegramThemeParams = {
  bg_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
  section_separator_color?: string;
  header_bg_color?: string;
};

export type SafeAreaInsets = { top: number; right: number; bottom: number; left: number };

export type ViewportState = {
  height: number | null;
  stableHeight: number | null;
  isExpanded: boolean;
};

type Unsubscribe = () => void;

export type TelegramBridge = {
  /** True only when Telegram passed signed launch data. */
  readonly isTelegram: boolean;
  /** Raw signed query string for `POST /auth/telegram`; empty outside Telegram. */
  readonly initData: string;
  readonly platform: string;
  readonly version: string;
  colorScheme(): TelegramColorScheme | null;
  themeParams(): TelegramThemeParams;
  viewport(): ViewportState;
  safeAreaInset(): SafeAreaInsets;
  contentSafeAreaInset(): SafeAreaInsets;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  showBackButton(): void;
  hideBackButton(): void;
  onBackButton(handler: () => void): Unsubscribe;
  onThemeChanged(handler: () => void): Unsubscribe;
  onViewportChanged(handler: () => void): Unsubscribe;
  onSafeAreaChanged(handler: () => void): Unsubscribe;
};

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const THEME_KEYS: ReadonlyArray<keyof TelegramThemeParams> = [
  'bg_color',
  'secondary_bg_color',
  'section_bg_color',
  'text_color',
  'hint_color',
  'link_color',
  'button_color',
  'button_text_color',
  'destructive_text_color',
  'section_separator_color',
  'header_bg_color',
];

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function readString(target: object, key: string): string {
  const value: unknown = Reflect.get(target, key);
  return typeof value === 'string' ? value : '';
}

function readNumber(target: object, key: string): number | null {
  const value: unknown = Reflect.get(target, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readInsets(target: object, key: string): SafeAreaInsets {
  const value: unknown = Reflect.get(target, key);
  if (!isObject(value)) {
    return ZERO_INSETS;
  }
  return {
    top: readNumber(value, 'top') ?? 0,
    right: readNumber(value, 'right') ?? 0,
    bottom: readNumber(value, 'bottom') ?? 0,
    left: readNumber(value, 'left') ?? 0,
  };
}

/** Calls `target[key](...args)` only when it is a function; returns its result. */
function invoke(target: object, key: string, ...args: unknown[]): unknown {
  const fn: unknown = Reflect.get(target, key);
  if (typeof fn !== 'function') {
    return undefined;
  }
  try {
    return Reflect.apply(fn, target, args);
  } catch {
    // Older clients throw on unsupported methods (e.g. colors before 6.1).
    return undefined;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function findWebApp(root: unknown): object | null {
  if (!isObject(root)) {
    return null;
  }
  const telegram: unknown = Reflect.get(root, 'Telegram');
  if (!isObject(telegram)) {
    return null;
  }
  const webApp: unknown = Reflect.get(telegram, 'WebApp');
  return isObject(webApp) ? webApp : null;
}

function createNoopBridge(): TelegramBridge {
  const noop = (): void => undefined;
  const noopSubscribe = (): Unsubscribe => noop;
  return {
    isTelegram: false,
    initData: '',
    platform: 'browser',
    version: '0',
    colorScheme: () => null,
    themeParams: () => ({}),
    viewport: () => ({ height: null, stableHeight: null, isExpanded: true }),
    safeAreaInset: () => ZERO_INSETS,
    contentSafeAreaInset: () => ZERO_INSETS,
    ready: noop,
    expand: noop,
    setHeaderColor: noop,
    setBackgroundColor: noop,
    showBackButton: noop,
    hideBackButton: noop,
    onBackButton: noopSubscribe,
    onThemeChanged: noopSubscribe,
    onViewportChanged: noopSubscribe,
    onSafeAreaChanged: noopSubscribe,
  };
}

/**
 * Builds a bridge from `root` (defaults to `globalThis`). The Telegram script
 * also defines `WebApp` in a normal browser, so presence of signed `initData`
 * is what marks a real Telegram launch.
 */
export function createTelegramBridge(root: unknown = globalThis): TelegramBridge {
  const webApp = findWebApp(root);
  if (!webApp) {
    return createNoopBridge();
  }
  const app: object = webApp;
  const initData = readString(app, 'initData');
  const version = readString(app, 'version') || '6.0';

  const supports = (minVersion: string): boolean => {
    const result = invoke(app, 'isVersionAtLeast', minVersion);
    return typeof result === 'boolean' ? result : compareVersions(version, minVersion) >= 0;
  };

  const subscribe = (event: string, handler: () => void): Unsubscribe => {
    invoke(app, 'onEvent', event, handler);
    return () => {
      invoke(app, 'offEvent', event, handler);
    };
  };

  const backButton = (): object | null => {
    const button: unknown = Reflect.get(app, 'BackButton');
    return isObject(button) && supports('6.1') ? button : null;
  };

  return {
    isTelegram: initData.length > 0,
    initData,
    platform: readString(app, 'platform') || 'unknown',
    version,
    colorScheme: () => {
      const scheme = readString(app, 'colorScheme');
      return scheme === 'dark' || scheme === 'light' ? scheme : null;
    },
    themeParams: () => {
      const raw: unknown = Reflect.get(app, 'themeParams');
      const params: TelegramThemeParams = {};
      if (!isObject(raw)) {
        return params;
      }
      for (const key of THEME_KEYS) {
        const value = readString(raw, key);
        if (value) {
          params[key] = value;
        }
      }
      return params;
    },
    viewport: () => ({
      height: readNumber(app, 'viewportHeight'),
      stableHeight: readNumber(app, 'viewportStableHeight'),
      isExpanded: Reflect.get(app, 'isExpanded') === true,
    }),
    safeAreaInset: () => (supports('8.0') ? readInsets(app, 'safeAreaInset') : ZERO_INSETS),
    contentSafeAreaInset: () =>
      supports('8.0') ? readInsets(app, 'contentSafeAreaInset') : ZERO_INSETS,
    ready: () => {
      invoke(app, 'ready');
    },
    expand: () => {
      invoke(app, 'expand');
    },
    setHeaderColor: (color) => {
      // Hex values are accepted since 6.9; earlier clients only take theme keys.
      if (supports(color.startsWith('#') ? '6.9' : '6.1')) {
        invoke(app, 'setHeaderColor', color);
      }
    },
    setBackgroundColor: (color) => {
      if (supports('6.1')) {
        invoke(app, 'setBackgroundColor', color);
      }
    },
    showBackButton: () => {
      const button = backButton();
      if (button) {
        invoke(button, 'show');
      }
    },
    hideBackButton: () => {
      const button = backButton();
      if (button) {
        invoke(button, 'hide');
      }
    },
    onBackButton: (handler) => {
      const button = backButton();
      if (!button) {
        return () => undefined;
      }
      invoke(button, 'onClick', handler);
      return () => {
        invoke(button, 'offClick', handler);
      };
    },
    onThemeChanged: (handler) => subscribe('themeChanged', handler),
    onViewportChanged: (handler) => subscribe('viewportChanged', handler),
    onSafeAreaChanged: (handler) => {
      const offSafe = subscribe('safeAreaChanged', handler);
      const offContent = subscribe('contentSafeAreaChanged', handler);
      return () => {
        offSafe();
        offContent();
      };
    },
  };
}
