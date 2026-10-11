import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service.js';

@Controller()
export class HealthController {
  private readonly health: HealthService;

  constructor(@Inject(HealthService) health: HealthService) {
    this.health = health;
  }

  @Get('health')
  async getHealth() {
    const result = await this.health.check();
    if (result.status !== 'healthy') {
      throw new ServiceUnavailableException({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'База данных недоступна',
          details: { db: result.db },
        },
        ...result,
      });
    }
    return result;
  }

  @Get('api/v1/health')
  async getVersionedHealth() {
    return this.getHealth();
  }
}
