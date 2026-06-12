import type { BoostPlan } from '../types/enums.js';

export const BOOST_PLAN_DURATIONS_MS: Record<BoostPlan, number> = {
  spotlight_1h: 60 * 60 * 1000,
  spotlight_24h: 24 * 60 * 60 * 1000,
  super_boost: 48 * 60 * 60 * 1000,
};

/** Telegram Stars (XTR) price per plan. */
export const BOOST_STARS_PRICES: Record<BoostPlan, number> = {
  spotlight_1h: 50,
  spotlight_24h: 150,
  super_boost: 300,
};

/** Ranking weight bump applied while boost is active. */
export const BOOST_SCORE_BY_PLAN: Record<BoostPlan, number> = {
  spotlight_1h: 25,
  spotlight_24h: 50,
  super_boost: 100,
};
