import { z } from 'zod';

import { eventHostSchema } from './events.js';

export const sendFriendRequestSchema = z.object({
  userId: z.string().min(1),
});

export const friendSummarySchema = eventHostSchema.extend({
  totalPoints: z.number().int(),
});

export const friendRequestSummarySchema = z.object({
  id: z.string(),
  requester: eventHostSchema,
  createdAt: z.string().datetime(),
});

export const friendsListResponseSchema = z.object({
  items: z.array(friendSummarySchema),
});

export const friendRequestsResponseSchema = z.object({
  items: z.array(friendRequestSummarySchema),
});

export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>;
export type FriendSummary = z.infer<typeof friendSummarySchema>;
export type FriendRequestSummary = z.infer<typeof friendRequestSummarySchema>;
export type FriendsListResponse = z.infer<typeof friendsListResponseSchema>;
export type FriendRequestsResponse = z.infer<typeof friendRequestsResponseSchema>;
