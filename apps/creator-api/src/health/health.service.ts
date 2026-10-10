import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export type HealthStatus = 'healthy' | 'unhealthy';
export type DbStatus = 'up' | 'down';

export type HealthResponse = {
  status: HealthStatus;
  service: 'creator-api';
  db: DbStatus;
  checkedAt: string;
};

@Injectable()
export class HealthService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async check(): Promise<HealthResponse> {
    const checkedAt = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        service: 'creator-api',
        db: 'up',
        checkedAt,
      };
    } catch {
      return {
        status: 'unhealthy',
        service: 'creator-api',
        db: 'down',
        checkedAt,
      };
    }
  }
}
