/**
 * Weekly streak math. Pure functions — unit-tested without DB.
 *
 * A "week" starts on Monday 00:00 UTC. One confirmed check-in marks the week
 * active. A single missed week can be bridged by a freeze token; otherwise the
 * streak resets to 1 on the next active week.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStartUtc(date: Date): Date {
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff),
  );
  return monday;
}

export type StreakState = {
  streakWeeks: number;
  freezeTokens: number;
  lastActiveWeek: Date | null;
};

export type StreakTransition = {
  streakWeeks: number;
  freezeTokens: number;
  lastActiveWeek: Date;
  /** true when the streak grew (continuation or frozen bridge) — bonus is due. */
  extended: boolean;
  /** true when a freeze token was consumed to bridge a missed week. */
  freezeConsumed: boolean;
  /** false when nothing changed (same week already active). */
  changed: boolean;
};

export function applyWeeklyActivity(state: StreakState, now: Date): StreakTransition {
  const currentWeek = weekStartUtc(now);

  if (state.lastActiveWeek) {
    const last = weekStartUtc(state.lastActiveWeek);
    const gapWeeks = Math.round((currentWeek.getTime() - last.getTime()) / WEEK_MS);

    if (gapWeeks <= 0) {
      return {
        streakWeeks: state.streakWeeks,
        freezeTokens: state.freezeTokens,
        lastActiveWeek: last,
        extended: false,
        freezeConsumed: false,
        changed: false,
      };
    }

    if (gapWeeks === 1) {
      return {
        streakWeeks: state.streakWeeks + 1,
        freezeTokens: state.freezeTokens,
        lastActiveWeek: currentWeek,
        extended: true,
        freezeConsumed: false,
        changed: true,
      };
    }

    if (gapWeeks === 2 && state.freezeTokens > 0) {
      return {
        streakWeeks: state.streakWeeks + 1,
        freezeTokens: state.freezeTokens - 1,
        lastActiveWeek: currentWeek,
        extended: true,
        freezeConsumed: true,
        changed: true,
      };
    }
  }

  return {
    streakWeeks: 1,
    freezeTokens: state.freezeTokens,
    lastActiveWeek: currentWeek,
    extended: false,
    freezeConsumed: false,
    changed: true,
  };
}
