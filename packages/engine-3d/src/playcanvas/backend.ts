import {
  Asset,
  BLEND_NONE,
  BLEND_NORMAL,
  Color,
  Entity,
  LAYERID_DEPTH,
  RenderComponent,
  LAYERID_SKYBOX,
  LAYERID_UI,
  LAYERID_WORLD,
  PROJECTION_ORTHOGRAPHIC,
  PROJECTION_PERSPECTIVE,
  StandardMaterial,
  type AppBase,
  type MeshInstance,
} from 'playcanvas';

import type {
  CameraData,
  LightData,
  MaterialData,
  MeshSpec,
  SceneBackend,
  TransformData,
} from '../sync.js';

type RenderableContainer = {
  instantiateRenderEntity(options?: { castShadows?: boolean; receiveShadows?: boolean }): Entity;
};

/** GLB loads produce `GlbContainerResource`, which does not extend the exported `ContainerResource`. */
function isRenderableContainer(value: unknown): value is RenderableContainer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'instantiateRenderEntity' in value &&
    typeof value.instantiateRenderEntity === 'function'
  );
}

export type ModelLoader = (assetId: string) => Promise<Uint8Array | null>;

export type NodeRecord = {
  id: string;
  entity: Entity;
  mesh: MeshSpec | null;
  material: StandardMaterial | null;
  model: Entity | null;
  modelToken: number;
  light: LightData | null;
  camera: CameraData | null;
  helper: Entity | null;
};

export const GAME_CAMERA_LAYERS = [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI];

const DEFAULT_MATERIAL: MaterialData = {
  baseColor: '#D9D6CC',
  roughness: 0.7,
  metalness: 0,
  emissive: '#000000',
  opacity: 1,
};

export function colorFromHex(hex: string, alpha = 1): Color {
  const value = Number.parseInt(hex.slice(1), 16);
  return new Color(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
    alpha,
  );
}

export function applyMaterial(material: StandardMaterial, data: MaterialData): void {
  material.diffuse = colorFromHex(data.baseColor);
  material.useMetalness = true;
  material.metalness = data.metalness;
  material.gloss = 1 - data.roughness;
  material.emissive = colorFromHex(data.emissive);
  material.opacity = data.opacity;
  material.blendType = data.opacity < 1 ? BLEND_NORMAL : BLEND_NONE;
  material.depthWrite = data.opacity >= 1;
  material.update();
}

export function unlitMaterial(
  hex: string,
  options: { depthTest?: boolean } = {},
): StandardMaterial {
  const material = new StandardMaterial();
  material.useLighting = false;
  material.diffuse = new Color(0, 0, 0);
  material.emissive = colorFromHex(hex);
  material.useFog = false;
  material.useSkybox = false;
  material.depthTest = options.depthTest ?? true;
  material.update();
  return material;
}

type HelperMaterials = {
  light: StandardMaterial;
  camera: StandardMaterial;
  empty: StandardMaterial;
};

/**
 * Mirrors scene entities as PlayCanvas entities. Only `SceneSync` calls the setters, so the
 * engine objects always reflect the document and never the other way round.
 */
export class PlayCanvasBackend implements SceneBackend {
  readonly root: Entity;
  readonly nodes = new Map<string, NodeRecord>();
  private readonly assets = new Map<string, Promise<Asset | null>>();
  private readonly objectUrls: string[] = [];
  private readonly helperMaterials: HelperMaterials;
  private disposed = false;

  constructor(
    private readonly app: AppBase,
    private readonly editorLayerId: number,
    private readonly hooks: {
      loadModel: ModelLoader | undefined;
      changed: () => void;
      warn: (message: string) => void;
      gameCameraEnabled: (id: string) => boolean;
      shadowResolution: number;
    },
  ) {
    this.root = new Entity('scene');
    app.root.addChild(this.root);
    this.helperMaterials = {
      light: unlitMaterial('#F2D06B'),
      camera: unlitMaterial('#D9D6CC'),
      empty: unlitMaterial('#9C998F'),
    };
  }

  node(id: string): NodeRecord | undefined {
    return this.nodes.get(id);
  }

  createNode(id: string, name: string): void {
    const entity = new Entity(name);
    this.root.addChild(entity);
    const record: NodeRecord = {
      id,
      entity,
      mesh: null,
      material: null,
      model: null,
      modelToken: 0,
      light: null,
      camera: null,
      helper: null,
    };
    this.nodes.set(id, record);
    this.refreshHelper(record);
  }

  removeNode(id: string): void {
    const record = this.nodes.get(id);
    if (!record) {
      return;
    }
    record.modelToken += 1;
    record.entity.destroy();
    record.material?.destroy();
    this.nodes.delete(id);
  }

