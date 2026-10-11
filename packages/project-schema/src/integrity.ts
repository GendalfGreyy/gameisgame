import type { AppPage, AssetKind, ProjectDocument, Scene } from './v2.js';
import { CONTAINER_WIDGETS } from './v2.js';

/** docs/06 codes a broken document maps to. */
export type DocumentErrorCode = 'SCHEMA_INVALID' | 'GRAPH_BROKEN_REF' | 'HIERARCHY_CYCLE';

/** Addressed like `POST /projects/:id/validate` results (docs/04 §4). */
export type DocumentIssue = {
  code: DocumentErrorCode;
  path: Array<string | number>;
  message: string;
  sceneId?: string;
  entityId?: string;
  pageId?: string;
  componentId?: string;
  graphId?: string;
  nodeId?: string;
};

export const MAX_REPORTED_ISSUES = 100;

class IssueList {
  readonly items: DocumentIssue[] = [];

  add(issue: DocumentIssue): void {
    if (this.items.length < MAX_REPORTED_ISSUES) {
      this.items.push(issue);
    }
  }
}

function checkUniqueIds(document: ProjectDocument, issues: IssueList): void {
  const seen = new Map<string, string>();
  const claim = (id: string, path: Array<string | number>) => {
    const where = path.join('.');
    const first = seen.get(id);
    if (first !== undefined) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path,
        message: `ID «${id}» уже используется (${first})`,
      });
      return;
    }
    seen.set(id, where);
  };

  document.scenes.forEach((scene, s) => {
    claim(scene.id, ['scenes', s, 'id']);
    for (const [key, entity] of Object.entries(scene.entities)) {
      claim(entity.id, ['scenes', s, 'entities', key, 'id']);
      entity.components.forEach((component, c) =>
        claim(component.id, ['scenes', s, 'entities', key, 'components', c, 'id']),
      );
    }
  });
  document.pages.forEach((page, p) => {
    claim(page.id, ['pages', p, 'id']);
    for (const [key, component] of Object.entries(page.components)) {
      claim(component.id, ['pages', p, 'components', key, 'id']);
    }
  });
  document.graphs.forEach((graph, g) => {
    claim(graph.id, ['graphs', g, 'id']);
    graph.nodes.forEach((node, n) => claim(node.id, ['graphs', g, 'nodes', n, 'id']));
    graph.edges.forEach((edge, e) => claim(edge.id, ['graphs', g, 'edges', e, 'id']));
  });
  document.assetRefs.forEach((asset, a) => claim(asset.id, ['assetRefs', a, 'id']));
}

