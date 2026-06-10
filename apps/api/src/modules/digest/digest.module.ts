import { Module } from '@nestjs/common';

import { DigestService } from './digest.service.js';

@Module({
  providers: [DigestService],
})
export class DigestModule {}
