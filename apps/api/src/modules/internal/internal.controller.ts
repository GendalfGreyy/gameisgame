import { linkSquadChatRequestSchema } from '@game-is-game/shared';
import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator.js';
import { ServiceTokenGuard } from '../../common/guards/service-token.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SquadsService } from '../squads/squads.service.js';

/**
 * Service-to-service endpoints (bot → api). @Public skips the user JWT guard;
 * ServiceTokenGuard enforces the static service token instead.
 */
@Public()
@UseGuards(ServiceTokenGuard)
@Controller('internal')
export class InternalController {
  constructor(@Inject(SquadsService) private readonly squadsService: SquadsService) {}

  @Post('squads/link-chat')
  linkSquadChat(
    @Body(new ZodValidationPipe(linkSquadChatRequestSchema))
    body: Parameters<SquadsService['linkChat']>[0],
  ) {
    return this.squadsService.linkChat(body);
  }
}
