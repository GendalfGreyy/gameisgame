import { createTelegramBridge, type TelegramBridge } from '@tg-creator/telegram';

let bridge: TelegramBridge | null = null;

/** Single bridge instance; created lazily after telegram-web-app.js has run. */
export function telegram(): TelegramBridge {
  bridge ??= createTelegramBridge();
  return bridge;
}

/** Mirrors Telegram viewport and safe areas into CSS variables used by the layout. */
export function syncViewportCssVars(target: HTMLElement = document.documentElement): () => void {
  const tg = telegram();
  const apply = () => {
    const { stableHeight } = tg.viewport();
    const safe = tg.safeAreaInset();
    const content = tg.contentSafeAreaInset();
    target.style.setProperty('--tg-viewport-height', stableHeight ? `${stableHeight}px` : '100dvh');
    target.style.setProperty('--tg-safe-top', `${safe.top + content.top}px`);
    target.style.setProperty('--tg-safe-bottom', `${safe.bottom + content.bottom}px`);
    target.style.setProperty('--tg-safe-left', `${safe.left + content.left}px`);
    target.style.setProperty('--tg-safe-right', `${safe.right + content.right}px`);
  };
  apply();
  const offViewport = tg.onViewportChanged(apply);
  const offSafe = tg.onSafeAreaChanged(apply);
  return () => {
    offViewport();
    offSafe();
  };
}
