import { describe, expect, it } from 'vitest';

import {
  encodeEventStartParam,
  encodeReferralStartParam,
  encodeStudioGameStartParam,
  parseEventStartParam,
  parseReferralStartParam,
  parseStudioGameStartParam,
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

  it('round-trips studio game param', () => {
    const projectId = 'clgggggggggggggggg';
    const param = encodeStudioGameStartParam(projectId);
    expect(parseStudioGameStartParam(param)).toBe(projectId);
  });
});
