import {
  IDENTITY,
  activeScene,
  composeTransform,
  findComponent,
  multiply,
  setTransformCommand,
  transformDirection,
  transformPoint,
  worldDeltaToLocal,
  type Mat4,
} from '@tg-creator/editor-core';
import type { ProjectType, Scene, SceneEntity, Vec3 } from '@tg-creator/project-schema';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { useEditorState, useEditorUi, useSession } from './context.js';
import { entityKind, type EntityKind } from './glyphs.js';

type View = { cx: number; cy: number; ppu: number };
type Size = { width: number; height: number };
type PlanePoint = { u: number; v: number };

type Shape = {
  entity: SceneEntity;
  kind: EntityKind;
  /** Footprint polygon in plane coordinates; empty for point-like entities. */
  outline: PlanePoint[];
  origin: PlanePoint;
  /** Camera look direction projected on the plane (unit), if meaningful. */
  facing: PlanePoint | null;
  color: string;
  active: boolean;
  order: number;
};

const PPU_MIN = 4;
const PPU_MAX = 400;
const CIRCLE_SEGMENTS = 20;

/** 3D: top view (X right, Z down). 2D: X right, Y up. */
function toPlane(projectType: ProjectType, point: Vec3): PlanePoint {
  return projectType === 'game2d' ? { u: point[0], v: point[1] } : { u: point[0], v: point[2] };
}

function planeDeltaToWorld(projectType: ProjectType, du: number, dv: number): Vec3 {
  return projectType === 'game2d' ? [du, dv, 0] : [du, 0, dv];
}

function localOutline(entity: SceneEntity): Vec3[] {
  const square = (z2d: boolean): Vec3[] =>
    z2d
      ? [
          [-0.5, -0.5, 0],
          [0.5, -0.5, 0],
          [0.5, 0.5, 0],
          [-0.5, 0.5, 0],
        ]
      : [
          [-0.5, 0, -0.5],
          [0.5, 0, -0.5],
          [0.5, 0, 0.5],
          [-0.5, 0, 0.5],
        ];
  const circle = (): Vec3[] =>
    Array.from({ length: CIRCLE_SEGMENTS }, (_, index) => {
      const angle = (index / CIRCLE_SEGMENTS) * Math.PI * 2;
      return [Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5];
    });
  const mesh = findComponent(entity, 'mesh');
  if (mesh) {
    return mesh.data.primitive === 'box' || mesh.data.primitive === 'plane'
      ? square(false)
      : circle();
  }
  if (findComponent(entity, 'sprite')) {
    return square(true);
  }
  return [];
}

function entityColor(entity: SceneEntity): string {
  return (
    findComponent(entity, 'material')?.data.baseColor ??
    findComponent(entity, 'sprite')?.data.color ??
    'var(--ui-muted)'
  );
}

function buildShapes(scene: Scene, projectType: ProjectType): Shape[] {
  const shapes: Shape[] = [];
  const visit = (ids: readonly string[], parent: Mat4, parentActive: boolean) => {
    for (const id of ids) {
      const entity = scene.entities[id];
      if (!entity) {
        continue;
      }
      const transform = findComponent(entity, 'transform');
      const world = transform ? multiply(parent, composeTransform(transform.data)) : parent;
      const active = parentActive && entity.enabled;
      const originWorld = transformPoint(world, [0, 0, 0]);
      const kind = entityKind(entity);
      let facing: PlanePoint | null = null;
      if (kind === 'camera' && projectType === 'game3d') {
        const forward = toPlane(projectType, transformDirection(world, [0, 0, -1]));
        const length = Math.hypot(forward.u, forward.v);
        facing = length > 1e-6 ? { u: forward.u / length, v: forward.v / length } : null;
      }
      const sprite = findComponent(entity, 'sprite');
      shapes.push({
        entity,
        kind,
        outline: localOutline(entity).map((point) =>
          toPlane(projectType, transformPoint(world, point)),
        ),
        origin: toPlane(projectType, originWorld),
        facing,
        color: entityColor(entity),
        active,
        order:
          projectType === 'game2d'
            ? (sprite?.data.layer ?? 0) * 100_000 + (sprite?.data.sortOrder ?? 0)
            : originWorld[1],
      });
      visit(entity.childIds, world, active);
    }
  };
  visit(scene.rootEntityIds, IDENTITY, true);
  // Footprints first (sorted), point markers on top so they stay clickable.
  return shapes.sort((a, b) => {
    const aPoint = a.outline.length === 0 ? 1 : 0;
    const bPoint = b.outline.length === 0 ? 1 : 0;
    return aPoint - bPoint || a.order - b.order;
  });
}

