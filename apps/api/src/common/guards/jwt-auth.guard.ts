import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { Env } from '../../config/env.schema.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { RequestUser } from '../types/request-user.js';

type AccessTokenPayload = {
  sub: string;
  telegramId: string;
  role: RequestUser['role'];
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: RequestUser;
    }>();

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.configService.get('JWT_SECRET', { infer: true }),
        issuer: this.configService.get('JWT_ISSUER', { infer: true }),
        audience: this.configService.get('JWT_AUDIENCE', { infer: true }),
      });
      request.user = {
        id: payload.sub,
        telegramId: payload.telegramId,
        role: payload.role,
      };
      return true;
    } catch {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
