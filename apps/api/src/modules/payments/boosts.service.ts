import type { BoostPlan, CreateBoostRequest, BoostResponse, BoostStatusResponse } from '@game-is-game/shared';
import {
  BOOST_SCORE_BY_PLAN,
  BOOST_STARS_PRICES,
  BOOST_PLAN_DURATIONS_MS,
} from '@game-is-game/shared';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type TelegramInvoiceResponse = {
  ok: boolean;
  result?: string;
  description?: string;
};

@Injectable()
export class BoostsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
  ) {}

  assertEnabled(): void {
    if (!this.configService.get('FEATURE_BOOSTS_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException('Boosts are not enabled');
    }
  }

  async createBoost(
    eventId: string,
    userId: string,
    input: CreateBoostRequest,
  ): Promise<BoostResponse> {
    this.assertEnabled();

    const event = await this.prisma.gameEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not found');
    }
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only the host can boost this event');
    }

    const starsAmount = BOOST_STARS_PRICES[input.plan];
    const boost = await this.prisma.boost.create({
      data: {
        eventId,
        userId,
        plan: input.plan,
        status: 'pending',
        starsAmount,
      },
    });

    const invoiceLink = await this.createInvoiceLink({
      boostId: boost.id,
      plan: input.plan,
      starsAmount,
      eventTitle: event.title,
    });

    return {
      boostId: boost.id,
      plan: input.plan,
      starsAmount,
      invoiceLink,
      expiresAt: null,
    };
  }

  async getPendingBoost(boostId: string): Promise<BoostStatusResponse> {
    const boost = await this.prisma.boost.findUnique({ where: { id: boostId } });
    if (!boost) {
      throw new NotFoundException('Boost not found');
    }
    return this.toStatus(boost);
  }

  async confirmPayment(input: {
    boostId: string;
    telegramPaymentChargeId: string;
    totalAmount: number;
  }): Promise<BoostStatusResponse> {
    this.assertEnabled();

    const boost = await this.prisma.boost.findUnique({
      where: { id: input.boostId },
      include: { event: true },
    });
    if (!boost) {
      throw new NotFoundException('Boost not found');
    }
    if (boost.status !== 'pending') {
      throw new BadRequestException('Boost is not pending payment');
    }
    if (input.totalAmount !== boost.starsAmount) {
      throw new BadRequestException('Payment amount mismatch');
    }

    const existing = await this.prisma.boost.findUnique({
      where: { telegramPaymentChargeId: input.telegramPaymentChargeId },
    });
    if (existing && existing.id !== boost.id) {
      return this.toStatus(existing);
    }

    const now = new Date();
    const durationMs = BOOST_PLAN_DURATIONS_MS[boost.plan as BoostPlan];
    const expiresAt = new Date(now.getTime() + durationMs);
    const scoreBump = BOOST_SCORE_BY_PLAN[boost.plan as BoostPlan];

    const updated = await this.prisma.$transaction(async (tx) => {
      const activated = await tx.boost.update({
        where: { id: boost.id },
        data: {
          status: 'active',
          telegramPaymentChargeId: input.telegramPaymentChargeId,
          activatedAt: now,
          expiresAt,
        },
      });

      await tx.gameEvent.update({
        where: { id: boost.eventId },
        data: { boostScore: { increment: scoreBump } },
      });

      return activated;
    });

    return this.toStatus(updated);
  }

  private async createInvoiceLink(params: {
    boostId: string;
    plan: BoostPlan;
    starsAmount: number;
    eventTitle: string;
  }): Promise<string> {
    const token = this.configService.get('TELEGRAM_BOT_TOKEN', { infer: true });
    const planLabel =
      params.plan === 'spotlight_1h'
        ? 'Spotlight 1h'
        : params.plan === 'spotlight_24h'
          ? 'Spotlight 24h'
          : 'Super Boost';

    const response = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Boost: ${params.eventTitle}`,
        description: `${planLabel} — поднять событие в выдаче`,
        payload: params.boostId,
        currency: 'XTR',
        prices: [{ label: planLabel, amount: params.starsAmount }],
      }),
    });

    const data = (await response.json()) as TelegramInvoiceResponse;
    if (!data.ok || !data.result) {
      throw new ServiceUnavailableException(data.description ?? 'Failed to create invoice link');
    }
    return data.result;
  }

  private toStatus(boost: {
    id: string;
    eventId: string;
    plan: BoostPlan;
    status: string;
    starsAmount: number;
    activatedAt: Date | null;
    expiresAt: Date | null;
  }): BoostStatusResponse {
    return {
      id: boost.id,
      eventId: boost.eventId,
      plan: boost.plan,
      status: boost.status as BoostStatusResponse['status'],
      starsAmount: boost.starsAmount,
      activatedAt: boost.activatedAt?.toISOString() ?? null,
      expiresAt: boost.expiresAt?.toISOString() ?? null,
    };
  }
}