function fitView(shapes: Shape[], size: Size, only?: ReadonlySet<string>): View {
  const points = shapes
    .filter((shape) => !only || only.has(shape.entity.id))
    .flatMap((shape) => [shape.origin, ...shape.outline]);
  if (points.length === 0 || size.width === 0 || size.height === 0) {
    return { cx: 0, cy: 0, ppu: 40 };
  }
  const us = points.map((point) => point.u);
  const vs = points.map((point) => point.v);
  const minU = Math.min(...us);
  const maxU = Math.max(...us);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const width = Math.max(maxU - minU, only ? 4 : 6) * 1.25;
  const height = Math.max(maxV - minV, only ? 4 : 6) * 1.25;
  const ppu = Math.min(size.width / width, size.height / height);
  return {
    cx: (minU + maxU) / 2,
    cy: (minV + maxV) / 2,
    ppu: Math.min(PPU_MAX, Math.max(PPU_MIN, ppu)),
  };
}

/** Camera view wedge in screen space (3D top view only, so plane v maps straight to y). */
function wedgePath(facing: PlanePoint): string {
  const { u, v } = facing;
  return `M0 0 L${u * 24 - v * 9} ${v * 24 + u * 9} L${u * 24 + v * 9} ${v * 24 - u * 9} Z`;
}

