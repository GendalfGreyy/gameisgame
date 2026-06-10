import {
  BoostPlan,
  BoostStatus,
  CheckInMethod,
  CheckInStatus,
  CommunityMemberRole,
  EventStatus,
  FriendshipStatus,
  PointsReason,
  PrismaClient,
  UserRole,
} from '../generated/client/index.js';

const prisma = new PrismaClient();

const USERS = [
  {
    id: 'seed_user_alex',
    telegramId: 100_001n,
    username: 'alex_dev',
    firstName: 'Alex',
    lastName: 'Dev',
    role: UserRole.admin,
  },
  {
    id: 'seed_user_maria',
    telegramId: 100_002n,
    username: 'maria_plays',
    firstName: 'Maria',
    lastName: 'Ivanova',
    role: UserRole.user,
  },
  {
    id: 'seed_user_ivan',
    telegramId: 100_003n,
    username: 'ivan_go',
    firstName: 'Ivan',
    lastName: 'Petrov',
    role: UserRole.user,
  },
  {
    id: 'seed_user_nina',
    telegramId: 100_004n,
    username: 'nina_map',
    firstName: 'Nina',
    lastName: 'Sokolova',
    role: UserRole.user,
  },
  {
    id: 'seed_user_oleg',
    telegramId: 100_005n,
    username: 'oleg_host',
    firstName: 'Oleg',
    lastName: 'Kuznetsov',
    role: UserRole.user,
  },
] as const;

const COMMUNITIES = [
  {
    id: 'seed_community_runners',
    name: 'City Runners',
    slug: 'city-runners',
    description: 'Morning runs and weekend races.',
    ownerId: 'seed_user_alex',
  },
  {
    id: 'seed_community_boardgames',
    name: 'Board Game Night',
    slug: 'board-game-night',
    description: 'Casual tabletop meetups.',
    ownerId: 'seed_user_oleg',
  },
] as const;

const VENUES = [
  {
    id: 'seed_venue_park',
    name: 'Central Park Lawn',
    address: 'Central Park, NYC',
    lat: 40.7829,
    lng: -73.9654,
    createdById: 'seed_user_alex',
  },
  {
    id: 'seed_venue_cafe',
    name: 'Corner Cafe',
    address: '14 W 4th St, NYC',
    lat: 40.7282,
    lng: -73.9942,
    createdById: 'seed_user_maria',
  },
  {
    id: 'seed_venue_rooftop',
    name: 'Rooftop Bar',
    address: '230 5th Ave, NYC',
    lat: 40.7443,
    lng: -73.9882,
    createdById: 'seed_user_oleg',
  },
] as const;

