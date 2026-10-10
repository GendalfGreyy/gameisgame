import { describe, expect, it } from 'vitest';
import { PACKAGE_STATUS } from './index.js';

describe('@tg-creator/asset-sdk', () => {
  it('is marked Planned in G0', () => {
    expect(PACKAGE_STATUS).toBe('Planned');
  });
});
