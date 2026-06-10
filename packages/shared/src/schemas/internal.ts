import { z } from 'zod';

/** chatId is a string because Telegram group ids exceed safe-integer range semantics in JSON. */
export const linkSquadChatRequestSchema = z.object({
  inviteCode: z.string().min(6).max(12),
  chatId: z.string().regex(/^-?\d+$/),
  chatTitle: z.string().max(255).optional(),
});

export const linkSquadChatResponseSchema = z.object({
  squadId: z.string(),
  name: z.string(),
  memberCount: z.number().int(),
});

export type LinkSquadChatRequest = z.infer<typeof linkSquadChatRequestSchema>;
export type LinkSquadChatResponse = z.infer<typeof linkSquadChatResponseSchema>;
