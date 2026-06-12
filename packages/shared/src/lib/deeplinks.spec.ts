import { describe, expect, it } from 'vitest';

import {
  encodeEventStartParam,
  encodeReferralStartParam,
  parseEventStartParam,
  parseReferralStartParam,
} from './deeplinks.js';

describe('deeplinks', () => {
  it('round-trips referral param', () => {
    const userId = 'clxxxxxxxxxxxxxxxx';
    const param = encodeReferralStartParam(userId);
    expect(parseReferralStartParam(param)).toBe(userId);
  });

  it('round-trips event param', () => {
    const eventId = 'clzzzzzzzzzzzzzzzz';
    const param = encodeEventStartParam(eventId);
    expect(parseEventStartParam(param)).toBe(eventId);
  });
});
