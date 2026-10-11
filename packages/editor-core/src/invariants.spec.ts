import {
  ENTITIES_PER_SCENE_MAX,
  parseProjectDocument,
  serializeProjectDocument,
  validateProjectDocument,
  type ProjectDocument,
} from '@tg-creator/project-schema';
import { describe, expect, it } from 'vitest';

import type { EditorCommand } from './commands.js';
import {
  addComponentCommand,
  addableComponentTypes,
  createEntityCommand,
  duplicateEntityCommand,
  presetsFor,
  setTransformCommand,
} from './factories.js';
import { createSequentialIdGenerator } from './ids.js';
import { findScene, flattenHierarchy } from './scene.js';
import { HISTORY_LIMIT, canRedo, canUndo, createEditorSession } from './session.js';
import { seededRandom, starterDocument } from './testing.js';

const SCENE = 'scene_main';

function pick<T>(random: () => number, items: readonly T[]): T | undefined {
  return items[Math.floor(random() * items.length)];
}

/** One random, possibly invalid, edit — the same mix a user produces with the UI. */
function randomCommand(
  document: ProjectDocument,
  random: () => number,
  ids: ReturnType<typeof createSequentialIdGenerator>,
): EditorCommand | null {
  const scene = findScene(document, SCENE);
  if (!scene) return null;
  const entityIds = Object.keys(scene.entities);
  const target = pick(random, entityIds);
  const other = pick(random, [null, ...entityIds]);
  const roll = random();
  if (roll < 0.2 || target === undefined) {
    const preset = pick(random, presetsFor(document.type));
    return preset
      ? createEntityCommand(
          document,
          { sceneId: SCENE, preset: preset.id, parentId: other ?? null },
          ids,
        )
      : null;
  }
  if (roll < 0.3) return { type: 'entity.remove', sceneId: SCENE, entityId: target };
  if (roll < 0.4) return duplicateEntityCommand(document, SCENE, target, ids);
  if (roll < 0.5) {
    return {
      type: 'entity.rename',
      sceneId: SCENE,
      entityId: target,
      name: random() < 0.1 ? '' : `Объект ${Math.floor(random() * 100)}`,
    };
  }
  if (roll < 0.7) {
    // Includes illegal moves (into itself / descendants) that must be rejected.
    return {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: target,
      parentId: other ?? null,
      index: Math.floor(random() * 4),
    };
  }
  if (roll < 0.8) {
    return { type: 'entity.setEnabled', sceneId: SCENE, entityId: target, enabled: random() < 0.5 };
  }
  if (roll < 0.9) {
    const entity = scene.entities[target];
    const type = entity ? pick(random, addableComponentTypes(document, entity)) : undefined;
    return entity && type ? addComponentCommand(document, SCENE, entity, type, ids) : null;
  }
  return setTransformCommand(document, SCENE, target, {
    position: [random() * 10 - 5, random() * 4, random() * 10 - 5],
    scale: [random() < 0.05 ? Number.NaN : 1, 1, 1],
  });
}

describe('invariants under random edit sequences', () => {
  for (const [type, seed] of [
    ['game3d', 1],
    ['game3d', 7],
    ['game2d', 42],
  ] as const) {
    it(`${type} seed ${seed}: valid after every step; full undo/redo restores both ends`, () => {
      const random = seededRandom(seed);
      const ids = createSequentialIdGenerator();
      const initial = starterDocument(type);
      const session = createEditorSession({ document: initial, revision: 1, savedAt: null, ids });
      let applied = 0;
      let rejected = 0;

      for (let step = 0; step < 190; step += 1) {
        const command = randomCommand(session.getState().document, random, ids);
        if (!command) continue;
        const result = session.dispatch(command, { label: command.type });
        if (result.ok) applied += 1;
        else rejected += 1;
        const { document } = session.getState();
        expect(validateProjectDocument(document)).toEqual([]);
      }
      expect(applied).toBeGreaterThan(80);
      // Must stay under HISTORY_LIMIT so undoing everything reaches the initial document.
      expect(applied).toBeLessThanOrEqual(HISTORY_LIMIT);
      expect(rejected).toBeGreaterThan(0);

      const final = session.getState().document;
      const parsed = parseProjectDocument(JSON.parse(serializeProjectDocument(final)));
      expect(parsed.ok && parsed.document).toEqual(final);

      while (canUndo(session.getState())) {
        expect(session.undo().ok).toBe(true);
      }
      expect(session.getState().document).toEqual(initial);
      expect(session.getState().version).toBe(0);

      while (canRedo(session.getState())) {
        expect(session.redo().ok).toBe(true);
      }
      expect(session.getState().document).toEqual(final);
    });
  }

  it('applies a command to a max-size scene fast enough for interactive editing', () => {
    const ids = createSequentialIdGenerator();
    let document = starterDocument();
    const scene = findScene(document, SCENE);
    if (!scene) throw new Error('scene missing');
    const entities = { ...scene.entities };
    const roots = [...scene.rootEntityIds];
    while (Object.keys(entities).length < ENTITIES_PER_SCENE_MAX) {
      const command = createEntityCommand(document, { sceneId: SCENE, preset: 'empty' }, ids);
      const [entity] = command.entities;
      if (!entity) break;
      entities[entity.id] = { ...entity, name: entity.id };
      roots.push(entity.id);
    }
    document = {
      ...document,
      scenes: [{ ...scene, entities, rootEntityIds: roots }],
    };
    expect(validateProjectDocument(document)).toEqual([]);
    const session = createEditorSession({ document, revision: 1, savedAt: null, ids });

    const started = Date.now();
    const command = setTransformCommand(document, SCENE, 'entity_cube', { position: [1, 2, 3] });
    if (!command) throw new Error('transform missing');
    expect(session.dispatch(command, { label: 'move' }).ok).toBe(true);
    const elapsed = Date.now() - started;
    expect(flattenHierarchy(findScene(session.getState().document, SCENE) ?? scene)).toHaveLength(
      ENTITIES_PER_SCENE_MAX,
    );
    // Generous bound for slow CI machines; locally this is a few milliseconds.
    expect(elapsed).toBeLessThan(250);
  });
});