function checkScene(
  scene: Scene,
  s: number,
  context: { assets: Map<string, AssetKind>; graphIds: Set<string> },
  issues: IssueList,
): void {
  const base = ['scenes', s];
  const entities = scene.entities;
  const has = (id: string) => Object.prototype.hasOwnProperty.call(entities, id);

  for (const [key, entity] of Object.entries(entities)) {
    const path = [...base, 'entities', key];
    const at = { sceneId: scene.id, entityId: entity.id };
    if (entity.id !== key) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path: [...path, 'id'],
        message: `Ключ «${key}» не совпадает с ID объекта «${entity.id}»`,
        ...at,
      });
    }

    if (entity.parentId !== null) {
      if (entity.parentId === entity.id) {
        issues.add({
          code: 'HIERARCHY_CYCLE',
          path: [...path, 'parentId'],
          message: `Объект «${entity.name}» указан родителем самого себя`,
          ...at,
        });
      } else if (!has(entity.parentId)) {
        issues.add({
          code: 'GRAPH_BROKEN_REF',
          path: [...path, 'parentId'],
          message: `Родитель «${entity.parentId}» объекта «${entity.name}» не найден`,
          ...at,
        });
      } else if (!entities[entity.parentId]?.childIds.includes(entity.id)) {
        issues.add({
          code: 'SCHEMA_INVALID',
          path: [...path, 'parentId'],
          message: `Родитель «${entity.parentId}» не содержит «${entity.id}» в childIds`,
          ...at,
        });
      }
    }

    const seenChildren = new Set<string>();
    entity.childIds.forEach((childId, c) => {
      const childPath = [...path, 'childIds', c];
      if (seenChildren.has(childId)) {
        issues.add({
          code: 'SCHEMA_INVALID',
          path: childPath,
          message: `Дочерний объект «${childId}» указан дважды`,
          ...at,
        });
        return;
      }
      seenChildren.add(childId);
      const child = entities[childId];
      if (!child) {
        issues.add({
          code: 'GRAPH_BROKEN_REF',
          path: childPath,
          message: `Дочерний объект «${childId}» не найден`,
          ...at,
        });
      } else if (child.parentId !== entity.id) {
        issues.add({
          code: 'SCHEMA_INVALID',
          path: childPath,
          message: `У «${childId}» другой parentId, чем у списка детей «${entity.id}»`,
          ...at,
        });
      }
    });

    const types = new Set<string>();
    entity.components.forEach((component, c) => {
      const componentPath = [...path, 'components', c];
      if (types.has(component.type)) {
        issues.add({
          code: 'SCHEMA_INVALID',
          path: [...componentPath, 'type'],
          message: `Компонент «${component.type}» добавлен дважды`,
          ...at,
        });
      }
      types.add(component.type);

      const assetRef = (assetId: string | null, kind: AssetKind) => {
        if (assetId === null) {
          return;
        }
        const actual = context.assets.get(assetId);
        if (actual === undefined) {
          issues.add({
            code: 'GRAPH_BROKEN_REF',
            path: [...componentPath, 'data', 'assetId'],
            message: `Ресурс «${assetId}» не найден в assetRefs`,
            ...at,
          });
        } else if (actual !== kind) {
          issues.add({
            code: 'SCHEMA_INVALID',
            path: [...componentPath, 'data', 'assetId'],
            message: `Ресурс «${assetId}» имеет тип ${actual}, нужен ${kind}`,
            ...at,
          });
        }
      };
      if (component.type === 'mesh') {
        assetRef(component.data.assetId, 'model');
      } else if (component.type === 'sprite') {
        assetRef(component.data.assetId, 'image');
      } else if (component.type === 'audio') {
        assetRef(component.data.assetId, 'audio');
      } else if (
        component.type === 'scriptGraph' &&
        !context.graphIds.has(component.data.graphId)
      ) {
        issues.add({
          code: 'GRAPH_BROKEN_REF',
          path: [...componentPath, 'data', 'graphId'],
          message: `Граф «${component.data.graphId}» не найден`,
          ...at,
        });
      }
    });
  }

  const roots = new Set<string>();
  scene.rootEntityIds.forEach((rootId, r) => {
    const path = [...base, 'rootEntityIds', r];
    const root = entities[rootId];
    if (roots.has(rootId)) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path,
        message: `Корневой объект «${rootId}» указан дважды`,
        sceneId: scene.id,
      });
    } else if (!root) {
      issues.add({
        code: 'GRAPH_BROKEN_REF',
        path,
        message: `Корневой объект «${rootId}» не найден`,
        sceneId: scene.id,
      });
    } else if (root.parentId !== null) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path,
        message: `«${rootId}» в корне, но у него есть родитель`,
        sceneId: scene.id,
        entityId: rootId,
      });
    }
    roots.add(rootId);
  });
  for (const entity of Object.values(entities)) {
    if (entity.parentId === null && !roots.has(entity.id)) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path: [...base, 'rootEntityIds'],
        message: `Объект без родителя «${entity.id}» отсутствует в rootEntityIds`,
        sceneId: scene.id,
        entityId: entity.id,
      });
    }
  }

  // Walk each parent chain; a chain that revisits itself is a cycle.
  const state = new Map<string, 'visiting' | 'done'>();
  for (const start of Object.keys(entities)) {
    const chain: string[] = [];
    let current: string | null = start;
    while (current !== null && has(current) && state.get(current) !== 'done') {
      if (state.get(current) === 'visiting') {
        const cycleStart = current;
        issues.add({
          code: 'HIERARCHY_CYCLE',
          path: [...base, 'entities', cycleStart, 'parentId'],
          message: `Цикл в иерархии: ${[...chain.slice(chain.indexOf(cycleStart)), cycleStart].join(' → ')}`,
          sceneId: scene.id,
          entityId: cycleStart,
        });
        break;
      }
      state.set(current, 'visiting');
      chain.push(current);
      const parentId: string | null = entities[current]?.parentId ?? null;
      current = parentId === current ? null : parentId;
    }
    for (const id of chain) {
      state.set(id, 'done');
    }
  }
}

