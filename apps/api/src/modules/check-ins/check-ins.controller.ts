import { confirmDwellRequestSchema, createCheckInRequestSchema } from '@game-is-game/shared';
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { CheckInsService } from './check-ins.service.js';

@Controller('events/:eventId/checkin')
export class CheckInsController {
  constructor(@Inject(CheckInsService) private readonly checkInsService: CheckInsService) {}

  @Post()
  create(
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCheckInRequestSchema))
    body: Parameters<CheckInsService['create']>[2],
  ) {
    return this.checkInsService.create(eventId, user.id, body);
  }

  @Post('confirm')
  confirmDwell(
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(confirmDwellRequestSchema))
    body: Parameters<CheckInsService['confirmDwell']>[2],
  ) {
    return this.checkInsService.confirmDwell(eventId, user.id, body);
  }

  @Get('qr-token')
  getQrToken(@Param('eventId') eventId: string, @CurrentUser() user: RequestUser) {
    return this.checkInsService.getQrToken(eventId, user.id);
  }
}
