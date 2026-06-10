import { z } from 'zod';

import { CHECK_IN_METHODS, CHECK_IN_STATUSES } from '../types/enums.js';
import { latSchema, lngSchema } from './common.js';

export const createCheckInRequestSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  accuracy: z.number().min(0).max(10_000).optional(),
  method: z.enum(CHECK_IN_METHODS).default('gps'),
  /** Required when method === 'qr': rotating token scanned from the host screen/stand. */
  qrToken: z.string().min(4).max(16).optional(),
});

export const confirmDwellRequestSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  accuracy: z.number().min(0).max(10_000).optional(),
});

export const checkInResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  status: z.enum(CHECK_IN_STATUSES),
  fraudScore: z.number().int(),
  pointsAwarded: z.number().int().nullable(),
  checkedInAt: z.string().datetime(),
  /** Set for GPS check-ins: confirm endpoint becomes available after this moment. */
  dwellConfirmAfter: z.string().datetime().nullable(),
});

export const qrTokenResponseSchema = z.object({
  token: z.string(),
  expiresInSeconds: z.number().int(),
});

export type CreateCheckInRequest = z.infer<typeof createCheckInRequestSchema>;
export type ConfirmDwellRequest = z.infer<typeof confirmDwellRequestSchema>;
export type CheckInResponse = z.infer<typeof checkInResponseSchema>;
export type QrTokenResponse = z.infer<typeof qrTokenResponseSchema>;