function checkPage(
  page: AppPage,
  p: number,
  context: { pageIds: Set<string>; assets: Map<string, AssetKind> },
  issues: IssueList,
): void {
  const base = ['pages', p];
  const components = page.components;
  const parents = new Map<string, string>();

  for (const [key, component] of Object.entries(components)) {
    const path = [...base, 'components', key];
    const at = { pageId: page.id, componentId: component.id };
    if (component.id !== key) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path: [...path, 'id'],
        message: `Ключ «${key}» не совпадает с ID компонента «${component.id}»`,
        ...at,
      });
    }
    if (!CONTAINER_WIDGETS.has(component.type) && component.childIds.length > 0) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path: [...path, 'childIds'],
        message: `Компонент «${component.type}» не может содержать вложенные элементы`,
        ...at,
      });
    }
    component.childIds.forEach((childId, c) => {
      if (!components[childId]) {
        issues.add({
          code: 'GRAPH_BROKEN_REF',
          path: [...path, 'childIds', c],
          message: `Вложенный компонент «${childId}» не найден`,
          ...at,
        });
        return;
      }
      const otherParent = parents.get(childId);
      if (otherParent !== undefined) {
        issues.add({
          code: 'SCHEMA_INVALID',
          path: [...path, 'childIds', c],
          message: `Компонент «${childId}» уже вложен в «${otherParent}»`,
          ...at,
        });
        return;
      }
      parents.set(childId, component.id);
    });
    if (component.type === 'button' && component.props.action.kind === 'navigate') {
      if (!context.pageIds.has(component.props.action.pageId)) {
        issues.add({
          code: 'GRAPH_BROKEN_REF',
          path: [...path, 'props', 'action', 'pageId'],
          message: `Страница «${component.props.action.pageId}» для перехода не найдена`,
          ...at,
        });
      }
    }
    if (component.type === 'image' && component.props.assetId !== null) {
      const kind = context.assets.get(component.props.assetId);
      if (kind !== 'image') {
        issues.add({
          code: kind === undefined ? 'GRAPH_BROKEN_REF' : 'SCHEMA_INVALID',
          path: [...path, 'props', 'assetId'],
          message: `Изображение «${component.props.assetId}» не найдено среди ресурсов`,
          ...at,
        });
      }
    }
  }

  const root = components[page.rootComponentId];
  if (!root) {
    issues.add({
      code: 'GRAPH_BROKEN_REF',
      path: [...base, 'rootComponentId'],
      message: `Корневой компонент «${page.rootComponentId}» не найден`,
      pageId: page.id,
    });
    return;
  }
  if (!CONTAINER_WIDGETS.has(root.type)) {
    issues.add({
      code: 'SCHEMA_INVALID',
      path: [...base, 'rootComponentId'],
      message: 'Корень страницы должен быть контейнером',
      pageId: page.id,
    });
  }

  // DFS from the root: a back edge is a cycle, anything unvisited is detached.
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): void => {
    state.set(id, 'visiting');
    for (const childId of components[id]?.childIds ?? []) {
      const childState = state.get(childId);
      if (childState === 'visiting') {
        issues.add({
          code: 'HIERARCHY_CYCLE',
          path: [...base, 'components', id, 'childIds'],
          message: `Цикл вложенности: «${childId}» содержит сам себя`,
          pageId: page.id,
          componentId: childId,
        });
      } else if (childState === undefined && components[childId]) {
        visit(childId);
      }
    }
    state.set(id, 'done');
  };
  visit(root.id);
  for (const id of Object.keys(components)) {
    if (!state.has(id)) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path: [...base, 'components', id],
        message: `Компонент «${id}» не связан с корнем страницы`,
        pageId: page.id,
        componentId: id,
      });
    }
  }
}

