import { z } from 'zod';

/** Current ProjectDocument schema version shipped in G0. */
export const PROJECT_SCHEMA_VERSION = 1 as const;

export const projectTypeSchema = z.enum(['game3d', 'game2d', 'app']);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const componentTypeSchema = z.enum([
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
export type ComponentType = z.infer<typeof componentTypeSchema>;

export const vec3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

export const componentRecordSchema = z.object({
  id: z.string().min(1),
  type: componentTypeSchema,
  enabled: z.boolean(),
  data: z.record(z.unknown()),
});
export type ComponentRecord = z.infer<typeof componentRecordSchema>;

export const sceneEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  childIds: z.array(z.string().min(1)),
  enabled: z.boolean(),
  components: z.array(componentRecordSchema),
});
export type SceneEntity = z.infer<typeof sceneEntitySchema>;

export const sceneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rootEntityIds: z.array(z.string().min(1)),
  entities: z.record(sceneEntitySchema),
});
export type Scene = z.infer<typeof sceneSchema>;

export const appComponentSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.unknown()).default({}),
  childIds: z.array(z.string().min(1)).default([]),
});
export type AppComponent = z.infer<typeof appComponentSchema>;

export const appPageSchema = z.object({
  id: z.string().min(1),
  route: z.string().min(1),
  rootComponentId: z.string().min(1),
  components: z.record(appComponentSchema),
});
export type AppPage = z.infer<typeof appPageSchema>;

export const logicNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.unknown()).default({}),
});
export type LogicNode = z.infer<typeof logicNodeSchema>;

export const logicEdgeSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  sourcePort: z.string().min(1),
  targetNodeId: z.string().min(1),
  targetPort: z.string().min(1),
});
export type LogicEdge = z.infer<typeof logicEdgeSchema>;

export const logicGraphSchema = z.object({
  id: z.string().min(1),
  nodes: z.array(logicNodeSchema),
  edges: z.array(logicEdgeSchema),
});
export type LogicGraph = z.infer<typeof logicGraphSchema>;

export const assetRefSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  kind: z.enum(['model', 'image', 'audio', 'font']),
});
export type AssetRef = z.infer<typeof assetRefSchema>;

export const typedValueSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'vec2', 'vec3']),
  value: z.unknown(),
});
export type TypedValue = z.infer<typeof typedValueSchema>;

export const projectSettingsSchema = z.object({
  orientation: z.enum(['auto', 'portrait', 'landscape']),
  quality: z.enum(['auto', 'low', 'medium', 'high']),
});

export const projectDocumentV1Schema = z.object({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  id: z.string().min(1),
  ownerId: z.string().min(1),
  title: z.string().min(1).max(120),
  type: projectTypeSchema,
  settings: projectSettingsSchema,
  entrySceneId: z.string().min(1).optional(),
  scenes: z.array(sceneSchema),
  pages: z.array(appPageSchema),
  graphs: z.array(logicGraphSchema),
  assetRefs: z.array(assetRefSchema),
  globalVariables: z.record(typedValueSchema),
});

export type ProjectDocumentV1 = z.infer<typeof projectDocumentV1Schema>;
export type ProjectDocument = ProjectDocumentV1;
