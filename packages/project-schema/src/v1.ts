import { z } from 'zod';

/**
 * Frozen ProjectDocument v1 (G0–G1). Only `migrate.ts` reads it; never extend this file —
 * new fields go into the latest version plus a migration step.
 */
export const PROJECT_SCHEMA_VERSION_V1 = 1 as const;

export const projectTypeV1Schema = z.enum(['game3d', 'game2d', 'app']);
export type ProjectTypeV1 = z.infer<typeof projectTypeV1Schema>;

export const componentTypeV1Schema = z.enum([
  'transform',
  'mesh',
  'material',
  'camera',
  'light',
  'rigidBody3d',
  'collider3d',
  'sprite',
  'collider2d',
  'audio',
  'playerController',
  'scriptGraph',
]);
export type ComponentTypeV1 = z.infer<typeof componentTypeV1Schema>;

export const vec3V1Schema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

export const componentRecordV1Schema = z.object({
  id: z.string().min(1),
  type: componentTypeV1Schema,
  enabled: z.boolean(),
  data: z.record(z.unknown()),
});
export type ComponentRecordV1 = z.infer<typeof componentRecordV1Schema>;

export const sceneEntityV1Schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  childIds: z.array(z.string().min(1)),
  enabled: z.boolean(),
  components: z.array(componentRecordV1Schema),
});
export type SceneEntityV1 = z.infer<typeof sceneEntityV1Schema>;

export const sceneV1Schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rootEntityIds: z.array(z.string().min(1)),
  entities: z.record(sceneEntityV1Schema),
});
export type SceneV1 = z.infer<typeof sceneV1Schema>;

export const appComponentV1Schema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.unknown()).default({}),
  childIds: z.array(z.string().min(1)).default([]),
});
export type AppComponentV1 = z.infer<typeof appComponentV1Schema>;

export const appPageV1Schema = z.object({
  id: z.string().min(1),
  route: z.string().min(1),
  rootComponentId: z.string().min(1),
  components: z.record(appComponentV1Schema),
});
export type AppPageV1 = z.infer<typeof appPageV1Schema>;

export const logicNodeV1Schema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.unknown()).default({}),
});
export type LogicNodeV1 = z.infer<typeof logicNodeV1Schema>;

export const logicEdgeV1Schema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  sourcePort: z.string().min(1),
  targetNodeId: z.string().min(1),
  targetPort: z.string().min(1),
});
export type LogicEdgeV1 = z.infer<typeof logicEdgeV1Schema>;

export const logicGraphV1Schema = z.object({
  id: z.string().min(1),
  nodes: z.array(logicNodeV1Schema),
  edges: z.array(logicEdgeV1Schema),
});
export type LogicGraphV1 = z.infer<typeof logicGraphV1Schema>;

export const assetRefV1Schema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  kind: z.enum(['model', 'image', 'audio', 'font']),
});
export type AssetRefV1 = z.infer<typeof assetRefV1Schema>;

export const typedValueV1Schema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'vec2', 'vec3']),
  value: z.unknown(),
});
export type TypedValueV1 = z.infer<typeof typedValueV1Schema>;

export const projectSettingsV1Schema = z.object({
  orientation: z.enum(['auto', 'portrait', 'landscape']),
  quality: z.enum(['auto', 'low', 'medium', 'high']),
});

export const projectDocumentV1Schema = z.object({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION_V1),
  id: z.string().min(1),
  ownerId: z.string().min(1),
  title: z.string().min(1).max(120),
  type: projectTypeV1Schema,
  settings: projectSettingsV1Schema,
  entrySceneId: z.string().min(1).optional(),
  scenes: z.array(sceneV1Schema),
  pages: z.array(appPageV1Schema),
  graphs: z.array(logicGraphV1Schema),
  assetRefs: z.array(assetRefV1Schema),
  globalVariables: z.record(typedValueV1Schema),
});

export type ProjectDocumentV1 = z.infer<typeof projectDocumentV1Schema>;
