import { describe, expect, it } from 'vitest';

import { applyWeeklyActivity, weekStartUtc } from './streak.util.js';

const monday = (iso: string) => new Date(iso);

describe('weekStartUtc', () => {
  it('returns the same Monday for any day of the week', () => {
    expect(weekStartUtc(new Date('2026-06-10T15:30:00Z')).toISOString()).toBe(
      '2026-06-08T00:00:00.000Z',
    );
    expect(weekStartUtc(new Date('2026-06-08T00:00:00Z')).toISOString()).toBe(
      '2026-06-08T00:00:00.000Z',
    );
    expect(weekStartUtc(new Date('2026-06-14T23:59:59Z')).toISOString()).toBe(
      '2026-06-08T00:00:00.000Z',
    );
  });

  it('handles Sunday as the last day of the week', () => {
    expect(weekStartUtc(new Date('2026-06-07T12:00:00Z')).toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    );
  });
});

describe('applyWeeklyActivity', () => {
  const now = new Date('2026-06-10T18:00:00Z'); // week of 2026-06-08

  it('starts a streak at 1 for a fresh user', () => {
    const result = applyWeeklyActivity(
      { streakWeeks: 0, freezeTokens: 1, lastActiveWeek: null },
      now,
    );
    expect(result.streakWeeks).toBe(1);
    expect(result.extended).toBe(false);
    expect(result.changed).toBe(true);
  });

  it('is idempotent within the same week', () => {
    const result = applyWeeklyActivity(
      { streakWeeks: 3, freezeTokens: 1, lastActiveWeek: monday('2026-06-08T00:00:00Z') },
      now,
    );
    expect(result.changed).toBe(false);
    expect(result.streakWeeks).toBe(3);
  });

  it('extends the streak after a consecutive week', () => {
    const result = applyWeeklyActivity(
      { streakWeeks: 3, freezeTokens: 1, lastActiveWeek: monday('2026-06-01T00:00:00Z') },
      now,
    );
    expect(result.streakWeeks).toBe(4);
    expect(result.extended).toBe(true);
    expect(result.freezeConsumed).toBe(false);
  });

  it('bridges one missed week with a freeze token', () => {
    const result = applyWeeklyActivity(
      { streakWeeks: 5, freezeTokens: 1, lastActiveWeek: monday('2026-05-25T00:00:00Z') },
      now,
    );
    expect(result.streakWeeks).toBe(6);
    expect(result.freezeTokens).toBe(0);
    expect(result.freezeConsumed).toBe(true);
  });

  it('resets when a week is missed without freeze tokens', () => {
    const result = applyWeeklyActivity(
      { streakWeeks: 5, freezeTokens: 0, lastActiveWeek: monday('2026-05-25T00:00:00Z') },
      now,
    );
    expect(result.streakWeeks).toBe(1);
    expect(result.extended).toBe(false);
  });

  it('resets after two or more missed weeks even with tokens', () => {
    const result = applyWeeklyActivity(
      { streakWeeks: 9, freezeTokens: 2, lastActiveWeek: monday('2026-05-11T00:00:00Z') },
      now,
    );
    expect(result.streakWeeks).toBe(1);
    expect(result.freezeTokens).toBe(2);
  });
});
