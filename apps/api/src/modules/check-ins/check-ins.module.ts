import { Module } from '@nestjs/common';

import { PointsModule } from '../points/points.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { CheckInsController } from './check-ins.controller.js';
import { CheckInsService } from './check-ins.service.js';

@Module({
  imports: [PointsModule, StreaksModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}
