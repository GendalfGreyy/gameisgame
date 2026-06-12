import type { EventSummary } from '@game-is-game/shared';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import type { GeoPosition } from '../privacy/geolocation.js';
import { buildHeatCells, eventsToPinGeoJson, heatCellsToGeoJson } from './heat-clusters.js';
import { MAP_STYLE_URL } from './map-config.js';

import 'maplibre-gl/dist/maplibre-gl.css';

const HEAT_SOURCE = 'gig-heat';
const HEAT_LAYER = 'gig-heat-circles';
const PINS_SOURCE = 'gig-pins';
const PINS_LAYER = 'gig-pins-layer';

type EventsRadarMapProps = {
  center: GeoPosition;
  events: EventSummary[];
  onOpenEvent: (eventId: string) => void;
};

export function EventsRadarMap({ center, events, onOpenEvent }: EventsRadarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const onOpenRef = useRef(onOpenEvent);
  onOpenRef.current = onOpenEvent;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(HEAT_SOURCE, {
        type: 'geojson',
        data: heatCellsToGeoJson([]),
      });
      map.addLayer({
        id: HEAT_LAYER,
        type: 'circle',
        source: HEAT_SOURCE,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 2, 18, 8, 48, 16, 72],
          'circle-color': '#5b8cff',
          'circle-opacity': 0.35,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#5b8cff',
          'circle-stroke-opacity': 0.5,
        },
      });

      map.addSource(PINS_SOURCE, {
        type: 'geojson',
        data: eventsToPinGeoJson([]),
      });
      map.addLayer({
        id: PINS_LAYER,
        type: 'circle',
        source: PINS_SOURCE,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#5b8cff',
        },
      });

      map.on('click', PINS_LAYER, (event) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id;
        if (typeof id === 'string') {
          onOpenRef.current(id);
        }
      });
      map.on('mouseenter', PINS_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', PINS_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const heatSource = map.getSource(HEAT_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const pinSource = map.getSource(PINS_SOURCE) as maplibregl.GeoJSONSource | undefined;

    heatSource?.setData(heatCellsToGeoJson(buildHeatCells(events)));
    pinSource?.setData(eventsToPinGeoJson(events));

    if (events.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([center.lng, center.lat]);
      for (const event of events) {
        bounds.extend([event.location.lng, event.location.lat]);
      }
      map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 400 });
    } else {
      map.flyTo({ center: [center.lng, center.lat], zoom: 12, duration: 400 });
    }
  }, [center.lat, center.lng, events, mapReady]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-3xl"
      aria-label="Heat radar событий"
    />
  );
}
