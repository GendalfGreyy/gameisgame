import { z } from 'zod';

/**
 * ProjectDocument v2 (G2): every component, app widget, graph node and variable has a
 * typed shape. Objects are `.strict()` so a valid document survives
 * serialize → deserialize → serialize unchanged and unknown fields are rejected, not dropped.
 * Referential integrity (parents, cycles, IDs, graph refs) lives in `integrity.ts`.
 */
export const PROJECT_SCHEMA_VERSION = 2 as const;

export const ID_MAX = 64;
export const NAME_MAX = 120;
export const TEXT_MAX = 2000;

export const idSchema = z
  .string()
  .min(1)
  .max(ID_MAX)
  .regex(/^[A-Za-z0-9_-]+$/, 'ID: латиница, цифры, «_» и «-»');

const nameSchema = z.string().trim().min(1).max(NAME_MAX);
const finite = z.number().finite();
const unit = finite.min(0).max(1);
const nonNegative = finite.min(0);
const positive = finite.positive();
const int = z.number().int();

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Цвет в формате #RRGGBB');
export const vec2Schema = z.tuple([finite, finite]);
export const vec3Schema = z.tuple([finite, finite, finite]);
export type Vec2 = z.infer<typeof vec2Schema>;
export type Vec3 = z.infer<typeof vec3Schema>;

export const projectTypeSchema = z.enum(['game3d', 'game2d', 'app']);
export type ProjectType = z.infer<typeof projectTypeSchema>;

/** JSON values allowed inside free-form graph node data. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(TEXT_MAX),
    finite,
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(256),
    z.record(jsonValueSchema),
  ]),
);

// ---------- Scene components ----------

export const transformDataSchema = z
  .object({ position: vec3Schema, rotationEuler: vec3Schema, scale: vec3Schema })
  .strict();

export const MESH_PRIMITIVES = ['box', 'sphere', 'plane', 'cylinder', 'capsule', 'cone'] as const;
export const meshDataSchema = z
  .object({
    primitive: z.enum(MESH_PRIMITIVES),
    /** AssetRef of kind `model`; when set it replaces the primitive. */
    assetId: idSchema.nullable(),
  })
  .strict();

export const materialDataSchema = z
  .object({
    baseColor: hexColorSchema,
    roughness: unit,
    metalness: unit,
    emissive: hexColorSchema,
    opacity: unit,
  })
  .strict();

export const cameraDataSchema = z
  .discriminatedUnion('projection', [
    z
      .object({
        projection: z.literal('perspective'),
        fov: finite.min(1).max(179),
        nearClip: positive,
        farClip: positive,
      })
      .strict(),
    z
      .object({
        projection: z.literal('orthographic'),
        orthoHeight: positive,
        nearClip: positive,
        farClip: positive,
      })
      .strict(),
  ])
  .refine((camera) => camera.farClip > camera.nearClip, {
    message: 'farClip должен быть больше nearClip',
    path: ['farClip'],
  });

export const lightDataSchema = z
  .object({
    kind: z.enum(['directional', 'point', 'spot']),
    color: hexColorSchema,
    intensity: nonNegative.max(100),
    range: positive,
    castShadows: z.boolean(),
  })
  .strict();

export const rigidBody3dDataSchema = z
  .object({
    bodyType: z.enum(['dynamic', 'kinematic', 'static']),
    mass: positive,
    linearDamping: nonNegative,
    angularDamping: nonNegative,
    gravityScale: finite,
  })
  .strict();

export const collider3dDataSchema = z
  .object({
    shape: z.enum(['box', 'sphere', 'capsule']),
    size: vec3Schema,
    isTrigger: z.boolean(),
  })
  .strict();

