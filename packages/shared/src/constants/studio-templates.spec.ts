import { describe, expect, it } from 'vitest';

import { studioSceneSchema } from '../schemas/studio.js';
import { buildStudioSceneFromTemplate } from './studio-templates.js';

describe('studio templates', () => {
  it.each(['empty', 'platformer', 'collector'] as const)(
    'builds a valid %s scene with a player',
    (template) => {
      const scene = buildStudioSceneFromTemplate(template);
      const parsed = studioSceneSchema.parse(scene);
      expect(parsed.entities.some((e) => e.behaviors.includes('player'))).toBe(true);
      expect(parsed.entities.length).toBeGreaterThan(0);
    },
  );
});
