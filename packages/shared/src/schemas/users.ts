import { z } from 'zod';

import { PRIVACY_MODES } from '../types/enums.js';
import { eventHostSchema } from './events.js';

export const updateUserSettingsSchema = z.object({
  privacyMode: z.enum(PRIVACY_MODES),
});

export const lookupUserQuerySchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .transform((value) => value.replace(/^@/, '').toLowerCase()),
});

export const userLookupSchema = eventHostSchema;

export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;
export type LookupUserQuery = z.infer<typeof lookupUserQuerySchema>;
export type UserLookup = z.infer<typeof userLookupSchema>;
