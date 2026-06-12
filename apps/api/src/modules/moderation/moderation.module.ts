import { Module } from '@nestjs/common';

import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AdminController } from './admin.controller.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController, AdminController],
  providers: [ReportsService, RolesGuard, AuditLogInterceptor],
})
export class ModerationModule {}
