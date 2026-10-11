import { z } from 'zod';

/**
 * REST contracts for creator-api (docs/04). Both the API and the Studio parse
 * through these schemas, so a shape change here is a contract change.
 */

export const themePreferenceSchema = z.enum(['telegram', 'system', 'dark', 'light']);
export type ThemePreferenceDto = z.infer<typeof themePreferenceSchema>;

export const densitySchema = z.enum(['comfortable', 'compact']);
export type DensityDto = z.infer<typeof densitySchema>;

export const userPreferencesSchema = z.object({
  theme: themePreferenceSchema,
  density: densitySchema,
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'telegram',
  density: 'comfortable',
};

export const updatePreferencesRequestSchema = userPreferencesSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Нет изменений' });
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;

export const userProfileSchema = z.object({
  id: z.string().min(1),
  /** Telegram ids exceed 2^53 in theory, so they travel as strings. */
  telegramId: z.string().regex(/^\d+$/),
  firstName: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  languageCode: z.string().nullable(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const quotaSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export const meResponseSchema = z.object({
  user: userProfileSchema,
  preferences: userPreferencesSchema,
  quotas: z.object({ projects: quotaSchema }),
  session: z.object({ expiresAt: z.string().datetime() }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const telegramAuthRequestSchema = z.object({
  initData: z.string().min(1).max(4096),
});
export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;

/** Development-only login; the API refuses it outside NODE_ENV=development. */
export const devAuthRequestSchema = z.object({
  telegramId: z
    .string()
    .regex(/^\d{1,15}$/)
    .default('100000001'),
  firstName: z.string().min(1).max(64).default('Dev'),
  username: z.string().min(1).max(32).nullable().default('dev_user'),
});
export type DevAuthRequest = z.input<typeof devAuthRequestSchema>;

export const authResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
  user: userProfileSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const projectTypeDtoSchema = z.enum(['game3d', 'game2d', 'app']);
export type ProjectTypeDto = z.infer<typeof projectTypeDtoSchema>;

export const projectTemplateIdSchema = z.enum(['empty', 'starter']);
export type ProjectTemplateId = z.infer<typeof projectTemplateIdSchema>;

export const orientationSchema = z.enum(['auto', 'portrait', 'landscape']);
export type Orientation = z.infer<typeof orientationSchema>;

export const PROJECT_TITLE_MAX = 120;

export const projectTitleSchema = z
  .string()
  .trim()
  .min(1, 'Введите название')
  .max(PROJECT_TITLE_MAX, `Не длиннее ${PROJECT_TITLE_MAX} символов`);

export const createProjectRequestSchema = z.object({
  title: projectTitleSchema,
  type: projectTypeDtoSchema,
  templateId: projectTemplateIdSchema.default('starter'),
  orientation: orientationSchema.default('auto'),
});
export type CreateProjectRequest = z.input<typeof createProjectRequestSchema>;

export const projectStatusSchema = z.enum(['draft', 'archived']);

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  type: projectTypeDtoSchema,
  status: projectStatusSchema,
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  lastEditedAt: z.string().datetime(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const listProjectsQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  type: projectTypeDtoSchema.optional(),
  q: z.string().trim().max(PROJECT_TITLE_MAX).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListProjectsQuery = z.input<typeof listProjectsQuerySchema>;

export const listProjectsResponseSchema = z.object({
  items: z.array(projectSummarySchema),
  nextCursor: z.string().nullable(),
});
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

export const createProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  revision: z.number().int().positive(),
  project: projectSummarySchema,
});
export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;

export const projectDetailSchema = projectSummarySchema;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/** `document` is a ProjectDocument; callers validate it with @tg-creator/project-schema. */
export const projectDraftResponseSchema = z.object({
  projectId: z.string().min(1),
  revision: z.number().int().positive(),
  document: z.unknown(),
});
export type ProjectDraftResponse = z.infer<typeof projectDraftResponseSchema>;
