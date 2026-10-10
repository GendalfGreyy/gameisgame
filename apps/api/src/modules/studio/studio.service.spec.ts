import { buildStudioSceneFromTemplate, studioSceneSchema } from '@game-is-game/shared';
import { describe, expect, it } from 'vitest';

describe('studio scene contracts', () => {
  it('platformer template stays within entity budget', () => {
    const scene = buildStudioSceneFromTemplate('platformer');
    const parsed = studioSceneSchema.parse(scene);
    expect(parsed.entities.length).toBeLessThanOrEqual(64);
    expect(parsed.entities.filter((e) => e.behaviors.includes('player')).length).toBe(1);
  });
});
