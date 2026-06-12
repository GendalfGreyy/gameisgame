import { Module } from '@nestjs/common';

import { BoostsController } from './boosts.controller.js';
import { BoostsService } from './boosts.service.js';

@Module({
  controllers: [BoostsController],
  providers: [BoostsService],
  exports: [BoostsService],
})
export class PaymentsModule {}
