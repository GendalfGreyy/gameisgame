import { describe, expect, it } from 'vitest';

import { deserializeProjectDocument, serializeProjectDocument } from './serialize.js';
import {
  PROJECT_TEMPLATE_IDS,
  cloneProjectDocument,
  createProjectDocument,
  type ProjectTemplateId,
} from './templates.js';
import type { ProjectDocument, ProjectType } from './v2.js';

const TYPES: ProjectType[] = ['game3d', 'game2d', 'app'];

function make(type: ProjectType, templateId: ProjectTemplateId): ProjectDocument {
  return createProjectDocument({
    id: 'prj_1',
    ownerId: 'usr_1',
    title: 'Тест',
    type,
    templateId,
    orientation: 'portrait',
  });
}

describe('createProjectDocument', () => {
  for (const type of TYPES) {
    for (const templateId of PROJECT_TEMPLATE_IDS) {
      it(`${type}/${templateId} is a valid, roundtrippable v2 document`, () => {
        const document = make(type, templateId);
        expect(document.schemaVersion).toBe(2);
        expect(document.type).toBe(type);
        expect(document.settings.orientation).toBe('portrait');
        expect(deserializeProjectDocument(serializeProjectDocument(document))).toEqual(document);
      });
    }
  }

  it('game projects have an entry scene whose roots exist', () => {
    for (const type of ['game3d', 'game2d'] as const) {
      const document = make(type, 'starter');
      const scene = document.scenes.find((item) => item.id === document.entrySceneId);
      expect(scene).toBeDefined();
      for (const rootId of scene?.rootEntityIds ?? []) {
        expect(scene?.entities[rootId]?.parentId).toBeNull();
      }
    }
  });

  it('starter adds content on top of empty', () => {
    const empty = make('game3d', 'empty');
    const starter = make('game3d', 'starter');
    const count = (doc: ProjectDocument) => Object.keys(doc.scenes[0]?.entities ?? {}).length;
    expect(count(starter)).toBeGreaterThan(count(empty));
    expect(Object.keys(make('app', 'starter').pages[0]?.components ?? {}).length).toBeGreaterThan(
      1,
    );
  });

  it('app projects have a home page and no scenes', () => {
    const document = make('app', 'empty');
    expect(document.scenes).toEqual([]);
    expect(document.pages[0]?.route).toBe('/');
  });
});

describe('cloneProjectDocument', () => {
  it('copies content with a new identity without aliasing the source', () => {
    const source = make('game3d', 'starter');
    const copy = cloneProjectDocument(source, { id: 'prj_2', ownerId: 'usr_1', title: 'Копия' });
    expect(copy.id).toBe('prj_2');
    expect(copy.title).toBe('Копия');
    expect(copy.scenes).toEqual(source.scenes);
    expect(copy.scenes).not.toBe(source.scenes);
  });
});
