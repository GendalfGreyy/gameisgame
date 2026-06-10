import { createSquadRequestSchema, joinSquadRequestSchema } from '@game-is-game/shared';
import { Body, Controller, Delete, Get, Inject, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { SquadsService } from './squads.service.js';

@Controller('squads')
export class SquadsController {
  constructor(@Inject(SquadsService) private readonly squadsService: SquadsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createSquadRequestSchema))
    body: Parameters<SquadsService['create']>[1],
  ) {
    return this.squadsService.create(user.id, body);
  }

  @Post('join')
  join(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(joinSquadRequestSchema))
    body: Parameters<SquadsService['join']>[1],
  ) {
    return this.squadsService.join(user.id, body);
  }

  @Delete('me')
  leave(@CurrentUser() user: RequestUser) {
    return this.squadsService.leave(user.id);
  }

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.squadsService.getMine(user.id);
  }

  @Get('leaderboard')
  getLeaderboard(@CurrentUser() user: RequestUser) {
    return this.squadsService.getLeaderboard(user.id);
  }
}
