import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME, PACKAGE_STATUS } from './index.js';

describe('@tg-creator/worker', () => {
  it('is marked Planned in G0', () => {
    expect(PACKAGE_STATUS).toBe('Planned');
    expect(PACKAGE_NAME).toBe('@tg-creator/worker');
  });
});
