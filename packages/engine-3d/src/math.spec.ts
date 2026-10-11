import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ORBIT,
  frameSphere,
  isOrbitState,
  orbitBy,
  orbitPosition,
  panBy,
  zoomBy,
} from './orbit.js';
import { rayAabb, rayGround, rayObb, roundTo, wrapDegrees } from './picking.js';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('picking math', () => {
  it('ray hits and misses an axis-aligned box', () => {
    expect(rayAabb([0, 0, 5], [0, 0, -1], [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5])).toBeCloseTo(4.5);
    expect(rayAabb([2, 0, 5], [0, 0, -1], [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5])).toBeNull();
    expect(rayAabb([0, 0, 0], [0, 0, -1], [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5])).toBe(0);
    // Behind the origin does not count.
    expect(rayAabb([0, 0, -5], [0, 0, -1], [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5])).toBeNull();
  });

  it('flat boxes (planes) are still hittable', () => {
    expect(rayAabb([0, 5, 0], [0, -1, 0], [-0.5, 0, -0.5], [0.5, 0, 0.5])).toBeCloseTo(5, 2);
  });

  it('oriented box: a cube scaled ×2 and moved to x = 3', () => {
    const world = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 3, 0, 0, 1];
    const inverse = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, -1.5, 0, 0, 1];
    expect(
      rayObb([3, 0, 10], [0, 0, -1], inverse, world, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]),
    ).toBeCloseTo(9);
    expect(
      rayObb([0, 0, 10], [0, 0, -1], inverse, world, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]),
    ).toBeNull();
    expect(
      rayObb([0, 0, 10], [0, 0, -1], IDENTITY, IDENTITY, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]),
    ).toBeCloseTo(9.5);
  });

  it('ground intersection and rounding helpers', () => {
    expect(rayGround([0, 10, 0], [0, -1, 0])).toEqual([0, 0, 0]);
    expect(rayGround([0, 10, 0], [0, 1, 0])).toBeNull();
    expect(roundTo(0.1 + 0.2, 0.001)).toBe(0.3);
    expect(Object.is(roundTo(-0.0001, 0.01), 0)).toBe(true);
    expect(wrapDegrees(270)).toBe(-90);
    expect(wrapDegrees(-180)).toBe(180);
  });
});

describe('editor orbit camera', () => {
  it('default view looks at the target from above', () => {
    const position = orbitPosition(DEFAULT_ORBIT);
    expect(position[1]).toBeGreaterThan(DEFAULT_ORBIT.target[1]);
    const distance = Math.hypot(
      position[0] - DEFAULT_ORBIT.target[0],
      position[1] - DEFAULT_ORBIT.target[1],
      position[2] - DEFAULT_ORBIT.target[2],
    );
    expect(distance).toBeCloseTo(DEFAULT_ORBIT.distance);
  });

  it('orbit clamps pitch, zoom clamps distance', () => {
    expect(orbitBy(DEFAULT_ORBIT, 0, 10_000).pitch).toBe(-89);
    expect(zoomBy(DEFAULT_ORBIT, 1e-6).distance).toBe(0.5);
    expect(zoomBy(DEFAULT_ORBIT, 1e6).distance).toBe(500);
  });

  it('pan moves the target in the view plane and keeps the distance', () => {
    const state = { target: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, distance: 10 };
    const moved = panBy(state, 100, 0, 1000, 60);
    expect(moved.target[0]).toBeLessThan(0);
    expect(moved.target[1]).toBeCloseTo(0);
    expect(moved.target[2]).toBeCloseTo(0);
    const up = panBy(state, 0, 100, 1000, 60);
    expect(up.target[1]).toBeGreaterThan(0);
    // Pan direction stays orthogonal to the viewing direction when looking down.
    const tilted = { ...state, pitch: -40, yaw: 30 };
    const pannedUp = panBy(tilted, 0, 100, 1000, 60);
    const delta = pannedUp.target;
    const back = [
      Math.sin((30 * Math.PI) / 180) * Math.cos((-40 * Math.PI) / 180),
      -Math.sin((-40 * Math.PI) / 180),
      Math.cos((30 * Math.PI) / 180) * Math.cos((-40 * Math.PI) / 180),
    ];
    expect(
      delta[0] * (back[0] ?? 0) + delta[1] * (back[1] ?? 0) + delta[2] * (back[2] ?? 0),
    ).toBeCloseTo(0);
  });

  it('frameSphere centres the selection and fits it', () => {
    const framed = frameSphere(DEFAULT_ORBIT, [3, 1, -2], 1, 50);
    expect(framed.target).toEqual([3, 1, -2]);
    expect(framed.distance).toBeGreaterThan(1);
  });

  it('validates stored camera state', () => {
    expect(isOrbitState(DEFAULT_ORBIT)).toBe(true);
    expect(isOrbitState({ target: [0, 0], yaw: 0, pitch: 0, distance: 1 })).toBe(false);
    expect(isOrbitState(null)).toBe(false);
  });
});
