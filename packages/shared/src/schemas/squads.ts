import { z } from 'zod';

import { eventHostSchema } from './events.js';

export const SQUAD_MIN_MEMBERS = 3;
export const SQUAD_MAX_MEMBERS = 8;

export const createSquadRequestSchema = z.object({
  name: z.string().min(3).max(32),
});

export const joinSquadRequestSchema = z.object({
  inviteCode: z.string().min(6).max(12),
});

export const squadMemberSchema = eventHostSchema.extend({
  totalPoints: z.number().int(),
  joinedAt: z.string().datetime(),
});

export const squadDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  ownerId: z.string(),
  memberCount: z.number().int(),
  totalPoints: z.number().int(),
  weeklyPoints: z.number().int(),
  members: z.array(squadMemberSchema),
});

export const squadLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  squadId: z.string(),
  name: z.string(),
  memberCount: z.number().int(),
  weeklyPoints: z.number().int(),
});

export const squadLeaderboardResponseSchema = z.object({
  items: z.array(squadLeaderboardEntrySchema),
  mySquadRank: z.number().int().nullable(),
});

export type CreateSquadRequest = z.infer<typeof createSquadRequestSchema>;
export type JoinSquadRequest = z.infer<typeof joinSquadRequestSchema>;
export type SquadDetail = z.infer<typeof squadDetailSchema>;
export type SquadLeaderboardResponse = z.infer<typeof squadLeaderboardResponseSchema>;
