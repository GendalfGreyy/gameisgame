import { z } from 'zod';

/** Max entities per scene — keeps TG Mini App JSON + runtime bounded. */
export const STUDIO_MAX_ENTITIES = 64;
export const STUDIO_MAX_TITLE_LENGTH = 48;
export const STUDIO_SCENE_VERSION = 1 as const;

export const studioEntityKindSchema = z.enum(['rect', 'circle']);
export const studioBehaviorSchema = z.enum([
  'player',
  'solid',
  'collectible',
  'hazard',
  'goal',
  'spawn',
]);

export const studioEntitySchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(32),
  kind: studioEntityKindSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().positive().max(2000),
  h: z.number().positive().max(2000),
  rotation: z.number().finite().default(0),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#3DDC97'),
  behaviors: z.array(studioBehaviorSchema).max(6).default([]),
});

export const studioWorldSchema = z.object({
  width: z.number().int().min(320).max(2000).default(720),
  height: z.number().int().min(240).max(2000).default(480),
  gravity: z.number().min(0).max(2).default(0.55),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#0B1F2A'),
});

export const studioSceneSchema = z.object({
  version: z.literal(STUDIO_SCENE_VERSION),
  world: studioWorldSchema,
  entities: z.array(studioEntitySchema).max(STUDIO_MAX_ENTITIES),
});

export const studioProjectStatusSchema = z.enum(['draft', 'published', 'archived']);

export const studioTemplateIdSchema = z.enum(['empty', 'platformer', 'collector']);

export const createStudioProjectRequestSchema = z.object({
  title: z.string().min(2).max(STUDIO_MAX_TITLE_LENGTH),
  description: z.string().max(280).optional(),
  template: studioTemplateIdSchema.default('platformer'),
});

export const updateStudioProjectRequestSchema = z.object({
  title: z.string().min(2).max(STUDIO_MAX_TITLE_LENGTH).optional(),
  description: z.string().max(280).nullable().optional(),
  scene: studioSceneSchema.optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const studioProjectSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: studioProjectStatusSchema,
  accentColor: z.string(),
  playCount: z.number().int(),
  entityCount: z.number().int(),
  publishedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const studioProjectOwnerSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  firstName: z.string(),
});

export const studioProjectDetailSchema = studioProjectSummarySchema.extend({
  scene: studioSceneSchema,
  owner: studioProjectOwnerSchema,
  isOwner: z.boolean(),
});

export const studioProjectListResponseSchema = z.object({
  items: z.array(studioProjectSummarySchema),
});

export const publishStudioProjectResponseSchema = z.object({
  id: z.string(),
  status: z.literal('published'),
  publishedAt: z.string().datetime(),
  shareStartParam: z.string(),
  shareUrl: z.string().url(),
});

export type StudioEntityKind = z.infer<typeof studioEntityKindSchema>;
export type StudioBehavior = z.infer<typeof studioBehaviorSchema>;
export type StudioEntity = z.infer<typeof studioEntitySchema>;
export type StudioWorld = z.infer<typeof studioWorldSchema>;
export type StudioScene = z.infer<typeof studioSceneSchema>;
export type StudioProjectStatus = z.infer<typeof studioProjectStatusSchema>;
export type StudioTemplateId = z.infer<typeof studioTemplateIdSchema>;
export type CreateStudioProjectRequest = z.infer<typeof createStudioProjectRequestSchema>;
export type UpdateStudioProjectRequest = z.infer<typeof updateStudioProjectRequestSchema>;
export type StudioProjectSummary = z.infer<typeof studioProjectSummarySchema>;
export type StudioProjectDetail = z.infer<typeof studioProjectDetailSchema>;
export type StudioProjectListResponse = z.infer<typeof studioProjectListResponseSchema>;
export type PublishStudioProjectResponse = z.infer<typeof publishStudioProjectResponseSchema>;
