import { describe, expect, it } from 'vitest';

import {
  cloneTimesFromEvent,
  endFromStartLocal,
  localToIso,
  toDatetimeLocalValue,
} from './create-event.util.js';

describe('endFromStartLocal', () => {
  it('adds duration minutes to start', () => {
    expect(endFromStartLocal('2026-06-10T18:00', 90)).toBe('2026-06-10T19:30');
  });
});

describe('localToIso', () => {
  it('returns ISO string', () => {
    const iso = localToIso('2026-06-10T18:00');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('cloneTimesFromEvent', () => {
  it('preserves duration between startsAt and endsAt', () => {
    const sourceStart = '2026-06-01T10:00:00.000Z';
    const sourceEnd = '2026-06-01T12:30:00.000Z';
    const durationMs = new Date(sourceEnd).getTime() - new Date(sourceStart).getTime();

    const cloned = cloneTimesFromEvent(sourceStart, sourceEnd);
    const clonedDuration = new Date(cloned.endsAt).getTime() - new Date(cloned.startsAt).getTime();

    expect(clonedDuration).toBe(durationMs);
    expect(cloned.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(cloned.endsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('toDatetimeLocalValue', () => {
  it('formats local datetime for input[type=datetime-local]', () => {
    const value = toDatetimeLocalValue(new Date('2026-06-10T15:30:00'));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
