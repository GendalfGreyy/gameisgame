/** Format metres for display in feed cards. */
export function formatDistanceM(distanceM: number | undefined): string | null {
  if (distanceM === undefined) {
    return null;
  }
  if (distanceM < 1000) {
    return `${Math.round(distanceM / 10) * 10} м`;
  }
  return `${(distanceM / 1000).toFixed(1)} км`;
}

export function formatTimeWindow(startsAt: string, endsAt: string): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${format(startsAt)} – ${format(endsAt)}`;
}
