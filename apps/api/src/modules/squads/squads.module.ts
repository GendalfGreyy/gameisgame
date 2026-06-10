import { Module } from '@nestjs/common';

import { SquadsController } from './squads.controller.js';
import { SquadsService } from './squads.service.js';

@Module({
  controllers: [SquadsController],
  providers: [SquadsService],
  exports: [SquadsService],
})
export class SquadsModule {}
