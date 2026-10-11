import {
  activeScene,
  createEntityCommand,
  duplicateEntityCommand,
  getEntity,
  siblingIds,
  type EditorSession,
  type EntityPresetId,
} from '@tg-creator/editor-core';
import type { Vec3 } from '@tg-creator/project-schema';

function nameOf(session: EditorSession, entityId: string): string {
  const scene = activeScene(session.getState());
  return (scene && getEntity(scene, entityId)?.name) ?? 'объект';
}

export function addEntity(
  session: EditorSession,
  preset: EntityPresetId,
  options: { parentId?: string | null; position?: Vec3 } = {},
): string | null {
  const state = session.getState();
  if (state.sceneId === null) {
    return null;
  }
  const parentId = options.parentId ?? null;
  // Children start at the parent's origin; root objects at the viewport centre.
  const position: Vec3 | undefined = parentId ? [0, 0, 0] : options.position;
  const command = createEntityCommand(
    state.document,
    { sceneId: state.sceneId, preset, parentId, ...(position ? { position } : {}) },
    session.ids,
  );
  const entity = command.entities[0];
  if (!entity) {
    return null;
  }
  const result = session.dispatch(command, {
    label: `Добавить «${entity.name}»`,
    select: [entity.id],
  });
  return result.ok ? entity.id : null;
}

export function duplicateEntity(session: EditorSession, entityId: string): void {
  const state = session.getState();
  if (state.sceneId === null) {
    return;
  }
  const command = duplicateEntityCommand(state.document, state.sceneId, entityId, session.ids);
  const copy = command?.entities[0];
  if (command && copy) {
    session.dispatch(command, {
      label: `Дублировать «${nameOf(session, entityId)}»`,
      select: [copy.id],
    });
  }
}

export function deleteEntity(session: EditorSession, entityId: string): void {
  const state = session.getState();
  if (state.sceneId === null) {
    return;
  }
  session.dispatch(
    { type: 'entity.remove', sceneId: state.sceneId, entityId },
    { label: `Удалить «${nameOf(session, entityId)}»` },
  );
}

export function renameEntity(session: EditorSession, entityId: string, name: string): boolean {
  const state = session.getState();
  const scene = activeScene(state);
  const current = scene ? getEntity(scene, entityId) : undefined;
  if (state.sceneId === null || !current || current.name === name.trim()) {
    return true;
  }
  return session.dispatch(
    { type: 'entity.rename', sceneId: state.sceneId, entityId, name },
    { label: `Переименовать «${current.name}»` },
  ).ok;
}

export function setEntityEnabled(session: EditorSession, entityId: string, enabled: boolean): void {
  const state = session.getState();
  if (state.sceneId === null) {
    return;
  }
  session.dispatch(
    { type: 'entity.setEnabled', sceneId: state.sceneId, entityId, enabled },
    { label: `${enabled ? 'Включить' : 'Выключить'} «${nameOf(session, entityId)}»` },
  );
}

export function moveEntity(
  session: EditorSession,
  entityId: string,
  parentId: string | null,
  index: number,
  label = `Переместить «${nameOf(session, entityId)}»`,
): boolean {
  const state = session.getState();
  if (state.sceneId === null) {
    return false;
  }
  return session.dispatch(
    { type: 'entity.move', sceneId: state.sceneId, entityId, parentId, index },
    { label },
  ).ok;
}

export type StructureMoves = {
  up: boolean;
  down: boolean;
  indent: boolean;
  outdent: boolean;
};

/** Which one-tap hierarchy moves are possible for this entity right now. */
export function structureMoves(session: EditorSession, entityId: string): StructureMoves {
  const scene = activeScene(session.getState());
  const entity = scene ? getEntity(scene, entityId) : undefined;
  if (!scene || !entity) {
    return { up: false, down: false, indent: false, outdent: false };
  }
  const siblings = siblingIds(scene, entity.parentId);
  const index = siblings.indexOf(entityId);
  return {
    up: index > 0,
    down: index >= 0 && index < siblings.length - 1,
    indent: index > 0,
    outdent: entity.parentId !== null,
  };
}

export function moveUp(session: EditorSession, entityId: string, delta: -1 | 1): void {
  const scene = activeScene(session.getState());
  const entity = scene ? getEntity(scene, entityId) : undefined;
  if (!scene || !entity) {
    return;
  }
  const index = siblingIds(scene, entity.parentId).indexOf(entityId);
  moveEntity(
    session,
    entityId,
    entity.parentId,
    index + delta,
    `${delta < 0 ? 'Выше' : 'Ниже'}: «${entity.name}»`,
  );
}

/** Makes the entity the last child of its previous sibling (outliner "Tab"). */
export function indent(session: EditorSession, entityId: string): void {
  const scene = activeScene(session.getState());
  const entity = scene ? getEntity(scene, entityId) : undefined;
  if (!scene || !entity) {
    return;
  }
  const siblings = siblingIds(scene, entity.parentId);
  const previousId = siblings[siblings.indexOf(entityId) - 1];
  const previous = previousId ? getEntity(scene, previousId) : undefined;
  if (previous) {
    moveEntity(
      session,
      entityId,
      previous.id,
      previous.childIds.length,
      `Вложить «${entity.name}» в «${previous.name}»`,
    );
  }
}

/** Moves the entity right after its parent, one level up. */
export function outdent(session: EditorSession, entityId: string): void {
  const scene = activeScene(session.getState());
  const entity = scene ? getEntity(scene, entityId) : undefined;
  const parent = scene && entity?.parentId ? getEntity(scene, entity.parentId) : undefined;
  if (!scene || !entity || !parent) {
    return;
  }
  const index = siblingIds(scene, parent.parentId).indexOf(parent.id) + 1;
  moveEntity(session, entityId, parent.parentId, index, `Вынести «${entity.name}» на уровень выше`);
}
