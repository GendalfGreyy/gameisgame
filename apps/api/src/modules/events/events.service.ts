import type {
  CloneEventRequest,
  CreateEventRequest,
  EventDetail,
  EventSummary,
  NearbyEventsRequest,
  StartingSoonRequest,
  UpdateEventRequest,
} from '@game-is-game/shared';
import { EVENT_TEMPLATES, POINTS_EVENT_HOST } from '@game-is-game/shared';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EventStatus, GameEvent, User } from '@game-is-game/db';

import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PointsService } from '../points/points.service.js';

type NearbyRow = {
  id: string;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  starts_at: Date;
  ends_at: Date;
  status: EventStatus;
  hot_score: number;
  boost_score: number;
  participant_count: bigint;
  friends_going: bigint;
  distance_m: number;
  host_id: string;
  host_first_name: string;
  host_username: string | null;
  host_photo_url: string | null;
};

const FALLBACK_LIMIT = 10;

@Injectable()
export class EventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PointsService) private readonly pointsService: PointsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  getTemplates() {
    return { items: EVENT_TEMPLATES };
  }

  async create(hostId: string, input: CreateEventRequest): Promise<EventDetail> {
    this.assertValidWindow(input.startsAt, input.endsAt);

    const event = await this.prisma.gameEvent.create({
      data: {
        hostId,
        title: input.title,
        description: input.description ?? null,
        venueId: input.venueId ?? null,
        communityId: input.communityId ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        maxParticipants: input.maxParticipants ?? null,
        status: 'published',
      },
      include: {
        host: true,
        _count: { select: { participants: true } },
      },
    });

    await this.setGeoPoint(event.id, input.lat, input.lng);

    await this.pointsService.award({
      userId: hostId,
      amount: POINTS_EVENT_HOST,
      reason: 'event_host',
      referenceType: 'event',
      referenceId: event.id,
    });

    return this.toEventDetail(event, input.lat, input.lng, false);
  }

  async clone(eventId: string, actorId: string, input: CloneEventRequest): Promise<EventDetail> {
    this.assertValidWindow(input.startsAt, input.endsAt);

    const source = await this.prisma.gameEvent.findUnique({ where: { id: eventId } });
    if (!source) {
      throw new NotFoundException('Event not found');
    }
    if (source.hostId !== actorId) {
      throw new ForbiddenException('Only the host can clone this event');
    }

    const location = await this.getGeoPoint(eventId);

    const clone = await this.prisma.gameEvent.create({
      data: {
        hostId: actorId,
        title: source.title,
        description: source.description,
        venueId: source.venueId,
        communityId: source.communityId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        maxParticipants: source.maxParticipants,
        status: 'published',
      },
      include: {
        host: true,
        _count: { select: { participants: true } },
      },
    });

    await this.setGeoPoint(clone.id, location.lat, location.lng);
    return this.toEventDetail(clone, location.lat, location.lng, false);
  }

  async findById(eventId: string, viewerId: string): Promise<EventDetail> {
    const event = await this.prisma.gameEvent.findUnique({
      where: { id: eventId },
      include: {
        host: true,
        participants: { where: { userId: viewerId }, select: { id: true } },
        _count: { select: { participants: true } },
      },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const location = await this.getGeoPoint(event.id);
    return this.toEventDetail(
      event,
      location.lat,
      location.lng,
      event.participants.length > 0,
    );
  }

  async update(eventId: string, actorId: string, input: UpdateEventRequest): Promise<EventDetail> {
    const existing = await this.prisma.gameEvent.findUnique({ where: { id: eventId } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    if (existing.hostId !== actorId) {
      throw new ForbiddenException('Only the host can update this event');
    }

    if (input.startsAt && input.endsAt) {
      this.assertValidWindow(input.startsAt, input.endsAt);
    }

    await this.prisma.gameEvent.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.venueId !== undefined ? { venueId: input.venueId } : {}),
        ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
        ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
        ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
        ...(input.maxParticipants !== undefined
          ? { maxParticipants: input.maxParticipants }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    if (input.lat !== undefined && input.lng !== undefined) {
      await this.setGeoPoint(eventId, input.lat, input.lng);
    }

    return this.findById(eventId, actorId);
  }

  async findNearby(
    input: NearbyEventsRequest,
    viewerId: string,
  ): Promise<{
    items: EventSummary[];
    page: number;
    limit: number;
    total: number;
    fallback: boolean;
  }> {
    const offset = (input.page - 1) * input.limit;

    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        e.id,
        e.title,
        e.description,
        ST_Y(e.geo_point::geometry) AS lat,
        ST_X(e.geo_point::geometry) AS lng,
        e.starts_at,
        e.ends_at,
        e.status::text AS status,
        e.hot_score,
        e.boost_score,
        COUNT(ep.id) AS participant_count,
        (
          SELECT COUNT(*)
          FROM event_participants ep2
          INNER JOIN friendships f
            ON f.status = 'accepted'
            AND (
              (f.requester_id = ${viewerId} AND f.addressee_id = ep2.user_id)
              OR (f.addressee_id = ${viewerId} AND f.requester_id = ep2.user_id)
            )
          WHERE ep2.event_id = e.id
        ) AS friends_going,
        ST_Distance(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        ) AS distance_m,
        u.id AS host_id,
        u.first_name AS host_first_name,
        u.username AS host_username,
        u.photo_url AS host_photo_url
      FROM game_events e
      INNER JOIN users u ON u.id = e.host_id
      LEFT JOIN event_participants ep ON ep.event_id = e.id
      WHERE e.status = 'published'
        AND e.ends_at > NOW()
        AND e.geo_point IS NOT NULL
        AND ST_DWithin(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          ${input.radiusM}
        )
      GROUP BY e.id, u.id
      ORDER BY (
        e.boost_score * 0.35
        + e.hot_score * 0.25
        + (
          SELECT COUNT(*)
          FROM event_participants ep3
          INNER JOIN friendships f2
            ON f2.status = 'accepted'
            AND (
              (f2.requester_id = ${viewerId} AND f2.addressee_id = ep3.user_id)
              OR (f2.addressee_id = ${viewerId} AND f2.requester_id = ep3.user_id)
            )
          WHERE ep3.event_id = e.id
        ) * 0.5
        - ST_Distance(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        ) * 0.0001
      ) DESC
      LIMIT ${input.limit}
      OFFSET ${offset}
    `;

    const countRows = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM game_events e
      WHERE e.status = 'published'
        AND e.ends_at > NOW()
        AND e.geo_point IS NOT NULL
        AND ST_DWithin(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          ${input.radiusM}
        )
    `;

    const total = Number(countRows[0]?.total ?? 0n);

    if (total === 0) {
      // Empty-map graceful state: never return a bare empty map —
      // surface the next events by start time regardless of distance.
      const fallbackItems = await this.findUpcomingAnywhere(input.lat, input.lng, viewerId);
      return {
        items: fallbackItems,
        page: 1,
        limit: input.limit,
        total: 0,
        fallback: true,
      };
    }

    const items = rows.map((row) => this.toEventSummary(row));
    return { items, page: input.page, limit: input.limit, total, fallback: false };
  }

  async findStartingSoon(
    input: StartingSoonRequest,
    viewerId: string,
  ): Promise<{ items: EventSummary[] }> {
    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        e.id,
        e.title,
        e.description,
        ST_Y(e.geo_point::geometry) AS lat,
        ST_X(e.geo_point::geometry) AS lng,
        e.starts_at,
        e.ends_at,
        e.status::text AS status,
        e.hot_score,
        e.boost_score,
        COUNT(ep.id) AS participant_count,
        (
          SELECT COUNT(*)
          FROM event_participants ep2
          INNER JOIN friendships f
            ON f.status = 'accepted'
            AND (
              (f.requester_id = ${viewerId} AND f.addressee_id = ep2.user_id)
              OR (f.addressee_id = ${viewerId} AND f.requester_id = ep2.user_id)
            )
          WHERE ep2.event_id = e.id
        ) AS friends_going,
        ST_Distance(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        ) AS distance_m,
        u.id AS host_id,
        u.first_name AS host_first_name,
        u.username AS host_username,
        u.photo_url AS host_photo_url
      FROM game_events e
      INNER JOIN users u ON u.id = e.host_id
      LEFT JOIN event_participants ep ON ep.event_id = e.id
      WHERE e.status = 'published'
        AND e.geo_point IS NOT NULL
        AND e.starts_at > NOW()
        AND e.starts_at <= NOW() + make_interval(mins => ${input.withinMinutes})
        AND ST_DWithin(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          ${input.radiusM}
        )
      GROUP BY e.id, u.id
      ORDER BY e.starts_at ASC
      LIMIT ${input.limit}
    `;

    return { items: rows.map((row) => this.toEventSummary(row)) };
  }

  async join(eventId: string, userId: string) {
    const event = await this.prisma.gameEvent.findUnique({
      where: { id: eventId },
      include: { _count: { select: { participants: true } } },
    });
    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not found');
    }
    if (event.maxParticipants && event._count.participants >= event.maxParticipants) {
      throw new BadRequestException('Event is full');
    }

    const participant = await this.prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });

    void this.notifications.notifyFriendsOfJoin(eventId, userId);

    return {
      eventId: participant.eventId,
      joinedAt: participant.joinedAt.toISOString(),
    };
  }

  private async findUpcomingAnywhere(
    lat: number,
    lng: number,
    viewerId: string,
  ): Promise<EventSummary[]> {
    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        e.id,
        e.title,
        e.description,
        ST_Y(e.geo_point::geometry) AS lat,
        ST_X(e.geo_point::geometry) AS lng,
        e.starts_at,
        e.ends_at,
        e.status::text AS status,
        e.hot_score,
        e.boost_score,
        COUNT(ep.id) AS participant_count,
        (
          SELECT COUNT(*)
          FROM event_participants ep2
          INNER JOIN friendships f
            ON f.status = 'accepted'
            AND (
              (f.requester_id = ${viewerId} AND f.addressee_id = ep2.user_id)
              OR (f.addressee_id = ${viewerId} AND f.requester_id = ep2.user_id)
            )
          WHERE ep2.event_id = e.id
        ) AS friends_going,
        ST_Distance(
          e.geo_point,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS distance_m,
        u.id AS host_id,
        u.first_name AS host_first_name,
        u.username AS host_username,
        u.photo_url AS host_photo_url
      FROM game_events e
      INNER JOIN users u ON u.id = e.host_id
      LEFT JOIN event_participants ep ON ep.event_id = e.id
      WHERE e.status = 'published'
        AND e.geo_point IS NOT NULL
        AND e.starts_at > NOW()
      GROUP BY e.id, u.id
      ORDER BY e.starts_at ASC
      LIMIT ${FALLBACK_LIMIT}
    `;

    return rows.map((row) => this.toEventSummary(row));
  }

  private assertValidWindow(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private async setGeoPoint(eventId: string, lat: number, lng: number) {
    await this.prisma.$executeRaw`
      UPDATE game_events
      SET geo_point = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      WHERE id = ${eventId}
    `;
  }

  private async getGeoPoint(id: string) {
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT
        ST_Y(geo_point::geometry) AS lat,
        ST_X(geo_point::geometry) AS lng
      FROM game_events
      WHERE id = ${id}
    `;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Event location not found');
    }
    return row;
  }

  private toEventSummary(row: NearbyRow): EventSummary {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      location: { lat: row.lat, lng: row.lng },
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      status: row.status,
      participantCount: Number(row.participant_count),
      hotScore: row.hot_score,
      boostScore: row.boost_score,
      distanceM: row.distance_m,
      friendsGoing: Number(row.friends_going),
      host: {
        id: row.host_id,
        firstName: row.host_first_name,
        username: row.host_username,
        photoUrl: row.host_photo_url,
      },
    };
  }

  private toEventDetail(
    event: GameEvent & {
      host: User;
      _count: { participants: number };
    },
    lat: number,
    lng: number,
    isParticipant: boolean,
  ): EventDetail {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: { lat, lng },
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      status: event.status,
      participantCount: event._count.participants,
      hotScore: event.hotScore,
      boostScore: event.boostScore,
      venueId: event.venueId,
      communityId: event.communityId,
      maxParticipants: event.maxParticipants,
      isParticipant,
      host: {
        id: event.host.id,
        firstName: event.host.firstName,
        username: event.host.username,
        photoUrl: event.host.photoUrl,
      },
    };
  }
}
