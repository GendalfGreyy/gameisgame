import { z } from 'zod';

const booleanFlag = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /** Railway injects PORT; local default is CREATOR_API_PORT. */
    PORT: z.coerce.number().int().optional(),
    CREATOR_API_PORT: z.coerce.number().int().default(3010),
    CREATOR_API_PUBLIC_URL: z.string().url().default('http://localhost:3010'),
    CREATOR_API_CORS_ORIGINS: z.string().default('http://localhost:5174,http://localhost:5175'),
    /** Must point at a dedicated Postgres schema, e.g. `?schema=creator`. */
    CREATOR_DATABASE_URL: z.string().min(1),
    /** Same bot token as apps/bot; required to verify Telegram initData. */
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    /** initData older than this is rejected with AUTH_EXPIRED. */
    CREATOR_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86_400),
    CREATOR_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
    CREATOR_PROJECT_QUOTA: z.coerce.number().int().positive().default(50),
    /** Enables POST /auth/dev. Only honoured when NODE_ENV=development. */
    CREATOR_DEV_AUTH: booleanFlag,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.CREATOR_DEV_AUTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CREATOR_DEV_AUTH must not be enabled in production',
        path: ['CREATOR_DEV_AUTH'],
      });
    }
    if (value.NODE_ENV === 'production' && !value.TELEGRAM_BOT_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TELEGRAM_BOT_TOKEN is required in production',
        path: ['TELEGRAM_BOT_TOKEN'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function isDevAuthAllowed(env: Pick<Env, 'NODE_ENV' | 'CREATOR_DEV_AUTH'>): boolean {
  return env.NODE_ENV === 'development' && env.CREATOR_DEV_AUTH;
}
