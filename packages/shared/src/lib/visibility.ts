import type { PrivacyMode } from '../types/enums.js';
import { GEOHASH_PRECISION_APPROX } from '../constants/geo.js';

const APPROX_CELL_DEG = 0.045;

export function obfuscateCoordinates(
  lat: number,
  lng: number,
  mode: PrivacyMode,
): { lat: number; lng: number } {
  if (mode === 'precise') {
    return { lat, lng };
  }
  const cell = APPROX_CELL_DEG;
  return {
    lat: Math.round(lat / cell) * cell,
    lng: Math.round(lng / cell) * cell,
  };
}

export function approximateGridPrecision(): number {
  return GEOHASH_PRECISION_APPROX;
}
