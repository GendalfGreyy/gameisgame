import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs';

import { AUDIT_ACTION_KEY, type AuditActionMeta } from '../decorators/audit-action.decorator.js';
import type { RequestUser } from '../types/request-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const meta = this.reflector.get<AuditActionMeta | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      params?: Record<string, string>;
      body?: unknown;
    }>();

    return next.handle().pipe(
      tap(() => {
        const user = request.user;
        if (!user) {
          return;
        }
        const targetId =
          (meta.targetIdParam ? request.params?.[meta.targetIdParam] : undefined) ?? 'unknown';

        void this.prisma.adminAuditLog.create({
          data: {
            adminId: user.id,
            action: meta.action,
            targetType: meta.targetType,
            targetId,
            metadata: request.body ?? {},
          },
        });
      }),
    );
  }
}
