import {
  COMPONENT_LABELS,
  activeScene,
  addComponentCommand,
  addableComponentTypes,
  cameraDataForProjection,
  componentProperties,
  getEntity,
  setComponentEnabledCommand,
  updateComponentCommand,
  type PropertyDescriptor,
} from '@tg-creator/editor-core';
import {
  COMPONENT_DEFAULTS,
  type ComponentRecord,
  type ProjectDocument,
  type SceneEntity,
} from '@tg-creator/project-schema';
import { useState } from 'react';

import { renameEntity, setEntityEnabled } from './actions.js';
import { useEditorState, useEditorUi, useSession } from './context.js';
import { BooleanField, ColorField, NumberField, SelectField, VectorField } from './fields.js';

/** In-memory "Copy/Paste component" buffer (docs/02 §4, Inspector). */
let componentClipboard: ComponentRecord | null = null;

function readField(component: ComponentRecord, key: string): unknown {
  const data: object = component.data;
  return Object.hasOwn(data, key) ? Reflect.get(data, key) : undefined;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function PropertyControl({
  descriptor,
  component,
  document,
  update,
}: {
  descriptor: PropertyDescriptor;
  component: ComponentRecord;
  document: ProjectDocument;
  update: (patch: Record<string, unknown>, label: string) => boolean;
}) {
  const value = readField(component, descriptor.key);
  const { control, label } = descriptor;
  const commit = (next: unknown) => update({ [descriptor.key]: next }, label);

  switch (control.kind) {
    case 'vec3':
    case 'vec2':
      return isNumberArray(value) ? (
        <VectorField
          label={label}
          value={value}
          step={control.step}
          testId={`prop-${component.type}-${descriptor.key}`}
          onCommit={commit}
        />
      ) : null;
    case 'number':
      return typeof value === 'number' ? (
        <NumberField
          label={label}
          value={value}
          step={control.step}
          min={control.min}
          max={control.max}
          integer={control.integer}
          testId={`prop-${component.type}-${descriptor.key}`}
          onCommit={commit}
        />
      ) : null;
    case 'color':
      return typeof value === 'string' ? (
        <ColorField label={label} value={value} onCommit={commit} />
      ) : null;
    case 'boolean':
      return typeof value === 'boolean' ? (
        <BooleanField label={label} value={value} onCommit={commit} />
      ) : null;
    case 'enum':
      if (typeof value !== 'string') {
        return null;
      }
      return (
        <SelectField
          label={label}
          value={value}
          options={control.options}
          onCommit={(next) => {
            if (
              component.type === 'camera' &&
              (next === 'perspective' || next === 'orthographic')
            ) {
              return update(cameraDataForProjection(component.data, next), label);
            }
            return commit(next);
          }}
        />
      );
    case 'asset': {
      const assets = document.assetRefs.filter((asset) => asset.kind === control.assetKind);
      return (
        <SelectField
          label={label}
          value={typeof value === 'string' ? value : ''}
          disabled={assets.length === 0 && value === null}
          options={[
            {
              value: '',
              label: assets.length === 0 ? 'Нет ассетов (загрузка — G5)' : 'Не выбрано',
            },
            ...assets.map((asset) => ({
              value: asset.id,
              label: `${asset.id} · v${asset.version}`,
            })),
          ]}
          onCommit={(next) => commit(next === '' ? null : next)}
        />
      );
    }
    case 'graph':
      return (
        <SelectField
          label={label}
          value={typeof value === 'string' ? value : ''}
          options={document.graphs.map((graph) => ({ value: graph.id, label: graph.name }))}
          onCommit={commit}
        />
      );
  }
}

function ComponentSection({
  entity,
  component,
  document,
  sceneId,
}: {
  entity: SceneEntity;
  component: ComponentRecord;
  document: ProjectDocument;
  sceneId: string;
}) {
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = COMPONENT_LABELS[component.type];

  const update = (patch: Record<string, unknown>, label: string) =>
    session.dispatch(updateComponentCommand(sceneId, entity.id, component, patch), {
      label: `${title}: ${label} — «${entity.name}»`,
    }).ok;

  const replaceData = (data: unknown, label: string) =>
    session.dispatch(
      {
        type: 'component.update',
        sceneId,
        entityId: entity.id,
        componentId: component.id,
        data,
        enabled: component.enabled,
      },
      { label: `${title}: ${label} — «${entity.name}»` },
    ).ok;

  const pasteable =
    componentClipboard !== null &&
    componentClipboard.type === component.type &&
    componentClipboard.id !== component.id;

  return (
    <section className="ed-comp" aria-label={title} data-testid={`component-${component.type}`}>
      <header className="ed-comp__head">
        {component.type === 'transform' ? null : (
          <input
            type="checkbox"
            role="switch"
            className="ed-switch ed-switch--small"
            aria-label={`${title}: включён`}
            checked={component.enabled}
            onChange={(event) =>
              session.dispatch(
                setComponentEnabledCommand(sceneId, entity.id, component, event.target.checked),
                {
                  label: `${event.target.checked ? 'Включить' : 'Выключить'} ${title} — «${entity.name}»`,
                },
              )
            }
          />
        )}
        <h3 className="ed-comp__title">{title}</h3>
        <div className="ed-menu-anchor">
          <button
            type="button"
            className="ed-icon-btn"
            aria-label={`Действия: ${title}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className="ed-menu" role="menu" onClick={() => setMenuOpen(false)}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const defaults =
                    component.type === 'camera'
                      ? cameraDataForProjection(
                          COMPONENT_DEFAULTS.camera,
                          component.data.projection,
                        )
                      : COMPONENT_DEFAULTS[component.type];
                  replaceData(defaults, 'сброс');
                }}
              >
                Сбросить значения
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  componentClipboard = component;
                }}
              >
                Копировать значения
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!pasteable}
                onClick={() => {
                  if (componentClipboard && pasteable) {
                    replaceData(componentClipboard.data, 'вставка');
                  }
                }}
              >
                Вставить значения
              </button>
              {component.type === 'transform' ? null : (
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() =>
                    session.dispatch(
                      {
                        type: 'component.remove',
                        sceneId,
                        entityId: entity.id,
                        componentId: component.id,
                      },
                      { label: `Удалить ${title} — «${entity.name}»` },
                    )
                  }
                >
                  Удалить компонент
                </button>
              )}
            </div>
          ) : null}
        </div>
      </header>
      <div className="ed-comp__body">
        {componentProperties(component).map((descriptor) => (
          <PropertyControl
            key={descriptor.key}
            descriptor={descriptor}
            component={component}
            document={document}
            update={update}
          />
        ))}
      </div>
    </section>
  );
}

function NameField({ entity }: { entity: SceneEntity }) {
  const session = useSession();
  const [draft, setDraft] = useState(entity.name);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const shown = editing ? draft : entity.name;

  return (
    <input
      className={`ed-name${invalid ? ' is-invalid' : ''}`}
      aria-label="Имя объекта"
      data-testid="inspector-name"
      value={shown}
      maxLength={120}
      enterKeyHint="done"
      onFocus={() => {
        setDraft(entity.name);
        setEditing(true);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        setInvalid(!renameEntity(session, entity.id, draft));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(entity.name);
          setInvalid(false);
          setEditing(false);
          requestAnimationFrame(() => event.currentTarget.blur());
        }
      }}
    />
  );
}

export function Inspector() {
  const session = useSession();
  const ui = useEditorUi();
  const document = useEditorState((state) => state.document);
  const sceneId = useEditorState((state) => state.sceneId);
  const selection = useEditorState((state) => state.selection);
  const scene = useEditorState(activeScene);
  const [adding, setAdding] = useState(false);

  const entityId = selection.at(-1);
  const entity = scene && entityId ? getEntity(scene, entityId) : undefined;

  if (!entity || sceneId === null) {
    return (
      <div className="ed-empty" data-testid="inspector-empty">
        <p>Ничего не выбрано.</p>
        <p className="muted">
          {ui.layout === 'desktop'
            ? 'Выберите объект в иерархии или на схеме сцены.'
            : 'Коснитесь объекта на схеме или откройте «Объекты».'}
        </p>
      </div>
    );
  }

  const addable = addableComponentTypes(document, entity);

  return (
    <div className="ed-inspector" data-testid="inspector">
      <div className="ed-inspector__head">
        <input
          type="checkbox"
          role="switch"
          className="ed-switch"
          aria-label="Объект включён"
          checked={entity.enabled}
          onChange={(event) => setEntityEnabled(session, entity.id, event.target.checked)}
        />
        <NameField key={entity.id} entity={entity} />
      </div>
      {entity.components.map((component) => (
        <ComponentSection
          key={component.id}
          entity={entity}
          component={component}
          document={document}
          sceneId={sceneId}
        />
      ))}
      {addable.length > 0 ? (
        <div className="ed-add-comp">
          <button
            type="button"
            className="btn btn--secondary btn--block"
            aria-expanded={adding}
            onClick={() => setAdding((open) => !open)}
          >
            + Добавить компонент
          </button>
          {adding ? (
            <div className="ed-add-comp__list" role="menu" aria-label="Компоненты">
              {addable.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  className="ed-chip"
                  onClick={() => {
                    setAdding(false);
                    session.dispatch(
                      addComponentCommand(document, sceneId, entity, type, session.ids),
                      { label: `Добавить ${COMPONENT_LABELS[type]} — «${entity.name}»` },
                    );
                  }}
                >
                  {COMPONENT_LABELS[type]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
