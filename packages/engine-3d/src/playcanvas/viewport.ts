import type { ProjectDocument, Scene } from '@tg-creator/project-schema';
import {
  Application,
  Color,
  Entity,
  FILLMODE_NONE,
  GAMMA_SRGB,
  Gizmo,
  LAYERID_DEPTH,
  LAYERID_IMMEDIATE,
  LAYERID_SKYBOX,
  LAYERID_UI,
  LAYERID_WORLD,
  Layer,
  Mat4,
  Mesh,
  MeshInstance,
  PRIMITIVE_LINES,
  RESOLUTION_AUTO,
  RotateGizmo,
  ScaleGizmo,
  TONEMAP_ACES,
  TranslateGizmo,
  Vec3,
  type StandardMaterial,
  type TransformGizmo,
} from 'playcanvas';

import {
  DEFAULT_ORBIT,
  frameSphere,
  normalizeOrbit,
  orbitBy,
  orbitPosition,
  panBy,
  zoomBy,
  type OrbitState,
} from '../orbit.js';
import { rayGround, rayObb, roundTo, wrapDegrees, type V3 } from '../picking.js';
import { SceneSync, type SyncStats, type TransformData } from '../sync.js';
import {
  PlayCanvasBackend,
  colorFromHex,
  unlitMaterial,
  type ModelLoader,
  type NodeRecord,
} from './backend.js';

export type ViewportTool = 'select' | 'move' | 'rotate' | 'scale';
export type ViewMode = 'editor' | 'game';
export type ScreenPoint = { x: number; y: number };

export type TransformEvent = {
  entityId: string;
  phase: 'start' | 'move' | 'end';
  /** Only the field the active tool edits (position, rotationEuler or scale). */
  patch: Partial<TransformData>;
};

export type ViewportOptions = {
  canvas: HTMLCanvasElement;
  /** Receives camera gestures; defaults to the canvas parent. */
  eventTarget?: HTMLElement;
  loadModel?: ModelLoader;
  onPick?: (entityId: string | null) => void;
  onTransform?: (event: TransformEvent) => void;
  onCameraChange?: (state: OrbitState) => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onWarning?: (message: string) => void;
  camera?: OrbitState;
  /** Coarse pointer: larger gizmo and tap radius. */
  touch?: boolean;
  background?: string;
  maxPixelRatio?: number;
};

export type SceneViewport = {
  applyChanges(document: ProjectDocument, sceneId: string | null): SyncStats;
  select(ids: readonly string[]): void;
  setTool(tool: ViewportTool): void;
  setSnap(enabled: boolean): void;
  setViewMode(mode: ViewMode): boolean;
  focus(ids?: readonly string[]): void;
  getCamera(): OrbitState;
  setCamera(state: OrbitState): void;
  /** Point on the ground in the middle of the view — where new objects appear. */
  placementPoint(): V3;
  hasGameCamera(): boolean;
  /** True once the entity's glTF model replaced its placeholder primitive. */
  hasLoadedModel(entityId: string): boolean;
  /** Canvas-relative CSS pixels of an entity's visual centre (tests, labels). */
  screenPoint(entityId: string): ScreenPoint | null;
  /** Canvas-relative CSS pixels of a gizmo handle for the active tool (tests). */
  gizmoHandlePoint(axis: 'x' | 'y' | 'z'): ScreenPoint | null;
  readonly renderer: string;
  dispose(): void;
};

const TAP_SLOP_MOUSE = 4;
const TAP_SLOP_TOUCH = 10;
const SNAP = { move: 0.5, rotate: 15, scale: 0.1 } as const;
const AXES = { x: new Vec3(1, 0, 0), y: new Vec3(0, 1, 0), z: new Vec3(0, 0, 1) } as const;

