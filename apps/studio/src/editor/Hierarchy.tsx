import {
  activeScene,
  flattenHierarchy,
  getEntity,
  presetsFor,
  siblingIds,
} from '@tg-creator/editor-core';
import type { Scene, SceneEntity } from '@tg-creator/project-schema';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';

import { IconSearch } from '../components/icons.js';
import {
  addEntity,
  duplicateEntity,
  indent,
  moveEntity,
  moveUp,
  outdent,
  renameEntity,
  setEntityEnabled,
  structureMoves,
} from './actions.js';
import { useEditorState, useEditorUi, useSession } from './context.js';
import { EntityGlyph } from './glyphs.js';

type DropZone = 'before' | 'inside' | 'after';

/** Ids to keep when filtering: matches plus their ancestors, so context stays visible. */
function visibleForQuery(scene: Scene, query: string): Set<string> | null {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (!needle) {
    return null;
  }
  const keep = new Set<string>();
  for (const entity of Object.values(scene.entities)) {
    if (!entity.name.toLocaleLowerCase('ru').includes(needle)) {
      continue;
    }
    let current: SceneEntity | undefined = entity;
    while (current && !keep.has(current.id)) {
      keep.add(current.id);
      current = current.parentId ? getEntity(scene, current.parentId) : undefined;
    }
  }
  return keep;
}

function RenameInput({ entity, onDone }: { entity: SceneEntity; onDone: () => void }) {
  const session = useSession();
  const [draft, setDraft] = useState(entity.name);
  const ref = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    if (commit) {
      renameEntity(session, entity.id, draft);
    }
    onDone();
  };

  return (
    <input
      ref={ref}
      className="ed-tree__rename"
      aria-label={`Новое имя для «${entity.name}»`}
      value={draft}
      maxLength={120}
      enterKeyHint="done"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          finish(true);
        } else if (event.key === 'Escape') {
          finish(false);
        }
      }}
    />
  );
}