const EVENTS = [
  {
    id: 'seed_event_01',
    title: 'Sunrise 5K',
    hostId: 'seed_user_alex',
    venueId: 'seed_venue_park',
    communityId: 'seed_community_runners',
    lat: 40.7829,
    lng: -73.9654,
    offsetHours: 2,
    durationHours: 2,
    status: EventStatus.published,
    hotScore: 12,
  },
  {
    id: 'seed_event_02',
    title: 'Catan Championship',
    hostId: 'seed_user_oleg',
    venueId: 'seed_venue_cafe',
    communityId: 'seed_community_boardgames',
    lat: 40.7282,
    lng: -73.9942,
    offsetHours: 6,
    durationHours: 4,
    status: EventStatus.published,
    hotScore: 8,
  },
  {
    id: 'seed_event_03',
    title: 'Rooftop Sunset Mixer',
    hostId: 'seed_user_maria',
    venueId: 'seed_venue_rooftop',
    communityId: null,
    lat: 40.7443,
    lng: -73.9882,
    offsetHours: 10,
    durationHours: 3,
    status: EventStatus.published,
    hotScore: 20,
  },
  {
    id: 'seed_event_04',
    title: 'Park Yoga',
    hostId: 'seed_user_nina',
    venueId: 'seed_venue_park',
    communityId: 'seed_community_runners',
    lat: 40.781,
    lng: -73.966,
    offsetHours: 24,
    durationHours: 1,
    status: EventStatus.published,
    hotScore: 5,
  },
  {
    id: 'seed_event_05',
    title: 'Speed Chess Blitz',
    hostId: 'seed_user_ivan',
    venueId: 'seed_venue_cafe',
    communityId: 'seed_community_boardgames',
    lat: 40.7285,
    lng: -73.9945,
    offsetHours: 30,
    durationHours: 2,
    status: EventStatus.published,
    hotScore: 6,
  },
  {
    id: 'seed_event_06',
    title: 'Night Run Loop',
    hostId: 'seed_user_alex',
    venueId: 'seed_venue_park',
    communityId: 'seed_community_runners',
    lat: 40.7835,
    lng: -73.9648,
    offsetHours: 48,
    durationHours: 1,
    status: EventStatus.published,
    hotScore: 9,
  },
  {
    id: 'seed_event_07',
    title: 'Draft Board Games',
    hostId: 'seed_user_oleg',
    venueId: 'seed_venue_cafe',
    communityId: 'seed_community_boardgames',
    lat: 40.7278,
    lng: -73.995,
    offsetHours: 52,
    durationHours: 3,
    status: EventStatus.published,
    hotScore: 4,
  },
  {
    id: 'seed_event_08',
    title: 'DJ Rooftop Warmup',
    hostId: 'seed_user_maria',
    venueId: 'seed_venue_rooftop',
    communityId: null,
    lat: 40.744,
    lng: -73.9885,
    offsetHours: 72,
    durationHours: 4,
    status: EventStatus.published,
    hotScore: 15,
  },
  {
    id: 'seed_event_09',
    title: 'Community Picnic',
    hostId: 'seed_user_nina',
    venueId: 'seed_venue_park',
    communityId: 'seed_community_runners',
    lat: 40.782,
    lng: -73.967,
    offsetHours: 96,
    durationHours: 5,
    status: EventStatus.published,
    hotScore: 11,
  },
  {
    id: 'seed_event_10',
    title: 'Strategy Night',
    hostId: 'seed_user_ivan',
    venueId: 'seed_venue_cafe',
    communityId: 'seed_community_boardgames',
    lat: 40.728,
    lng: -73.994,
    offsetHours: 120,
    durationHours: 3,
    status: EventStatus.draft,
    hotScore: 0,
  },
] as const;

async function setGeoPoint(table: 'venues' | 'game_events', id: string, lat: number, lng: number) {
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET geo_point = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
    lng,
    lat,
    id,
  );
}

