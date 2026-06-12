import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { PointsModule } from '../points/points.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [PointsModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
