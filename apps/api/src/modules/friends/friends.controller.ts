import { sendFriendRequestSchema } from '@game-is-game/shared';
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { FriendsService } from './friends.service.js';

@Controller('friends')
export class FriendsController {
  constructor(@Inject(FriendsService) private readonly friendsService: FriendsService) {}

  @Get()
  listFriends(@CurrentUser() user: RequestUser) {
    return this.friendsService.listFriends(user.id);
  }

  @Get('requests')
  listIncomingRequests(@CurrentUser() user: RequestUser) {
    return this.friendsService.listIncomingRequests(user.id);
  }

  @Post('requests')
  sendRequest(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(sendFriendRequestSchema))
    body: Parameters<FriendsService['sendRequest']>[1],
  ) {
    return this.friendsService.sendRequest(user.id, body);
  }

  @Post('requests/:id/accept')
  acceptRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.friendsService.acceptRequest(id, user.id);
  }
}
