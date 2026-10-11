import {
  assetRefSchema,
  componentRecordSchema,
  sceneEntitySchema,
  validateProjectDocument,
  NAME_MAX,
  type AssetRef,
  type ComponentRecord,
  type DocumentIssue,
  type ProjectDocument,
  type Scene,
  type SceneEntity,
} from '@tg-creator/project-schema';

import {
  collectSubtree,
  findScene,
  getEntity,
  insertAt,
  isSelfOrDescendant,
  replaceScene,
  siblingIds,
  withoutValue,
} from './scene.js';

/**
 * Every edit of a ProjectDocument goes through one of these serializable commands.
 * `applyCommand` is pure: it never mutates its input and returns the exact inverse,
 * so Undo is "apply the inverse", not a snapshot restore.
 */
export type EditorCommand =
  | {
      type: 'entity.insert';
      sceneId: string;
      parentId: string | null;
      index: number;
      /** Subtree in pre-order; `entities[0]` is the root and its `parentId` equals `parentId`. */
      entities: SceneEntity[];
    }
  | { type: 'entity.remove'; sceneId: string; entityId: string }
  | { type: 'entity.rename'; sceneId: string; entityId: string; name: string }
  | { type: 'entity.setEnabled'; sceneId: string; entityId: string; enabled: boolean }
  | {
      type: 'entity.move';
      sceneId: string;
      entityId: string;
      parentId: string | null;
      /** Position among the new siblings, counted after the entity left its old place. */
      index: number;
    }
  | {
      type: 'component.add';
      sceneId: string;
      entityId: string;
      index: number;
      component: ComponentRecord;
    }
  | { type: 'component.remove'; sceneId: string; entityId: string; componentId: string }
  | {
      type: 'component.update';
      sceneId: string;
      entityId: string;
      componentId: string;
      /** Full replacement of `data`; validated against the component's Zod schema. */
      data: unknown;
      enabled: boolean;
    }
  | { type: 'asset.add'; index: number; asset: AssetRef }
  | { type: 'asset.remove'; assetId: string }
  /** Several commands as one Undo step, e.g. "register a model and assign it to a mesh". */
  | { type: 'batch'; commands: EditorCommand[] };

export type EditorCommandType = EditorCommand['type'];

export type CommandErrorCode =
  | 'SCENE_NOT_FOUND'
  | 'ENTITY_NOT_FOUND'
  | 'COMPONENT_NOT_FOUND'
  | 'ASSET_NOT_FOUND'
  | 'ASSET_EXISTS'
  | 'INVALID_PARENT'
  | 'REPARENT_CYCLE'
  | 'DUPLICATE_ID'
  | 'COMPONENT_EXISTS'
  | 'COMPONENT_REQUIRED'
  | 'INVALID_NAME'
  | 'INVALID_DATA'
  | 'INTEGRITY';

export type CommandError = {
  code: CommandErrorCode;
  message: string;
  issues?: DocumentIssue[];
};

export type ApplyResult =
  | { ok: true; document: ProjectDocument; inverse: EditorCommand }
  | { ok: false; error: CommandError };

function fail(code: CommandErrorCode, message: string, issues?: DocumentIssue[]): ApplyResult {
  return { ok: false, error: issues ? { code, message, issues } : { code, message } };
}

type SceneContext = { scene: Scene };
type EntityContext = SceneContext & { entity: SceneEntity };

function sceneContext(document: ProjectDocument, sceneId: string): SceneContext | CommandError {
  const scene = findScene(document, sceneId);
  return scene ? { scene } : { code: 'SCENE_NOT_FOUND', message: 'Сцена не найдена' };
}

function entityContext(
  document: ProjectDocument,
  sceneId: string,
  entityId: string,
): EntityContext | CommandError {
  const context = sceneContext(document, sceneId);
  if ('code' in context) {
    return context;
  }
  const entity = getEntity(context.scene, entityId);
  return entity
    ? { scene: context.scene, entity }
    : { code: 'ENTITY_NOT_FOUND', message: 'Объект не найден' };
}

function setSiblings(scene: Scene, parentId: string | null, ids: string[]): Scene {
  if (parentId === null) {
    return { ...scene, rootEntityIds: ids };
  }
  const parent = getEntity(scene, parentId);
  if (!parent) {
    return scene;
  }
  return { ...scene, entities: { ...scene.entities, [parentId]: { ...parent, childIds: ids } } };
}

function updateEntity(
  document: ProjectDocument,
  sceneId: string,
  entity: SceneEntity,
): ProjectDocument {
  return replaceScene(document, sceneId, (scene) => ({
    ...scene,
    entities: { ...scene.entities, [entity.id]: entity },
  }));
}

