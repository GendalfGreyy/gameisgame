import { describe, expect, it } from 'vitest';

import { parseStartPayload } from './parse.js';

describe('parseStartPayload', () => {
  it('parses referral', () => {
    expect(parseStartPayload('ref_clxxxxxxxxxx')).toEqual({
      kind: 'referral',
      userId: 'clxxxxxxxxxx',
    });
  });

  it('parses event deep link', () => {
    expect(parseStartPayload('evt_clzzzzzzzzzz')).toEqual({
      kind: 'event',
      eventId: 'clzzzzzzzzzz',
    });
  });

  it('returns none for empty', () => {
    expect(parseStartPayload(undefined)).toEqual({ kind: 'none' });
  });
});