function RowMenu({ entity, onClose }: { entity: SceneEntity; onClose: () => void }) {
  const session = useSession();
  const ui = useEditorUi();
  const document = useEditorState((state) => state.document);
  const moves = structureMoves(session, entity.id);
  const [addingChild, setAddingChild] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const item = (
    label: string,
    action: () => void,
    options: { disabled?: boolean; danger?: boolean } = {},
  ) => (
    <button
      type="button"
      role="menuitem"
      className={options.danger ? 'is-danger' : undefined}
      disabled={options.disabled}
      onClick={() => {
        onClose();
        action();
      }}
    >
      {label}
    </button>
  );

  if (addingChild) {
    return (
      <div
        ref={ref}
        className="ed-menu"
        role="menu"
        aria-label={`Добавить внутрь «${entity.name}»`}
      >
        <p className="ed-menu__caption">Добавить внутрь «{entity.name}»</p>
        {presetsFor(document.type).map((preset) =>
          item(preset.label, () => {
            addEntity(session, preset.id, { parentId: entity.id });
          }),
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="ed-menu" role="menu" aria-label={`Действия: ${entity.name}`}>
      {item('Переименовать', () => ui.setRenamingId(entity.id))}
      <button type="button" role="menuitem" onClick={() => setAddingChild(true)}>
        Добавить дочерний…
      </button>
      {item('Дублировать', () => duplicateEntity(session, entity.id))}
      {item('Выше', () => moveUp(session, entity.id, -1), { disabled: !moves.up })}
      {item('Ниже', () => moveUp(session, entity.id, 1), { disabled: !moves.down })}
      {item('Вложить в предыдущий', () => indent(session, entity.id), { disabled: !moves.indent })}
      {item('Вынести на уровень выше', () => outdent(session, entity.id), {
        disabled: !moves.outdent,
      })}
      {item('Переместить в…', () => ui.requestMove(entity.id))}
      {item('Удалить', () => ui.requestDelete(entity.id), { danger: true })}
    </div>
  );
}

export function Hierarchy() {
  const session = useSession();
  const ui = useEditorUi();
  const document = useEditorState((state) => state.document);
  const scene = useEditorState(activeScene);
  const selection = useEditorState((state) => state.selection);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [drag, setDrag] = useState<{ id: string; overId: string | null; zone: DropZone } | null>(
    null,
  );

  const rows = useMemo(() => {
    if (!scene) {
      return [];
    }
    const keep = visibleForQuery(scene, query);
    const all = flattenHierarchy(scene, (id) => keep !== null || !collapsed.has(id));
    return keep ? all.filter((row) => keep.has(row.entity.id)) : all;
  }, [scene, collapsed, query]);

  // Reveal the selected entity: expand its ancestors.
  const selectedId = selection.at(-1);
  useEffect(() => {
    if (!scene || !selectedId) {
      return;
    }
    const ancestors: string[] = [];
    let current = getEntity(scene, selectedId)?.parentId ?? null;
    while (current) {
      ancestors.push(current);
      current = getEntity(scene, current)?.parentId ?? null;
    }
    if (ancestors.some((id) => collapsed.has(id))) {
      setCollapsed((set) => new Set([...set].filter((id) => !ancestors.includes(id))));
    }
  }, [scene, selectedId, collapsed]);

  if (!scene) {
    return <div className="ed-empty">В проекте нет сцен.</div>;
  }

  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const onDragOver = (event: DragEvent<HTMLElement>, target: SceneEntity) => {
    if (!drag) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const zone: DropZone = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    if (drag.overId !== target.id || drag.zone !== zone) {
      setDrag({ ...drag, overId: target.id, zone });
    }
  };

  const onDrop = (target: SceneEntity | null) => {
    if (!drag) {
      return;
    }
    const dragged = getEntity(scene, drag.id);
    setDrag(null);
    if (!dragged || target?.id === dragged.id) {
      return;
    }
    if (target === null) {
      const roots = siblingIds(scene, null).filter((id) => id !== dragged.id);
      moveEntity(session, dragged.id, null, roots.length);
      return;
    }
    if (drag.zone === 'inside') {
      const children = target.childIds.filter((id) => id !== dragged.id);
      moveEntity(
        session,
        dragged.id,
        target.id,
        children.length,
        `Вложить «${dragged.name}» в «${target.name}»`,
      );
      return;
    }
    const siblings = siblingIds(scene, target.parentId).filter((id) => id !== dragged.id);
    const index = siblings.indexOf(target.id) + (drag.zone === 'after' ? 1 : 0);
    moveEntity(session, dragged.id, target.parentId, index);
  };

  return (
    <div className="ed-hierarchy" data-testid="hierarchy">
      <div className="ed-hierarchy__tools">
        <label className="ed-search">
          <IconSearch size={16} />
          <input
            type="search"
            placeholder="Поиск объектов"
            aria-label="Поиск объектов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <p className="ed-hierarchy__scene mono">{scene.name}</p>
      <div
        className="ed-tree"
        role="tree"
        aria-label="Иерархия сцены"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            session.select([]);
          }
        }}
      >
        {rows.length === 0 ? (
          <p className="ed-empty muted">
            {query ? 'Ничего не найдено.' : 'Сцена пуста — добавьте объект.'}
          </p>
        ) : null}
        {rows.map(({ entity, depth }) => {
          const selected = selection.includes(entity.id);
          const hasChildren = entity.childIds.length > 0;
          const isOpen = query !== '' || !collapsed.has(entity.id);
          const dropClass =
            drag && drag.overId === entity.id && drag.id !== entity.id
              ? ` is-drop-${drag.zone}`
              : '';
          return (
            <div
              key={entity.id}
              className={`ed-tree__row${selected ? ' is-selected' : ''}${entity.enabled ? '' : ' is-disabled'}${dropClass}`}
              style={{ '--depth': depth }}
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={selected}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-label={entity.name}
              data-testid={`tree-row-${entity.id}`}
              draggable={ui.layout === 'desktop' && ui.renamingId !== entity.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entity.id);
                setDrag({ id: entity.id, overId: null, zone: 'inside' });
              }}
              onDragEnd={() => setDrag(null)}
              onDragOver={(event) => onDragOver(event, entity)}
              onDrop={(event) => {
                event.preventDefault();
                onDrop(entity);
              }}
              onClick={() => session.select([entity.id])}
              onDoubleClick={() => ui.setRenamingId(entity.id)}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="ed-tree__caret"
                  aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(entity.id);
                  }}
                >
                  {isOpen ? '▾' : '▸'}
                </button>
              ) : (
                <span className="ed-tree__caret" aria-hidden="true" />
              )}
              <EntityGlyph entity={entity} />
              {ui.renamingId === entity.id ? (
                <RenameInput entity={entity} onDone={() => ui.setRenamingId(null)} />
              ) : (
                <span className="ed-tree__name">{entity.name}</span>
              )}
              <button
                type="button"
                className="ed-tree__eye"
                aria-label={
                  entity.enabled ? `Выключить «${entity.name}»` : `Включить «${entity.name}»`
                }
                aria-pressed={!entity.enabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setEntityEnabled(session, entity.id, !entity.enabled);
                }}
              >
                {entity.enabled ? '◉' : '○'}
              </button>
              <div className="ed-menu-anchor">
                <button
                  type="button"
                  className="ed-icon-btn"
                  aria-label={`Действия: ${entity.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuFor === entity.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    session.select([entity.id]);
                    setMenuFor(menuFor === entity.id ? null : entity.id);
                  }}
                >
                  ⋯
                </button>
                {menuFor === entity.id ? (
                  <RowMenu entity={entity} onClose={() => setMenuFor(null)} />
                ) : null}
              </div>
            </div>
          );
        })}
        {drag ? (
          <div
            className="ed-tree__root-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onDrop(null);
            }}
          >
            Перетащите сюда, чтобы вынести в корень сцены
          </div>
        ) : null}
      </div>
      <div className="ed-hierarchy__foot ed-menu-anchor ed-menu-anchor--up">
        <button
          type="button"
          className="btn btn--secondary btn--block"
          aria-expanded={adding}
          onClick={() => setAdding((open) => !open)}
        >
          + Добавить объект
        </button>
        {adding ? (
          <div className="ed-menu" role="menu" aria-label="Добавить объект">
            {presetsFor(document.type).map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAdding(false);
                  addEntity(session, preset.id, { position: ui.placementRef.current });
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