export const spriteDataSchema = z
  .object({
    /** AssetRef of kind `image`; `null` draws a flat `color` rectangle. */
    assetId: idSchema.nullable(),
    color: hexColorSchema,
    layer: int.min(-100).max(100),
    sortOrder: int,
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .strict();

export const collider2dDataSchema = z
  .object({
    shape: z.enum(['box', 'circle']),
    size: vec2Schema,
    isStatic: z.boolean(),
    isTrigger: z.boolean(),
  })
  .strict();

export const audioDataSchema = z
  .object({
    assetId: idSchema.nullable(),
    volume: unit,
    loop: z.boolean(),
    autoplay: z.boolean(),
    spatial: z.boolean(),
  })
  .strict();

export const playerControllerDataSchema = z
  .object({
    mode: z.enum(['firstPerson', 'thirdPerson', 'platformer2d']),
    moveSpeed: positive,
    jumpHeight: nonNegative,
  })
  .strict();

export const scriptGraphDataSchema = z.object({ graphId: idSchema }).strict();

function component<T extends string, D extends z.ZodTypeAny>(type: T, data: D) {
  return z.object({ id: idSchema, type: z.literal(type), enabled: z.boolean(), data }).strict();
}

export const componentRecordSchema = z.discriminatedUnion('type', [
  component('transform', transformDataSchema),
  component('mesh', meshDataSchema),
  component('material', materialDataSchema),
  component('camera', cameraDataSchema),
  component('light', lightDataSchema),
  component('rigidBody3d', rigidBody3dDataSchema),
  component('collider3d', collider3dDataSchema),
  component('sprite', spriteDataSchema),
  component('collider2d', collider2dDataSchema),
  component('audio', audioDataSchema),
  component('playerController', playerControllerDataSchema),
  component('scriptGraph', scriptGraphDataSchema),
]);
export type ComponentRecord = z.infer<typeof componentRecordSchema>;
export type ComponentType = ComponentRecord['type'];
export type ComponentData<T extends ComponentType> = Extract<ComponentRecord, { type: T }>['data'];

export const COMPONENT_TYPES = [
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
] as const satisfies readonly ComponentType[];
export const componentTypeSchema = z.enum(COMPONENT_TYPES);

/** Defaults for "add component" and for filling fields missing in older documents. */
export const COMPONENT_DEFAULTS: { [T in ComponentType]: ComponentData<T> } = {
  transform: { position: [0, 0, 0], rotationEuler: [0, 0, 0], scale: [1, 1, 1] },
  mesh: { primitive: 'box', assetId: null },
  material: {
    baseColor: '#D9D6CC',
    roughness: 0.7,
    metalness: 0,
    emissive: '#000000',
    opacity: 1,
  },
  camera: { projection: 'perspective', fov: 60, nearClip: 0.1, farClip: 1000 },
  light: { kind: 'directional', color: '#FFFFFF', intensity: 1, range: 10, castShadows: true },
  rigidBody3d: {
    bodyType: 'dynamic',
    mass: 1,
    linearDamping: 0,
    angularDamping: 0.05,
    gravityScale: 1,
  },
  collider3d: { shape: 'box', size: [1, 1, 1], isTrigger: false },
  sprite: { assetId: null, color: '#D9D6CC', layer: 0, sortOrder: 0, flipX: false, flipY: false },
  collider2d: { shape: 'box', size: [1, 1], isStatic: false, isTrigger: false },
  audio: { assetId: null, volume: 1, loop: false, autoplay: false, spatial: false },
  playerController: { mode: 'thirdPerson', moveSpeed: 5, jumpHeight: 1.2 },
  scriptGraph: { graphId: 'graph_main' },
};

/** Components that may appear at most once per entity. */
export const SINGLETON_COMPONENTS: ReadonlySet<ComponentType> = new Set(COMPONENT_TYPES);

export const sceneEntitySchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    parentId: idSchema.nullable(),
    childIds: z.array(idSchema),
    enabled: z.boolean(),
    components: z.array(componentRecordSchema).max(32),
  })
  .strict();
export type SceneEntity = z.infer<typeof sceneEntitySchema>;

export const ENTITIES_PER_SCENE_MAX = 5000;

export const sceneSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    rootEntityIds: z.array(idSchema),
    entities: z
      .record(idSchema, sceneEntitySchema)
      .refine((entities) => Object.keys(entities).length <= ENTITIES_PER_SCENE_MAX, {
        message: `Не больше ${ENTITIES_PER_SCENE_MAX} объектов в сцене`,
      }),
  })
  .strict();
export type Scene = z.infer<typeof sceneSchema>;

// ---------- App pages (allowlisted widgets, no user JSX) ----------

export const appActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('navigate'), pageId: idSchema }).strict(),
]);
export type AppAction = z.infer<typeof appActionSchema>;

function widget<T extends string, P extends z.ZodTypeAny>(type: T, props: P) {
  return z
    .object({ id: idSchema, type: z.literal(type), props, childIds: z.array(idSchema) })
    .strict();
}