async function main() {
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { telegramId: user.telegramId },
      create: user,
      update: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        deletedAt: null,
      },
    });
  }

  for (const community of COMMUNITIES) {
    await prisma.community.upsert({
      where: { slug: community.slug },
      create: community,
      update: {
        name: community.name,
        description: community.description,
        ownerId: community.ownerId,
      },
    });
    await prisma.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: community.ownerId,
        },
      },
      create: {
        communityId: community.id,
        userId: community.ownerId,
        role: CommunityMemberRole.admin,
      },
      update: { role: CommunityMemberRole.admin },
    });
  }

  for (const venue of VENUES) {
    await prisma.venue.upsert({
      where: { id: venue.id },
      create: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        createdById: venue.createdById,
      },
      update: {
        name: venue.name,
        address: venue.address,
        createdById: venue.createdById,
      },
    });
    await setGeoPoint('venues', venue.id, venue.lat, venue.lng);
  }

  const now = Date.now();
  for (const event of EVENTS) {
    const startsAt = new Date(now + event.offsetHours * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + event.durationHours * 60 * 60 * 1000);
    await prisma.gameEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        title: event.title,
        hostId: event.hostId,
        venueId: event.venueId,
        communityId: event.communityId,
        startsAt,
        endsAt,
        status: event.status,
        hotScore: event.hotScore,
      },
      update: {
        title: event.title,
        hostId: event.hostId,
        venueId: event.venueId,
        communityId: event.communityId,
        startsAt,
        endsAt,
        status: event.status,
        hotScore: event.hotScore,
      },
    });
    await setGeoPoint('game_events', event.id, event.lat, event.lng);
  }

  const friendships = [
    ['seed_user_alex', 'seed_user_maria'],
    ['seed_user_alex', 'seed_user_ivan'],
    ['seed_user_maria', 'seed_user_nina'],
    ['seed_user_ivan', 'seed_user_oleg'],
  ] as const;

  for (const [requesterId, addresseeId] of friendships) {
    await prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
      create: { requesterId, addresseeId, status: FriendshipStatus.accepted },
      update: { status: FriendshipStatus.accepted },
    });
  }

  const participants = [
    ['seed_event_01', 'seed_user_maria'],
    ['seed_event_01', 'seed_user_ivan'],
    ['seed_event_02', 'seed_user_alex'],
    ['seed_event_02', 'seed_user_nina'],
    ['seed_event_03', 'seed_user_ivan'],
    ['seed_event_03', 'seed_user_oleg'],
    ['seed_event_04', 'seed_user_maria'],
    ['seed_event_05', 'seed_user_nina'],
    ['seed_event_06', 'seed_user_oleg'],
    ['seed_event_08', 'seed_user_alex'],
    ['seed_event_09', 'seed_user_ivan'],
  ] as const;

  for (const [eventId, userId] of participants) {
    await prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });
  }

  const checkIns = [
    {
      id: 'seed_checkin_01',
      eventId: 'seed_event_01',
      userId: 'seed_user_maria',
      lat: 40.7829,
      lng: -73.9654,
      fraudScore: 10,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_02',
      eventId: 'seed_event_01',
      userId: 'seed_user_ivan',
      lat: 40.783,
      lng: -73.9653,
      fraudScore: 15,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_03',
      eventId: 'seed_event_02',
      userId: 'seed_user_alex',
      lat: 40.7282,
      lng: -73.9942,
      fraudScore: 8,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_04',
      eventId: 'seed_event_02',
      userId: 'seed_user_nina',
      lat: 40.7283,
      lng: -73.9941,
      fraudScore: 12,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_05',
      eventId: 'seed_event_03',
      userId: 'seed_user_ivan',
      lat: 40.7443,
      lng: -73.9882,
      fraudScore: 5,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_06',
      eventId: 'seed_event_03',
      userId: 'seed_user_oleg',
      lat: 40.7444,
      lng: -73.9881,
      fraudScore: 7,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_07',
      eventId: 'seed_event_04',
      userId: 'seed_user_maria',
      lat: 40.781,
      lng: -73.966,
      fraudScore: 20,
      status: CheckInStatus.pending,
    },
    {
      id: 'seed_checkin_08',
      eventId: 'seed_event_05',
      userId: 'seed_user_nina',
      lat: 40.7285,
      lng: -73.9945,
      fraudScore: 55,
      status: CheckInStatus.pending,
    },
    {
      id: 'seed_checkin_09',
      eventId: 'seed_event_06',
      userId: 'seed_user_oleg',
      lat: 40.7835,
      lng: -73.9648,
      fraudScore: 75,
      status: CheckInStatus.rejected,
    },
    {
      id: 'seed_checkin_10',
      eventId: 'seed_event_08',
      userId: 'seed_user_alex',
      lat: 40.744,
      lng: -73.9885,
      fraudScore: 3,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_11',
      eventId: 'seed_event_09',
      userId: 'seed_user_ivan',
      lat: 40.782,
      lng: -73.967,
      fraudScore: 11,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_12',
      eventId: 'seed_event_01',
      userId: 'seed_user_nina',
      lat: 40.7828,
      lng: -73.9655,
      fraudScore: 18,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_13',
      eventId: 'seed_event_02',
      userId: 'seed_user_oleg',
      lat: 40.7281,
      lng: -73.9943,
      fraudScore: 9,
      status: CheckInStatus.confirmed,
    },
    {
      id: 'seed_checkin_14',
      eventId: 'seed_event_05',
      userId: 'seed_user_ivan',
      lat: 40.7286,
      lng: -73.9944,
      fraudScore: 42,
      status: CheckInStatus.pending,
    },
    {
      id: 'seed_checkin_15',
      eventId: 'seed_event_08',
      userId: 'seed_user_maria',
      lat: 40.7441,
      lng: -73.9884,
      fraudScore: 6,
      status: CheckInStatus.confirmed,
    },
  ] as const;

  for (const checkIn of checkIns) {
    await prisma.checkIn.upsert({
      where: { id: checkIn.id },
      create: { ...checkIn, method: CheckInMethod.gps },
      update: {
        lat: checkIn.lat,
        lng: checkIn.lng,
        fraudScore: checkIn.fraudScore,
        status: checkIn.status,
      },
    });
  }

  const pointsEntries = [
    { userId: 'seed_user_maria', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_01' },
    { userId: 'seed_user_ivan', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_02' },
    { userId: 'seed_user_alex', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_03' },
    { userId: 'seed_user_nina', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_04' },
    { userId: 'seed_user_ivan', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_05' },
    { userId: 'seed_user_oleg', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_06' },
    { userId: 'seed_user_alex', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_10' },
    { userId: 'seed_user_ivan', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_11' },
    { userId: 'seed_user_nina', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_12' },
    { userId: 'seed_user_oleg', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_13' },
    { userId: 'seed_user_maria', amount: 50, reason: PointsReason.check_in, ref: 'seed_checkin_15' },
    { userId: 'seed_user_alex', amount: 100, reason: PointsReason.event_host, ref: 'seed_event_01' },
    { userId: 'seed_user_oleg', amount: 100, reason: PointsReason.event_host, ref: 'seed_event_02' },
    { userId: 'seed_user_maria', amount: 100, reason: PointsReason.event_host, ref: 'seed_event_03' },
    { userId: 'seed_user_nina', amount: 100, reason: PointsReason.event_host, ref: 'seed_event_04' },
    { userId: 'seed_user_ivan', amount: 100, reason: PointsReason.event_host, ref: 'seed_event_05' },
    { userId: 'seed_user_alex', amount: 25, reason: PointsReason.streak_bonus, ref: null },
    { userId: 'seed_user_maria', amount: 25, reason: PointsReason.streak_bonus, ref: null },
    { userId: 'seed_user_ivan', amount: 25, reason: PointsReason.streak_bonus, ref: null },
    { userId: 'seed_user_nina', amount: 25, reason: PointsReason.streak_bonus, ref: null },
    { userId: 'seed_user_oleg', amount: 25, reason: PointsReason.streak_bonus, ref: null },
    { userId: 'seed_user_alex', amount: 75, reason: PointsReason.invite_friend, ref: 'seed_user_maria' },
    { userId: 'seed_user_maria', amount: 75, reason: PointsReason.invite_friend, ref: 'seed_user_nina' },
    { userId: 'seed_user_ivan', amount: 75, reason: PointsReason.invite_friend, ref: 'seed_user_oleg' },
    { userId: 'seed_user_alex', amount: 10, reason: PointsReason.admin_adjustment, ref: null },
    { userId: 'seed_user_maria', amount: 10, reason: PointsReason.admin_adjustment, ref: null },
    { userId: 'seed_user_ivan', amount: 10, reason: PointsReason.admin_adjustment, ref: null },
    { userId: 'seed_user_nina', amount: 10, reason: PointsReason.admin_adjustment, ref: null },
    { userId: 'seed_user_oleg', amount: 10, reason: PointsReason.admin_adjustment, ref: null },
    { userId: 'seed_user_alex', amount: 30, reason: PointsReason.boost_refund, ref: 'seed_boost_01' },
  ] as const;

  let ledgerIndex = 0;
  for (const entry of pointsEntries) {
    ledgerIndex += 1;
    const id = `seed_ledger_${String(ledgerIndex).padStart(2, '0')}`;
    await prisma.pointsLedger.upsert({
      where: { id },
      create: {
        id,
        userId: entry.userId,
        amount: entry.amount,
        reason: entry.reason,
        referenceType: entry.ref ? 'check_in' : null,
        referenceId: entry.ref,
      },
      update: {
        amount: entry.amount,
        reason: entry.reason,
        referenceType: entry.ref ? 'check_in' : null,
        referenceId: entry.ref,
      },
    });
  }

  const userTotals = await prisma.pointsLedger.groupBy({
    by: ['userId'],
    _sum: { amount: true },
  });

  for (const row of userTotals) {
    await prisma.user.update({
      where: { id: row.userId },
      data: { totalPoints: row._sum.amount ?? 0 },
    });
  }

  await prisma.boost.upsert({
    where: { id: 'seed_boost_01' },
    create: {
      id: 'seed_boost_01',
      eventId: 'seed_event_03',
      userId: 'seed_user_maria',
      plan: BoostPlan.spotlight_24h,
      status: BoostStatus.active,
      starsAmount: 100,
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {
      status: BoostStatus.active,
      starsAmount: 100,
    },
  });

  await prisma.gameEvent.update({
    where: { id: 'seed_event_03' },
    data: { boostScore: 50 },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
