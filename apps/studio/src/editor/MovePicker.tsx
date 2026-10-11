import {
  activeScene,
  flattenHierarchy,
  getEntity,
  isSelfOrDescendant,
} from '@tg-creator/editor-core';
import { useId } from 'react';

import { moveEntity } from './actions.js';
import { useEditorState, useSession } from './context.js';

/** Keyboard- and drag-free reparenting: pick the new parent from a list. */
export function MovePicker({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const session = useSession();
  const scene = useEditorState(activeScene);
  const titleId = useId();
  const entity = scene ? getEntity(scene, entityId) : undefined;
  if (!scene || !entity) {
    return null;
  }
  const targets = flattenHierarchy(scene).filter(
    (row) => !isSelfOrDescendant(scene, entity.id, row.entity.id),
  );

  const choose = (parentId: string | null) => {
    const count = parentId
      ? (getEntity(scene, parentId)?.childIds.length ?? 0)
      : scene.rootEntityIds.length;
    const sameParent = entity.parentId === parentId;
    moveEntity(session, entity.id, parentId, sameParent ? count - 1 : count);
    onClose();
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog ed-move"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="dialog__title">
          Переместить «{entity.name}»
        </h2>
        <div className="ed-move__list" role="listbox" aria-label="Новый родитель">
          <button
            type="button"
            role="option"
            aria-selected={entity.parentId === null}
            className="ed-move__item"
            onClick={() => choose(null)}
          >
            Корень сцены
          </button>
          {targets.map(({ entity: target, depth }) => (
            <button
              key={target.id}
              type="button"
              role="option"
              aria-selected={entity.parentId === target.id}
              className="ed-move__item"
              style={{ '--depth': depth + 1 }}
              onClick={() => choose(target.id)}
            >
              {target.name}
            </button>
          ))}
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
