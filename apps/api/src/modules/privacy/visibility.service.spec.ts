import { describe, expect, it } from 'vitest';

import { VisibilityService } from './visibility.service.js';

describe('VisibilityService', () => {
  const service = new VisibilityService();

  it('allows self to see own presence regardless of mode', () => {
    expect(service.canShowPresence('u1', { id: 'u1', privacyMode: 'hidden' }, false)).toBe(true);
  });

  it('hides hidden users from others', () => {
    expect(service.canShowPresence('u2', { id: 'u1', privacyMode: 'hidden' }, true)).toBe(false);
  });

  it('shows precise mode only to friends', () => {
    expect(service.canShowPresence('u2', { id: 'u1', privacyMode: 'precise' }, true)).toBe(true);
    expect(service.canShowPresence('u2', { id: 'u1', privacyMode: 'precise' }, false)).toBe(false);
  });

  it('obfuscates approximate coordinates', () => {
    const exact = { lat: 55.751244, lng: 37.618423 };
    const precise = service.obfuscateCoordinates(exact.lat, exact.lng, 'precise');
    expect(precise).toEqual(exact);

    const approx = service.obfuscateCoordinates(exact.lat, exact.lng, 'approximate');
    expect(approx.lat).not.toBe(exact.lat);
    expect(Math.abs(approx.lat - exact.lat)).toBeLessThan(0.1);
  });
});
