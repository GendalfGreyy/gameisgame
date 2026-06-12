import { createBoostRequestSchema, confirmBoostPaymentSchema } from '@game-is-game/shared';
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ServiceTokenGuard } from '../../common/guards/service-token.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { BoostsService } from './boosts.service.js';

@Controller()
export class BoostsController {
  constructor(@Inject(BoostsService) private readonly boostsService: BoostsService) {}

  @Post('events/:id/boost')
  create(
    @Param('id') eventId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createBoostRequestSchema))
    body: Parameters<BoostsService['createBoost']>[2],
  ) {
    return this.boostsService.createBoost(eventId, user.id, body);
  }

  @Public()
  @UseGuards(ServiceTokenGuard)
  @Get('internal/boosts/:id')
  getPending(@Param('id') boostId: string) {
    return this.boostsService.getPendingBoost(boostId);
  }

  @Public()
  @UseGuards(ServiceTokenGuard)
  @Post('internal/boosts/confirm')
  confirm(
    @Body(new ZodValidationPipe(confirmBoostPaymentSchema))
    body: Parameters<BoostsService['confirmPayment']>[0],
  ) {
    return this.boostsService.confirmPayment(body);
  }
}
