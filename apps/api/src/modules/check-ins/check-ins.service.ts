import type {
  CheckInResponse,
  ConfirmDwellRequest,
  CreateCheckInRequest,
  QrTokenResponse,
} from '@game-is-game/shared';
import {
  DWELL_MAX_DISTANCE_M,
  DWELL_MINUTES,
  DWELL_TTL_SECONDS,
  FRAUD_PENDING_THRESHOLD,
  FRAUD_REJECT_THRESHOLD,
  POINTS_CHECK_IN,
} from '@game-is-game/shared';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CheckInStatus } from '@game-is-game/db';

import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PointsService } from '../points/points.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { makeQrToken, secondsUntilRotation, verifyQrToken, windowIndex } from './qr-token.js';

const MAX_CHECK_INS_PER_DAY = 10;
const CHECK_IN_COOLDOWN_MINUTES = 30;
const MAX_DISTANCE_METERS = 150;
/** Host can render the rotating QR starting this long before the event. */
const QR_AVAILABLE_BEFORE_START_MINUTES = 60;

type DwellRecord = {
  checkInId: string;
  firstAt: string;
  lat: number;
  lng: number;
};

@Injectable()
export class CheckInsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(PointsService) private readonly pointsService: PointsService,
    @Inject(StreaksService) private readonly streaksService: StreaksService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /**
   * Rotating QR token for the host screen / printed-stand companion page.
   * Stateless TOTP-style HMAC — see qr-token.ts.
   */
  async getQrToken(eventId: string, actorId: string): Promise<QrTokenResponse> {
    const event = await this.prisma.gameEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not found');
    }
    if (event.hostId !== actorId) {
      throw new ForbiddenException('Only the host can issue check-in tokens');
    }

    const now = new Date();
    const availableFrom = new Date(
      event.startsAt.getTime() - QR_AVAILABLE_BEFORE_START_MINUTES * 60 * 1000,
    );
    if (now < availableFrom || now > event.endsAt) {
      throw new BadRequestException('QR tokens are only available around the event window');
    }

    return {
      token: makeQrToken(this.qrSecret(), eventId, windowIndex(now)),
      expiresInSeconds: secondsUntilRotation(now),
    };
  }

  async create(
    eventId: string,
    userId: string,
    input: CreateCheckInRequest,
  ): Promise<CheckInResponse> {
    const event = await this.prisma.gameEvent.findUnique({
      where: { id: eventId },
      include: {
        participants: { where: { userId }, select: { id: true } },
      },
    });
    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not found');
    }

    const now = new Date();
    if (now < event.startsAt || now > event.endsAt) {
      throw new BadRequestException('Check-in is outside the event window');
    }

    if (event.participants.length === 0) {
      throw new ForbiddenException('Join the event before checking in');
    }

    if (input.method === 'qr') {
      if (!input.qrToken) {
        throw new BadRequestException('qrToken is required for QR check-ins');
      }
      if (!verifyQrToken(this.qrSecret(), eventId, input.qrToken, now)) {
        throw new BadRequestException('Invalid or expired QR token');
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const checkInsToday = await this.prisma.checkIn.count({
      where: {
        userId,
        checkedInAt: { gte: todayStart },
        status: { in: ['confirmed', 'pending'] },
      },
    });
    if (checkInsToday >= MAX_CHECK_INS_PER_DAY) {
      throw new BadRequestException('Daily check-in limit reached');
    }

    const recentCheckIn = await this.prisma.checkIn.findFirst({
      where: {
        userId,
        checkedInAt: {
          gte: new Date(now.getTime() - CHECK_IN_COOLDOWN_MINUTES * 60 * 1000),
        },
      },
      orderBy: { checkedInAt: 'desc' },
    });
    if (recentCheckIn) {
      throw new BadRequestException('Check-in cooldown active');
    }

    const distanceM = await this.distanceToEvent(eventId, input.lat, input.lng);

    let fraudScore = 0;
    if (distanceM > MAX_DISTANCE_METERS) {
      fraudScore += 50;
    } else if (distanceM > MAX_DISTANCE_METERS / 2) {
      fraudScore += 20;
    }

    if (input.accuracy !== undefined && input.accuracy > 100) {
      fraudScore += 15;
    }
    if (input.method === 'manual') {
      fraudScore += 25;
    }

    const openReports = await this.prisma.report.count({
      where: {
        targetType: 'user',
        targetId: userId,
        status: 'open',
      },
    });
    fraudScore += openReports * 10;

    // GPS check-ins must dwell: they stay pending until the user confirms
    // presence after DWELL_MINUTES inside the geofence. QR proves physical
    // presence via the rotating token and confirms immediately.
    const requiresDwell = input.method === 'gps';
    const resolved = this.resolveStatus(fraudScore);
    const status: CheckInStatus =
      requiresDwell && resolved === 'confirmed' ? 'pending' : resolved;

    const checkIn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.checkIn.create({
        data: {
          eventId,
          userId,
          lat: input.lat,
          lng: input.lng,
          accuracy: input.accuracy ?? null,
          method: input.method,
          fraudScore,
          status,
        },
      });

      if (status === 'confirmed') {
        await this.pointsService.award({
          userId,
          amount: POINTS_CHECK_IN,
          reason: 'check_in',
          referenceType: 'check_in',
          referenceId: created.id,
          tx,
        });
        await this.streaksService.recordWeeklyActivity(userId, tx, now);
      }

      return created;
    });

    let dwellConfirmAfter: string | null = null;
    if (requiresDwell && status === 'pending') {
      const record: DwellRecord = {
        checkInId: checkIn.id,
        firstAt: now.toISOString(),
        lat: input.lat,
        lng: input.lng,
      };
      await this.redis.client.set(
        this.dwellKey(eventId, userId),
        JSON.stringify(record),
        'EX',
        DWELL_TTL_SECONDS,
      );
      dwellConfirmAfter = new Date(now.getTime() + DWELL_MINUTES * 60 * 1000).toISOString();
    }

    if (status === 'confirmed') {
      void this.notifyCheckInConfirmed(userId, eventId, POINTS_CHECK_IN);
    }

    return {
      id: checkIn.id,
      eventId: checkIn.eventId,
      status: checkIn.status,
      fraudScore: checkIn.fraudScore,
      pointsAwarded: status === 'confirmed' ? POINTS_CHECK_IN : null,
      checkedInAt: checkIn.checkedInAt.toISOString(),
      dwellConfirmAfter,
    };
  }

  /** Second GPS ping after DWELL_MINUTES inside the geofence → confirm + points. */
  async confirmDwell(
    eventId: string,
    userId: string,
    input: ConfirmDwellRequest,
  ): Promise<CheckInResponse> {
    const key = this.dwellKey(eventId, userId);
    const raw = await this.redis.client.get(key);
    if (!raw) {
      throw new BadRequestException('No pending dwell check-in for this event');
    }
    const record = JSON.parse(raw) as DwellRecord;

    const checkIn = await this.prisma.checkIn.findUnique({ where: { id: record.checkInId } });
    if (!checkIn || checkIn.status !== 'pending') {
      await this.redis.client.del(key);
      throw new BadRequestException('Check-in is not pending confirmation');
    }

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(record.firstAt).getTime();
    if (elapsedMs < DWELL_MINUTES * 60 * 1000) {
      throw new BadRequestException(
        `Dwell time not reached yet — confirm after ${DWELL_MINUTES} minutes`,
      );
    }

    const distanceM = await this.distanceToEvent(eventId, input.lat, input.lng);
    if (distanceM > DWELL_MAX_DISTANCE_M) {
      throw new BadRequestException('Confirmation ping is outside the event geofence');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.checkIn.update({
        where: { id: checkIn.id },
        data: { status: 'confirmed' },
      });

      await this.pointsService.award({
        userId,
        amount: POINTS_CHECK_IN,
        reason: 'check_in',
        referenceType: 'check_in',
        referenceId: confirmed.id,
        tx,
      });
      await this.streaksService.recordWeeklyActivity(userId, tx, now);

      return confirmed;
    });

    await this.redis.client.del(key);

    void this.notifyCheckInConfirmed(userId, eventId, POINTS_CHECK_IN);

    return {
      id: updated.id,
      eventId: updated.eventId,
      status: updated.status,
      fraudScore: updated.fraudScore,
      pointsAwarded: POINTS_CHECK_IN,
      checkedInAt: updated.checkedInAt.toISOString(),
      dwellConfirmAfter: null,
    };
  }

  private async notifyCheckInConfirmed(
    userId: string,
    eventId: string,
    points: number,
  ): Promise<void> {
    const [user, event] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      }),
      this.prisma.gameEvent.findUnique({
        where: { id: eventId },
        select: { title: true },
      }),
    ]);
    if (!user || !event) {
      return;
    }
    await this.notifications.notifyCheckInConfirmed({
      telegramId: user.telegramId.toString(),
      eventTitle: event.title,
      points,
      eventId,
    });
  }

  private async distanceToEvent(eventId: string, lat: number, lng: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ distance_m: number }[]>`
      SELECT ST_Distance(
        geo_point,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_m
      FROM game_events
      WHERE id = ${eventId}
    `;
    return rows[0]?.distance_m ?? Number.POSITIVE_INFINITY;
  }

  private qrSecret(): string {
    return (
      this.configService.get('CHECKIN_QR_SECRET', { infer: true }) ??
      this.configService.get('JWT_SECRET', { infer: true })
    );
  }

  private dwellKey(eventId: string, userId: string): string {
    return `dwell:${eventId}:${userId}`;
  }

  private resolveStatus(fraudScore: number): CheckInStatus {
    if (fraudScore >= FRAUD_REJECT_THRESHOLD) {
      return 'rejected';
    }
    if (fraudScore >= FRAUD_PENDING_THRESHOLD) {
      return 'pending';
    }
    return 'confirmed';
  }
}