  setParent(id: string, parentId: string | null): void {
    const record = this.nodes.get(id);
    const parent = parentId === null ? this.root : this.nodes.get(parentId)?.entity;
    if (record && parent && record.entity.parent !== parent) {
      record.entity.reparent(parent);
    }
  }

  setName(id: string, name: string): void {
    const record = this.nodes.get(id);
    if (record) {
      record.entity.name = name;
    }
  }

  setEnabled(id: string, enabled: boolean): void {
    const record = this.nodes.get(id);
    if (record) {
      record.entity.enabled = enabled;
    }
  }

  setTransform(id: string, transform: TransformData): void {
    const entity = this.nodes.get(id)?.entity;
    if (!entity) {
      return;
    }
    entity.setLocalPosition(...transform.position);
    entity.setLocalEulerAngles(...transform.rotationEuler);
    entity.setLocalScale(...transform.scale);
  }

  setMesh(id: string, mesh: MeshSpec | null): void {
    const record = this.nodes.get(id);
    if (!record) {
      return;
    }
    const previousAsset = record.mesh?.assetId ?? null;
    record.mesh = mesh;
    if (!mesh) {
      record.modelToken += 1;
      this.removeModel(record);
      if (record.entity.render) {
        record.entity.removeComponent('render');
      }
      record.material?.destroy();
      record.material = null;
      this.refreshHelper(record);
      return;
    }
    if (!record.material) {
      record.material = new StandardMaterial();
    }
    applyMaterial(record.material, mesh.material ?? DEFAULT_MATERIAL);

    if (mesh.assetId === null) {
      record.modelToken += 1;
      this.removeModel(record);
      this.showPrimitive(record, mesh);
    } else if (mesh.assetId !== previousAsset || !record.model) {
      record.modelToken += 1;
      this.removeModel(record);
      // The primitive stays visible until the model is ready (or if it fails to load).
      this.showPrimitive(record, mesh);
      this.requestModel(record, mesh.assetId, record.modelToken);
    }
    this.refreshHelper(record);
  }

  setLight(id: string, light: LightData | null): void {
    const record = this.nodes.get(id);
    if (!record) {
      return;
    }
    record.light = light;
    if (!light) {
      if (record.entity.light) {
        record.entity.removeComponent('light');
      }
      this.refreshHelper(record);
      return;
    }
    const settings = {
      type: light.kind === 'point' ? 'omni' : light.kind,
      color: colorFromHex(light.color),
      intensity: light.intensity,
      range: light.range,
      castShadows: light.castShadows,
      shadowDistance: 40,
      shadowResolution: this.hooks.shadowResolution,
      normalOffsetBias: 0.05,
      shadowBias: 0.2,
      innerConeAngle: 25,
      outerConeAngle: 40,
    };
    if (record.entity.light) {
      Object.assign(record.entity.light, settings);
    } else {
      record.entity.addComponent('light', settings);
    }
    this.refreshHelper(record);
  }

  setCamera(id: string, camera: CameraData | null): void {
    const record = this.nodes.get(id);
    if (!record) {
      return;
    }
    record.camera = camera;
    if (!camera) {
      if (record.entity.camera) {
        record.entity.removeComponent('camera');
      }
      this.refreshHelper(record);
      return;
    }
    const settings = {
      enabled: this.hooks.gameCameraEnabled(id),
      projection:
        camera.projection === 'perspective' ? PROJECTION_PERSPECTIVE : PROJECTION_ORTHOGRAPHIC,
      nearClip: camera.nearClip,
      farClip: camera.farClip,
      ...(camera.projection === 'perspective'
        ? { fov: camera.fov }
        : { orthoHeight: camera.orthoHeight }),
    };
    if (record.entity.camera) {
      Object.assign(record.entity.camera, settings);
    } else {
      record.entity.addComponent('camera', {
        ...settings,
        layers: GAME_CAMERA_LAYERS,
        clearColor: new Color(0.53, 0.66, 0.78),
      });
    }
    this.refreshHelper(record);
  }

  /** Mesh instances that represent this node's visible geometry (primitive or model). */
  meshInstances(record: NodeRecord): readonly MeshInstance[] {
    if (record.model) {
      return record.model
        .findComponents('render')
        .flatMap((component) =>
          component instanceof RenderComponent ? [...component.meshInstances] : [],
        );
    }
    return record.entity.render?.meshInstances ?? [];
  }

  /** Editor-only marker (lights, cameras, empty objects) — `null` for meshes. */
  helperOf(record: NodeRecord): Entity | null {
    return record.helper;
  }

