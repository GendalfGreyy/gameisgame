import { describe, expect, it } from 'vitest';
import { PACKAGE_STATUS } from './index.js';

describe('@tg-creator/telegram', () => {
  it('is marked Planned in G0', () => {
    expect(PACKAGE_STATUS).toBe('Planned');
  });
});
