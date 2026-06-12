import { reviewReportRequestSchema } from '@game-is-game/shared';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { ReportsService } from './reports.service.js';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles('moderator', 'admin')
@UseInterceptors(AuditLogInterceptor)
export class AdminController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('reports')
  listReports() {
    return this.reportsService.listOpen();
  }

  @Patch('reports/:id')
  @AuditAction({ action: 'report.review', targetType: 'report', targetIdParam: 'id' })
  reviewReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(reviewReportRequestSchema))
    body: Parameters<ReportsService['review']>[2],
  ) {
    return this.reportsService.review(id, user.id, body);
  }
}
