/** Mini App / bot start_param: invite a friend. */
export function encodeReferralStartParam(userId: string): string {
  return `ref_${userId}`;
}

export function parseReferralStartParam(startParam: string | undefined): string | null {
  if (!startParam?.startsWith('ref_')) {
    return null;
  }
  const userId = startParam.slice(4);
  return userId.length >= 8 ? userId : null;
}

/** Mini App startapp payload: open event detail. */
export function encodeEventStartParam(eventId: string): string {
  return `evt_${eventId}`;
}

export function parseEventStartParam(startParam: string | undefined): string | null {
  if (!startParam?.startsWith('evt_')) {
    return null;
  }
  const eventId = startParam.slice(4);
  return eventId.length >= 8 ? eventId : null;
}

export function buildMiniAppDeepLink(botUsername: string, startParam: string): string {
  const username = botUsername.replace(/^@/, '');
  return `https://t.me/${username}?startapp=${encodeURIComponent(startParam)}`;
}

export function buildBotReferralLink(botUsername: string, userId: string): string {
  const username = botUsername.replace(/^@/, '');
  return `https://t.me/${username}?start=${encodeReferralStartParam(userId)}`;
}
