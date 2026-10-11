import { describe, expect, it } from 'vitest';

import { documentErrorCode, validateProjectDocument } from './integrity.js';
import { parseProjectDocument } from './parse.js';
import { createProjectDocument } from './templates.js';
import { clone, readExample } from './testing.js';
import {
  COMPONENT_DEFAULTS,
  projectDocumentSchema,
  type AppComponent,
  type ProjectDocument,
  type Scene,
} from './v2.js';

function example(): ProjectDocument {
  return projectDocumentSchema.parse(clone(readExample('project-3d.v2.json')));
}

function scene(document: ProjectDocument): Scene {
  const first = document.scenes[0];
  if (!first) {
    throw new Error('example has no scene');
  }
  return first;
}

function app(): ProjectDocument {
  return createProjectDocument({
    id: 'prj_app',
    ownerId: 'usr_1',
    title: 'Приложение',
    type: 'app',
    templateId: 'starter',
    orientation: 'auto',
  });
}

function widgets(document: ProjectDocument): Record<string, AppComponent> {
  const page = document.pages[0];
  if (!page) {
    throw new Error('app has no page');
  }
  return page.components;
}

function codes(document: ProjectDocument): string[] {
  return validateProjectDocument(document).map((issue) => issue.code);
}

describe('validateProjectDocument — scenes', () => {
  it('accepts the example and every template', () => {
    expect(validateProjectDocument(example())).toEqual([]);
    expect(validateProjectDocument(app())).toEqual([]);
  });

  it('missing parentId → GRAPH_BROKEN_REF', () => {
    const document = example();
    const gem = scene(document).entities['entity_cube_gem'];
    if (gem) {
      gem.parentId = 'entity_ghost';
    }
    expect(codes(document)).toContain('GRAPH_BROKEN_REF');
  });

  it('parent cycle → HIERARCHY_CYCLE, reported with the path', () => {
    const document = example();
    const { entities } = scene(document);
    const cube = entities['entity_cube'];
    const gem = entities['entity_cube_gem'];
    if (!cube || !gem) {
      throw new Error('fixture changed');
    }
    cube.parentId = 'entity_cube_gem';
    gem.childIds = ['entity_cube'];
    scene(document).rootEntityIds = scene(document).rootEntityIds.filter(
      (id) => id !== 'entity_cube',
    );
    const issues = validateProjectDocument(document);
    expect(documentErrorCode(issues)).toBe('HIERARCHY_CYCLE');
    expect(issues.find((issue) => issue.code === 'HIERARCHY_CYCLE')?.message).toMatch(/→/);
  });

  it('self parent → HIERARCHY_CYCLE', () => {
    const document = example();
    const gem = scene(document).entities['entity_cube_gem'];
    if (gem) {
      gem.parentId = 'entity_cube_gem';
    }
    expect(codes(document)).toContain('HIERARCHY_CYCLE');
  });

  it('duplicate IDs across the document → SCHEMA_INVALID', () => {
    const document = example();
    const cube = scene(document).entities['entity_cube'];
    const first = cube?.components[0];
    const second = cube?.components[1];
    if (!first || !second) {
      throw new Error('fixture changed');
    }
    second.id = first.id;
    expect(codes(document)).toEqual(['SCHEMA_INVALID']);

    const other = example();
    const graph = other.graphs[0];
    if (graph) {
      graph.id = 'entity_cube';
    }
    expect(codes(other)).toContain('SCHEMA_INVALID');
  });

  it('record key must equal entity id', () => {
    const document = example();
    const { entities } = scene(document);
    const light = entities['entity_light'];
    if (light) {
      light.id = 'entity_sun';
    }
    expect(codes(document)).toContain('SCHEMA_INVALID');
  });

  it('parent/child lists must agree', () => {
    const document = example();
    const cube = scene(document).entities['entity_cube'];
    if (cube) {
      cube.childIds = [];
    }
    expect(codes(document)).toContain('SCHEMA_INVALID');
  });

  it('roots must be exactly the parentless entities', () => {
    const missingRoot = example();
    scene(missingRoot).rootEntityIds = scene(missingRoot).rootEntityIds.slice(1);
    expect(codes(missingRoot)).toContain('SCHEMA_INVALID');

    const childAsRoot = example();
    scene(childAsRoot).rootEntityIds.push('entity_cube_gem');
    expect(codes(childAsRoot)).toContain('SCHEMA_INVALID');

    const ghostRoot = example();
    scene(ghostRoot).rootEntityIds.push('entity_ghost');
    expect(codes(ghostRoot)).toContain('GRAPH_BROKEN_REF');
  });

  it('a component type appears at most once per entity', () => {
    const document = example();
    scene(document).entities['entity_light']?.components.push({
      id: 'cmp_light_2',
      type: 'light',
      enabled: true,
      data: COMPONENT_DEFAULTS.light,
    });
    expect(codes(document)).toContain('SCHEMA_INVALID');
  });

  it('asset and graph references must resolve with the right kind', () => {
    const missingAsset = example();
    const mesh = scene(missingAsset).entities['entity_cube']?.components.find(
      (component) => component.type === 'mesh',
    );
    if (mesh?.type === 'mesh') {
      mesh.data.assetId = 'asset_ghost';
    }
    expect(codes(missingAsset)).toContain('GRAPH_BROKEN_REF');

    const wrongKind = example();
    wrongKind.assetRefs.push({ id: 'asset_song', version: '1', kind: 'audio' });
    const wrongMesh = scene(wrongKind).entities['entity_cube']?.components.find(
      (component) => component.type === 'mesh',
    );
    if (wrongMesh?.type === 'mesh') {
      wrongMesh.data.assetId = 'asset_song';
    }
    expect(codes(wrongKind)).toEqual(['SCHEMA_INVALID']);

    const missingGraph = example();
    missingGraph.graphs = [];
    expect(codes(missingGraph)).toContain('GRAPH_BROKEN_REF');
  });

  it('games need an existing entry scene', () => {
    const none = example();
    none.entrySceneId = null;
    expect(codes(none)).toContain('SCHEMA_INVALID');
    const ghost = example();
    ghost.entrySceneId = 'scene_ghost';
    expect(codes(ghost)).toContain('GRAPH_BROKEN_REF');
  });
});

