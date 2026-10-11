import { parseProjectDocument } from './parse.js';
import { ProjectDocumentError } from './serialize.js';
import {
  COMPONENT_DEFAULTS,
  PROJECT_SCHEMA_VERSION,
  projectDocumentSchema,
  type AppComponent,
  type ComponentRecord,
  type ProjectDocument,
  type ProjectType,
  type SceneEntity,
} from './v2.js';

export const PROJECT_TEMPLATE_IDS = ['empty', 'starter'] as const;
export type ProjectTemplateId = (typeof PROJECT_TEMPLATE_IDS)[number];

export type ProjectOrientation = ProjectDocument['settings']['orientation'];

export type CreateProjectDocumentInput = {
  id: string;
  ownerId: string;
  title: string;
  type: ProjectType;
  templateId: ProjectTemplateId;
  orientation: ProjectOrientation;
};

const MAIN_SCENE_ID = 'scene_main';

function transform(
  id: string,
  position: [number, number, number],
  rotationEuler: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): ComponentRecord {
  return { id, type: 'transform', enabled: true, data: { position, rotationEuler, scale } };
}

function entity(id: string, name: string, components: ComponentRecord[]): SceneEntity {
  return { id, name, parentId: null, childIds: [], enabled: true, components };
}

function entitiesFor3d(templateId: ProjectTemplateId): SceneEntity[] {
  const base = [
    entity('entity_camera', 'Камера', [
      transform('cmp_transform_camera', [5, 4, 6], [-20, 35, 0]),
      {
        id: 'cmp_camera',
        type: 'camera',
        enabled: true,
        data: COMPONENT_DEFAULTS.camera,
      },
    ]),
    entity('entity_light', 'Свет', [
      transform('cmp_transform_light', [0, 10, 0], [-50, 30, 0]),
      {
        id: 'cmp_light',
        type: 'light',
        enabled: true,
        data: COMPONENT_DEFAULTS.light,
      },
    ]),
  ];
  if (templateId === 'empty') {
    return base;
  }
  return [
    ...base,
    entity('entity_ground', 'Земля', [
      transform('cmp_transform_ground', [0, 0, 0], [0, 0, 0], [10, 1, 10]),
      {
        id: 'cmp_mesh_ground',
        type: 'mesh',
        enabled: true,
        data: { primitive: 'plane', assetId: null },
      },
      {
        id: 'cmp_material_ground',
        type: 'material',
        enabled: true,
        data: { ...COMPONENT_DEFAULTS.material, baseColor: '#3B3A33', roughness: 0.9 },
      },
    ]),
    entity('entity_cube', 'Куб', [
      transform('cmp_transform_cube', [0, 1, 0]),
      { id: 'cmp_mesh_cube', type: 'mesh', enabled: true, data: COMPONENT_DEFAULTS.mesh },
      {
        id: 'cmp_material_cube',
        type: 'material',
        enabled: true,
        data: { ...COMPONENT_DEFAULTS.material, baseColor: '#D4F24A' },
      },
    ]),
  ];
}

function entitiesFor2d(templateId: ProjectTemplateId): SceneEntity[] {
  const base = [
    entity('entity_camera', 'Камера', [
      transform('cmp_transform_camera', [0, 0, 10]),
      {
        id: 'cmp_camera',
        type: 'camera',
        enabled: true,
        data: { projection: 'orthographic', orthoHeight: 10, nearClip: 0.1, farClip: 1000 },
      },
    ]),
  ];
  if (templateId === 'empty') {
    return base;
  }
  return [
    ...base,
    entity('entity_ground', 'Платформа', [
      transform('cmp_transform_ground', [0, -4, 0], [0, 0, 0], [16, 1, 1]),
      {
        id: 'cmp_sprite_ground',
        type: 'sprite',
        enabled: true,
        data: { ...COMPONENT_DEFAULTS.sprite, color: '#3B3A33' },
      },
      {
        id: 'cmp_collider_ground',
        type: 'collider2d',
        enabled: true,
        data: { ...COMPONENT_DEFAULTS.collider2d, isStatic: true },
      },
    ]),
    entity('entity_player', 'Игрок', [
      transform('cmp_transform_player', [0, 0, 0]),
      {
        id: 'cmp_sprite_player',
        type: 'sprite',
        enabled: true,
        data: { ...COMPONENT_DEFAULTS.sprite, color: '#D4F24A', sortOrder: 1 },
      },
      {
        id: 'cmp_collider_player',
        type: 'collider2d',
        enabled: true,
        data: COMPONENT_DEFAULTS.collider2d,
      },
    ]),
  ];
}

function appComponents(templateId: ProjectTemplateId, title: string): AppComponent[] {
  const childIds = templateId === 'empty' ? [] : ['cmp_title', 'cmp_text', 'cmp_button'];
  const root: AppComponent = {
    id: 'cmp_root',
    type: 'container',
    props: { direction: 'column', gap: 12, padding: 16 },
    childIds,
  };
  if (templateId === 'empty') {
    return [root];
  }
  return [
    root,
    { id: 'cmp_title', type: 'text', props: { text: title, variant: 'title' }, childIds: [] },
    {
      id: 'cmp_text',
      type: 'text',
      props: { text: 'Опишите, что умеет ваше приложение.', variant: 'body' },
      childIds: [],
    },
    {
      id: 'cmp_button',
      type: 'button',
      props: { label: 'Начать', variant: 'primary', action: { kind: 'none' } },
      childIds: [],
    },
  ];
}

function checked(input: unknown): ProjectDocument {
  const parsed = parseProjectDocument(projectDocumentSchema.parse(input));
  if (!parsed.ok) {
    throw new ProjectDocumentError(parsed);
  }
  return parsed.document;
}

/** Builds the initial draft for the project wizard (docs/02 S03). */
export function createProjectDocument(input: CreateProjectDocumentInput): ProjectDocument {
  const base = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: input.id,
    ownerId: input.ownerId,
    title: input.title,
    type: input.type,
    settings: { orientation: input.orientation, quality: 'auto' as const },
    graphs: [],
    assetRefs: [],
    globalVariables: {},
  };

  if (input.type === 'app') {
    const components = appComponents(input.templateId, input.title);
    return checked({
      ...base,
      entrySceneId: null,
      scenes: [],
      pages: [
        {
          id: 'page_home',
          name: 'Главная',
          route: '/',
          rootComponentId: 'cmp_root',
          components: Object.fromEntries(components.map((component) => [component.id, component])),
        },
      ],
    });
  }

  const entities =
    input.type === 'game3d' ? entitiesFor3d(input.templateId) : entitiesFor2d(input.templateId);
  return checked({
    ...base,
    entrySceneId: MAIN_SCENE_ID,
    scenes: [
      {
        id: MAIN_SCENE_ID,
        name: 'Основная сцена',
        rootEntityIds: entities.map((item) => item.id),
        entities: Object.fromEntries(entities.map((item) => [item.id, item])),
      },
    ],
    pages: [],
  });
}

/** Deep copy for "Дублировать": new identity and title, same content. */
export function cloneProjectDocument(
  source: ProjectDocument,
  overrides: { id: string; ownerId: string; title: string },
): ProjectDocument {
  const copy: unknown = JSON.parse(JSON.stringify(source));
  return checked({
    ...(typeof copy === 'object' && copy !== null ? copy : {}),
    ...overrides,
  });
}
