import { z } from 'zod';

import { PRIVACY_MODES, USER_ROLES } from '../types/enums.js';

export const telegramAuthRequestSchema = z.object({
  initData: z.string().min(1),
});

export const userProfileSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  username: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  role: z.enum(USER_ROLES),
  privacyMode: z.enum(PRIVACY_MODES),
  totalPoints: z.number().int(),
  streakDays: z.number().int(),
});

export const telegramAuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
  user: userProfileSchema,
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const refreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;
export type TelegramAuthResponse = z.infer<typeof telegramAuthResponseSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
