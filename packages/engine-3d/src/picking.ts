export type V3 = readonly [number, number, number];

/** Column-major 4×4 matrix, the layout PlayCanvas `Mat4.data` uses. */
export type M4 = ArrayLike<number>;

/**
 * Slab test. Returns the distance along `direction` to the first hit with the box
 * (0 when the origin is inside), or `null`. Thin boxes (planes) get a small thickness.
 */
export function rayAabb(
  origin: V3,
  direction: V3,
  min: V3,
  max: V3,
  epsilon = 1e-3,
): number | null {
  let near = -Infinity;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    let lo = min[axis] ?? 0;
    let hi = max[axis] ?? 0;
    if (hi - lo < epsilon) {
      lo -= epsilon;
      hi += epsilon;
    }
    const o = origin[axis] ?? 0;
    const d = direction[axis] ?? 0;
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) {
        return null;
      }
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far || far < 0) {
      return null;
    }
  }
  return Math.max(near, 0);
}

function transformPoint(m: M4, p: V3): [number, number, number] {
  const x = p[0];
  const y = p[1];
  const z = p[2];
  return [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
  ];
}

function transformVector(m: M4, v: V3): [number, number, number] {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  return [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z,
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z,
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z,
  ];
}

/**
 * Ray against an oriented box: `inverseWorld` maps world space into the box's local space
 * where it is the axis-aligned `min..max`. Returns the world-space hit distance or `null`.
 */
export function rayObb(
  origin: V3,
  direction: V3,
  inverseWorld: M4,
  world: M4,
  min: V3,
  max: V3,
): number | null {
  const localOrigin = transformPoint(inverseWorld, origin);
  const localDirection = transformVector(inverseWorld, direction);
  const t = rayAabb(localOrigin, localDirection, min, max);
  if (t === null) {
    return null;
  }
  const localHit: V3 = [
    localOrigin[0] + localDirection[0] * t,
    localOrigin[1] + localDirection[1] * t,
    localOrigin[2] + localDirection[2] * t,
  ];
  const hit = transformPoint(world, localHit);
  return Math.hypot(hit[0] - origin[0], hit[1] - origin[1], hit[2] - origin[2]);
}

/** Where the ray meets the horizontal plane `y = height`, or `null` if it never does. */
export function rayGround(origin: V3, direction: V3, height = 0): V3 | null {
  if (Math.abs(direction[1]) < 1e-9) {
    return null;
  }
  const t = (height - origin[1]) / direction[1];
  if (t < 0) {
    return null;
  }
  return [origin[0] + direction[0] * t, height, origin[2] + direction[2] * t];
}

export function roundTo(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  // Avoid "-0" and float noise like 0.30000000000000004 in the saved JSON.
  return Number.parseFloat((rounded === 0 ? 0 : rounded).toFixed(6));
}

/** Wraps an angle in degrees into (-180, 180]. */
export function wrapDegrees(value: number): number {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}
