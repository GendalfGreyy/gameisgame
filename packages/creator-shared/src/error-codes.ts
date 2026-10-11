/**
 * Machine error codes — normative registry: tg-creator-studio/docs/06-ERROR-CATALOG.md
 * New codes require a docs/06 update in the same change.
 */
export const ERROR_CODES = [
  'AUTH_INVALID_SIGNATURE',
  'AUTH_EXPIRED',
  'AUTH_DEV_FORBIDDEN',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'REVISION_CONFLICT',
  'SCHEMA_INVALID',
  'GRAPH_BROKEN_REF',
  'HIERARCHY_CYCLE',
  'MIGRATION_FAILED',
  'ASSET_TOO_LARGE',
  'ASSET_TYPE_FORBIDDEN',
  'ASSET_PROCESSING_FAILED',
  'ASSET_MISSING',
  'PUBLISH_VALIDATION_FAILED',
  'PUBLISH_LINK_NOT_CONFIGURED',
  'ALREADY_UNPUBLISHED',
  'ACTION_NOT_PERMITTED',
  'DATA_POLICY_DENIED',
  'VALIDATION_FAILED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
