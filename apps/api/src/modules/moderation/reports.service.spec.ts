import { describe, expect, it } from 'vitest';

import { REPORT_STATUSES, REPORT_TARGET_TYPES } from '@game-is-game/shared';

describe('report enums', () => {
  it('includes expected statuses', () => {
    expect(REPORT_STATUSES).toContain('open');
    expect(REPORT_STATUSES).toContain('actioned');
  });

  it('includes expected target types', () => {
    expect(REPORT_TARGET_TYPES).toEqual(['user', 'event', 'check_in']);
  });
});
