import {
  applyCommand,
  createEntityCommand,
  createSequentialIdGenerator,
  duplicateEntityCommand,
  findComponent,
  setTransformCommand,
  updateComponentCommand,
  type EditorCommand,
} from '@tg-creator/editor-core';
import {
  createProjectDocument,
  type ProjectDocument,
  type Scene,
} from '@tg-creator/project-schema';
import { describe, expect, it } from 'vitest';

import {
  SceneSync,
  type CameraData,
  type LightData,
  type MeshSpec,
  type SceneBackend,
  type TransformData,
} from './sync.js';

type NodeState = {
  name: string;
  parent: string | null;
  enabled: boolean;
  transform: TransformData | null;
  mesh: MeshSpec | null;
  light: LightData | null;
  camera: CameraData | null;
};

/** Records calls and keeps the resulting state; throws on calls a real engine could not do. */
class FakeBackend implements SceneBackend {
  readonly nodes = new Map<string, NodeState>();
  readonly calls: string[] = [];

  private get(id: string): NodeState {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`unknown node ${id}`);
    return node;
  }

  createNode(id: string, name: string): void {
    if (this.nodes.has(id)) throw new Error(`duplicate node ${id}`);
    this.calls.push(`create:${id}`);
    this.nodes.set(id, {
      name,
      parent: null,
      enabled: true,
      transform: null,
      mesh: null,
      light: null,
      camera: null,
    });
  }
  removeNode(id: string): void {
    this.get(id);
    for (const [childId, node] of this.nodes) {
      if (node.parent === id) throw new Error(`removing ${id} before its child ${childId}`);
    }
    this.calls.push(`remove:${id}`);
    this.nodes.delete(id);
  }
  setParent(id: string, parentId: string | null): void {
    if (parentId !== null) this.get(parentId);
    this.calls.push(`parent:${id}:${parentId ?? 'root'}`);
    this.get(id).parent = parentId;
  }
  setName(id: string, name: string): void {
    this.calls.push(`name:${id}`);
    this.get(id).name = name;
  }
  setEnabled(id: string, enabled: boolean): void {
    this.calls.push(`enabled:${id}`);
    this.get(id).enabled = enabled;
  }
  setTransform(id: string, transform: TransformData): void {
    this.calls.push(`transform:${id}`);
    this.get(id).transform = transform;
  }
  setMesh(id: string, mesh: MeshSpec | null): void {
    this.calls.push(`mesh:${id}`);
    this.get(id).mesh = mesh;
  }
  setLight(id: string, light: LightData | null): void {
    this.calls.push(`light:${id}`);
    this.get(id).light = light;
  }
  setCamera(id: string, camera: CameraData | null): void {
    this.calls.push(`camera:${id}`);
    this.get(id).camera = camera;
  }
  snapshot(): Record<string, NodeState> {
    return Object.fromEntries([...this.nodes.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }
}

const SCENE = 'scene_main';

function starter(): ProjectDocument {
  return createProjectDocument({
    id: 'prj',
    ownerId: 'usr',
    title: 'Sync',
    type: 'game3d',
    templateId: 'starter',
    orientation: 'auto',
  });
}

function sceneOf(document: ProjectDocument): Scene {
  const scene = document.scenes.find((item) => item.id === SCENE);
  if (!scene) throw new Error('scene missing');
  return scene;
}

function apply(document: ProjectDocument, command: EditorCommand | null) {
  if (!command) throw new Error('no command');
  const result = applyCommand(document, command);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function rebuilt(scene: Scene) {
  const backend = new FakeBackend();
  new SceneSync(backend).apply(scene);
  return backend.snapshot();
}

describe('SceneSync — engine objects mirror the document', () => {
  it('first apply creates parents before children with all components', () => {
    const document = apply(starter(), {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: 'entity_light',
      parentId: 'entity_cube',
      index: 0,
    }).document;
    const backend = new FakeBackend();
    const stats = new SceneSync(backend).apply(sceneOf(document));
    expect(stats.created).toBe(4);
    expect(backend.calls.indexOf('create:entity_cube')).toBeLessThan(
      backend.calls.indexOf('create:entity_light'),
    );
    expect(backend.nodes.get('entity_light')?.parent).toBe('entity_cube');
    expect(backend.nodes.get('entity_cube')?.mesh).toEqual({
      primitive: 'box',
      assetId: null,
      material: expect.objectContaining({ baseColor: '#D4F24A' }),
    });
    expect(backend.nodes.get('entity_light')?.light?.kind).toBe('directional');
    expect(backend.nodes.get('entity_camera')?.camera?.projection).toBe('perspective');
  });

  it('re-applying the same scene does nothing', () => {
    const scene = sceneOf(starter());
    const backend = new FakeBackend();
    const sync = new SceneSync(backend);
    sync.apply(scene);
    const before = backend.calls.length;
    expect(sync.apply(scene)).toEqual({ created: 0, removed: 0, reparented: 0, updated: 0 });
    expect(backend.calls).toHaveLength(before);
  });

  it('a transform edit touches exactly one setter of one entity', () => {
    const document = starter();
    const backend = new FakeBackend();
    const sync = new SceneSync(backend);
    sync.apply(sceneOf(document));
    backend.calls.length = 0;
    const next = apply(
      document,
      setTransformCommand(document, SCENE, 'entity_cube', { position: [2, 1, 0] }),
    ).document;
    expect(sync.apply(sceneOf(next))).toEqual({
      created: 0,
      removed: 0,
      reparented: 0,
      updated: 1,
    });
    expect(backend.calls).toEqual(['transform:entity_cube']);
    expect(backend.nodes.get('entity_cube')?.transform?.position).toEqual([2, 1, 0]);
  });

  it('a material edit updates the mesh of that entity only; disabling hides it', () => {
    const document = starter();
    const backend = new FakeBackend();
    const sync = new SceneSync(backend);
    sync.apply(sceneOf(document));
    backend.calls.length = 0;
    const cube = sceneOf(document).entities['entity_cube'];
    const material = cube ? findComponent(cube, 'material') : undefined;
    if (!material) throw new Error('no material');
    const red = apply(
      document,
      updateComponentCommand(SCENE, 'entity_cube', material, { baseColor: '#FF0000' }),
    ).document;
    sync.apply(sceneOf(red));
    expect(backend.calls).toEqual(['mesh:entity_cube']);
    expect(backend.nodes.get('entity_cube')?.mesh?.material?.baseColor).toBe('#FF0000');

    const redCube = sceneOf(red).entities['entity_cube'];
    const mesh = redCube ? findComponent(redCube, 'mesh') : undefined;
    if (!mesh) throw new Error('no mesh');
    const hidden = apply(red, {
      type: 'component.update',
      sceneId: SCENE,
      entityId: 'entity_cube',
      componentId: mesh.id,
      data: mesh.data,
      enabled: false,
    }).document;
    sync.apply(sceneOf(hidden));
    expect(backend.nodes.get('entity_cube')?.mesh).toBeNull();
  });

  it('removing a subtree removes children first; reparenting re-attaches survivors', () => {
    const ids = createSequentialIdGenerator();
    let document = starter();
    const child = createEntityCommand(
      document,
      { sceneId: SCENE, preset: 'sphere', parentId: 'entity_cube' },
      ids,
    );
    document = apply(document, child).document;
    const backend = new FakeBackend();
    const sync = new SceneSync(backend);
    sync.apply(sceneOf(document));
    const childId = child.entities[0]?.id ?? '';

    const moved = apply(document, {
      type: 'entity.move',
      sceneId: SCENE,
      entityId: childId,
      parentId: null,
      index: 0,
    }).document;
    sync.apply(sceneOf(moved));
    expect(backend.nodes.get(childId)?.parent).toBeNull();

    backend.calls.length = 0;
    const removed = apply(document, {
      type: 'entity.remove',
      sceneId: SCENE,
      entityId: 'entity_cube',
    }).document;
    sync.apply(sceneOf(document));
    sync.apply(sceneOf(removed));
    expect(backend.calls.filter((call) => call.startsWith('remove:'))).toEqual([
      `remove:${childId}`,
      'remove:entity_cube',
    ]);
  });

  it('undo after a burst of edits leaves the engine exactly as before', () => {
    const ids = createSequentialIdGenerator();
    const document = starter();
    const backend = new FakeBackend();
    const sync = new SceneSync(backend);
    sync.apply(sceneOf(document));
    const initial = backend.snapshot();

    const steps: EditorCommand[] = [];
    let current = document;
    const push = (command: EditorCommand | null) => {
      const result = apply(current, command);
      steps.push(result.inverse);
      current = result.document;
      sync.apply(sceneOf(current));
    };
    push(
      setTransformCommand(current, SCENE, 'entity_cube', {
        rotationEuler: [0, 45, 0],
        scale: [2, 1, 1],
      }),
    );
    push(duplicateEntityCommand(current, SCENE, 'entity_cube', ids));
    push({ type: 'entity.setEnabled', sceneId: SCENE, entityId: 'entity_ground', enabled: false });
    push({ type: 'entity.remove', sceneId: SCENE, entityId: 'entity_light' });
    for (const inverse of steps.reverse()) {
      current = apply(current, inverse).document;
      sync.apply(sceneOf(current));
    }
    expect(backend.snapshot()).toEqual(initial);
  });

  it('incremental sync always equals a full rebuild (random command sequences)', () => {
    for (const seed of [1, 7, 42]) {
      let state = seed;
      const random = () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
      const ids = createSequentialIdGenerator();
      let document = starter();
      const backend = new FakeBackend();
      const sync = new SceneSync(backend);
      sync.apply(sceneOf(document));
      const history: EditorCommand[] = [];
      for (let step = 0; step < 120; step += 1) {
        const scene = sceneOf(document);
        const entityIds = Object.keys(scene.entities);
        const pickId = () => entityIds[Math.floor(random() * entityIds.length)] ?? 'entity_cube';
        const roll = random();
        let command: EditorCommand | null = null;
        if (roll < 0.2 || entityIds.length === 0) {
          command = createEntityCommand(
            document,
            {
              sceneId: SCENE,
              preset: random() < 0.5 ? 'box' : 'pointLight',
              parentId: entityIds.length > 0 && random() < 0.4 ? pickId() : null,
            },
            ids,
          );
        } else if (roll < 0.3) {
          command = duplicateEntityCommand(document, SCENE, pickId(), ids);
        } else if (roll < 0.4) {
          command = { type: 'entity.remove', sceneId: SCENE, entityId: pickId() };
        } else if (roll < 0.55) {
          command = {
            type: 'entity.move',
            sceneId: SCENE,
            entityId: pickId(),
            parentId: random() < 0.5 ? null : pickId(),
            index: 0,
          };
        } else if (roll < 0.7) {
          command = {
            type: 'entity.setEnabled',
            sceneId: SCENE,
            entityId: pickId(),
            enabled: random() < 0.5,
          };
        } else if (roll < 0.8 && history.length > 0) {
          command = history.pop() ?? null;
        } else {
          command = setTransformCommand(document, SCENE, pickId(), {
            position: [random() * 10, random() * 3, random() * 10],
          });
        }
        if (!command) continue;
        const result = applyCommand(document, command);
        if (!result.ok) continue; // cycles and the like are rejected by editor-core
        if (roll >= 0.7 && roll < 0.8) {
          // that was an undo — do not push its inverse
        } else {
          history.push(result.inverse);
        }
        document = result.document;
        sync.apply(sceneOf(document));
        expect(backend.snapshot()).toEqual(rebuilt(sceneOf(document)));
      }
    }
  });

  it('clear() removes every node', () => {
    const backend = new FakeBackend();
    const sync = new SceneSync(backend);
    sync.apply(sceneOf(starter()));
    expect(sync.clear().removed).toBe(4);
    expect(backend.nodes.size).toBe(0);
  });
});
