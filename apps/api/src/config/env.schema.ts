import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Railway injects PORT; falls back to API_PORT for local/docker. */
  PORT: z.coerce.number().int().optional(),
  API_PORT: z.coerce.number().int().default(3001),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  API_CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(3).default('gamegamebot'),
  TELEGRAM_WEBAPP_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32),
  /** Dedicated secret for rotating check-in QR tokens. Falls back to JWT_SECRET when unset. */
  CHECKIN_QR_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_ISSUER: z.string().default('game-is-game'),
  JWT_AUDIENCE: z.string().default('game-is-game-miniapp'),
  /** Static bearer token for bot → api internal endpoints. Internal routes 503 when unset. */
  SERVICE_JWT_SECRET: z.string().min(32).optional(),
  ADMIN_BOOTSTRAP_TELEGRAM_IDS: z.string().default(''),
  FEATURE_BOOSTS_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  FEATURE_PAYMENTS_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;
