import { Module } from '@nestjs/common';

import { LeaderboardController } from './leaderboard.controller.js';
import { PointsService } from './points.service.js';

@Module({
  providers: [PointsService],
  controllers: [LeaderboardController],
  exports: [PointsService],
})
export class PointsModule {}
