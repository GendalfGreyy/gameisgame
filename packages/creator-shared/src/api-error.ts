import { z } from 'zod';

import { ERROR_CODES, type ErrorCode } from './error-codes.js';

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export type ApiErrorOptions = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
};

/** Structured API error with catalog code + Russian user message. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;
  readonly status: number;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.details = options.details;
    this.status = options.status ?? defaultStatusForCode(options.code);
  }

  toJSON(): ApiErrorBody {
    const body: ApiErrorBody = {
      error: {
        code: this.code,
        message: this.message,
      },
    };
    if (this.details !== undefined) {
      body.error.details = this.details;
    }
    return body;
  }
}

export function defaultStatusForCode(code: ErrorCode): number {
  switch (code) {
    case 'AUTH_INVALID_SIGNATURE':
    case 'AUTH_EXPIRED':
    case 'AUTH_DEV_FORBIDDEN':
    case 'SESSION_EXPIRED':
      return 401;
    case 'FORBIDDEN':
    case 'ACTION_NOT_PERMITTED':
    case 'DATA_POLICY_DENIED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'REVISION_CONFLICT':
    case 'ALREADY_UNPUBLISHED':
      return 409;
    case 'ASSET_TOO_LARGE':
      return 413;
    case 'SCHEMA_INVALID':
    case 'GRAPH_BROKEN_REF':
    case 'HIERARCHY_CYCLE':
    case 'MIGRATION_FAILED':
    case 'ASSET_TYPE_FORBIDDEN':
    case 'ASSET_PROCESSING_FAILED':
    case 'ASSET_MISSING':
    case 'PUBLISH_VALIDATION_FAILED':
    case 'PUBLISH_LINK_NOT_CONFIGURED':
    case 'VALIDATION_FAILED':
      return 422;
    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMITED':
      return 429;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
