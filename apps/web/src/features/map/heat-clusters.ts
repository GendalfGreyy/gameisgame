import type { EventSummary } from '@game-is-game/shared';

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: { type: 'Point'; coordinates: [number, number] };
  }>;
};

/** Minimum activity weight to draw a heat blob (avoids sad single dots). */
const MIN_HEAT_WEIGHT = 2;

type HeatCell = {
  lat: number;
  lng: number;
  weight: number;
};

/**
 * Grid-cluster events for privacy-safe heat radar (aggregates, not people pins).
 */
export function buildHeatCells(events: EventSummary[], cellDeg = 0.004): HeatCell[] {
  const grid = new Map<string, HeatCell>();

  for (const event of events) {
    const latKey = Math.floor(event.location.lat / cellDeg);
    const lngKey = Math.floor(event.location.lng / cellDeg);
    const key = `${latKey}:${lngKey}`;
    const weight = 1 + Math.min(event.participantCount, 5) + (event.friendsGoing ?? 0);
    const existing = grid.get(key);
    if (existing) {
      existing.weight += weight;
    } else {
      grid.set(key, {
        lat: (latKey + 0.5) * cellDeg,
        lng: (lngKey + 0.5) * cellDeg,
        weight,
      });
    }
  }

  return [...grid.values()].filter((cell) => cell.weight >= MIN_HEAT_WEIGHT);
}

export function heatCellsToGeoJson(cells: HeatCell[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature',
      properties: { weight: cell.weight },
      geometry: {
        type: 'Point',
        coordinates: [cell.lng, cell.lat],
      },
    })),
  };
}

export function eventsToPinGeoJson(events: EventSummary[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      properties: {
        id: event.id,
        title: event.title,
        participants: event.participantCount,
      },
      geometry: {
        type: 'Point',
        coordinates: [event.location.lng, event.location.lat],
      },
    })),
  };
}