/**
 * Cross-reference checks Zod cannot express. Returns an empty list for a consistent document.
 * The same function runs in Studio (before save), API (PUT draft, publish) and Player.
 */
export function validateProjectDocument(document: ProjectDocument): DocumentIssue[] {
  const issues = new IssueList();
  checkUniqueIds(document, issues);

  const sceneIds = new Set(document.scenes.map((scene) => scene.id));
  if (document.type === 'app') {
    if (document.pages.length === 0) {
      issues.add({ code: 'SCHEMA_INVALID', path: ['pages'], message: 'В приложении нет страниц' });
    }
  } else if (document.entrySceneId === null) {
    issues.add({
      code: 'SCHEMA_INVALID',
      path: ['entrySceneId'],
      message: 'У игры должна быть стартовая сцена',
    });
  }
  if (document.entrySceneId !== null && !sceneIds.has(document.entrySceneId)) {
    issues.add({
      code: 'GRAPH_BROKEN_REF',
      path: ['entrySceneId'],
      message: `Стартовая сцена «${document.entrySceneId}» не найдена`,
    });
  }

  const assets = new Map(document.assetRefs.map((asset) => [asset.id, asset.kind]));
  const graphIds = new Set(document.graphs.map((graph) => graph.id));
  document.scenes.forEach((scene, s) => checkScene(scene, s, { assets, graphIds }, issues));

  const pageIds = new Set(document.pages.map((page) => page.id));
  const routes = new Map<string, string>();
  document.pages.forEach((page, p) => {
    const other = routes.get(page.route);
    if (other !== undefined) {
      issues.add({
        code: 'SCHEMA_INVALID',
        path: ['pages', p, 'route'],
        message: `Маршрут «${page.route}» уже занят страницей «${other}»`,
        pageId: page.id,
      });
    }
    routes.set(page.route, page.id);
    checkPage(page, p, { pageIds, assets }, issues);
  });

  document.graphs.forEach((graph, g) => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const links = new Set<string>();
    graph.edges.forEach((edge, e) => {
      const path = ['graphs', g, 'edges', e];
      for (const [end, nodeId] of [
        ['sourceNodeId', edge.sourceNodeId],
        ['targetNodeId', edge.targetNodeId],
      ] as const) {
        if (!nodeIds.has(nodeId)) {
          issues.add({
            code: 'GRAPH_BROKEN_REF',
            path: [...path, end],
            message: `Связь «${edge.id}» ссылается на несуществующий узел «${nodeId}»`,
            graphId: graph.id,
            nodeId,
          });
        }
      }
      const link = `${edge.sourceNodeId}:${edge.sourcePort}>${edge.targetNodeId}:${edge.targetPort}`;
      if (links.has(link)) {
        issues.add({
          code: 'SCHEMA_INVALID',
          path,
          message: `Связь «${edge.id}» дублирует существующую`,
          graphId: graph.id,
        });
      }
      links.add(link);
    });
  });

  return issues.items;
}

/** Most specific docs/06 code for a set of issues: cycles, then broken refs, then schema. */
export function documentErrorCode(issues: readonly DocumentIssue[]): DocumentErrorCode {
  if (issues.some((issue) => issue.code === 'HIERARCHY_CYCLE')) {
    return 'HIERARCHY_CYCLE';
  }
  if (issues.some((issue) => issue.code === 'GRAPH_BROKEN_REF')) {
    return 'GRAPH_BROKEN_REF';
  }
  return 'SCHEMA_INVALID';
}
