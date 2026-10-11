import type { Vec3 } from '@tg-creator/project-schema';
import { describe, expect, it } from 'vitest';

import { applyCommand } from './commands.js';
import { setTransformCommand } from './factories.js';
import {
  composeTransform,
  invertLinear,
  multiply,
  transformPoint,
  worldDeltaToLocal,
  worldPosition,
} from './math.js';
import { findScene } from './scene.js';
import { starterDocument } from './testing.js';

function close(actual: Vec3, expected: Vec3) {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 6));
}

describe('transform math (PlayCanvas convention, degrees, R = Rz·Ry·Rx)', () => {
  it('rotates about each axis right-handedly', () => {
    const at = (rotationEuler: Vec3) =>
      transformPoint(
        composeTransform({ position: [0, 0, 0], rotationEuler, scale: [1, 1, 1] }),
        [1, 0, 0],
      );
    close(at([0, 0, 90]), [0, 1, 0]);
    close(at([0, 90, 0]), [0, 0, -1]);
    close(
      transformPoint(
        composeTransform({ position: [0, 0, 0], rotationEuler: [90, 0, 0], scale: [1, 1, 1] }),
        [0, 1, 0],
      ),
      [0, 0, 1],
    );
  });

  it('applies X first, then Y, then Z', () => {
    const combined = composeTransform({
      position: [0, 0, 0],
      rotationEuler: [30, 40, 50],
      scale: [1, 1, 1],
    });
    const only = (rotationEuler: Vec3) =>
      composeTransform({ position: [0, 0, 0], rotationEuler, scale: [1, 1, 1] });
    const sequential = multiply(only([0, 0, 50]), multiply(only([0, 40, 0]), only([30, 0, 0])));
    close(transformPoint(combined, [1, 2, 3]), transformPoint(sequential, [1, 2, 3]));
  });

  it('inverts the linear part and refuses zero scale', () => {
    const matrix = composeTransform({
      position: [5, 5, 5],
      rotationEuler: [10, 20, 30],
      scale: [2, 3, 4],
    });
    const inverse = invertLinear(matrix);
    if (!inverse) throw new Error('not invertible');
    const direction: Vec3 = [1, -2, 0.5];
    const there = transformPoint(matrix, direction);
    const back = transformPoint(inverse, [there[0] - 5, there[1] - 5, there[2] - 5]);
    close(back, direction);
    expect(
      invertLinear(
        composeTransform({ position: [0, 0, 0], rotationEuler: [0, 0, 0], scale: [0, 1, 1] }),
      ),
    ).toBeNull();
  });

  it('world position of a child under a rotated, scaled parent; drag delta maps back', () => {
    let document = starterDocument();
    const reparent = applyCommand(document, {
      type: 'entity.move',
      sceneId: 'scene_main',
      entityId: 'entity_cube',
      parentId: 'entity_ground',
      index: 0,
    });
    if (!reparent.ok) throw new Error(reparent.error.message);
    document = reparent.document;
    // Ground: position 0, scale [10,1,10]; rotate it 90° about Y.
    const rotate = setTransformCommand(document, 'scene_main', 'entity_ground', {
      rotationEuler: [0, 90, 0],
    });
    if (!rotate) throw new Error('transform missing');
    const rotated = applyCommand(document, rotate);
    if (!rotated.ok) throw new Error(rotated.error.message);
    const scene = findScene(rotated.document, 'scene_main');
    if (!scene) throw new Error('scene missing');

    // Cube local [0,1,0] stays above the parent origin.
    close(worldPosition(scene, 'entity_cube'), [0, 1, 0]);
    // Moving 1 m along world X equals -0.1 along local Z (90° yaw, ×10 scale).
    close(worldDeltaToLocal(scene, 'entity_cube', [1, 0, 0]), [0, 0, 0.1]);
  });
});
