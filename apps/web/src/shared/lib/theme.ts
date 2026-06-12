import { create } from 'zustand';

export type ColorTheme = 'light' | 'dark';

const STORAGE_KEY = 'gig.theme';

export function readStoredTheme(): ColorTheme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'light';
}

export function applyColorTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function initColorTheme(): ColorTheme {
  const theme = readStoredTheme();
  applyColorTheme(theme);
  return theme;
}

type ThemeState = {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyColorTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: ColorTheme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

export function bootstrapThemeStore(): void {
  const theme = initColorTheme();
  useThemeStore.setState({ theme });
}