function applyInsert(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'entity.insert' }>,
): ApplyResult {
  const context = sceneContext(document, command.sceneId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { scene } = context;
  const [root] = command.entities;
  if (!root) {
    return fail('INVALID_DATA', 'Нечего добавлять');
  }
  if (root.parentId !== command.parentId) {
    return fail('INVALID_PARENT', 'Родитель объекта не совпадает с местом вставки');
  }
  if (command.parentId !== null && !getEntity(scene, command.parentId)) {
    return fail('INVALID_PARENT', 'Родительский объект не найден');
  }
  const entities = { ...scene.entities };
  for (const entity of command.entities) {
    if (Object.hasOwn(entities, entity.id)) {
      return fail('DUPLICATE_ID', `ID ${entity.id} уже занят`);
    }
    const parsed = sceneEntitySchema.safeParse(entity);
    if (!parsed.success) {
      return fail('INVALID_DATA', parsed.error.issues[0]?.message ?? 'Некорректный объект');
    }
    entities[entity.id] = parsed.data;
  }
  const withEntities: Scene = { ...scene, entities };
  const siblings = insertAt(siblingIds(withEntities, command.parentId), command.index, root.id);
  const next = setSiblings(withEntities, command.parentId, siblings);
  return {
    ok: true,
    document: replaceScene(document, command.sceneId, () => next),
    inverse: { type: 'entity.remove', sceneId: command.sceneId, entityId: root.id },
  };
}

function applyRemove(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'entity.remove' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { scene, entity } = context;
  const subtree = collectSubtree(scene, entity.id);
  const siblings = siblingIds(scene, entity.parentId);
  const index = siblings.indexOf(entity.id);
  const entities = { ...scene.entities };
  for (const removed of subtree) {
    delete entities[removed.id];
  }
  const next = setSiblings(
    { ...scene, entities },
    entity.parentId,
    withoutValue(siblings, entity.id),
  );
  return {
    ok: true,
    document: replaceScene(document, command.sceneId, () => next),
    inverse: {
      type: 'entity.insert',
      sceneId: command.sceneId,
      parentId: entity.parentId,
      index: index < 0 ? siblings.length : index,
      entities: subtree,
    },
  };
}

function applyRename(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'entity.rename' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const name = command.name.trim();
  if (name.length === 0 || name.length > NAME_MAX) {
    return fail('INVALID_NAME', `Имя: от 1 до ${NAME_MAX} символов`);
  }
  const { entity } = context;
  return {
    ok: true,
    document: updateEntity(document, command.sceneId, { ...entity, name }),
    inverse: { ...command, name: entity.name },
  };
}

function applySetEnabled(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'entity.setEnabled' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { entity } = context;
  return {
    ok: true,
    document: updateEntity(document, command.sceneId, { ...entity, enabled: command.enabled }),
    inverse: { ...command, enabled: entity.enabled },
  };
}

function applyMove(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'entity.move' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { scene, entity } = context;
  if (command.parentId !== null) {
    if (!getEntity(scene, command.parentId)) {
      return fail('INVALID_PARENT', 'Новый родитель не найден');
    }
    if (isSelfOrDescendant(scene, entity.id, command.parentId)) {
      return fail('REPARENT_CYCLE', 'Нельзя вложить объект в самого себя или в своего потомка');
    }
  }
  const oldSiblings = siblingIds(scene, entity.parentId);
  const oldIndex = oldSiblings.indexOf(entity.id);
  let next = setSiblings(scene, entity.parentId, withoutValue(oldSiblings, entity.id));
  next = setSiblings(
    next,
    command.parentId,
    insertAt(siblingIds(next, command.parentId), command.index, entity.id),
  );
  const moved = getEntity(next, entity.id) ?? entity;
  next = {
    ...next,
    entities: { ...next.entities, [entity.id]: { ...moved, parentId: command.parentId } },
  };
  return {
    ok: true,
    document: replaceScene(document, command.sceneId, () => next),
    inverse: {
      ...command,
      parentId: entity.parentId,
      index: oldIndex < 0 ? oldSiblings.length : oldIndex,
    },
  };
}

function applyComponentAdd(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'component.add' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { entity } = context;
  const parsed = componentRecordSchema.safeParse(command.component);
  if (!parsed.success) {
    return fail('INVALID_DATA', parsed.error.issues[0]?.message ?? 'Некорректный компонент');
  }
  if (entity.components.some((component) => component.type === parsed.data.type)) {
    return fail('COMPONENT_EXISTS', 'Такой компонент уже есть у объекта');
  }
  return {
    ok: true,
    document: updateEntity(document, command.sceneId, {
      ...entity,
      components: insertAt(entity.components, command.index, parsed.data),
    }),
    inverse: {
      type: 'component.remove',
      sceneId: command.sceneId,
      entityId: command.entityId,
      componentId: parsed.data.id,
    },
  };
}

function applyComponentRemove(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'component.remove' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { entity } = context;
  const index = entity.components.findIndex((component) => component.id === command.componentId);
  const component = entity.components[index];
  if (!component) {
    return fail('COMPONENT_NOT_FOUND', 'Компонент не найден');
  }
  if (component.type === 'transform') {
    return fail('COMPONENT_REQUIRED', 'Transform нельзя удалить');
  }
  return {
    ok: true,
    document: updateEntity(document, command.sceneId, {
      ...entity,
      components: entity.components.filter((item) => item.id !== component.id),
    }),
    inverse: {
      type: 'component.add',
      sceneId: command.sceneId,
      entityId: command.entityId,
      index,
      component,
    },
  };
}

function applyComponentUpdate(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'component.update' }>,
): ApplyResult {
  const context = entityContext(document, command.sceneId, command.entityId);
  if ('code' in context) {
    return { ok: false, error: context };
  }
  const { entity } = context;
  const component = entity.components.find((item) => item.id === command.componentId);
  if (!component) {
    return fail('COMPONENT_NOT_FOUND', 'Компонент не найден');
  }
  const parsed = componentRecordSchema.safeParse({
    ...component,
    data: command.data,
    enabled: command.enabled,
  });
  if (!parsed.success) {
    return fail('INVALID_DATA', parsed.error.issues[0]?.message ?? 'Некорректное значение');
  }
  if (parsed.data.type !== component.type) {
    return fail('INVALID_DATA', 'Тип компонента менять нельзя');
  }
  return {
    ok: true,
    document: updateEntity(document, command.sceneId, {
      ...entity,
      components: entity.components.map((item) => (item.id === component.id ? parsed.data : item)),
    }),
    inverse: { ...command, data: component.data, enabled: component.enabled },
  };
}

