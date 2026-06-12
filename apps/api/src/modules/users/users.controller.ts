import { lookupUserQuerySchema, updateUserSettingsSchema } from '@game-is-game/shared';
import { Body, Controller, Get, Inject, Patch, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateUserSettingsSchema))
    body: Parameters<UsersService['updateSettings']>[1],
  ) {
    return this.usersService.updateSettings(user.id, body);
  }

  @Get('lookup')
  lookup(
    @Query(new ZodValidationPipe(lookupUserQuerySchema))
    query: { username: string },
  ) {
    return this.usersService.lookupByUsername(query.username);
  }
}