function luminance(hex: string): number {
  const c = colorFromHex(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function mix(a: Color, b: Color, t: number): [number, number, number] {
  return [a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t];
}

function buildGrid(app: Application, layer: Layer, background: string): Entity {
  const half = 50;
  const bg = colorFromHex(background);
  const ink = luminance(background) > 0.5 ? new Color(0, 0, 0) : new Color(1, 1, 1);
  const minor = mix(bg, ink, 0.08);
  const major = mix(bg, ink, 0.18);
  const positions: number[] = [];
  const colors: number[] = [];
  const line = (a: V3, b: V3, rgb: readonly [number, number, number]) => {
    positions.push(...a, ...b);
    const bytes = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
    colors.push(...bytes, 255, ...bytes, 255);
  };
  // Short segments: some rasterizers drop a whole line whose ends lie on both sides of the
  // camera plane, which a 100 m line does whenever the camera is inside the grid.
  const segment = 5;
  for (let i = -half; i <= half; i += 1) {
    const rgbX = i === 0 ? ([0.36, 0.5, 0.95] as const) : i % 5 === 0 ? major : minor;
    const rgbZ = i === 0 ? ([0.92, 0.32, 0.3] as const) : i % 5 === 0 ? major : minor;
    for (let s = -half; s < half; s += segment) {
      line([i, 0, s], [i, 0, s + segment], rgbX); // along Z (the Z axis is blue at x = 0)
      line([s, 0, i], [s + segment, 0, i], rgbZ); // along X (the X axis is red at z = 0)
    }
  }
  const mesh = new Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.setColors32(colors);
  mesh.update(PRIMITIVE_LINES);
  const material = unlitMaterial('#FFFFFF');
  material.emissiveVertexColor = true;
  material.depthWrite = false;
  material.update();
  const entity = new Entity('editor-grid');
  entity.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)],
    layers: [layer.id],
    castShadows: false,
    receiveShadows: false,
  });
  return entity;
}

function buildBoxOutline(app: Application, layer: Layer, material: StandardMaterial): Entity {
  const c = [-0.5, 0.5];
  const positions: number[] = [];
  for (const y of c) {
    for (const z of c) positions.push(-0.5, y, z, 0.5, y, z);
  }
  for (const x of c) {
    for (const z of c) positions.push(x, -0.5, z, x, 0.5, z);
  }
  for (const x of c) {
    for (const y of c) positions.push(x, y, -0.5, x, y, 0.5);
  }
  const mesh = new Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.update(PRIMITIVE_LINES);
  const entity = new Entity('editor-selection');
  entity.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)],
    layers: [layer.id],
    castShadows: false,
    receiveShadows: false,
  });
  entity.enabled = false;
  return entity;
}

function preOrder(scene: Scene | null): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const entity = scene?.entities[id];
    if (entity) {
      out.push(id);
      entity.childIds.forEach(visit);
    }
  };
  scene?.rootEntityIds.forEach(visit);
  return out;
}

/**
 * Editor viewport on PlayCanvas (WebGL2). Rendering is on demand: a frame is drawn only
 * after a document change, a camera move, a resize or gizmo feedback.
 */
