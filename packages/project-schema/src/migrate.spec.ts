import { describe, expect, it } from 'vitest';

import { migrateToLatest } from './migrate.js';
import { parseProjectDocument } from './parse.js';
import { clone, fixtureNames, readExample, readFixture } from './testing.js';
import { projectDocumentV1Schema } from './v1.js';

describe('migrate v1 → v2', () => {
  const names = fixtureNames('v1');

  it('has fixtures for every G1 template and the v1 example', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'app-empty.json',
        'app-starter.json',
        'example-3d.json',
        'game2d-empty.json',
        'game2d-starter.json',
        'game3d-empty.json',
        'game3d-starter.json',
      ]),
    );
  });

  for (const name of names) {
    it(`${name} migrates to the golden v2 document`, () => {
      const result = migrateToLatest(readFixture('v1', name));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.fromVersion).toBe(1);
        expect(result.document).toEqual(readFixture('v2-from-v1', name));
      }
    });

    it(`${name} keeps its meaning: IDs, hierarchy, names and every v1 value`, () => {
      const v1 = projectDocumentV1Schema.parse(readFixture('v1', name));
      const result = parseProjectDocument(v1);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const v2 = result.document;
      expect(v2.id).toBe(v1.id);
      expect(v2.title).toBe(v1.title);
      expect(v2.settings).toEqual(v1.settings);
      expect(v2.entrySceneId).toBe(v1.entrySceneId ?? null);

      v1.scenes.forEach((scene, s) => {
        const migrated = v2.scenes[s];
        expect(migrated?.rootEntityIds).toEqual(scene.rootEntityIds);
        for (const [id, entity] of Object.entries(scene.entities)) {
          const next = migrated?.entities[id];
          expect(next?.name).toBe(entity.name);
          expect(next?.parentId).toBe(entity.parentId);
          expect(next?.childIds).toEqual(entity.childIds);
          entity.components.forEach((component, c) => {
            const after = next?.components[c];
            expect(after?.id).toBe(component.id);
            expect(after?.type).toBe(component.type);
            for (const [key, value] of Object.entries(component.data)) {
              expect(after?.data).toHaveProperty(key, value);
            }
          });
        }
      });

      v1.pages.forEach((page, p) => {
        const migrated = v2.pages[p];
        expect(migrated?.route).toBe(page.route);
        for (const [id, component] of Object.entries(page.components)) {
          const after = migrated?.components[id];
          expect(after?.type).toBe(component.type);
          expect(after?.childIds).toEqual(component.childIds);
          for (const [key, value] of Object.entries(component.props)) {
            expect(after?.props).toHaveProperty(key, value);
          }
        }
      });
    });
  }

  it('fills missing camera fields per projection', () => {
    const v1 = clone(readExample('project-3d.v1.json'));
    const result = migrateToLatest(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const camera = result.document.scenes[0]?.entities['entity_camera']?.components.find(
        (component) => component.type === 'camera',
      );
      expect(camera?.data).toEqual({
        projection: 'perspective',
        fov: 60,
        nearClip: 0.1,
        farClip: 1000,
      });
    }
  });

  it('v1 example in examples/ stays a valid migration input', () => {
    expect(parseProjectDocument(readExample('project-3d.v1.json')).ok).toBe(true);
  });

  it('is pure: the input is not mutated', () => {
    const input = readFixture('v1', 'game3d-starter.json');
    const before = JSON.stringify(input);
    migrateToLatest(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('a v1 document with an unknown widget type fails as MIGRATION_FAILED', () => {
    const input = clone(readFixture('v1', 'app-starter.json'));
    const page = Reflect.get(input as object, 'pages') as Array<{
      components: Record<string, { type: string }>;
    }>;
    const button = page[0]?.components['cmp_button'];
    if (!button) {
      throw new Error('fixture has no button');
    }
    button.type = 'iframe';
    const result = parseProjectDocument(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('MIGRATION_FAILED');
    }
  });

  it('newer or unknown versions are refused, not guessed', () => {
    for (const schemaVersion of [3, 99, 0, '2', null]) {
      const result = parseProjectDocument({ schemaVersion, id: 'x' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('MIGRATION_FAILED');
      }
    }
    expect(parseProjectDocument('nope').ok).toBe(false);
  });
});
