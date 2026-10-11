import { describe, expect, it } from 'vitest';

import {
  DARK_TOKENS,
  LIGHT_TOKENS,
  contrastRatio,
  isThemePreference,
  resolveTheme,
  themeToCssVars,
  tokensFromTelegram,
} from './index.js';

describe('resolveTheme', () => {
  it('honours manual dark/light regardless of Telegram or system', () => {
    const telegram = { colorScheme: 'light' as const, themeParams: { bg_color: '#ffffff' } };
    expect(resolveTheme('dark', { systemPrefersDark: false, telegram }).tokens).toEqual(
      DARK_TOKENS,
    );
    expect(resolveTheme('light', { systemPrefersDark: true, telegram }).scheme).toBe('light');
  });

  it('follows the OS scheme for "system"', () => {
    expect(resolveTheme('system', { systemPrefersDark: true, telegram: null }).scheme).toBe('dark');
    expect(resolveTheme('system', { systemPrefersDark: false, telegram: null }).tokens).toEqual(
      LIGHT_TOKENS,
    );
  });

  it('uses Telegram palette for "telegram" inside Telegram', () => {
    const resolved = resolveTheme('telegram', {
      systemPrefersDark: false,
      telegram: {
        colorScheme: 'dark',
        themeParams: { bg_color: '#17212b', text_color: '#f5f5f5', button_color: '#5288c1' },
      },
    });
    expect(resolved.source).toBe('telegram');
    expect(resolved.scheme).toBe('dark');
    expect(resolved.tokens.bg).toBe('#17212b');
    expect(resolved.tokens.accent).toBe('#5288c1');
  });

  it('falls back to system outside Telegram for "telegram"', () => {
    const resolved = resolveTheme('telegram', { systemPrefersDark: true, telegram: null });
    expect(resolved.source).toBe('system');
    expect(resolved.scheme).toBe('dark');
  });
});

describe('tokensFromTelegram', () => {
  it('rejects unreadable Telegram palettes', () => {
    const tokens = tokensFromTelegram({ bg_color: '#ffffff', text_color: '#fefefe' }, 'light');
    expect(tokens).toEqual(LIGHT_TOKENS);
  });

  it('ignores non-hex values', () => {
    const tokens = tokensFromTelegram({ bg_color: 'red', text_color: '#000000' }, 'light');
    expect(tokens.bg).toBe(LIGHT_TOKENS.bg);
  });
});

describe('helpers', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('nope', '#ffffff')).toBeNull();
  });

  it('built-in palettes keep text readable', () => {
    for (const tokens of [DARK_TOKENS, LIGHT_TOKENS]) {
      for (const surface of [tokens.bg, tokens.sidebar, tokens.surface]) {
        for (const text of [
          tokens.ink,
          tokens.muted,
          tokens.accent,
          tokens.success,
          tokens.warning,
          tokens.danger,
        ]) {
          expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrastRatio(tokens.accentInk, tokens.accentFill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('exposes CSS variables and validates preferences', () => {
    expect(themeToCssVars(DARK_TOKENS)['--ui-accent']).toBe('#D4F24A');
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('neon')).toBe(false);
  });
});