function gridStep(ppu: number): number {
  for (const step of [0.1, 0.5, 1, 5, 10, 50, 100, 500]) {
    if (step * ppu >= 18) {
      return step;
    }
  }
  return 1000;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

type Gesture =
  | {
      kind: 'drag';
      pointerId: number;
      entityId: string;
      start: PlanePoint;
      startPosition: Vec3;
      scene: Scene;
      mergeKey: string;
      moved: boolean;
    }
  | {
      kind: 'pan';
      pointerId: number;
      startX: number;
      startY: number;
      startView: View;
      moved: boolean;
    }
  | { kind: 'pinch'; startDistance: number; startView: View };

let gestureCounter = 0;

export function Viewport() {
  const session = useSession();
  const ui = useEditorUi();
  const scene = useEditorState(activeScene);
  const projectType = useEditorState((state) => state.document.type);
  const selection = useEditorState((state) => state.selection);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const [snap, setSnap] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const shapes = useMemo(
    () => (scene ? buildShapes(scene, projectType) : []),
    [scene, projectType],
  );
  const sign = projectType === 'game2d' ? -1 : 1;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // First fit once the container has a size.
  useEffect(() => {
    if (view === null && size.width > 0) {
      setView(fitView(shapes, size));
    }
  }, [view, size, shapes]);

  const current = view ?? { cx: 0, cy: 0, ppu: 40 };

  useEffect(() => {
    ui.placementRef.current =
      projectType === 'game2d'
        ? [roundTo(current.cx, 0.5), roundTo(current.cy, 0.5), 0]
        : [roundTo(current.cx, 0.5), 0.5, roundTo(current.cy, 0.5)];
  }, [current.cx, current.cy, projectType, ui.placementRef]);

  const focusToken = ui.focusToken;
  const lastFocus = useRef(focusToken);
  useEffect(() => {
    if (focusToken === lastFocus.current) {
      return;
    }
    lastFocus.current = focusToken;
    const selected = new Set(session.getState().selection);
    setView(fitView(shapes, size, selected.size > 0 ? selected : undefined));
  }, [focusToken, shapes, size, session]);

  const toScreen = useCallback(
    (point: PlanePoint) => ({
      x: size.width / 2 + (point.u - current.cx) * current.ppu,
      y: size.height / 2 + sign * (point.v - current.cy) * current.ppu,
    }),
    [size, current, sign],
  );

  const toPlanePoint = useCallback(
    (clientX: number, clientY: number): PlanePoint => {
      const rect = svgRef.current?.getBoundingClientRect();
      const x = clientX - (rect?.left ?? 0);
      const y = clientY - (rect?.top ?? 0);
      return {
        u: current.cx + (x - size.width / 2) / current.ppu,
        v: current.cy + (sign * (y - size.height / 2)) / current.ppu,
      };
    },
    [current, size, sign],
  );

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      setView((previous) => {
        const base = previous ?? current;
        const ppu = Math.min(PPU_MAX, Math.max(PPU_MIN, base.ppu * factor));
        if (clientX === undefined || clientY === undefined) {
          return { ...base, ppu };
        }
        const anchor = toPlanePoint(clientX, clientY);
        const ratio = base.ppu / ppu;
        return {
          ppu,
          cx: anchor.u + (base.cx - anchor.u) * ratio,
          cy: anchor.v + (base.cy - anchor.v) * ratio,
        };
      });
    },
    [current, toPlanePoint],
  );

  useEffect(() => {
    const element = svgRef.current;
    if (!element) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const endGesture = () => {
    const active = gesture.current;
    if (active?.kind === 'drag') {
      session.closeMergeGroup();
    }
    if (active?.kind === 'pan' && !active.moved) {
      session.select([]);
    }
    gesture.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svgRef.current?.setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) {
        if (gesture.current?.kind === 'drag') {
          session.closeMergeGroup();
        }
        gesture.current = {
          kind: 'pinch',
          startDistance: Math.hypot(a.x - b.x, a.y - b.y),
          startView: current,
        };
      }
      return;
    }
    const target =
      event.target instanceof Element ? event.target.closest('[data-entity-id]') : null;
    const entityId = target?.getAttribute('data-entity-id') ?? null;
    if (entityId && scene) {
      session.select([entityId]);
      const entity = scene.entities[entityId];
      const transform = entity ? findComponent(entity, 'transform') : undefined;
      if (ui.tool === 'move' && transform) {
        gestureCounter += 1;
        gesture.current = {
          kind: 'drag',
          pointerId: event.pointerId,
          entityId,
          start: toPlanePoint(event.clientX, event.clientY),
          startPosition: transform.data.position,
          scene,
          mergeKey: `drag-${gestureCounter}`,
          moved: false,
        };
      } else {
        gesture.current = null;
      }
      return;
    }
    gesture.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startView: current,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const active = gesture.current;
    if (!active) {
      return;
    }
    if (active.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (a && b && active.startDistance > 0) {
        const factor = Math.hypot(a.x - b.x, a.y - b.y) / active.startDistance;
        setView({
          ...active.startView,
          ppu: Math.min(PPU_MAX, Math.max(PPU_MIN, active.startView.ppu * factor)),
        });
      }
      return;
    }
    if (event.pointerId !== active.pointerId) {
      return;
    }
    if (active.kind === 'pan') {
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      if (!active.moved && Math.hypot(dx, dy) < 4) {
        return;
      }
      active.moved = true;
      setView({
        ...active.startView,
        cx: active.startView.cx - dx / active.startView.ppu,
        cy: active.startView.cy - (sign * dy) / active.startView.ppu,
      });
      return;
    }
    const point = toPlanePoint(event.clientX, event.clientY);
    const world = planeDeltaToWorld(
      projectType,
      point.u - active.start.u,
      point.v - active.start.v,
    );
    if (!active.moved && Math.hypot(world[0], world[1], world[2]) * current.ppu < 3) {
      return;
    }
    active.moved = true;
    const local = worldDeltaToLocal(active.scene, active.entityId, world);
    const step = snap ? 0.5 : 0.01;
    const position: Vec3 = [
      roundTo(active.startPosition[0] + local[0], step),
      roundTo(active.startPosition[1] + local[1], step),
      roundTo(active.startPosition[2] + local[2], step),
    ];
    const state = session.getState();
    if (state.sceneId === null) {
      return;
    }
    const command = setTransformCommand(state.document, state.sceneId, active.entityId, {
      position,
    });
    const name = active.scene.entities[active.entityId]?.name ?? 'объект';
    if (command) {
      session.dispatch(command, { label: `Переместить «${name}»`, mergeKey: active.mergeKey });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      endGesture();
    } else if (gesture.current?.kind === 'pinch') {
      gesture.current = null;
    }
  };

  const step = gridStep(current.ppu);
  const gridLines = useMemo(() => {
    if (size.width === 0) {
      return [];
    }
    const lines: { key: string; x1: number; y1: number; x2: number; y2: number; kind: string }[] =
      [];
    const halfU = size.width / 2 / current.ppu;
    const halfV = size.height / 2 / current.ppu;
    const kindOf = (value: number, axis: boolean) =>
      Math.abs(value) < step / 2
        ? axis
          ? 'axis-v'
          : 'axis-u'
        : Math.abs(roundTo(value / step, 1) % 5) === 0
          ? 'major'
          : 'minor';
    for (
      let u = Math.floor((current.cx - halfU) / step) * step;
      u <= current.cx + halfU;
      u += step
    ) {
      const x = size.width / 2 + (u - current.cx) * current.ppu;
      lines.push({
        key: `u${u.toFixed(3)}`,
        x1: x,
        y1: 0,
        x2: x,
        y2: size.height,
        kind: kindOf(u, true),
      });
    }
    for (
      let v = Math.floor((current.cy - halfV) / step) * step;
      v <= current.cy + halfV;
      v += step
    ) {
      const y = size.height / 2 + sign * (v - current.cy) * current.ppu;
      lines.push({
        key: `v${v.toFixed(3)}`,
        x1: 0,
        y1: y,
        x2: size.width,
        y2: y,
        kind: kindOf(v, false),
      });
    }
    return lines;
  }, [size, current, step, sign]);

  const selected = new Set(selection);
  const showLabels = current.ppu >= 28;

  return (
    <div className="ed-viewport" ref={containerRef} data-testid="viewport">
      <svg
        ref={svgRef}
        className={`ed-viewport__svg is-tool-${ui.tool}`}
        width={size.width}
        height={size.height}
        role="application"
        aria-label={
          projectType === 'game2d' ? 'Схема сцены 2D (X/Y)' : 'Схема сцены, вид сверху (X/Z)'
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          const target =
            event.target instanceof Element ? event.target.closest('[data-entity-id]') : null;
          if (target) {
            ui.focusSelection();
          }
        }}
      >
        <g className="ed-grid">
          {gridLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={`ed-grid__${line.kind}`}
            />
          ))}
        </g>
        {shapes.map((shape) => {
          const isSelected = selected.has(shape.entity.id);
          const origin = toScreen(shape.origin);
          const className = `ed-shape ed-shape--${shape.kind}${isSelected ? ' is-selected' : ''}${shape.active ? '' : ' is-inactive'}`;
          return (
            <g
              key={shape.entity.id}
              className={className}
              data-entity-id={shape.entity.id}
              data-testid={`viewport-entity-${shape.entity.id}`}
              aria-label={shape.entity.name}
            >
              {shape.outline.length > 0 ? (
                <polygon
                  points={shape.outline
                    .map((point) => {
                      const screen = toScreen(point);
                      return `${screen.x},${screen.y}`;
                    })
                    .join(' ')}
                  style={{ fill: shape.color }}
                />
              ) : (
                <g transform={`translate(${origin.x} ${origin.y})`}>
                  <circle r={11} className="ed-shape__marker" />
                  {shape.facing ? (
                    <path d={wedgePath(shape.facing)} className="ed-shape__frustum" />
                  ) : null}
                  <text className="ed-shape__icon" textAnchor="middle" dominantBaseline="central">
                    {shape.kind === 'camera'
                      ? '◧'
                      : shape.kind === 'light'
                        ? '✶'
                        : shape.kind === 'audio'
                          ? '♪'
                          : '+'}
                  </text>
                </g>
              )}
              {isSelected ? (
                <circle cx={origin.x} cy={origin.y} r={4} className="ed-shape__pivot" />
              ) : null}
              {showLabels || isSelected ? (
                <text
                  x={origin.x}
                  y={shape.outline.length > 0 ? origin.y + 24 : origin.y - 18}
                  textAnchor="middle"
                  className="ed-shape__label"
                >
                  {shape.entity.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="ed-viewport__badge mono" aria-hidden="true">
        {projectType === 'game2d' ? 'Схема 2D · X/Y' : 'Вид сверху · X/Z'} · клетка {step} м
      </div>
      <div className="ed-viewport__note">
        Схема по данным сцены. Полноценный 3D-вьюпорт — этап G4.
      </div>
      <div className="ed-viewport__zoom">
        <button
          type="button"
          className={`ed-icon-btn${snap ? ' is-active' : ''}`}
          aria-pressed={snap}
          title="Привязка к шагу 0,5 м"
          onClick={() => setSnap((value) => !value)}
        >
          #
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          aria-label="Приблизить"
          onClick={() => zoomAt(1.25)}
        >
          +
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          aria-label="Отдалить"
          onClick={() => zoomAt(0.8)}
        >
          −
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          aria-label="Показать всё"
          title="Показать всё"
          onClick={() => setView(fitView(shapes, size))}
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