describe('validateProjectDocument — graphs', () => {
  it('edges must point at nodes of the same graph', () => {
    const document = example();
    const edge = document.graphs[0]?.edges[0];
    if (edge) {
      edge.targetNodeId = 'node_ghost';
    }
    const issues = validateProjectDocument(document);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'GRAPH_BROKEN_REF',
        graphId: 'graph_cube_spin',
        nodeId: 'node_ghost',
      }),
    ]);
  });

  it('duplicate links are rejected', () => {
    const document = example();
    const graph = document.graphs[0];
    const edge = graph?.edges[0];
    if (graph && edge) {
      graph.edges.push({ ...edge, id: 'edge_copy' });
    }
    expect(codes(document)).toEqual(['SCHEMA_INVALID']);
  });
});

describe('validateProjectDocument — app pages', () => {
  it('missing child → GRAPH_BROKEN_REF', () => {
    const document = app();
    const root = widgets(document)['cmp_root'];
    root?.childIds.push('cmp_ghost');
    expect(codes(document)).toContain('GRAPH_BROKEN_REF');
  });

  it('nesting cycle → HIERARCHY_CYCLE', () => {
    const document = app();
    const components = widgets(document);
    components['cmp_inner'] = {
      id: 'cmp_inner',
      type: 'container',
      props: { direction: 'row', gap: 0, padding: 0 },
      childIds: ['cmp_root'],
    };
    components['cmp_root']?.childIds.push('cmp_inner');
    expect(documentErrorCode(validateProjectDocument(document))).toBe('HIERARCHY_CYCLE');
  });

  it('leaf widgets cannot have children; components must be attached', () => {
    const leaf = app();
    widgets(leaf)['cmp_button']?.childIds.push('cmp_text');
    expect(codes(leaf)).toContain('SCHEMA_INVALID');

    const detached = app();
    const components = widgets(detached);
    const root = components['cmp_root'];
    if (root) {
      root.childIds = root.childIds.filter((id) => id !== 'cmp_text');
    }
    expect(codes(detached)).toEqual(['SCHEMA_INVALID']);
  });

  it('navigate actions must target an existing page; routes are unique', () => {
    const navigate = app();
    const button = widgets(navigate)['cmp_button'];
    if (button?.type === 'button') {
      button.props.action = { kind: 'navigate', pageId: 'page_ghost' };
    }
    expect(codes(navigate)).toContain('GRAPH_BROKEN_REF');

    const routes = app();
    const home = routes.pages[0];
    if (home) {
      routes.pages.push({
        ...clone(home),
        id: 'page_copy',
        components: {},
        rootComponentId: 'cmp_copy_root',
      });
    }
    const copy = routes.pages[1];
    if (copy) {
      copy.components['cmp_copy_root'] = {
        id: 'cmp_copy_root',
        type: 'container',
        props: { direction: 'column', gap: 0, padding: 0 },
        childIds: [],
      };
    }
    expect(codes(routes)).toEqual(['SCHEMA_INVALID']);
  });
});

describe('parseProjectDocument', () => {
  it('maps the most specific code and keeps addressing', () => {
    const document = example();
    const gem = scene(document).entities['entity_cube_gem'];
    if (gem) {
      gem.parentId = 'entity_ghost';
    }
    const parsed = parseProjectDocument(document);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe('GRAPH_BROKEN_REF');
      expect(parsed.issues.find((issue) => issue.code === 'GRAPH_BROKEN_REF')).toMatchObject({
        sceneId: 'scene_main',
        entityId: 'entity_cube_gem',
        path: ['scenes', 0, 'entities', 'entity_cube_gem', 'parentId'],
      });
    }
  });
});