export function createScene(options: ViewportOptions): SceneViewport {
  const { canvas } = options;
  const eventTarget = options.eventTarget ?? canvas.parentElement ?? canvas;
  const background = options.background ?? '#1C1B18';
  const touch = options.touch ?? false;

  const app = new Application(canvas, {
    graphicsDeviceOptions: { antialias: true, alpha: false, preferWebGl2: true },
  });
  app.setCanvasFillMode(FILLMODE_NONE);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Math.min(
    window.devicePixelRatio || 1,
    options.maxPixelRatio ?? 2,
  );
  app.autoRender = false;
  app.scene.ambientLight = new Color(0.32, 0.32, 0.34);

  const requestRender = () => {
    app.renderNextFrame = true;
  };

  const editorLayer = new Layer({ name: 'Editor' });
  app.scene.layers.push(editorLayer);

  // ---------- editor camera ----------
  let orbit = normalizeOrbit(options.camera ?? DEFAULT_ORBIT);
  const editorCamera = new Entity('editor-camera');
  editorCamera.addComponent('camera', {
    clearColor: colorFromHex(background),
    fov: 50,
    nearClip: 0.05,
    farClip: 2000,
    layers: [
      LAYERID_WORLD,
      LAYERID_DEPTH,
      LAYERID_SKYBOX,
      LAYERID_IMMEDIATE,
      LAYERID_UI,
      editorLayer.id,
    ],
    toneMapping: TONEMAP_ACES,
    gammaCorrection: GAMMA_SRGB,
  });
  app.root.addChild(editorCamera);
  const cameraComponent = editorCamera.camera;
  if (!cameraComponent) {
    throw new Error('editor camera component missing');
  }

  // Editor-only light so an unlit scene is still visible while editing.
  const headlight = new Entity('editor-headlight');
  headlight.addComponent('light', { type: 'directional', intensity: 0.9, castShadows: false });
  headlight.setLocalEulerAngles(60, 20, 0);
  editorCamera.addChild(headlight);

  const applyCamera = (notify: boolean) => {
    editorCamera.setPosition(...orbitPosition(orbit));
    editorCamera.lookAt(...orbit.target);
    requestRender();
    if (notify) {
      options.onCameraChange?.(orbit);
    }
  };
  applyCamera(false);

  // ---------- scene mirror ----------
  let viewMode: ViewMode = 'editor';
  let gameCameraId: string | null = null;
  const backend = new PlayCanvasBackend(app, editorLayer.id, {
    loadModel: options.loadModel,
    changed: () => {
      refreshSelection();
      requestRender();
    },
    warn: (message) => options.onWarning?.(message),
    gameCameraEnabled: (id) => viewMode === 'game' && id === gameCameraId,
    shadowResolution: touch ? 1024 : 2048,
  });
  const sync = new SceneSync(backend);
  let sceneId: string | null = null;

  app.root.addChild(buildGrid(app, editorLayer, background));
  const selectionMaterial = unlitMaterial('#D4F24A', { depthTest: false });
  const selectionBox = buildBoxOutline(app, editorLayer, selectionMaterial);
  app.root.addChild(selectionBox);

  // ---------- gizmos (attached to a proxy, never to scene entities) ----------
  const gizmoLayer = Gizmo.createLayer(app);
  const gizmos = {
    move: new TranslateGizmo(cameraComponent, gizmoLayer),
    rotate: new RotateGizmo(cameraComponent, gizmoLayer),
    scale: new ScaleGizmo(cameraComponent, gizmoLayer),
  };
  gizmos.move.coordSpace = 'world';
  gizmos.rotate.coordSpace = 'world';
  gizmos.scale.coordSpace = 'local';
  gizmos.scale.lowerBoundScale = new Vec3(0.01, 0.01, 0.01);
  gizmos.move.snapIncrement = SNAP.move;
  gizmos.rotate.snapIncrement = SNAP.rotate;
  gizmos.scale.snapIncrement = SNAP.scale;
  for (const gizmo of Object.values(gizmos)) {
    gizmo.size = touch ? 1.45 : 1.1;
  }
  const proxyParent = new Entity('gizmo-proxy-parent');
  const proxy = new Entity('gizmo-proxy');
  proxyParent.addChild(proxy);
  app.root.addChild(proxyParent);

  let tool: ViewportTool = 'move';
  let selection: readonly string[] = [];
  let dragging = false;

  const selectedRecord = (): NodeRecord | undefined => {
    const id = selection.at(-1);
    return id ? backend.node(id) : undefined;
  };

  const activeGizmo = (): TransformGizmo | null =>
    tool === 'select' || viewMode === 'game' ? null : gizmos[tool];

  const syncProxy = () => {
    if (dragging) {
      return;
    }
    const record = selectedRecord();
    const active = record ? activeGizmo() : null;
    for (const gizmo of Object.values(gizmos)) {
      if (gizmo !== active && gizmo.nodes.length > 0) {
        gizmo.detach();
      }
    }
    if (!record || !active) {
      requestRender();
      return;
    }
    const parent = record.entity.parent ?? app.root;
    proxyParent.setPosition(parent.getPosition());
    proxyParent.setRotation(parent.getRotation());
    proxyParent.setLocalScale(parent.getWorldTransform().getScale());
    proxy.setLocalPosition(record.entity.getLocalPosition());
    proxy.setLocalRotation(record.entity.getLocalRotation());
    proxy.setLocalScale(record.entity.getLocalScale());
    if (active.nodes[0] !== proxy) {
      active.attach([proxy]);
    }
    requestRender();
  };

  const proxyPatch = (): Partial<TransformData> => {
    if (tool === 'move') {
      const p = proxy.getLocalPosition();
      return { position: [roundTo(p.x, 0.001), roundTo(p.y, 0.001), roundTo(p.z, 0.001)] };
    }
    if (tool === 'rotate') {
      const r = proxy.getLocalEulerAngles();
      return {
        rotationEuler: [
          roundTo(wrapDegrees(r.x), 0.01),
          roundTo(wrapDegrees(r.y), 0.01),
          roundTo(wrapDegrees(r.z), 0.01),
        ],
      };
    }
    const s = proxy.getLocalScale();
    return { scale: [roundTo(s.x, 0.001), roundTo(s.y, 0.001), roundTo(s.z, 0.001)] };
  };

  const emitTransform = (phase: TransformEvent['phase']) => {
    const id = selection.at(-1);
    if (id) {
      options.onTransform?.({ entityId: id, phase, patch: phase === 'start' ? {} : proxyPatch() });
    }
  };

  for (const gizmo of Object.values(gizmos)) {
    gizmo.on('transform:start', () => {
      dragging = true;
      emitTransform('start');
    });
    gizmo.on('transform:move', () => {
      emitTransform('move');
      requestRender();
    });
    gizmo.on('transform:end', () => {
      emitTransform('end');
      dragging = false;
      syncProxy();
    });
    gizmo.on('render:update', requestRender);
  }

  // ---------- selection outline ----------
  const tmpCenter = new Vec3();
  const refreshSelection = () => {
    const record = selectedRecord();
    if (!record || viewMode === 'game' || !record.entity.enabled) {
      selectionBox.enabled = false;
      return;
    }
    selectionBox.enabled = true;
    const instances = backend.meshInstances(record);
    if (instances.length === 0) {
      selectionBox.setPosition(record.entity.getPosition());
      selectionBox.setRotation(record.entity.getRotation());
      selectionBox.setLocalScale(0.55, 0.55, 0.55);
      return;
    }
    if (record.model) {
      // Union of world-space boxes of all model parts.
      const min = new Vec3(Infinity, Infinity, Infinity);
      const max = new Vec3(-Infinity, -Infinity, -Infinity);
      for (const instance of instances) {
        min.min(instance.aabb.getMin());
        max.max(instance.aabb.getMax());
      }
      selectionBox.setPosition(tmpCenter.add2(min, max).mulScalar(0.5));
      selectionBox.setEulerAngles(0, 0, 0);
      selectionBox.setLocalScale(
        Math.max(max.x - min.x, 0.02),
        Math.max(max.y - min.y, 0.02),
        Math.max(max.z - min.z, 0.02),
      );
      return;
    }
    const box = instances[0]?.mesh?.aabb;
    if (!box) return;
    const world = record.entity.getWorldTransform();
    world.transformPoint(box.center, tmpCenter);
    const scale = world.getScale();
    selectionBox.setPosition(tmpCenter);
    selectionBox.setRotation(record.entity.getRotation());
    selectionBox.setLocalScale(
      Math.max(Math.abs(box.halfExtents.x * 2 * scale.x), 0.02),
      Math.max(Math.abs(box.halfExtents.y * 2 * scale.y), 0.02),
      Math.max(Math.abs(box.halfExtents.z * 2 * scale.z), 0.02),
    );
  };

  // ---------- game camera ----------
  const findGameCamera = (): string | null => {
    for (const id of preOrder(sync.scene)) {
      const record = backend.node(id);
      if (record?.camera && record.entity.enabled) {
        return id;
      }
    }
    return null;
  };

  const updateCameras = () => {
    const anyLight = [...backend.nodes.values()].some(
      (record) => record.light && record.entity.enabled,
    );
    if (headlight.light) headlight.light.enabled = viewMode === 'editor' && !anyLight;
    if (viewMode === 'game') {
      const id = findGameCamera();
      if (!id) {
        viewMode = 'editor';
        options.onViewModeChange?.('editor');
        options.onWarning?.('В сцене нет включённой камеры — вид редактора');
      }
      gameCameraId = id;
    }
    cameraComponent.enabled = viewMode === 'editor';
    for (const record of backend.nodes.values()) {
      if (record.entity.camera) {
        record.entity.camera.enabled = viewMode === 'game' && record.id === gameCameraId;
      }
    }
  };

  // ---------- picking ----------
  const rayFrom = (x: number, y: number): { origin: V3; direction: V3 } => {
    const near = cameraComponent.screenToWorld(x, y, cameraComponent.nearClip);
    const far = cameraComponent.screenToWorld(x, y, cameraComponent.farClip);
    const d = new Vec3().sub2(far, near).normalize();
    return { origin: [near.x, near.y, near.z], direction: [d.x, d.y, d.z] };
  };

  const pick = (x: number, y: number): string | null => {
    const { origin, direction } = rayFrom(x, y);
    const camPos = editorCamera.getPosition();
    const radius = touch ? 26 : 16;
    let best: { id: string; distance: number } | null = null;
    const inverse = new Mat4();
    for (const record of backend.nodes.values()) {
      if (!record.entity.enabled) continue;
      const instances = backend.meshInstances(record);
      let hit: number | null = null;
      for (const instance of instances) {
        const world = instance.node.getWorldTransform();
        inverse.copy(world).invert();
        const aabb = instance.mesh?.aabb;
        if (!aabb) continue;
        const min = aabb.getMin();
        const max = aabb.getMax();
        const distance = rayObb(
          origin,
          direction,
          inverse.data,
          world.data,
          [min.x, min.y, min.z],
          [max.x, max.y, max.z],
        );
        if (distance !== null && (hit === null || distance < hit)) hit = distance;
      }
      if (instances.length === 0 && record.helper) {
        const position = record.entity.getPosition();
        const screen = cameraComponent.worldToScreen(position);
        if (screen.z > 0 && Math.hypot(screen.x - x, screen.y - y) <= radius) {
          hit = position.distance(camPos);
        }
      }
      if (hit !== null && (!best || hit < best.distance)) {
        best = { id: record.id, distance: hit };
      }
    }
    return best?.id ?? null;
  };

  // ---------- pointer routing: gizmo first (it stops propagation on a hit), then camera ----------
  type Pointer = { x: number; y: number; startX: number; startY: number; touch: boolean };
  const pointers = new Map<number, Pointer>();
  let gesture: 'none' | 'orbit' | 'pan' | 'pinch' = 'none';
  let moved = false;
  let pinch: { distance: number; midX: number; midY: number; start: OrbitState } | null = null;

  const local = (event: PointerEvent | WheelEvent): ScreenPoint => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startPinch = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    gesture = 'pinch';
    moved = true;
    pinch = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      start: orbit,
    };
  };

  const handleDown = (event: PointerEvent) => {
    const point = local(event);
    try {
      eventTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events in tests may not be capturable; gestures still work.
    }
    pointers.set(event.pointerId, {
      x: point.x,
      y: point.y,
      startX: point.x,
      startY: point.y,
      touch: event.pointerType === 'touch',
    });
    if (pointers.size >= 2) {
      startPinch();
      return;
    }
    moved = false;
    gesture = event.button === 1 || event.button === 2 || event.shiftKey ? 'pan' : 'orbit';
  };

  // A second finger during a camera gesture must never grab the gizmo.
  const onPointerDownCapture = (event: PointerEvent) => {
    if (pointers.size > 0 && !pointers.has(event.pointerId) && viewMode === 'editor') {
      event.stopPropagation();
      handleDown(event);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (dragging || viewMode === 'game' || pointers.size > 0) return;
    handleDown(event);
  };

  const onPointerMove = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const point = local(event);
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    pointer.x = point.x;
    pointer.y = point.y;
    if (gesture === 'pinch' && pinch) {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const zoomed = zoomBy(pinch.start, pinch.distance / distance);
      orbit = panBy(
        zoomed,
        (a.x + b.x) / 2 - pinch.midX,
        (a.y + b.y) / 2 - pinch.midY,
        canvas.clientHeight,
        cameraComponent.fov,
      );
      applyCamera(true);
      return;
    }
    if (!moved) {
      const slop = pointer.touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE;
      if (Math.hypot(point.x - pointer.startX, point.y - pointer.startY) < slop) return;
      moved = true;
    }
    orbit =
      gesture === 'pan'
        ? panBy(orbit, dx, dy, canvas.clientHeight, cameraComponent.fov)
        : orbitBy(orbit, dx, dy);
    applyCamera(true);
  };

  const endPointer = (event: PointerEvent, cancelled: boolean) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    try {
      eventTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (pointers.size === 0) {
      if (!moved && !cancelled && gesture !== 'pinch' && event.button === 0) {
        options.onPick?.(pick(pointer.x, pointer.y));
      }
      gesture = 'none';
      pinch = null;
    } else if (gesture === 'pinch') {
      // One finger left: keep orbiting from where it is, without a tap.
      gesture = 'orbit';
      pinch = null;
    }
  };
  const onPointerUp = (event: PointerEvent) => endPointer(event, false);
  const onPointerCancel = (event: PointerEvent) => endPointer(event, true);

  const onWheel = (event: WheelEvent) => {
    if (viewMode === 'game') return;
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    orbit = zoomBy(orbit, Math.exp(delta * 0.0015));
    applyCamera(true);
  };
  const onContextMenu = (event: Event) => event.preventDefault();

  eventTarget.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
  eventTarget.addEventListener('pointerdown', onPointerDown);
  eventTarget.addEventListener('pointermove', onPointerMove);
  eventTarget.addEventListener('pointerup', onPointerUp);
  eventTarget.addEventListener('pointercancel', onPointerCancel);
  eventTarget.addEventListener('wheel', onWheel, { passive: false });
  eventTarget.addEventListener('contextmenu', onContextMenu);

  // ---------- size ----------
  const resize = () => {
    const width = Math.max(1, eventTarget.clientWidth);
    const height = Math.max(1, eventTarget.clientHeight);
    app.resizeCanvas(width, height);
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(eventTarget);
  resize();
  app.graphicsDevice.on('devicerestored', requestRender);
  app.start();

  const renderer = (() => {
    const gl = canvas.getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'WebGL2';
  })();

  let disposed = false;

  return {
    renderer,
    applyChanges(document, nextSceneId) {
      if (nextSceneId !== sceneId) {
        sync.clear();
        sceneId = nextSceneId;
      }
      const scene =
        nextSceneId === null
          ? null
          : (document.scenes.find((item) => item.id === nextSceneId) ?? null);
      const stats = sync.apply(scene);
      updateCameras();
      refreshSelection();
      syncProxy();
      requestRender();
      return stats;
    },
    select(ids) {
      selection = ids.filter((id) => backend.node(id));
      refreshSelection();
      syncProxy();
      requestRender();
    },
    setTool(next) {
      tool = next;
      syncProxy();
    },
    setSnap(enabled) {
      for (const gizmo of Object.values(gizmos)) gizmo.snap = enabled;
    },
    setViewMode(mode) {
      if (mode === 'game' && !findGameCamera()) {
        return false;
      }
      viewMode = mode;
      gameCameraId = mode === 'game' ? findGameCamera() : null;
      updateCameras();
      refreshSelection();
      syncProxy();
      requestRender();
      options.onViewModeChange?.(mode);
      return true;
    },
    focus(ids = selection) {
      const records = ids
        .map((id) => backend.node(id))
        .filter((record): record is NodeRecord => Boolean(record));
      if (records.length === 0) return;
      const min = new Vec3(Infinity, Infinity, Infinity);
      const max = new Vec3(-Infinity, -Infinity, -Infinity);
      for (const record of records) {
        const instances = backend.meshInstances(record);
        if (instances.length === 0) {
          const p = record.entity.getPosition();
          min.min(new Vec3(p.x - 0.5, p.y - 0.5, p.z - 0.5));
          max.max(new Vec3(p.x + 0.5, p.y + 0.5, p.z + 0.5));
        }
        for (const instance of instances) {
          min.min(instance.aabb.getMin());
          max.max(instance.aabb.getMax());
        }
      }
      const center: V3 = [(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2];
      const radius = Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) / 2;
      orbit = frameSphere(orbit, center, radius, cameraComponent.fov);
      applyCamera(true);
    },
    getCamera: () => orbit,
    setCamera(state) {
      orbit = normalizeOrbit(state);
      applyCamera(false);
    },
    placementPoint() {
      const position = editorCamera.getPosition();
      const forward = editorCamera.forward;
      const hit = rayGround(
        [position.x, position.y, position.z],
        [forward.x, forward.y, forward.z],
      );
      const point = hit ?? orbit.target;
      return [roundTo(point[0], 0.5), 0, roundTo(point[2], 0.5)];
    },
    hasGameCamera: () => findGameCamera() !== null,
    hasLoadedModel: (entityId) => Boolean(backend.node(entityId)?.model),
    screenPoint(entityId) {
      const record = backend.node(entityId);
      if (!record) return null;
      const instances = backend.meshInstances(record);
      const target = new Vec3();
      if (instances.length > 0 && !record.model) {
        const box = instances[0]?.mesh?.aabb;
        if (box) record.entity.getWorldTransform().transformPoint(box.center, target);
      } else if (instances.length > 0) {
        const min = new Vec3(Infinity, Infinity, Infinity);
        const max = new Vec3(-Infinity, -Infinity, -Infinity);
        for (const instance of instances) {
          min.min(instance.aabb.getMin());
          max.max(instance.aabb.getMax());
        }
        target.add2(min, max).mulScalar(0.5);
      } else {
        target.copy(record.entity.getPosition());
      }
      const screen = cameraComponent.worldToScreen(target);
      return screen.z > 0 ? { x: screen.x, y: screen.y } : null;
    },
    gizmoHandlePoint(axis) {
      const gizmo = activeGizmo();
      if (!gizmo || gizmo.nodes.length === 0) return null;
      const center = gizmo.root.getPosition();
      const scale = gizmo.root.getLocalScale().x;
      const direction = new Vec3();
      let distance: number;
      if (tool === 'rotate') {
        // Ring point facing the camera (the visible half of the arc).
        const axisVector = AXES[axis];
        const toCamera = new Vec3().sub2(editorCamera.getPosition(), center);
        direction.copy(toCamera).sub(axisVector.clone().mulScalar(toCamera.dot(axisVector)));
        if (direction.length() < 1e-6) direction.copy(axis === 'y' ? AXES.x : AXES.y);
        direction.normalize();
        distance = 0.5;
      } else if (tool === 'scale') {
        proxy.getWorldTransform().transformVector(AXES[axis], direction);
        direction.normalize();
        distance = 0.56;
      } else {
        direction.copy(AXES[axis]);
        distance = 0.62;
      }
      const point = center.clone().add(direction.mulScalar(distance * scale));
      const screen = cameraComponent.worldToScreen(point);
      return screen.z > 0 ? { x: screen.x, y: screen.y } : null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      eventTarget.removeEventListener('pointerdown', onPointerDownCapture, { capture: true });
      eventTarget.removeEventListener('pointerdown', onPointerDown);
      eventTarget.removeEventListener('pointermove', onPointerMove);
      eventTarget.removeEventListener('pointerup', onPointerUp);
      eventTarget.removeEventListener('pointercancel', onPointerCancel);
      eventTarget.removeEventListener('wheel', onWheel);
      eventTarget.removeEventListener('contextmenu', onContextMenu);
      backend.dispose();
      selectionMaterial.destroy();
      // Gizmos unsubscribe and destroy themselves on the app "destroy" event.
      app.destroy();
    },
  };
}
