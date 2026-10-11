import {
  DEFAULT_DENSITY,
  DEFAULT_THEME_PREFERENCE,
  isDensity,
  isThemePreference,
  resolveTheme,
  themeToCssVars,
  type Density,
  type ResolvedTheme,
  type ThemeContext as ThemeEnvironment,
  type ThemePreference,
} from '@tg-creator/ui-kit';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { readStored, STORAGE_KEYS, writeStored } from '../lib/storage.js';
import { telegram } from '../lib/telegram.js';

type ThemeState = {
  preference: ThemePreference;
  density: Density;
  resolved: ResolvedTheme;
  environment: ThemeEnvironment;
  setPreference: (preference: ThemePreference) => void;
  setDensity: (density: Density) => void;
  /** Applies server-side preferences after login without echoing them back. */
  hydrate: (preferences: { theme: ThemePreference; density: Density }) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readEnvironment(): ThemeEnvironment {
  const tg = telegram();
  const colorScheme = tg.colorScheme();
  return {
    systemPrefersDark:
      typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY).matches : true,
    telegram: tg.isTelegram && colorScheme ? { colorScheme, themeParams: tg.themeParams() } : null,
  };
}

function initialPreference(): ThemePreference {
  const stored = readStored(STORAGE_KEYS.theme);
  return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
}

function initialDensity(): Density {
  const stored = readStored(STORAGE_KEYS.density);
  return isDensity(stored) ? stored : DEFAULT_DENSITY;
}

function applyToDocument(resolved: ResolvedTheme, density: Density): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeToCssVars(resolved.tokens))) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = resolved.scheme;
  root.dataset.scheme = resolved.scheme;
  root.dataset.density = density;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved.tokens.bg);

  const tg = telegram();
  tg.setHeaderColor(resolved.tokens.bg);
  tg.setBackgroundColor(resolved.tokens.bg);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [density, setDensityState] = useState<Density>(initialDensity);
  const [environment, setEnvironment] = useState<ThemeEnvironment>(readEnvironment);

  useEffect(() => {
    const refresh = () => setEnvironment(readEnvironment());
    const offTelegram = telegram().onThemeChanged(refresh);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
    media?.addEventListener('change', refresh);
    return () => {
      offTelegram();
      media?.removeEventListener('change', refresh);
    };
  }, []);

  const resolved = useMemo(() => resolveTheme(preference, environment), [preference, environment]);

  useEffect(() => {
    applyToDocument(resolved, density);
  }, [resolved, density]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStored(STORAGE_KEYS.theme, next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    writeStored(STORAGE_KEYS.density, next);
  }, []);

  const hydrate = useCallback(
    (preferences: { theme: ThemePreference; density: Density }) => {
      setPreference(preferences.theme);
      setDensity(preferences.density);
    },
    [setPreference, setDensity],
  );

  const value = useMemo<ThemeState>(
    () => ({ preference, density, resolved, environment, setPreference, setDensity, hydrate }),
    [preference, density, resolved, environment, setPreference, setDensity, hydrate],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
