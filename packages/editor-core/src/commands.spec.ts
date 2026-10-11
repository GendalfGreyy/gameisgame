import {
  COMPONENT_DEFAULTS,
  parseProjectDocument,
  serializeProjectDocument,
  validateProjectDocument,
  type ProjectDocument,
} from '@tg-creator/project-schema';
import { describe, expect, it } from 'vitest';

import { applyCommand, type EditorCommand } from './commands.js';
import {
  addComponentCommand,
  createEntityCommand,
  duplicateEntityCommand,
  findComponent,
  setTransformCommand,
} from './factories.js';
import { createSequentialIdGenerator } from './ids.js';
import { collectDocumentIds, findScene, flattenHierarchy, getEntity } from './scene.js';
import { deepFreeze, starterDocument } from './testing.js';

const SCENE = 'scene_main';

function apply(document: ProjectDocument, command: EditorCommand) {
  const result = applyCommand(document, command);
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectInverse(document: ProjectDocument, command: EditorCommand): ProjectDocument {
  const frozen = deepFreeze(JSON.parse(JSON.stringify(document)) as ProjectDocument);
  const { document: next, inverse } = apply(frozen, command);
  expect(validateProjectDocument(next)).toEqual([]);
  const restored = apply(next, inverse).document;
  expect(restored).toEqual(document);
  return next;
}

function scene(document: ProjectDocument) {
  const found = findScene(document, SCENE);
  if (!found) {
    throw new Error('scene missing');
  }
  return found;
}

describe('applyCommand — every command has an exact inverse and never mutates input', () => {
  const ids = createSequentialIdGenerator();
  const base = starterDocument();

  it('entity.insert (create) / remove', () => {
    const create = createEntityCommand(base, { sceneId: SCENE, preset: 'box' }, ids);
    const next = expectInverse(base, create);
    const created = create.entities[0];
    expect(created && getEntity(scene(next), created.id)?.name).toBe('Куб 2');
    expect(scene(next).rootEntityIds.at(-1)).toBe(created?.id);
  });

  it('entity.remove removes the whole subtree and restores it at the same index', () => {
    const withChild = apply(base, {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: 'entity_light',
      parentId: 'entity_cube',
      index: 0,
    }).document;
    const next = expectInverse(withChild, {
      type: 'entity.remove',
      sceneId: SCENE,
      entityId: 'entity_cube',
    });
    expect(getEntity(scene(next), 'entity_light')).toBeUndefined();
    expect(scene(next).rootEntityIds).not.toContain('entity_cube');
  });

  it('entity.rename trims and restores the old name', () => {
    const next = expectInverse(base, {
      type: 'entity.rename',
      sceneId: SCENE,
      entityId: 'entity_cube',
      name: '  Ящик  ',
    });
    expect(getEntity(scene(next), 'entity_cube')?.name).toBe('Ящик');
  });

  it('entity.setEnabled', () => {
    expectInverse(base, {
      type: 'entity.setEnabled',
      sceneId: SCENE,
      entityId: 'entity_cube',
      enabled: false,
    });
  });

  it('entity.move: reparent and reorder', () => {
    const reparented = expectInverse(base, {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: 'entity_cube',
      parentId: 'entity_ground',
      index: 0,
    });
    expect(getEntity(scene(reparented), 'entity_cube')?.parentId).toBe('entity_ground');
    expect(getEntity(scene(reparented), 'entity_ground')?.childIds).toEqual(['entity_cube']);

    const reordered = expectInverse(base, {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: 'entity_cube',
      parentId: null,
      index: 0,
    });
    expect(scene(reordered).rootEntityIds[0]).toBe('entity_cube');
  });

  it('component.add / remove / update', () => {
    const ground = getEntity(scene(base), 'entity_ground');
    if (!ground) throw new Error('ground missing');
    expectInverse(base, addComponentCommand(base, SCENE, ground, 'collider3d', ids));
    expectInverse(base, {
      type: 'component.remove',
      sceneId: SCENE,
      entityId: 'entity_ground',
      componentId: 'cmp_material_ground',
    });
    const move = setTransformCommand(base, SCENE, 'entity_cube', { position: [3, 2, 1] });
    if (!move) throw new Error('transform missing');
    const next = expectInverse(base, move);
    const cube = getEntity(scene(next), 'entity_cube');
    expect(cube && findComponent(cube, 'transform')?.data.position).toEqual([3, 2, 1]);
  });

  it('duplicate copies the subtree with fresh IDs right after the source', () => {
    const nested = apply(base, {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: 'entity_light',
      parentId: 'entity_cube',
      index: 0,
    }).document;
    const duplicate = duplicateEntityCommand(nested, SCENE, 'entity_cube', ids);
    if (!duplicate) throw new Error('duplicate missing');
    const next = expectInverse(nested, duplicate);
    const before = collectDocumentIds(nested);
    const copies = duplicate.entities;
    expect(copies).toHaveLength(2);
    for (const copy of copies) {
      expect(before.has(copy.id)).toBe(false);
      for (const component of copy.components) {
        expect(before.has(component.id)).toBe(false);
      }
    }
    const roots = scene(next).rootEntityIds;
    expect(roots[roots.indexOf('entity_cube') + 1]).toBe(copies[0]?.id);
    expect(copies[0]?.name).toBe('Куб 2');
    expect(copies[1]?.parentId).toBe(copies[0]?.id);
  });
});

describe('applyCommand — rejects edits the server would refuse', () => {
  const base = starterDocument();
  const ids = createSequentialIdGenerator();

  it('reparenting into itself or a descendant is REPARENT_CYCLE', () => {
    const nested = apply(base, {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: 'entity_light',
      parentId: 'entity_cube',
      index: 0,
    }).document;
    for (const parentId of ['entity_cube', 'entity_light']) {
      const result = applyCommand(nested, {
        type: 'entity.move',
        sceneId: SCENE,
        entityId: 'entity_cube',
        parentId,
        index: 0,
      });
      expect(result.ok ? null : result.error.code).toBe('REPARENT_CYCLE');
    }
  });

  it('unknown targets, removing transform, bad data and duplicate components', () => {
    const codes = [
      applyCommand(base, { type: 'entity.remove', sceneId: SCENE, entityId: 'nope' }),
      applyCommand(base, { type: 'entity.remove', sceneId: 'nope', entityId: 'entity_cube' }),
      applyCommand(base, {
        type: 'entity.move',
        sceneId: SCENE,
        entityId: 'entity_cube',
        parentId: 'nope',
        index: 0,
      }),
      applyCommand(base, {
        type: 'component.remove',
        sceneId: SCENE,
        entityId: 'entity_cube',
        componentId: 'cmp_transform_cube',
      }),
      applyCommand(base, {
        type: 'component.update',
        sceneId: SCENE,
        entityId: 'entity_cube',
        componentId: 'cmp_material_cube',
        data: { ...COMPONENT_DEFAULTS.material, opacity: 2 },
        enabled: true,
      }),
      applyCommand(base, {
        type: 'component.add',
        sceneId: SCENE,
        entityId: 'entity_cube',
        index: 0,
        component: { id: 'cmp_x', type: 'mesh', enabled: true, data: COMPONENT_DEFAULTS.mesh },
      }),
      applyCommand(base, {
        type: 'entity.rename',
        sceneId: SCENE,
        entityId: 'entity_cube',
        name: ' ',
      }),
    ].map((result) => (result.ok ? 'ok' : result.error.code));
    expect(codes).toEqual([
      'ENTITY_NOT_FOUND',
      'SCENE_NOT_FOUND',
      'INVALID_PARENT',
      'COMPONENT_REQUIRED',
      'INVALID_DATA',
      'COMPONENT_EXISTS',
      'INVALID_NAME',
    ]);
  });

  it('inserting an already used ID is rejected; reusing a component ID fails integrity', () => {
    const create = createEntityCommand(base, { sceneId: SCENE, preset: 'empty' }, ids);
    const [entity] = create.entities;
    if (!entity) throw new Error('entity missing');
    const sameId = applyCommand(base, { ...create, entities: [{ ...entity, id: 'entity_cube' }] });
    expect(sameId.ok ? null : sameId.error.code).toBe('DUPLICATE_ID');

    const clashing = applyCommand(base, {
      ...create,
      entities: [
        {
          ...entity,
          components: entity.components.map((component) => ({
            ...component,
            id: 'cmp_transform_cube',
          })),
        },
      ],
    });
    expect(clashing.ok ? null : clashing.error.code).toBe('INTEGRITY');
  });

  it('every successful result stays a valid, roundtrip-stable document', () => {
    const create = createEntityCommand(base, { sceneId: SCENE, preset: 'sphere' }, ids);
    const { document } = apply(base, create);
    const parsed = parseProjectDocument(JSON.parse(serializeProjectDocument(document)));
    expect(parsed.ok).toBe(true);
    expect(flattenHierarchy(scene(document)).map((row) => row.entity.name)).toContain('Сфера');
  });
});
