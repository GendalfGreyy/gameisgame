import type { ProjectDocument, Scene, SceneEntity } from '@tg-creator/project-schema';

export function findScene(document: ProjectDocument, sceneId: string): Scene | undefined {
  return document.scenes.find((scene) => scene.id === sceneId);
}

export function getEntity(scene: Scene, entityId: string): SceneEntity | undefined {
  return Object.hasOwn(scene.entities, entityId) ? scene.entities[entityId] : undefined;
}

/** Ordered sibling list that contains entities with this parent. */
export function siblingIds(scene: Scene, parentId: string | null): readonly string[] {
  if (parentId === null) {
    return scene.rootEntityIds;
  }
  return getEntity(scene, parentId)?.childIds ?? [];
}

/** Pre-order (parent before children) list of the subtree rooted at `entityId`. */
export function collectSubtree(scene: Scene, entityId: string): SceneEntity[] {
  const result: SceneEntity[] = [];
  const stack = [entityId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const entity = getEntity(scene, id);
    if (!entity) {
      continue;
    }
    result.push(entity);
    for (let index = entity.childIds.length - 1; index >= 0; index -= 1) {
      const childId = entity.childIds[index];
      if (childId !== undefined) {
        stack.push(childId);
      }
    }
  }
  return result;
}

/** True when `candidateId` is `ancestorId` itself or lies inside its subtree. */
export function isSelfOrDescendant(scene: Scene, ancestorId: string, candidateId: string): boolean {
  let current: string | null = candidateId;
  const guard = new Set<string>();
  while (current !== null && !guard.has(current)) {
    if (current === ancestorId) {
      return true;
    }
    guard.add(current);
    current = getEntity(scene, current)?.parentId ?? null;
  }
  return false;
}

/** Depth-first visual order of the hierarchy, as shown in the Hierarchy panel. */
export function flattenHierarchy(
  scene: Scene,
  isExpanded: (entityId: string) => boolean = () => true,
): { entity: SceneEntity; depth: number }[] {
  const rows: { entity: SceneEntity; depth: number }[] = [];
  const visit = (ids: readonly string[], depth: number) => {
    for (const id of ids) {
      const entity = getEntity(scene, id);
      if (!entity) {
        continue;
      }
      rows.push({ entity, depth });
      if (entity.childIds.length > 0 && isExpanded(id)) {
        visit(entity.childIds, depth + 1);
      }
    }
  };
  visit(scene.rootEntityIds, 0);
  return rows;
}

export function replaceScene(
  document: ProjectDocument,
  sceneId: string,
  update: (scene: Scene) => Scene,
): ProjectDocument {
  return {
    ...document,
    scenes: document.scenes.map((scene) => (scene.id === sceneId ? update(scene) : scene)),
  };
}

export function insertAt<T>(list: readonly T[], index: number, value: T): T[] {
  const clamped = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, clamped), value, ...list.slice(clamped)];
}

export function withoutValue<T>(list: readonly T[], value: T): T[] {
  return list.filter((item) => item !== value);
}

/** Collects every ID used anywhere in the document (entities, components, pages, graphs…). */
export function collectDocumentIds(document: ProjectDocument): Set<string> {
  const ids = new Set<string>();
  for (const scene of document.scenes) {
    ids.add(scene.id);
    for (const entity of Object.values(scene.entities)) {
      ids.add(entity.id);
      for (const component of entity.components) {
        ids.add(component.id);
      }
    }
  }
  for (const page of document.pages) {
    ids.add(page.id);
    for (const component of Object.values(page.components)) {
      ids.add(component.id);
    }
  }
  for (const graph of document.graphs) {
    ids.add(graph.id);
    for (const node of graph.nodes) {
      ids.add(node.id);
    }
    for (const edge of graph.edges) {
      ids.add(edge.id);
    }
  }
  for (const asset of document.assetRefs) {
    ids.add(asset.id);
  }
  return ids;
}
