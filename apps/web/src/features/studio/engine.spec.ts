import { buildStudioSceneFromTemplate } from '@game-is-game/shared';
import { describe, expect, it } from 'vitest';

import { StudioRuntime } from './engine.js';

describe('StudioRuntime', () => {
  it('starts in playing state with collectible count', () => {
    const scene = buildStudioSceneFromTemplate('platformer');
    const runtime = new StudioRuntime(scene);
    const state = runtime.getState();
    expect(state.status).toBe('playing');
    expect(state.totalCollectibles).toBeGreaterThan(0);
    expect(state.score).toBe(0);
  });

  it('moves player right when input is set', () => {
    const scene = buildStudioSceneFromTemplate('empty');
    const runtime = new StudioRuntime(scene);
    const beforeX = runtime.getScene().entities.find((e) => e.behaviors.includes('player'))?.x;
    expect(beforeX).toBeDefined();
    runtime.setInput({ right: true });
    for (let i = 0; i < 10; i += 1) {
      runtime.step(1);
    }
    const afterX = runtime.getScene().entities.find((e) => e.behaviors.includes('player'))?.x;
    expect(afterX).toBeGreaterThan(beforeX!);
  });

  it('restart restores pristine positions', () => {
    const scene = buildStudioSceneFromTemplate('empty');
    const runtime = new StudioRuntime(scene);
    runtime.setInput({ right: true });
    runtime.step(1);
    runtime.restart();
    const player = runtime.getScene().entities.find((e) => e.behaviors.includes('player'));
    const spawn = runtime.getScene().entities.find((e) => e.behaviors.includes('spawn'));
    expect(player?.x).toBe(spawn?.x);
    expect(runtime.getState().status).toBe('playing');
  });
});
