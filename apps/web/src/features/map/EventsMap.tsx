import type { EventSummary } from '@game-is-game/shared';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import type { GeoPosition } from '../events/hooks.js';
import { MAP_STYLE_URL } from './map-config.js';

import 'maplibre-gl/dist/maplibre-gl.css';

type EventsMapProps = {
  center: GeoPosition;
  events: EventSummary[];
  onOpenEvent: (eventId: string) => void;
};

const ACCENT = '#5b8cff';

export function EventsMap({ center, events, onOpenEvent }: EventsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
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
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const event of events) {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = String(Math.min(event.participantCount, 9) || '·');
      element.title = event.title;
      element.style.cssText = [
        'width:32px',
        'height:32px',
        'border-radius:9999px',
        `background:${ACCENT}`,
        'border:2px solid white',
        'color:white',
        'font-size:11px',
        'font-weight:700',
        'cursor:pointer',
        'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
      ].join(';');
      element.addEventListener('click', () => onOpenRef.current(event.id));

      markersRef.current.push(
        new maplibregl.Marker({ element })
          .setLngLat([event.location.lng, event.location.lat])
          .addTo(map),
      );
    }

    const userDot = document.createElement('div');
    userDot.style.cssText =
      'width:14px;height:14px;border-radius:9999px;background:#34d399;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)';
    markersRef.current.push(
      new maplibregl.Marker({ element: userDot }).setLngLat([center.lng, center.lat]).addTo(map),
    );

    if (events.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([center.lng, center.lat]);
      for (const event of events) {
        bounds.extend([event.location.lng, event.location.lat]);
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 400 });
    } else {
      map.flyTo({ center: [center.lng, center.lat], zoom: 13, duration: 400 });
    }
  }, [center.lat, center.lng, events]);

  return (
    <div
      ref={containerRef}
      className="h-56 w-full overflow-hidden rounded-2xl border border-white/10"
      aria-label="Карта событий"
    />
  );
}
