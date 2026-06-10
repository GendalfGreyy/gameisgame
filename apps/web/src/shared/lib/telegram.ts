import WebApp from '@twa-dev/sdk';

export function applyTelegramTheme() {
  const theme = WebApp.themeParams;
  const root = document.documentElement;

  if (theme.bg_color) {
    root.style.setProperty('--tg-bg', theme.bg_color);
  }
  if (theme.text_color) {
    root.style.setProperty('--tg-text', theme.text_color);
  }
  if (theme.button_color) {
    root.style.setProperty('--tg-accent', theme.button_color);
  }

  WebApp.ready();
  WebApp.expand();
}

export function getInitData() {
  return WebApp.initData;
}