  dispose(): void {
    this.disposed = true;
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    for (const material of Object.values(this.helperMaterials)) {
      material.destroy();
    }
  }

  private showPrimitive(record: NodeRecord, mesh: MeshSpec): void {
    const material = record.material ?? undefined;
    if (record.entity.render) {
      record.entity.render.type = mesh.primitive;
      if (material) record.entity.render.material = material;
      return;
    }
    record.entity.addComponent('render', {
      type: mesh.primitive,
      ...(material ? { material } : {}),
      castShadows: true,
      receiveShadows: true,
    });
  }

  private removeModel(record: NodeRecord): void {
    record.model?.destroy();
    record.model = null;
  }

  private loadAsset(assetId: string): Promise<Asset | null> {
    const cached = this.assets.get(assetId);
    if (cached) {
      return cached;
    }
    const loader = this.hooks.loadModel;
    const promise = (async () => {
      const bytes = loader ? await loader(assetId) : null;
      if (!bytes || this.disposed) {
        return null;
      }
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: 'model/gltf-binary' }),
      );
      this.objectUrls.push(url);
      const asset = new Asset(assetId, 'container', { url, filename: `${assetId}.glb` });
      this.app.assets.add(asset);
      await new Promise<void>((resolve, reject) => {
        asset.once('load', () => resolve());
        asset.once('error', (message: unknown) => reject(new Error(String(message))));
        this.app.assets.load(asset);
      });
      return asset;
    })();
    this.assets.set(assetId, promise);
    // A failed load may succeed later (e.g. after an upload in G5).
    promise.catch(() => this.assets.delete(assetId));
    return promise;
  }

  private requestModel(record: NodeRecord, assetId: string, token: number): void {
    this.loadAsset(assetId)
      .then((asset) => {
        if (this.disposed || record.modelToken !== token || this.nodes.get(record.id) !== record) {
          return;
        }
        const resource: unknown = asset?.resource;
        if (!isRenderableContainer(resource)) {
          this.hooks.warn(`Модель «${assetId}» не найдена — показан примитив`);
          return;
        }
        const instance = resource.instantiateRenderEntity({
          castShadows: true,
          receiveShadows: true,
        });
        record.entity.addChild(instance);
        record.model = instance;
        if (record.entity.render) {
          record.entity.removeComponent('render');
        }
        this.hooks.changed();
      })
      .catch((error: unknown) => {
        if (!this.disposed) {
          const reason = error instanceof Error ? error.message : String(error);
          this.hooks.warn(`Модель «${assetId}» не загрузилась (${reason}) — показан примитив`);
        }
      });
  }

  private refreshHelper(record: NodeRecord): void {
    const kind = record.mesh ? null : record.camera ? 'camera' : record.light ? 'light' : 'empty';
    const current = record.helper?.tags.list()[0] ?? null;
    const wanted = kind === 'light' && record.light ? `light-${record.light.kind}` : kind;
    if (current === wanted) {
      return;
    }
    record.helper?.destroy();
    record.helper = null;
    if (!wanted || !kind) {
      return;
    }
    const helper = new Entity(`helper:${record.id}`);
    helper.tags.add(wanted);
    const layers = [this.editorLayerId];
    const part = (
      type: 'box' | 'sphere' | 'cylinder' | 'cone',
      material: StandardMaterial,
      scale: [number, number, number],
      position: [number, number, number] = [0, 0, 0],
      rotation: [number, number, number] = [0, 0, 0],
    ) => {
      const child = new Entity();
      child.addComponent('render', {
        type,
        material,
        layers,
        castShadows: false,
        receiveShadows: false,
      });
      child.setLocalScale(...scale);
      child.setLocalPosition(...position);
      child.setLocalEulerAngles(...rotation);
      helper.addChild(child);
    };
    if (kind === 'camera') {
      part('box', this.helperMaterials.camera, [0.32, 0.24, 0.36]);
      part('cone', this.helperMaterials.camera, [0.3, 0.3, 0.3], [0, 0, -0.33], [90, 0, 0]);
    } else if (kind === 'light') {
      part('sphere', this.helperMaterials.light, [0.26, 0.26, 0.26]);
      if (record.light?.kind !== 'point') {
        // Lights shine along local -Y in PlayCanvas.
        part('cylinder', this.helperMaterials.light, [0.04, 0.9, 0.04], [0, -0.55, 0]);
      }
    } else {
      part('sphere', this.helperMaterials.empty, [0.14, 0.14, 0.14]);
    }
    record.entity.addChild(helper);
    record.helper = helper;
  }
}
