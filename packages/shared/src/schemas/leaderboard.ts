import { z } from 'zod';

export const leaderboardEntrySchema = z.object({
  rank: z.number().int(),
  userId: z.string(),
  firstName: z.string(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  totalPoints: z.number().int(),
});

export const leaderboardResponseSchema = z.object({
  items: z.array(leaderboardEntrySchema),
  myRank: z.number().int().nullable(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