export const appComponentSchema = z.discriminatedUnion('type', [
  widget(
    'container',
    z
      .object({
        direction: z.enum(['column', 'row']),
        gap: int.min(0).max(64),
        padding: int.min(0).max(64),
      })
      .strict(),
  ),
  widget(
    'text',
    z
      .object({
        text: z.string().max(TEXT_MAX),
        variant: z.enum(['title', 'subtitle', 'body', 'caption']),
      })
      .strict(),
  ),
  widget(
    'button',
    z
      .object({
        label: z.string().min(1).max(NAME_MAX),
        variant: z.enum(['primary', 'secondary']),
        action: appActionSchema,
      })
      .strict(),
  ),
  widget(
    'image',
    z
      .object({
        assetId: idSchema.nullable(),
        alt: z.string().max(NAME_MAX),
        fit: z.enum(['cover', 'contain']),
      })
      .strict(),
  ),
  widget(
    'input',
    z
      .object({
        label: z.string().max(NAME_MAX),
        placeholder: z.string().max(NAME_MAX),
        fieldKey: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
      })
      .strict(),
  ),
]);
export type AppComponent = z.infer<typeof appComponentSchema>;
export type AppComponentType = AppComponent['type'];
export const CONTAINER_WIDGETS: ReadonlySet<AppComponentType> = new Set(['container']);

export const appPageSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    route: z
      .string()
      .max(NAME_MAX)
      .regex(/^\/[a-z0-9\-/]*$/, 'Маршрут вида /catalog/item'),
    rootComponentId: idSchema,
    components: z.record(idSchema, appComponentSchema),
  })
  .strict();
export type AppPage = z.infer<typeof appPageSchema>;

// ---------- Logic graphs (node registry arrives in G7) ----------

export const logicNodeSchema = z
  .object({
    id: idSchema,
    /** Registry key, e.g. `event.onStart`; checked against the node registry in G7. */
    type: z.string().regex(/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/, 'Тип узла вида group.name'),
    position: z.object({ x: finite, y: finite }).strict(),
    data: z.record(jsonValueSchema),
  })
  .strict();
export type LogicNode = z.infer<typeof logicNodeSchema>;

const portSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,31}$/);

export const logicEdgeSchema = z
  .object({
    id: idSchema,
    sourceNodeId: idSchema,
    sourcePort: portSchema,
    targetNodeId: idSchema,
    targetPort: portSchema,
  })
  .strict();
export type LogicEdge = z.infer<typeof logicEdgeSchema>;

export const logicGraphSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    nodes: z.array(logicNodeSchema).max(1000),
    edges: z.array(logicEdgeSchema).max(4000),
  })
  .strict();
export type LogicGraph = z.infer<typeof logicGraphSchema>;

// ---------- Assets & variables ----------

export const assetKindSchema = z.enum(['model', 'image', 'audio', 'font']);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const assetRefSchema = z
  .object({ id: idSchema, version: z.string().min(1).max(ID_MAX), kind: assetKindSchema })
  .strict();
export type AssetRef = z.infer<typeof assetRefSchema>;

export const typedValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('string'), value: z.string().max(TEXT_MAX) }).strict(),
  z.object({ type: z.literal('number'), value: finite }).strict(),
  z.object({ type: z.literal('boolean'), value: z.boolean() }).strict(),
  z.object({ type: z.literal('vec2'), value: vec2Schema }).strict(),
  z.object({ type: z.literal('vec3'), value: vec3Schema }).strict(),
]);
export type TypedValue = z.infer<typeof typedValueSchema>;

export const variableNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, 'Имя переменной: латиница, цифры и «_»');

export const projectSettingsSchema = z
  .object({
    orientation: z.enum(['auto', 'portrait', 'landscape']),
    quality: z.enum(['auto', 'low', 'medium', 'high']),
  })
  .strict();
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const projectDocumentSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    id: z.string().min(1).max(ID_MAX),
    ownerId: z.string().min(1).max(ID_MAX),
    title: z.string().trim().min(1).max(NAME_MAX),
    type: projectTypeSchema,
    settings: projectSettingsSchema,
    entrySceneId: idSchema.nullable(),
    scenes: z.array(sceneSchema).max(50),
    pages: z.array(appPageSchema).max(50),
    graphs: z.array(logicGraphSchema).max(200),
    assetRefs: z.array(assetRefSchema).max(2000),
    globalVariables: z.record(variableNameSchema, typedValueSchema),
  })
  .strict();

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
