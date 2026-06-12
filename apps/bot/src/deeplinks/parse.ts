import { parseEventStartParam, parseReferralStartParam } from '@game-is-game/shared';

export type StartIntent =
  | { kind: 'referral'; userId: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'none' };

export function parseStartPayload(payload: string | undefined): StartIntent {
  if (!payload) {
    return { kind: 'none' };
  }

  const referralId = parseReferralStartParam(payload);
  if (referralId) {
    return { kind: 'referral', userId: referralId };
  }

  const eventId = parseEventStartParam(payload);
  if (eventId) {
    return { kind: 'event', eventId };
  }

  return { kind: 'none' };
}
