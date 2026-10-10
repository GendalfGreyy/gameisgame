function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const botConfig = {
  token: required('TELEGRAM_BOT_TOKEN'),
  redisUrl: required('REDIS_URL'),
  webappUrl: process.env.TELEGRAM_WEBAPP_URL ?? 'http://localhost:5173',
  apiUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
  /** Static token for internal api routes; squad linking is disabled when unset. */
  serviceToken: process.env.SERVICE_JWT_SECRET ?? null,
  /** When true, /start copy targets the constructor-only Mini App. */
  studioMiniApp: process.env.STUDIO_MINI_APP === 'true',
};
