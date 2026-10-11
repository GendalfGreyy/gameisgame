import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/client/index.js';

function resolveDatabaseUrl(): string {
  const url = process.env.CREATOR_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('CREATOR_DATABASE_URL or DATABASE_URL is required');
  }
  return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: resolveDatabaseUrl() },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
