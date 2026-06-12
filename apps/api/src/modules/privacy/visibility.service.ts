import type { PrivacyMode } from '@game-is-game/shared';
import { GEOHASH_PRECISION_APPROX } from '@game-is-game/shared';
import { Injectable } from '@nestjs/common';

/** ~5 km grid at mid-latitudes when precision is 5. */
const APPROX_CELL_DEG = 0.045;

@Injectable()
export class VisibilityService {
  /** Whether a user's presence may appear in social surfaces for the viewer. */
  canShowPresence(
    viewerId: string,
    subject: { id: string; privacyMode: PrivacyMode },
    isFriend: boolean,
  ): boolean {
    if (subject.id === viewerId) {
      return true;
    }
    if (subject.privacyMode === 'hidden') {
      return false;
    }
    if (subject.privacyMode === 'precise') {
      return isFriend;
    }
    // approximate: friends see obfuscated presence
    return isFriend;
  }

  obfuscateCoordinates(lat: number, lng: number, mode: PrivacyMode): { lat: number; lng: number } {
    if (mode === 'precise') {
      return { lat, lng };
    }
    const cell = APPROX_CELL_DEG;
    return {
      lat: Math.round(lat / cell) * cell,
      lng: Math.round(lng / cell) * cell,
    };
  }

  /** Grid precision label for docs/tests. */
  approximatePrecision(): number {
    return GEOHASH_PRECISION_APPROX;
  }
}
