import { Controller, Get, Inject } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { StreaksService } from './streaks.service.js';

@Controller('streaks')
export class StreaksController {
  constructor(@Inject(StreaksService) private readonly streaksService: StreaksService) {}

  @Get('me')
  getMyStreak(@CurrentUser() user: RequestUser) {
    return this.streaksService.getMyStreak(user.id);
  }
}
