import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

export type AuditActionMeta = {
  action: string;
  targetType: string;
  targetIdParam?: string;
};

export const AuditAction = (meta: AuditActionMeta) => SetMetadata(AUDIT_ACTION_KEY, meta);
