import { describe, expect, it } from 'vitest';

import { createEntityCommand, setTransformCommand } from './factories.js';
import { createSequentialIdGenerator } from './ids.js';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createEditorSession,
  isDirty,
  saveIndicator,
} from './session.js';
import { starterDocument } from './testing.js';

const SCENE = 'scene_main';

function setup() {
  const ids = createSequentialIdGenerator();
  const document = starterDocument();
  const session = createEditorSession({ document, revision: 1, savedAt: null, ids });
  return { ids, document, session };
}

function move(session: ReturnType<typeof setup>['session'], x: number, mergeKey?: string) {
  const command = setTransformCommand(session.getState().document, SCENE, 'entity_cube', {
    position: [x, 1, 0],
  });
  if (!command) throw new Error('transform missing');
  return session.dispatch(command, mergeKey ? { label: 'Сдвиг', mergeKey } : { label: 'Сдвиг' });
}

describe('editor session history', () => {
  it('undo/redo restores documents and selection; new edits clear redo', () => {
    const { ids, document, session } = setup();
    session.select(['entity_ground']);
    const create = createEntityCommand(document, { sceneId: SCENE, preset: 'box' }, ids);
    const createdId = create.entities[0]?.id ?? '';
    expect(session.dispatch(create, { label: 'Добавить', select: [createdId] }).ok).toBe(true);
    expect(session.getState().selection).toEqual([createdId]);
    const afterCreate = session.getState().document;

    session.undo();
    expect(session.getState().document).toEqual(document);
    expect(session.getState().selection).toEqual(['entity_ground']);
    expect(canRedo(session.getState())).toBe(true);

    session.redo();
    expect(session.getState().document).toEqual(afterCreate);
    expect(session.getState().selection).toEqual([createdId]);

    session.undo();
    move(session, 4);
    expect(canRedo(session.getState())).toBe(false);
  });

  it('a rejected command changes nothing and is logged', () => {
    const { session } = setup();
    const before = session.getState();
    const result = session.dispatch(
      {
        type: 'entity.move',
        sceneId: SCENE,
        entityId: 'entity_cube',
        parentId: 'entity_cube',
        index: 0,
      },
      { label: 'Переместить' },
    );
    expect(result.ok).toBe(false);
    const after = session.getState();
    expect(after.document).toBe(before.document);
    expect(after.past).toHaveLength(0);
    expect(after.log.at(-1)).toMatchObject({ level: 'error' });
  });

  it('a drag gesture (same mergeKey) is one undo step; closing the group starts a new one', () => {
    const { document, session } = setup();
    move(session, 1, 'drag-1');
    move(session, 2, 'drag-1');
    move(session, 3, 'drag-1');
    expect(session.getState().past).toHaveLength(1);
    session.closeMergeGroup();
    move(session, 4, 'drag-1');
    expect(session.getState().past).toHaveLength(2);
    session.undo();
    session.undo();
    expect(session.getState().document).toEqual(document);
  });

  it('removing the selected entity prunes the selection', () => {
    const { session } = setup();
    session.select(['entity_cube', 'entity_ground']);
    session.dispatch(
      { type: 'entity.remove', sceneId: SCENE, entityId: 'entity_cube' },
      { label: 'Удалить' },
    );
    expect(session.getState().selection).toEqual(['entity_ground']);
    session.select(['missing']);
    expect(session.getState().selection).toEqual([]);
  });

  it('keeps at most HISTORY_LIMIT entries', () => {
    const { session } = setup();
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      move(session, index);
    }
    expect(session.getState().past).toHaveLength(HISTORY_LIMIT);
  });
});

describe('editor session save state', () => {
  it('is Saved only after the server confirms; undo back to the saved point is clean', () => {
    const { session } = setup();
    expect(saveIndicator(session.getState())).toBe('saved');
    expect(session.beginSave()).toBeNull();

    move(session, 2);
    expect(saveIndicator(session.getState())).toBe('dirty');
    const ticket = session.beginSave();
    expect(ticket).toMatchObject({ baseRevision: 1 });
    expect(saveIndicator(session.getState())).toBe('saving');
    expect(session.beginSave()).toBeNull();
    if (!ticket) throw new Error('ticket missing');

    session.saveSucceeded(ticket, 2, '2026-10-11T12:00:00.000Z');
    expect(saveIndicator(session.getState())).toBe('saved');
    expect(session.getState().serverRevision).toBe(2);

    move(session, 3);
    expect(isDirty(session.getState())).toBe(true);
    session.undo();
    expect(isDirty(session.getState())).toBe(false);
    session.undo();
    expect(isDirty(session.getState())).toBe(true);
  });

  it('edits made while saving stay dirty after the save lands', () => {
    const { session } = setup();
    move(session, 2);
    const ticket = session.beginSave();
    if (!ticket) throw new Error('ticket missing');
    move(session, 5);
    session.saveSucceeded(ticket, 2, '2026-10-11T12:00:00.000Z');
    expect(saveIndicator(session.getState())).toBe('dirty');
    expect(session.beginSave()).toMatchObject({ baseRevision: 2 });
  });

  it('retrying the same document reuses the mutationId; a new edit gets a new one', () => {
    const { session } = setup();
    move(session, 2);
    const first = session.beginSave();
    if (!first) throw new Error('ticket missing');
    session.saveFailed(first, { kind: 'offline' });
    expect(saveIndicator(session.getState())).toBe('offline');

    const retry = session.beginSave();
    expect(retry?.mutationId).toBe(first.mutationId);
    if (!retry) throw new Error('ticket missing');
    session.saveFailed(retry, { kind: 'error', message: 'Сервер недоступен' });
    expect(saveIndicator(session.getState())).toBe('error');

    move(session, 3);
    expect(session.beginSave()?.mutationId).not.toBe(first.mutationId);
  });

  it('a conflict blocks saving until the server version is loaded', () => {
    const { document, session } = setup();
    move(session, 2);
    const ticket = session.beginSave();
    if (!ticket) throw new Error('ticket missing');
    session.saveFailed(ticket, { kind: 'conflict', actualRevision: 3 });
    expect(saveIndicator(session.getState())).toBe('conflict');
    expect(session.beginSave()).toBeNull();

    session.reset(document, 3, '2026-10-11T12:00:00.000Z');
    const state = session.getState();
    expect(saveIndicator(state)).toBe('saved');
    expect(state.serverRevision).toBe(3);
    expect(canUndo(state)).toBe(false);
  });
});
