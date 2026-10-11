import { ApiError } from '@tg-creator/shared';
import type { z } from 'zod';

/** Parses request input; failures become VALIDATION_FAILED (422) with field issues. */
export function parseRequest<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      message: 'Проверьте введённые данные',
      details: {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
  return result.data;
}
