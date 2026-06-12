import { z } from 'zod';

import { BOOST_PLANS } from '../types/enums.js';

export const createBoostRequestSchema = z.object({
  plan: z.enum(BOOST_PLANS),
});

export const boostResponseSchema = z.object({
  boostId: z.string(),
  plan: z.enum(BOOST_PLANS),
  starsAmount: z.number().int().positive(),
  invoiceLink: z.string().url(),
  expiresAt: z.string().datetime().nullable(),
});

export const confirmBoostPaymentSchema = z.object({
  boostId: z.string(),
  telegramPaymentChargeId: z.string().min(1),
  totalAmount: z.number().int().positive(),
});

export const boostStatusResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  plan: z.enum(BOOST_PLANS),
  status: z.enum(['pending', 'active', 'expired', 'cancelled']),
  starsAmount: z.number().int(),
  activatedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export type CreateBoostRequest = z.infer<typeof createBoostRequestSchema>;
export type BoostResponse = z.infer<typeof boostResponseSchema>;
export type ConfirmBoostPayment = z.infer<typeof confirmBoostPaymentSchema>;
export type BoostStatusResponse = z.infer<typeof boostStatusResponseSchema>;
