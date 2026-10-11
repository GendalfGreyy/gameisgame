import type { V3 } from './picking.js';

export type OrbitState = {
  target: [number, number, number];
  /** Degrees around +Y; 0 looks from +Z towards the target. */
  yaw: number;
  /** Degrees; negative looks down at the target. */
  pitch: number;
  distance: number;
};

export const DEFAULT_ORBIT: OrbitState = { target: [0, 0.5, 0], yaw: 35, pitch: -28, distance: 14 };

const PITCH_LIMIT = 89;
const DISTANCE_MIN = 0.5;
const DISTANCE_MAX = 500;
const DEG = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isOrbitState(value: unknown): value is OrbitState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  return (
    Array.isArray(v['target']) &&
    v['target'].length === 3 &&
    v['target'].every(finite) &&
    finite(v['yaw']) &&
    finite(v['pitch']) &&
    finite(v['distance'])
  );
}

export function normalizeOrbit(state: OrbitState): OrbitState {
  return {
    target: [state.target[0], state.target[1], state.target[2]],
    yaw: ((state.yaw % 360) + 360) % 360,
    pitch: clamp(state.pitch, -PITCH_LIMIT, PITCH_LIMIT),
    distance: clamp(state.distance, DISTANCE_MIN, DISTANCE_MAX),
  };
}

/** Unit vector from the target towards the camera. */
export function orbitBackward(state: OrbitState): [number, number, number] {
  const yaw = state.yaw * DEG;
  const pitch = state.pitch * DEG;
  return [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

export function orbitPosition(state: OrbitState): [number, number, number] {
  const back = orbitBackward(state);
  return [
    state.target[0] + back[0] * state.distance,
    state.target[1] + back[1] * state.distance,
    state.target[2] + back[2] * state.distance,
  ];
}

/** Drag in CSS pixels → rotation. Dragging right turns the scene right (camera left). */
export function orbitBy(state: OrbitState, dx: number, dy: number, speed = 0.3): OrbitState {
  return normalizeOrbit({ ...state, yaw: state.yaw - dx * speed, pitch: state.pitch - dy * speed });
}

/**
 * Drag in CSS pixels → move the target in the view plane so the point under the finger
 * stays under it (exact at the target's depth).
 */
export function panBy(
  state: OrbitState,
  dx: number,
  dy: number,
  viewportHeight: number,
  fovDegrees: number,
): OrbitState {
  const worldPerPixel =
    (2 * state.distance * Math.tan((fovDegrees * DEG) / 2)) / Math.max(1, viewportHeight);
  const yaw = state.yaw * DEG;
  const pitch = state.pitch * DEG;
  const right: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up: V3 = [
    Math.sin(yaw) * Math.sin(pitch),
    Math.cos(pitch),
    Math.cos(yaw) * Math.sin(pitch),
  ];
  const mx = -dx * worldPerPixel;
  const my = dy * worldPerPixel;
  return {
    ...state,
    target: [
      state.target[0] + right[0] * mx + up[0] * my,
      state.target[1] + right[1] * mx + up[1] * my,
      state.target[2] + right[2] * mx + up[2] * my,
    ],
  };
}

/** `factor` > 1 moves away. */
export function zoomBy(state: OrbitState, factor: number): OrbitState {
  return normalizeOrbit({ ...state, distance: state.distance * factor });
}

/** Fits a bounding sphere into the view, keeping the current angle. */
export function frameSphere(
  state: OrbitState,
  center: V3,
  radius: number,
  fovDegrees: number,
): OrbitState {
  const half = (fovDegrees * DEG) / 2;
  const distance = (Math.max(radius, 0.25) / Math.sin(half)) * 1.15;
  return normalizeOrbit({ ...state, target: [center[0], center[1], center[2]], distance });
}
