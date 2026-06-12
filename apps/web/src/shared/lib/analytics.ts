/** Lightweight analytics — PostHog HTTP capture when configured. */

type TrackProps = Record<string, string | number | boolean>;

let posthogKey: string | undefined;
let posthogHost: string | undefined;

export function initAnalytics(): void {
  posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  posthogHost = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.DEV) {
    console.info('[analytics] Sentry DSN set — add @sentry/react in deploy pipeline');
  }
}

export function trackEvent(name: string, props?: TrackProps): void {
  if (import.meta.env.DEV) {
    console.debug('[track]', name, props ?? {});
  }

  if (!posthogKey) {
    return;
  }

  const host = posthogHost ?? 'https://us.i.posthog.com';
  void fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: posthogKey,
      event: name,
      properties: {
        ...props,
        $lib: 'web-manual',
      },
    }),
  }).catch(() => {
    // fire-and-forget
  });
}
