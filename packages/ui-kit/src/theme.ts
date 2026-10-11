export const THEME_PREFERENCES = ['telegram', 'system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export type ColorScheme = 'dark' | 'light';

export type ThemeTokens = {
  bg: string;
  sidebar: string;
  surface: string;
  border: string;
  ink: string;
  muted: string;
  /** Accent for text, links, focus rings and selection outlines. */
  accent: string;
  /** Fill for primary buttons; `accentInk` on it must reach 4.5:1. */
  accentFill: string;
  accentInk: string;
  success: string;
  warning: string;
  danger: string;
};

/** Subset of Telegram `WebApp.themeParams` used for the "Как в Telegram" theme. */
export type TelegramThemeParams = {
  bg_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
  section_separator_color?: string;
};

/**
 * "Мастерская" palette (docs/02 §9): warm graphite with a single acid-lime signal.
 * Every text/surface pair is checked to WCAG AA in index.spec.ts.
 */
export const DARK_TOKENS: ThemeTokens = {
  bg: '#0E0E0C',
  sidebar: '#151513',
  surface: '#1C1C19',
  border: '#33322C',
  ink: '#F3F1EA',
  muted: '#A6A398',
  accent: '#D4F24A',
  accentFill: '#D4F24A',
  accentInk: '#12130B',
  success: '#5AD7AE',
  warning: '#F5B544',
  danger: '#FF7A6B',
};

/** Paper variant: lime cannot carry text on light paper, so it moves onto an ink-black fill. */
export const LIGHT_TOKENS: ThemeTokens = {
  bg: '#F3F1EA',
  sidebar: '#EAE7DE',
  surface: '#FFFFFF',
  border: '#D6D2C6',
  ink: '#171713',
  muted: '#5C594F',
  accent: '#4D6600',
  accentFill: '#191A14',
  accentInk: '#D4F24A',
  success: '#0F7052',
  warning: '#8F5A00',
  danger: '#B5342A',
};

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'telegram';
export const DEFAULT_DENSITY: Density = 'comfortable';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function isDensity(value: unknown): value is Density {
  return typeof value === 'string' && (DENSITIES as readonly string[]).includes(value);
}

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseHex(color: string): [number, number, number] | null {
  if (!HEX_COLOR.test(color)) {
    return null;
  }
  const hex = color.slice(1);
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : hex;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) {
    return null;
  }
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio; `null` when either color is not a hex value. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  if (fg === null || bg === null) {
    return null;
  }
  const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
  return (hi + 0.05) / (lo + 0.05);
}

export function schemeOfColor(background: string): ColorScheme | null {
  const lum = relativeLuminance(background);
  if (lum === null) {
    return null;
  }
  return lum < 0.4 ? 'dark' : 'light';
}

/** Minimum contrast for body text (WCAG AA). */
const MIN_TEXT_CONTRAST = 4.5;
const MIN_UI_CONTRAST = 3;

function pick(value: string | undefined, fallback: string): string {
  return value !== undefined && HEX_COLOR.test(value) ? value : fallback;
}

/**
 * Maps Telegram themeParams onto our tokens. Any Telegram palette that would
 * make text unreadable falls back to the built-in tokens for the same scheme.
 */
export function tokensFromTelegram(params: TelegramThemeParams, scheme: ColorScheme): ThemeTokens {
  const base = scheme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
  const bg = pick(params.bg_color, base.bg);
  const ink = pick(params.text_color, base.ink);
  const textContrast = contrastRatio(ink, bg);
  if (textContrast === null || textContrast < MIN_TEXT_CONTRAST) {
    return base;
  }

  const accent = pick(params.button_color, base.accent);
  const accentInk = pick(params.button_text_color, base.accentInk);
  const accentContrast = contrastRatio(accentInk, accent);
  // Telegram's own button pair is accepted at the WCAG non-text/large-text level
  // so primary buttons look like the native MainButton.
  const accentOk = accentContrast !== null && accentContrast >= MIN_UI_CONTRAST;

  return {
    ...base,
    bg,
    ink,
    sidebar: pick(params.secondary_bg_color, base.sidebar),
    surface: pick(params.section_bg_color ?? params.secondary_bg_color, base.surface),
    border: pick(params.section_separator_color, base.border),
    muted: pick(params.hint_color, base.muted),
    accent: accentOk ? accent : base.accent,
    accentFill: accentOk ? accent : base.accentFill,
    accentInk: accentOk ? accentInk : base.accentInk,
    danger: pick(params.destructive_text_color, base.danger),
  };
}

export type ThemeContext = {
  systemPrefersDark: boolean;
  /** `null` when not running inside Telegram. */
  telegram: { colorScheme: ColorScheme; themeParams: TelegramThemeParams } | null;
};

export type ResolvedTheme = {
  preference: ThemePreference;
  scheme: ColorScheme;
  /** Which source produced the palette — shown in Settings so the choice is explainable. */
  source: 'telegram' | 'system' | 'manual';
  tokens: ThemeTokens;
};

export function resolveTheme(preference: ThemePreference, context: ThemeContext): ResolvedTheme {
  if (preference === 'dark' || preference === 'light') {
    return {
      preference,
      scheme: preference,
      source: 'manual',
      tokens: preference === 'dark' ? DARK_TOKENS : LIGHT_TOKENS,
    };
  }

  if (preference === 'telegram' && context.telegram) {
    const { colorScheme, themeParams } = context.telegram;
    const scheme =
      (themeParams.bg_color ? schemeOfColor(themeParams.bg_color) : null) ?? colorScheme;
    return {
      preference,
      scheme,
      source: 'telegram',
      tokens: tokensFromTelegram(themeParams, scheme),
    };
  }

  const scheme: ColorScheme = context.systemPrefersDark ? 'dark' : 'light';
  return {
    preference,
    scheme,
    source: 'system',
    tokens: scheme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS,
  };
}

const TOKEN_CSS_VARS: Record<keyof ThemeTokens, string> = {
  bg: '--ui-bg',
  sidebar: '--ui-sidebar',
  surface: '--ui-surface',
  border: '--ui-border',
  ink: '--ui-ink',
  muted: '--ui-muted',
  accent: '--ui-accent',
  accentFill: '--ui-accent-fill',
  accentInk: '--ui-accent-ink',
  success: '--ui-success',
  warning: '--ui-warning',
  danger: '--ui-danger',
};

export function themeToCssVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(TOKEN_CSS_VARS) as Array<keyof ThemeTokens>) {
    vars[TOKEN_CSS_VARS[key]] = tokens[key];
  }
  return vars;
}
