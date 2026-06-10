import type { EventSummary } from '@game-is-game/shared';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDistance(distanceM: number | undefined): string | null {
  if (distanceM === undefined) {
    return null;
  }
  if (distanceM < 1000) {
    return `${Math.round(distanceM / 10) * 10} м`;
  }
  return `${(distanceM / 1000).toFixed(1)} км`;
}

export function EventCard({
  event,
  onOpen,
}: {
  event: EventSummary;
  onOpen: (eventId: string) => void;
}) {
  const distance = formatDistance(event.distanceM);

  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-medium">{event.title}</p>
          <p className="mt-1 text-sm text-white/60">
            {formatTime(event.startsAt)}
            {distance ? ` · ${distance}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="text-white/70">{event.participantCount} идут</p>
          {event.friendsGoing ? (
            <p className="mt-1 font-medium text-tg-accent">
              {event.friendsGoing} {friendsLabel(event.friendsGoing)}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function friendsLabel(count: number): string {
  if (count === 1) {
    return 'друг идёт';
  }
  if (count >= 2 && count <= 4) {
    return 'друга идут';
  }
  return 'друзей идут';
}
