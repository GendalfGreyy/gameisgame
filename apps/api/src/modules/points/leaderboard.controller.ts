import { Controller, Get, Inject } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { PointsService } from './points.service.js';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(@Inject(PointsService) private readonly pointsService: PointsService) {}

  @Get()
  getLeaderboard(@CurrentUser() user: RequestUser) {
    return this.pointsService.getLeaderboard(user.id);
  }
}
