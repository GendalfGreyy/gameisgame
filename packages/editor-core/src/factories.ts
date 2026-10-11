import {
  COMPONENT_DEFAULTS,
  type ComponentData,
  type ComponentRecord,
  type ComponentType,
  type ProjectDocument,
  type ProjectType,
  type SceneEntity,
  type Vec3,
} from '@tg-creator/project-schema';

import type { EditorCommand } from './commands.js';
import type { IdGenerator } from './ids.js';
import { collectSubtree, findScene, getEntity, siblingIds } from './scene.js';

function componentRecord<T extends ComponentType>(
  ids: IdGenerator,
  type: T,
  data: ComponentData<T>,
): ComponentRecord {
  // The literal union is rebuilt from a generic pair; the result is re-validated by Zod in applyCommand.
  return { id: ids('cmp'), type, enabled: true, data } as ComponentRecord;
}

export type EntityPresetId =
  | 'empty'
  | 'box'
  | 'sphere'
  | 'plane'
  | 'cylinder'
  | 'pointLight'
  | 'directionalLight'
  | 'camera'
  | 'sprite';

export type EntityPreset = {
  id: EntityPresetId;
  label: string;
  projectTypes: readonly ProjectType[];
};

export const ENTITY_PRESETS: readonly EntityPreset[] = [
  { id: 'empty', label: 'Пустой объект', projectTypes: ['game3d', 'game2d'] },
  { id: 'box', label: 'Куб', projectTypes: ['game3d'] },
  { id: 'sphere', label: 'Сфера', projectTypes: ['game3d'] },
  { id: 'plane', label: 'Плоскость', projectTypes: ['game3d'] },
  { id: 'cylinder', label: 'Цилиндр', projectTypes: ['game3d'] },
  { id: 'pointLight', label: 'Точечный свет', projectTypes: ['game3d'] },
  { id: 'directionalLight', label: 'Направленный свет', projectTypes: ['game3d'] },
  { id: 'camera', label: 'Камера', projectTypes: ['game3d', 'game2d'] },
  { id: 'sprite', label: 'Спрайт', projectTypes: ['game2d'] },
];

export function presetsFor(projectType: ProjectType): EntityPreset[] {
  return ENTITY_PRESETS.filter((preset) => preset.projectTypes.includes(projectType));
}

function presetComponents(
  preset: EntityPresetId,
  projectType: ProjectType,
  ids: IdGenerator,
  position: Vec3,
): ComponentRecord[] {
  const transform = componentRecord(ids, 'transform', {
    ...COMPONENT_DEFAULTS.transform,
    position,
  });
  const mesh = (primitive: ComponentData<'mesh'>['primitive']) => [
    transform,
    componentRecord(ids, 'mesh', { primitive, assetId: null }),
    componentRecord(ids, 'material', COMPONENT_DEFAULTS.material),
  ];
  switch (preset) {
    case 'empty':
      return [transform];
    case 'box':
      return mesh('box');
    case 'sphere':
      return mesh('sphere');
    case 'plane':
      return mesh('plane');
    case 'cylinder':
      return mesh('cylinder');
    case 'pointLight':
      return [
        transform,
        componentRecord(ids, 'light', { ...COMPONENT_DEFAULTS.light, kind: 'point' }),
      ];
    case 'directionalLight':
      return [transform, componentRecord(ids, 'light', COMPONENT_DEFAULTS.light)];
    case 'camera':
      return [
        transform,
        componentRecord(
          ids,
          'camera',
          projectType === 'game2d'
            ? { projection: 'orthographic', orthoHeight: 10, nearClip: 0.1, farClip: 1000 }
            : COMPONENT_DEFAULTS.camera,
        ),
      ];
    case 'sprite':
      return [transform, componentRecord(ids, 'sprite', COMPONENT_DEFAULTS.sprite)];
  }
}

function presetLabel(preset: EntityPresetId): string {
  return ENTITY_PRESETS.find((item) => item.id === preset)?.label ?? 'Объект';
}

/** "Куб", "Куб 2", "Куб 3"… unique among siblings, like most engine outliners. */
export function uniqueSiblingName(
  document: ProjectDocument,
  sceneId: string,
  parentId: string | null,
  base: string,
): string {
  const scene = findScene(document, sceneId);
  if (!scene) {
    return base;
  }
  const taken = new Set(siblingIds(scene, parentId).map((id) => getEntity(scene, id)?.name ?? ''));
  if (!taken.has(base)) {
    return base;
  }
  let counter = 2;
  while (taken.has(`${base} ${counter}`)) {
    counter += 1;
  }
  return `${base} ${counter}`;
}

export type CreateEntityInput = {
  sceneId: string;
  preset: EntityPresetId;
  parentId?: string | null;
  /** Defaults to the end of the sibling list. */
  index?: number;
  position?: Vec3;
};

export function createEntityCommand(
  document: ProjectDocument,
  input: CreateEntityInput,
  ids: IdGenerator,
): Extract<EditorCommand, { type: 'entity.insert' }> {
  const parentId = input.parentId ?? null;
  const scene = findScene(document, input.sceneId);
  const siblings = scene ? siblingIds(scene, parentId) : [];
  const entity: SceneEntity = {
    id: ids('ent'),
    name: uniqueSiblingName(document, input.sceneId, parentId, presetLabel(input.preset)),
    parentId,
    childIds: [],
    enabled: true,
    components: presetComponents(
      input.preset,
      document.type,
      ids,
      input.position ??
        (document.type === 'game3d' && input.preset !== 'plane' ? [0, 0.5, 0] : [0, 0, 0]),
    ),
  };
  return {
    type: 'entity.insert',
    sceneId: input.sceneId,
    parentId,
    index: input.index ?? siblings.length,
    entities: [entity],
  };
}

