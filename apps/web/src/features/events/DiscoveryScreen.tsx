import type { UserProfile } from '@game-is-game/shared';
import { useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { AnimatedNumber, EventCardSkeleton, Sonar, Stagger } from '../../shared/ui/motion.js';
import { Avatar, Chip, ErrorBanner } from '../../shared/ui/primitives.js';
import { LazyEventsRadarMap } from '../map/LazyMaps.js';
import { useGeolocation } from '../privacy/geolocation.js';
import { EventCard } from './EventCard.js';
import { useNearbyEvents } from './hooks.js';

type ViewMode = 'list' | 'radar';

export function DiscoveryScreen({
  user,
  onOpenEvent,
}: {
  user: UserProfile;
  onOpenEvent: (eventId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const geo = useGeolocation();
  const nearby = useNearbyEvents(geo.position);

  if (geo.error) {
    return (
      <section className="space-y-6">
        <DiscoveryHeader user={user} liveCount={null} />
        <div className="animate-fade-up space-y-5 pt-6 text-center">
          <Sonar emoji="🛰️" />
          <div className="space-y-1">
            <p className="text-lg font-bold text-gig-ink">Нужна локация</p>
            <p className="mx-auto max-w-[260px] text-sm leading-relaxed text-gig-muted">
              {geo.error}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.press();
              geo.refresh();
            }}
            className="gig-gradient-text text-sm font-bold"
          >
            Разрешить геолокацию
          </button>
        </div>
      </section>
    );
  }

  if (!geo.position) {
    return (
      <section className="space-y-6">
        <DiscoveryHeader user={user} liveCount={null} />
        <div className="animate-fade-up space-y-4 pt-6 text-center">
          <Sonar emoji="📍" />
          <p className="text-sm text-gig-muted">Сканирую район…</p>
        </div>
      </section>
    );
  }

  const items = nearby.data?.items;
  const isFallback = nearby.data?.fallback === true;
  const radarEvents = nearby.data?.items ?? [];
  const liveCount = items?.filter(
    (event) =>
      new Date(event.startsAt).getTime() <= Date.now() &&
      new Date(event.endsAt).getTime() > Date.now(),
  ).length;

  return (
    <section className="space-y-5">
      <DiscoveryHeader user={user} liveCount={isFallback ? null : (liveCount ?? null)} />

      <div className="flex flex-wrap gap-2">
        <Chip
          active={viewMode === 'radar'}
          onClick={() => {
            haptics.tap();
            setViewMode('radar');
          }}
        >
          Radar
        </Chip>
        <Chip
          active={viewMode === 'list'}
          onClick={() => {
            haptics.tap();
            setViewMode('list');
          }}
        >
          Список
        </Chip>
      </div>

      {viewMode === 'radar' ? (
        <div className="animate-fade-up space-y-2">
          <div className="overflow-hidden rounded-4xl border border-black/[0.06] shadow-card">
            <LazyEventsRadarMap
              center={geo.position}
              events={radarEvents}
              onOpenEvent={onOpenEvent}
            />
          </div>
          <p className="text-xs leading-relaxed text-gig-muted">
            Heat-зоны — агрегат активности, без точек людей. Пины — события.
          </p>
        </div>
      ) : null}

      {viewMode === 'list' && nearby.isLoading ? (
        <div className="space-y-3">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      ) : null}
      {nearby.error ? <ErrorBanner message={nearby.error.message} /> : null}

      {viewMode === 'list' && isFallback ? (
        <div className="animate-fade-up space-y-4 pt-2 text-center">
          <Sonar emoji="🌃" />
          <div className="space-y-1">
            <p className="text-lg font-bold text-gig-ink">Рядом пока тихо</p>
            <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-gig-muted">
              Радар пуст — но вот что стартует раньше всего. Или создай своё и зажги район.
            </p>
          </div>
        </div>
      ) : null}

      {viewMode === 'list' && items && items.length === 0 && !isFallback ? (
        <div className="animate-fade-up space-y-4 pt-2 text-center">
          <Sonar emoji="🌃" />
          <div className="space-y-1">
            <p className="text-lg font-bold text-gig-ink">Пока пусто</p>
            <p className="text-sm text-gig-muted">Будь первым, кто что-то замутит.</p>
          </div>
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <div className="space-y-3">
          {items?.map((event, index) => (
            <Stagger key={event.id} index={index}>
              <EventCard
                event={event}
                onOpen={(eventId) => {
                  haptics.press();
                  onOpenEvent(eventId);
                }}
              />
            </Stagger>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DiscoveryHeader({ user, liveCount }: { user: UserProfile; liveCount: number | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-[26px] font-bold tracking-tight text-gig-ink">Рядом</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gig-muted">{user.firstName} ·</span>
          <AnimatedNumber value={user.totalPoints} className="font-bold text-gig-accent" />
          <span className="text-gig-muted">очков</span>
          {liveCount ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
              <span className="gig-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {liveCount} live
            </span>
          ) : null}
        </div>
      </div>
      <Avatar name={user.firstName} photoUrl={user.photoUrl} size="md" />
    </div>
  );
}
