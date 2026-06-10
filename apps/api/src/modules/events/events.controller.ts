import {
  cloneEventRequestSchema,
  createEventRequestSchema,
  nearbyEventsRequestSchema,
  startingSoonRequestSchema,
  updateEventRequestSchema,
} from '@game-is-game/shared';
import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { EventsService } from './events.service.js';

@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly eventsService: EventsService) {}

  @Get('templates')
  getTemplates() {
    return this.eventsService.getTemplates();
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createEventRequestSchema))
    body: Parameters<EventsService['create']>[1],
  ) {
    return this.eventsService.create(user.id, body);
  }

  @Get('nearby')
  findNearby(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(nearbyEventsRequestSchema))
    query: Parameters<EventsService['findNearby']>[0],
  ) {
    return this.eventsService.findNearby(query, user.id);
  }

  @Get('starting-soon')
  findStartingSoon(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(startingSoonRequestSchema))
    query: Parameters<EventsService['findStartingSoon']>[0],
  ) {
    return this.eventsService.findStartingSoon(query, user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.eventsService.findById(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateEventRequestSchema))
    body: Parameters<EventsService['update']>[2],
  ) {
    return this.eventsService.update(id, user.id, body);
  }

  @Post(':id/clone')
  clone(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(cloneEventRequestSchema))
    body: Parameters<EventsService['clone']>[2],
  ) {
    return this.eventsService.clone(id, user.id, body);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.eventsService.join(id, user.id);
  }
}
