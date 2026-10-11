import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis as RedisClient } from 'ioredis';

import type { Env } from '../config/env.schema.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: RedisClient;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService<Env, true>) {
    this.client = new RedisClient(this.configService.get('REDIS_URL', { infer: true }));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
