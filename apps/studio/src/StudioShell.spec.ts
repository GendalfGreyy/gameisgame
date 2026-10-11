import { describe, expect, it } from 'vitest';

import { PROJECT_SCHEMA_VERSION } from '@tg-creator/project-schema';

describe('@tg-creator/studio', () => {
  it('depends on project-schema v1', () => {
    expect(PROJECT_SCHEMA_VERSION).toBe(1);
  });
});
