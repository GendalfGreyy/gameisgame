import {
  createStudioProjectRequestSchema,
  updateStudioProjectRequestSchema,
} from '@game-is-game/shared';
import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../../common/types/request-user.js';
import { StudioService } from './studio.service.js';

type OptionalAuthRequest = {
  user?: RequestUser;
};

@Controller('studio')
export class StudioController {
  constructor(@Inject(StudioService) private readonly studioService: StudioService) {}

  @Get('projects')
  listMine(@CurrentUser() user: RequestUser) {
    return this.studioService.listMine(user.id);
  }

  @Post('projects')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createStudioProjectRequestSchema))
    body: Parameters<StudioService['create']>[1],
  ) {
    return this.studioService.create(user.id, body);
  }

  @Get('projects/:id')
  getMine(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.studioService.getById(id, user.id);
  }

  /** Published games can be opened via deep link even before full session hydrate. */
  @Public()
  @Get('play/:id')
  getPublished(@Param('id') id: string, @Req() req: OptionalAuthRequest) {
    return this.studioService.getById(id, req.user?.id ?? null);
  }

  @Patch('projects/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStudioProjectRequestSchema))
    body: Parameters<StudioService['update']>[2],
  ) {
    return this.studioService.update(user.id, id, body);
  }

  @Post('projects/:id/publish')
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.studioService.publish(user.id, id);
  }

  @Post('projects/:id/unpublish')
  unpublish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.studioService.unpublish(user.id, id);
  }

  @Delete('projects/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.studioService.remove(user.id, id);
  }

  @Post('projects/:id/play')
  recordPlay(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.studioService.recordPlay(id, user.id);
  }

  @Public()
  @Post('play/:id/start')
  recordPublicPlay(@Param('id') id: string, @Req() req: OptionalAuthRequest) {
    return this.studioService.recordPlay(id, req.user?.id ?? null);
  }
}
