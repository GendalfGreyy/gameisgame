import { createReportRequestSchema } from '@game-is-game/shared';
import { Body, Controller, Inject, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createReportRequestSchema))
    body: Parameters<ReportsService['create']>[1],
  ) {
    return this.reportsService.create(user.id, body);
  }
}
