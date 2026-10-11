import { describe, expect, it } from 'vitest';

import { parseProjectDocument } from './parse.js';
import { deserializeProjectDocument, serializeProjectDocument } from './serialize.js';
import { PROJECT_TEMPLATE_IDS, createProjectDocument } from './templates.js';
import { clone, readExample } from './testing.js';
import { projectDocumentSchema, type ProjectDocument, type ProjectType } from './v2.js';

function example(): ProjectDocument {
  return projectDocumentSchema.parse(readExample('project-3d.v2.json'));
}

describe('ProjectDocument v2 roundtrip', () => {
  it('the canonical v2 example is valid and consistent', () => {
    const parsed = parseProjectDocument(readExample('project-3d.v2.json'));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.migratedFrom).toBeNull();
      expect(parsed.document.scenes[0]?.entities['entity_cube_gem']?.parentId).toBe('entity_cube');
    }
  });

  it('serialize → deserialize → serialize is byte-identical and lossless', () => {
    const document = example();
    const first = serializeProjectDocument(document);
    const restored = deserializeProjectDocument(first);
    expect(restored).toEqual(document);
    expect(serializeProjectDocument(restored)).toBe(first);
  });

  it('serialization is canonical regardless of input key order', () => {
    const document = example();
    const reordered = Object.fromEntries(Object.entries(document).reverse());
    expect(serializeProjectDocument(projectDocumentSchema.parse(reordered))).toBe(
      serializeProjectDocument(document),
    );
  });

  for (const type of ['game3d', 'game2d', 'app'] satisfies ProjectType[]) {
    for (const templateId of PROJECT_TEMPLATE_IDS) {
      it(`template ${type}/${templateId} roundtrips`, () => {
        const document = createProjectDocument({
          id: 'prj_1',
          ownerId: 'usr_1',
          title: 'Тест',
          type,
          templateId,
          orientation: 'auto',
        });
        const raw = serializeProjectDocument(document);
        expect(serializeProjectDocument(deserializeProjectDocument(raw))).toBe(raw);
      });
    }
  }

  it('rejects unknown fields instead of silently dropping them', () => {
    const document: Record<string, unknown> = { ...clone(example()), engineState: { gl: 1 } };
    const parsed = parseProjectDocument(document);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe('SCHEMA_INVALID');
    }
  });

  it('rejects untyped component data', () => {
    const document = clone(example());
    const cube = document.scenes[0]?.entities['entity_cube'];
    const material = cube?.components.find((component) => component.type === 'material');
    if (material?.type !== 'material') {
      throw new Error('fixture has no material');
    }
    const broken: unknown = { ...document };
    Reflect.set(material.data, 'roughness', 'very');
    const parsed = parseProjectDocument(broken);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe('SCHEMA_INVALID');
      expect(parsed.issues[0]?.path).toContain('roughness');
    }
  });

  it('rejects a camera whose far clip is not beyond the near clip', () => {
    const document = clone(example());
    const camera = document.scenes[0]?.entities['entity_camera']?.components.find(
      (component) => component.type === 'camera',
    );
    if (camera?.type !== 'camera') {
      throw new Error('fixture has no camera');
    }
    camera.data.farClip = 0.05;
    expect(parseProjectDocument(document).ok).toBe(false);
  });
});
