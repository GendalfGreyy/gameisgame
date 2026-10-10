import { describe, expect, it } from 'vitest';

import { ApiError, apiErrorBodySchema, defaultStatusForCode } from './api-error.js';
import { ERROR_CODES, isErrorCode } from './error-codes.js';

describe('@tg-creator/shared ApiError', () => {
  it('serializes catalog code and Russian message', () => {
    const err = new ApiError({
      code: 'REVISION_CONFLICT',
      message: 'Проект изменен в другой сессии',
      details: { expectedRevision: 11, actualRevision: 12 },
    });
    expect(err.status).toBe(409);
    expect(apiErrorBodySchema.parse(err.toJSON())).toEqual({
      error: {
        code: 'REVISION_CONFLICT',
        message: 'Проект изменен в другой сессии',
        details: { expectedRevision: 11, actualRevision: 12 },
      },
    });
  });

  it('maps known codes to default HTTP statuses', () => {
    expect(defaultStatusForCode('AUTH_EXPIRED')).toBe(401);
    expect(defaultStatusForCode('NOT_FOUND')).toBe(404);
    expect(defaultStatusForCode('RATE_LIMITED')).toBe(429);
    expect(defaultStatusForCode('SERVICE_UNAVAILABLE')).toBe(503);
  });

  it('lists every catalog code as a known ErrorCode', () => {
    for (const code of ERROR_CODES) {
      expect(isErrorCode(code)).toBe(true);
    }
    expect(isErrorCode('NOT_A_REAL_CODE')).toBe(false);
  });
});
