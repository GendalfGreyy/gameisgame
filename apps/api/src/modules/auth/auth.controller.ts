import {
  refreshTokenRequestSchema,
  telegramAuthRequestSchema,
} from '@game-is-game/shared';
import { Body, Controller, Get, Inject, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('telegram')
  authenticateWithTelegram(
    @Body(new ZodValidationPipe(telegramAuthRequestSchema))
    body: { initData: string },
  ) {
    return this.authService.authenticateWithTelegram(body.initData);
  }

  @Public()
  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    body: { refreshToken: string },
  ) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const record = await this.prisma.user.findFirstOrThrow({
      where: { id: user.id, deletedAt: null },
    });
    return this.authService.toUserProfile(record);
  }

  @Get('invite-link')
  inviteLink(@CurrentUser() user: RequestUser) {
    return this.authService.getInviteLink(user.id);
  }
}
