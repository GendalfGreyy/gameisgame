import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '@tg-creator/shared';

import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuthContext = {
  userId: string;
  sessionId: string;
  expiresAt: Date;
};

const TOKEN_PREFIX = 'tgc_';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionExpired(): ApiError {
  return new ApiError({ code: 'SESSION_EXPIRED', message: 'Сессия истекла. Войдите снова' });
}

/** Opaque bearer sessions; only the SHA-256 of a token is persisted. */
@Injectable()
export class SessionService {
  private readonly prisma: PrismaService;
  private readonly ttlMs: number;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.prisma = prisma;
    this.ttlMs = config.get('CREATOR_SESSION_TTL_HOURS', { infer: true }) * 3_600_000;
  }

  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  async resolve(token: string): Promise<AuthContext> {
    if (!token.startsWith(TOKEN_PREFIX)) {
      throw sessionExpired();
    }
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw sessionExpired();
    }
    return { userId: session.userId, sessionId: session.id, expiresAt: session.expiresAt };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
