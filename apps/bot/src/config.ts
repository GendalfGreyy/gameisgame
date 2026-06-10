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
};
