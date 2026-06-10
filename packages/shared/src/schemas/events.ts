import { z } from 'zod';

import { DEFAULT_NEARBY_RADIUS_M, MAX_NEARBY_RADIUS_M } from '../constants/geo.js';
import { EVENT_STATUSES } from '../types/enums.js';
import { geoPointSchema, latSchema, lngSchema } from './common.js';

export const createEventRequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  lat: latSchema,
  lng: lngSchema,
  venueId: z.string().optional(),
  communityId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  maxParticipants: z.number().int().min(2).max(10_000).optional(),
});

export const updateEventRequestSchema = createEventRequestSchema
  .partial()
  .extend({
    status: z.enum(EVENT_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const nearbyEventsRequestSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  radiusM: z.coerce
    .number()
    .int()
    .min(100)
    .max(MAX_NEARBY_RADIUS_M)
    .default(DEFAULT_NEARBY_RADIUS_M),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const startingSoonRequestSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  radiusM: z.coerce
    .number()
    .int()
    .min(100)
    .max(MAX_NEARBY_RADIUS_M)
    .default(DEFAULT_NEARBY_RADIUS_M),
  withinMinutes: z.coerce.number().int().min(15).max(240).default(90),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const cloneEventRequestSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const eventHostSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export const eventSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: geoPointSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(EVENT_STATUSES),
  participantCount: z.number().int(),
  hotScore: z.number(),
  boostScore: z.number(),
  distanceM: z.number().optional(),
  /** Accepted friends of the viewer who joined this event. */
  friendsGoing: z.number().int().optional(),
  host: eventHostSchema,
});

export const eventDetailSchema = eventSummarySchema.extend({
  venueId: z.string().nullable(),
  communityId: z.string().nullable(),
  maxParticipants: z.number().int().nullable(),
  isParticipant: z.boolean(),
});

export const nearbyEventsResponseSchema = z.object({
  items: z.array(eventSummarySchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  /**
   * Empty-map graceful state: when nothing matches the radius, items contains
   * upcoming events ordered by start time regardless of distance and fallback=true.
   */
  fallback: z.boolean().default(false),
});

export const startingSoonResponseSchema = z.object({
  items: z.array(eventSummarySchema),
});

export const joinEventResponseSchema = z.object({
  eventId: z.string(),
  joinedAt: z.string().datetime(),
});

export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;
export type NearbyEventsRequest = z.infer<typeof nearbyEventsRequestSchema>;
export type StartingSoonRequest = z.infer<typeof startingSoonRequestSchema>;
export type CloneEventRequest = z.infer<typeof cloneEventRequestSchema>;
export type StartingSoonResponse = z.infer<typeof startingSoonResponseSchema>;
export type EventSummary = z.infer<typeof eventSummarySchema>;
export type EventDetail = z.infer<typeof eventDetailSchema>;
export type NearbyEventsResponse = z.infer<typeof nearbyEventsResponseSchema>;
