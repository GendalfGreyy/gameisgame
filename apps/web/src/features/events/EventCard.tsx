import type { EventSummary } from '@game-is-game/shared';

import { formatDistanceM, formatTimeWindow } from '../../shared/lib/format.js';
import { Card } from '../../shared/ui/primitives.js';

export function EventCard({
  event,
  onOpen,
}: {
  event: EventSummary;
  onOpen: (eventId: string) => void;
}) {
  const distance = formatDistanceM(event.distanceM);
  const now = Date.now();
  const isLive =
    new Date(event.startsAt).getTime() <= now && new Date(event.endsAt).getTime() > now;
  const isHot = event.hotScore > 0 || event.boostScore > 0;

  return (
    <Card onClick={() => onOpen(event.id)} className="relative overflow-hidden p-4">
      {event.friendsGoing ? (
        <span className="gig-gradient-bg absolute inset-y-0 left-0 w-1" aria-hidden />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                <span className="gig-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                live
              </span>
            ) : null}
            {isHot && !isLive ? <span className="shrink-0 text-sm">🔥</span> : null}
            <p className="truncate text-[16px] font-semibold text-gig-ink">{event.title}</p>
          </div>
          <p className="mt-1 text-sm text-gig-muted">
            {formatTimeWindow(event.startsAt, event.endsAt)}
            {distance ? ` · ${distance}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="font-medium text-gig-ink">{event.participantCount}</p>
          <p className="text-xs text-gig-muted">идут</p>
          {event.friendsGoing ? (
            <p className="gig-gradient-text mt-1 text-xs font-bold">
              {event.friendsGoing} {friendsLabel(event.friendsGoing)}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function friendsLabel(count: number): string {
  if (count === 1) {
    return 'друг';
  }
  if (count >= 2 && count <= 4) {
    return 'друга';
  }
  return 'друзей';
}
