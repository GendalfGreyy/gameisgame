import { z } from 'zod';

export const inviteLinkResponseSchema = z.object({
  startParam: z.string(),
  miniAppUrl: z.string().url(),
  botUrl: z.string().url(),
});

export type InviteLinkResponse = z.infer<typeof inviteLinkResponseSchema>;
