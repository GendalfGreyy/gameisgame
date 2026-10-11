/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CREATOR_API_URL?: string;
  /** Shows the dev-login button outside Telegram; the API still enforces NODE_ENV. */
  readonly VITE_CREATOR_DEV_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
