import { describe, expect, it, vi } from 'vitest';

import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns healthy when DB responds', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const service = new HealthService(prisma as never);
    const result = await service.check();
    expect(result.status).toBe('healthy');
    expect(result.db).toBe('up');
    expect(result.service).toBe('creator-api');
  });

  it('returns unhealthy when DB throws', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    const service = new HealthService(prisma as never);
    const result = await service.check();
    expect(result.status).toBe('unhealthy');
    expect(result.db).toBe('down');
  });
});