function applyAssetAdd(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'asset.add' }>,
): ApplyResult {
  const parsed = assetRefSchema.safeParse(command.asset);
  if (!parsed.success) {
    return fail('INVALID_DATA', parsed.error.issues[0]?.message ?? 'Некорректный ассет');
  }
  if (document.assetRefs.some((asset) => asset.id === parsed.data.id)) {
    return fail('ASSET_EXISTS', 'Ассет уже подключён к проекту');
  }
  return {
    ok: true,
    document: { ...document, assetRefs: insertAt(document.assetRefs, command.index, parsed.data) },
    inverse: { type: 'asset.remove', assetId: parsed.data.id },
  };
}

function applyAssetRemove(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'asset.remove' }>,
): ApplyResult {
  const index = document.assetRefs.findIndex((asset) => asset.id === command.assetId);
  const asset = document.assetRefs[index];
  if (!asset) {
    return fail('ASSET_NOT_FOUND', 'Ассет не найден');
  }
  return {
    ok: true,
    document: {
      ...document,
      assetRefs: document.assetRefs.filter((item) => item.id !== command.assetId),
    },
    inverse: { type: 'asset.add', index, asset },
  };
}

function applyBatch(
  document: ProjectDocument,
  command: Extract<EditorCommand, { type: 'batch' }>,
): ApplyResult {
  let current = document;
  const inverses: EditorCommand[] = [];
  for (const step of command.commands) {
    const result = applyUnchecked(current, step);
    if (!result.ok) {
      return result;
    }
    current = result.document;
    inverses.unshift(result.inverse);
  }
  return { ok: true, document: current, inverse: { type: 'batch', commands: inverses } };
}

function applyUnchecked(document: ProjectDocument, command: EditorCommand): ApplyResult {
  switch (command.type) {
    case 'entity.insert':
      return applyInsert(document, command);
    case 'entity.remove':
      return applyRemove(document, command);
    case 'entity.rename':
      return applyRename(document, command);
    case 'entity.setEnabled':
      return applySetEnabled(document, command);
    case 'entity.move':
      return applyMove(document, command);
    case 'component.add':
      return applyComponentAdd(document, command);
    case 'component.remove':
      return applyComponentRemove(document, command);
    case 'component.update':
      return applyComponentUpdate(document, command);
    case 'asset.add':
      return applyAssetAdd(document, command);
    case 'asset.remove':
      return applyAssetRemove(document, command);
    case 'batch':
      return applyBatch(document, command);
  }
}

export type ApplyOptions = {
  /**
   * Re-run the full project-schema integrity check on the result. On by default so a
   * command can never produce a document the server would reject with 422.
   */
  validate?: boolean;
};

export function applyCommand(
  document: ProjectDocument,
  command: EditorCommand,
  options: ApplyOptions = {},
): ApplyResult {
  const result = applyUnchecked(document, command);
  if (!result.ok || options.validate === false) {
    return result;
  }
  const issues = validateProjectDocument(result.document);
  if (issues.length > 0) {
    return fail('INTEGRITY', issues[0]?.message ?? 'Документ стал некорректным', issues);
  }
  return result;
}
