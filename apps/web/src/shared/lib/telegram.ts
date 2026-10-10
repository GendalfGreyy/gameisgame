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

/** Share a URL via Telegram native sheet when available. */
export function shareUrl(url: string, text?: string) {
  const share = WebApp as unknown as {
    openTelegramLink?: (link: string) => void;
    openLink?: (link: string) => void;
  };
  const shareLink = `https://t.me/share/url?url=${encodeURIComponent(url)}${
    text ? `&text=${encodeURIComponent(text)}` : ''
  }`;
  if (typeof share.openTelegramLink === 'function') {
    share.openTelegramLink(shareLink);
    return;
  }
  if (typeof share.openLink === 'function') {
    share.openLink(shareLink);
    return;
  }
  window.open(shareLink, '_blank', 'noopener,noreferrer');
}
