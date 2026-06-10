import { Module } from '@nestjs/common';

import { ServiceTokenGuard } from '../../common/guards/service-token.guard.js';
import { SquadsModule } from '../squads/squads.module.js';
import { InternalController } from './internal.controller.js';

@Module({
  imports: [SquadsModule],
  controllers: [InternalController],
  providers: [ServiceTokenGuard],
})
export class InternalModule {}
