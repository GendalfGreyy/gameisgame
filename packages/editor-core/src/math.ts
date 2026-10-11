import type { ComponentData, Scene, Vec3 } from '@tg-creator/project-schema';

import { findComponent } from './factories.js';
import { getEntity } from './scene.js';

/**
 * Column-major 4×4 matrices. Rotation follows the PlayCanvas convention used by the G4
 * engine adapter: Euler angles in degrees, R = Rz · Ry · Rx (X is applied first).
 * World = parentWorld · T · R · S.
 */
export type Mat4 = readonly number[];

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const DEG = Math.PI / 180;

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: number[] = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

export function composeTransform(transform: ComponentData<'transform'>): Mat4 {
  const [tx, ty, tz] = transform.position;
  const [rx, ry, rz] = transform.rotationEuler;
  const [sx, sy, sz] = transform.scale;
  const cx = Math.cos(rx * DEG);
  const sxr = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG);
  const syr = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG);
  const szr = Math.sin(rz * DEG);
  // Columns of R = Rz·Ry·Rx.
  const r00 = cz * cy;
  const r10 = szr * cy;
  const r20 = -syr;
  const r01 = cz * syr * sxr - szr * cx;
  const r11 = szr * syr * sxr + cz * cx;
  const r21 = cy * sxr;
  const r02 = cz * syr * cx + szr * sxr;
  const r12 = szr * syr * cx - cz * sxr;
  const r22 = cy * cx;
  // prettier-ignore
  return [
    r00 * sx, r10 * sx, r20 * sx, 0,
    r01 * sy, r11 * sy, r21 * sy, 0,
    r02 * sz, r12 * sz, r22 * sz, 0,
    tx, ty, tz, 1,
  ];
}

export function transformPoint(matrix: Mat4, point: Vec3): Vec3 {
  const [x, y, z] = point;
  const m = (index: number) => matrix[index] ?? 0;
  return [
    m(0) * x + m(4) * y + m(8) * z + m(12),
    m(1) * x + m(5) * y + m(9) * z + m(13),
    m(2) * x + m(6) * y + m(10) * z + m(14),
  ];
}

/** Applies only the linear 3×3 part (directions, deltas). */
export function transformDirection(matrix: Mat4, vector: Vec3): Vec3 {
  const [x, y, z] = vector;
  const m = (index: number) => matrix[index] ?? 0;
  return [
    m(0) * x + m(4) * y + m(8) * z,
    m(1) * x + m(5) * y + m(9) * z,
    m(2) * x + m(6) * y + m(10) * z,
  ];
}

/** Inverse of the linear 3×3 part; `null` for degenerate (zero-scale) matrices. */
export function invertLinear(matrix: Mat4): Mat4 | null {
  const m = (index: number) => matrix[index] ?? 0;
  // Row-major names for the column-major storage: [a b c; d e f; g h i].
  const [a, b, c] = [m(0), m(4), m(8)];
  const [d, e, f] = [m(1), m(5), m(9)];
  const [g, h, i] = [m(2), m(6), m(10)];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) {
    return null;
  }
  const inv = 1 / det;
  // prettier-ignore
  return [
    (e * i - f * h) * inv, (f * g - d * i) * inv, (d * h - e * g) * inv, 0,
    (c * h - b * i) * inv, (a * i - c * g) * inv, (b * g - a * h) * inv, 0,
    (b * f - c * e) * inv, (c * d - a * f) * inv, (a * e - b * d) * inv, 0,
    0, 0, 0, 1,
  ];
}

export function localMatrix(scene: Scene, entityId: string): Mat4 {
  const entity = getEntity(scene, entityId);
  const transform = entity ? findComponent(entity, 'transform') : undefined;
  return transform ? composeTransform(transform.data) : IDENTITY;
}

export function worldMatrix(scene: Scene, entityId: string): Mat4 {
  const chain: string[] = [];
  const guard = new Set<string>();
  let current: string | null = entityId;
  while (current !== null && !guard.has(current)) {
    guard.add(current);
    chain.unshift(current);
    current = getEntity(scene, current)?.parentId ?? null;
  }
  return chain.reduce((matrix, id) => multiply(matrix, localMatrix(scene, id)), IDENTITY);
}

export function parentWorldMatrix(scene: Scene, entityId: string): Mat4 {
  const parentId = getEntity(scene, entityId)?.parentId ?? null;
  return parentId === null ? IDENTITY : worldMatrix(scene, parentId);
}

export function worldPosition(scene: Scene, entityId: string): Vec3 {
  return transformPoint(worldMatrix(scene, entityId), [0, 0, 0]);
}

/**
 * Converts a world-space translation into the entity's local position change, so dragging
 * a child of a rotated/scaled parent moves it exactly under the pointer.
 */
export function worldDeltaToLocal(scene: Scene, entityId: string, delta: Vec3): Vec3 {
  const inverse = invertLinear(parentWorldMatrix(scene, entityId));
  return inverse ? transformDirection(inverse, delta) : delta;
}
