import type {
  ComponentData,
  ComponentRecord,
  ComponentType,
  Scene,
  SceneEntity,
} from '@tg-creator/project-schema';

export type TransformData = ComponentData<'transform'>;
export type MaterialData = ComponentData<'material'>;
export type LightData = ComponentData<'light'>;
export type CameraData = ComponentData<'camera'>;
export type MeshPrimitive = ComponentData<'mesh'>['primitive'];

export type MeshSpec = {
  primitive: MeshPrimitive;
  /** Model asset id; while it loads (or if it fails) the primitive is shown. */
  assetId: string | null;
  /** `null` when the entity has no (enabled) material: the engine default is used. */
  material: MaterialData | null;
};

/**
 * What a renderer must implement to mirror a scene. Engine objects are a projection of the
 * ProjectDocument: they are only ever changed through this interface, driven by `SceneSync`.
 */
export interface SceneBackend {
  createNode(id: string, name: string): void;
  removeNode(id: string): void;
  setParent(id: string, parentId: string | null): void;
  setName(id: string, name: string): void;
  setEnabled(id: string, enabled: boolean): void;
  setTransform(id: string, transform: TransformData): void;
  setMesh(id: string, mesh: MeshSpec | null): void;
  setLight(id: string, light: LightData | null): void;
  setCamera(id: string, camera: CameraData | null): void;
}

export type SyncStats = {
  created: number;
  removed: number;
  reparented: number;
  /** Component-level setter calls (transform, mesh, light, camera, name, enabled). */
  updated: number;
};

const IDENTITY_TRANSFORM: TransformData = {
  position: [0, 0, 0],
  rotationEuler: [0, 0, 0],
  scale: [1, 1, 1],
};

function component<T extends ComponentType>(
  entity: SceneEntity | undefined,
  type: T,
): Extract<ComponentRecord, { type: T }> | undefined {
  return entity?.components.find(
    (item): item is Extract<ComponentRecord, { type: T }> => item.type === type,
  );
}

function active<T extends ComponentType>(
  entity: SceneEntity,
  type: T,
): Extract<ComponentRecord, { type: T }> | undefined {
  const record = component(entity, type);
  return record && record.enabled ? record : undefined;
}

function meshSpec(entity: SceneEntity): MeshSpec | null {
  const mesh = active(entity, 'mesh')?.data;
  if (!mesh) {
    return null;
  }
  return {
    primitive: mesh.primitive,
    assetId: mesh.assetId,
    material: active(entity, 'material')?.data ?? null,
  };
}

/** Same record object ⇒ unchanged (documents are immutable and structurally shared). */
function sameRecord(
  previous: SceneEntity | undefined,
  next: SceneEntity,
  type: ComponentType,
): boolean {
  return previous !== undefined && component(previous, type) === component(next, type);
}

function preOrder(scene: Scene | null): string[] {
  if (!scene) {
    return [];
  }
  const out: string[] = [];
  const visit = (id: string) => {
    const entity = scene.entities[id];
    if (!entity) {
      return;
    }
    out.push(id);
    entity.childIds.forEach(visit);
  };
  scene.rootEntityIds.forEach(visit);
  return out;
}

/**
 * Applies the difference between the last applied scene and the next one to a backend.
 * Cost is proportional to what changed: untouched entities are skipped by identity.
 */
export class SceneSync {
  private current: Scene | null = null;

  constructor(private readonly backend: SceneBackend) {}

  get scene(): Scene | null {
    return this.current;
  }

  apply(next: Scene | null): SyncStats {
    const stats: SyncStats = { created: 0, removed: 0, reparented: 0, updated: 0 };
    const previous = this.current;
    if (previous === next) {
      return stats;
    }
    const before = previous?.entities ?? {};
    const after = next?.entities ?? {};
    const order = preOrder(next);

    // Parents come before children in pre-order, so a new child always finds its parent.
    for (const id of order) {
      const entity = after[id];
      if (!entity) {
        continue;
      }
      const old = Object.hasOwn(before, id) ? before[id] : undefined;
      if (!old) {
        this.backend.createNode(id, entity.name);
        stats.created += 1;
      }
      if (!old || old.parentId !== entity.parentId) {
        this.backend.setParent(id, entity.parentId);
        stats.reparented += 1;
      }
      if (old === entity) {
        continue;
      }
      if (old && old.name !== entity.name) {
        this.backend.setName(id, entity.name);
        stats.updated += 1;
      }
      if (!old || old.enabled !== entity.enabled) {
        this.backend.setEnabled(id, entity.enabled);
        stats.updated += 1;
      }
      if (!sameRecord(old, entity, 'transform')) {
        this.backend.setTransform(id, component(entity, 'transform')?.data ?? IDENTITY_TRANSFORM);
        stats.updated += 1;
      }
      if (!sameRecord(old, entity, 'mesh') || !sameRecord(old, entity, 'material')) {
        this.backend.setMesh(id, meshSpec(entity));
        stats.updated += 1;
      }
      if (!sameRecord(old, entity, 'light')) {
        this.backend.setLight(id, active(entity, 'light')?.data ?? null);
        stats.updated += 1;
      }
      if (!sameRecord(old, entity, 'camera')) {
        this.backend.setCamera(id, active(entity, 'camera')?.data ?? null);
        stats.updated += 1;
      }
    }

    // Children first, after survivors were re-attached elsewhere above.
    for (const id of preOrder(previous).reverse()) {
      if (!Object.hasOwn(after, id)) {
        this.backend.removeNode(id);
        stats.removed += 1;
      }
    }
    this.current = next;
    return stats;
  }

  /** Forgets the mirrored scene, removing every node (e.g. before switching scenes). */
  clear(): SyncStats {
    return this.apply(null);
  }
}
