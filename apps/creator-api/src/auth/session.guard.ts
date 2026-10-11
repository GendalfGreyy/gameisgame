import {
  Inject,
  Injectable,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from './public.decorator.js';
import { SessionService, sessionExpired, type AuthContext } from './session.service.js';

type AuthedRequest = Request & { auth?: AuthContext };

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly reflector: Reflector;
  private readonly sessions: SessionService;

  constructor(
    @Inject(Reflector) reflector: Reflector,
    @Inject(SessionService) sessions: SessionService,
  ) {
    this.reflector = reflector;
    this.sessions = sessions;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match?.[1]) {
      throw sessionExpired();
    }
    request.auth = await this.sessions.resolve(match[1]);
    return true;
  }
}

/** Injects the AuthContext set by SessionGuard; only valid on guarded routes. */
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  if (!request.auth) {
    throw sessionExpired();
  }
  return request.auth;
});
