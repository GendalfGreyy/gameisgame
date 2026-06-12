import WebApp from '@twa-dev/sdk';

export function applyTelegramTheme() {
  const theme = WebApp.themeParams;
  const root = document.documentElement;

  if (theme.button_color) {
    root.style.setProperty('--tg-accent', theme.button_color);
    root.style.setProperty('--gig-accent', theme.button_color);
  }

  WebApp.ready();
  WebApp.expand();
}

export function getInitData() {
  return WebApp.initData;
}

export function getStartParam(): string | undefined {
  const param = WebApp.initDataUnsafe.start_param;
  return typeof param === 'string' && param.length > 0 ? param : undefined;
}