/**
 * Deep copy of the subtree with fresh entity and component IDs, inserted right after the
 * original. Returns `null` when the entity does not exist.
 */
export function duplicateEntityCommand(
  document: ProjectDocument,
  sceneId: string,
  entityId: string,
  ids: IdGenerator,
): Extract<EditorCommand, { type: 'entity.insert' }> | null {
  const scene = findScene(document, sceneId);
  const source = scene ? getEntity(scene, entityId) : undefined;
  if (!scene || !source) {
    return null;
  }
  const subtree = collectSubtree(scene, entityId);
  const idMap = new Map<string, string>();
  for (const entity of subtree) {
    idMap.set(entity.id, ids('ent'));
  }
  const mapId = (id: string) => idMap.get(id) ?? id;
  const copies: SceneEntity[] = subtree.map((entity) => ({
    ...entity,
    id: mapId(entity.id),
    name:
      entity.id === entityId
        ? uniqueSiblingName(document, sceneId, source.parentId, entity.name)
        : entity.name,
    parentId: entity.id === entityId ? source.parentId : mapId(entity.parentId ?? ''),
    childIds: entity.childIds.map(mapId),
    components: entity.components.map((component) => ({ ...component, id: ids('cmp') })),
  }));
  const siblings = siblingIds(scene, source.parentId);
  return {
    type: 'entity.insert',
    sceneId,
    parentId: source.parentId,
    index: siblings.indexOf(entityId) + 1,
    entities: copies,
  };
}

export function findComponent<T extends ComponentType>(
  entity: SceneEntity,
  type: T,
): Extract<ComponentRecord, { type: T }> | undefined {
  return entity.components.find(
    (component): component is Extract<ComponentRecord, { type: T }> => component.type === type,
  );
}

/** Builds the update for one component field; the full data object is re-validated on apply. */
export function updateComponentCommand(
  sceneId: string,
  entityId: string,
  component: ComponentRecord,
  patch: Record<string, unknown>,
): Extract<EditorCommand, { type: 'component.update' }> {
  return {
    type: 'component.update',
    sceneId,
    entityId,
    componentId: component.id,
    data: { ...component.data, ...patch },
    enabled: component.enabled,
  };
}

export function setComponentEnabledCommand(
  sceneId: string,
  entityId: string,
  component: ComponentRecord,
  enabled: boolean,
): Extract<EditorCommand, { type: 'component.update' }> {
  return {
    type: 'component.update',
    sceneId,
    entityId,
    componentId: component.id,
    data: component.data,
    enabled,
  };
}

/** Transform edit shared by the Inspector fields and viewport dragging (same command). */
export function setTransformCommand(
  document: ProjectDocument,
  sceneId: string,
  entityId: string,
  patch: Partial<ComponentData<'transform'>>,
): Extract<EditorCommand, { type: 'component.update' }> | null {
  const scene = findScene(document, sceneId);
  const entity = scene ? getEntity(scene, entityId) : undefined;
  const transform = entity ? findComponent(entity, 'transform') : undefined;
  if (!transform) {
    return null;
  }
  return updateComponentCommand(sceneId, entityId, transform, patch);
}

/** Component types the Inspector may add for this project type and entity. */
export function addableComponentTypes(
  document: ProjectDocument,
  entity: SceneEntity,
): ComponentType[] {
  const present = new Set(entity.components.map((component) => component.type));
  const byProject: Record<ProjectType, ComponentType[]> = {
    game3d: [
      'mesh',
      'material',
      'light',
      'camera',
      'rigidBody3d',
      'collider3d',
      'audio',
      'playerController',
      'scriptGraph',
    ],
    game2d: ['sprite', 'collider2d', 'camera', 'audio', 'playerController', 'scriptGraph'],
    app: [],
  };
  return byProject[document.type].filter(
    (type) => !present.has(type) && (type !== 'scriptGraph' || document.graphs.length > 0),
  );
}

export function addComponentCommand(
  document: ProjectDocument,
  sceneId: string,
  entity: SceneEntity,
  type: ComponentType,
  ids: IdGenerator,
): Extract<EditorCommand, { type: 'component.add' }> {
  let data: unknown = COMPONENT_DEFAULTS[type];
  if (type === 'scriptGraph') {
    data = { graphId: document.graphs[0]?.id ?? COMPONENT_DEFAULTS.scriptGraph.graphId };
  } else if (type === 'camera' && document.type === 'game2d') {
    data = { projection: 'orthographic', orthoHeight: 10, nearClip: 0.1, farClip: 1000 };
  } else if (type === 'playerController' && document.type === 'game2d') {
    data = { ...COMPONENT_DEFAULTS.playerController, mode: 'platformer2d' };
  }
  return {
    type: 'component.add',
    sceneId,
    entityId: entity.id,
    index: entity.components.length,
    // Same pattern as componentRecord(): Zod re-validates the record before it is stored.
    component: { id: ids('cmp'), type, enabled: true, data } as ComponentRecord,
  };
}
