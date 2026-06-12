import { Module } from '@nestjs/common';

import { VisibilityService } from './visibility.service.js';

@Module({
  providers: [VisibilityService],
  exports: [VisibilityService],
})
export class PrivacyModule {}
