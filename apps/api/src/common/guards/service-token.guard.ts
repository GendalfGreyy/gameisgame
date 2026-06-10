import { timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema.js';

/**
 * Static bearer token for service-to-service calls (bot → api internal routes).
 * Routes using this guard are marked @Public to bypass the user JWT guard —
 * this guard is what protects them instead (default-deny stays intact).
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get('SERVICE_JWT_SECRET', { infer: true });
    if (!secret) {
      throw new ServiceUnavailableException('Internal API is not configured');
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing service token');
    }

    const token = header.slice('Bearer '.length);
    const expected = Buffer.from(secret);
    const provided = Buffer.from(token);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid service token');
    }

    return true;
  }
}
