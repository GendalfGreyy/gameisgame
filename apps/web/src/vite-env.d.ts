/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_BOOSTS_ENABLED?: string;
  /** When "true", build a constructor-only Mini App (no map/events). */
  readonly VITE_STUDIO_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
