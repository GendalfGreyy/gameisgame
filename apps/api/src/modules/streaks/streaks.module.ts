import { Module } from '@nestjs/common';

import { PointsModule } from '../points/points.module.js';
import { StreaksController } from './streaks.controller.js';
import { StreaksService } from './streaks.service.js';

@Module({
  imports: [PointsModule],
  controllers: [StreaksController],
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
