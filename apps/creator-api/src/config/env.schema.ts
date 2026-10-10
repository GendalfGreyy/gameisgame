import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /** Railway injects PORT; local default is CREATOR_API_PORT. */
    PORT: z.coerce.number().int().optional(),
    CREATOR_API_PORT: z.coerce.number().int().default(3010),
    CREATOR_API_PUBLIC_URL: z.string().url().default('http://localhost:3010'),
    CREATOR_API_CORS_ORIGINS: z.string().default('http://localhost:5174,http://localhost:5175'),
    /** Falls back to DATABASE_URL when CREATOR_DATABASE_URL is unset. */
    CREATOR_DATABASE_URL: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.CREATOR_DATABASE_URL && !value.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CREATOR_DATABASE_URL or DATABASE_URL is required',
        path: ['CREATOR_DATABASE_URL'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function resolveCreatorDatabaseUrl(env: Env): string {
  return env.CREATOR_DATABASE_URL ?? env.DATABASE_URL ?? '';
}
