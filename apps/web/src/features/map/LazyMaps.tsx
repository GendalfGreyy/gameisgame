import { lazy, Suspense } from 'react';

import type { EventSummary } from '@game-is-game/shared';

import type { GeoPosition } from '../privacy/geolocation.js';

const EventsRadarMap = lazy(() =>
  import('./EventsRadarMap.js').then((module) => ({ default: module.EventsRadarMap })),
);

const EventsMap = lazy(() =>
  import('./EventsMap.js').then((module) => ({ default: module.EventsMap })),
);

function MapFallback() {
  return (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/50">
      Загружаю карту…
    </div>
  );
}

export function LazyEventsRadarMap(props: {
  center: GeoPosition;
  events: EventSummary[];
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <Suspense fallback={<MapFallback />}>
      <EventsRadarMap {...props} />
    </Suspense>
  );
}

export function LazyEventsMap(props: {
  center: GeoPosition;
  events: EventSummary[];
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <Suspense fallback={<MapFallback />}>
      <EventsMap {...props} />
    </Suspense>
  );
}
