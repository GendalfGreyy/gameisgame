import type {
  CreateReportRequest,
  ReportsListResponse,
  ReviewReportRequest,
} from '@game-is-game/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(reporterId: string, input: CreateReportRequest) {
    if (input.targetType === 'user' && input.targetId === reporterId) {
      throw new BadRequestException('Cannot report yourself');
    }

    await this.assertTargetExists(input.targetType, input.targetId);

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'open',
      },
    });
    if (existing) {
      throw new ConflictException('You already have an open report for this target');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      },
    });

    return { id: report.id, status: report.status };
  }

  async listOpen(limit = 50): Promise<ReportsListResponse> {
    const reports = await this.prisma.report.findMany({
      where: { status: 'open' },
      include: {
        reporter: { select: { id: true, firstName: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return {
      items: reports.map((report) => ({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        reporter: report.reporter,
        createdAt: report.createdAt.toISOString(),
      })),
    };
  }

  async review(reportId: string, reviewerId: string, input: ReviewReportRequest) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (report.status !== 'open') {
      throw new BadRequestException('Report is not open');
    }

    if (input.status === 'actioned') {
      await this.applyModerationAction(report.targetType, report.targetId);
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: input.status,
        reviewedById: reviewerId,
      },
    });

    return { id: updated.id, status: updated.status };
  }

  private async assertTargetExists(
    targetType: CreateReportRequest['targetType'],
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case 'user': {
        const user = await this.prisma.user.findFirst({
          where: { id: targetId, deletedAt: null },
        });
        if (!user) {
          throw new NotFoundException('Report target not found');
        }
        break;
      }
      case 'event': {
        const event = await this.prisma.gameEvent.findUnique({ where: { id: targetId } });
        if (!event) {
          throw new NotFoundException('Report target not found');
        }
        break;
      }
      case 'check_in': {
        const checkIn = await this.prisma.checkIn.findUnique({ where: { id: targetId } });
        if (!checkIn) {
          throw new NotFoundException('Report target not found');
        }
        break;
      }
    }
  }

  private async applyModerationAction(
    targetType: CreateReportRequest['targetType'],
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case 'user':
        await this.prisma.user.update({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });
        break;
      case 'event':
        await this.prisma.gameEvent.update({
          where: { id: targetId },
          data: { status: 'cancelled' },
        });
        break;
      case 'check_in':
        await this.prisma.checkIn.update({
          where: { id: targetId },
          data: { status: 'rejected' },
        });
        break;
    }
  }
}
