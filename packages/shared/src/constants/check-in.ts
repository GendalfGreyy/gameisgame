/** Rotating QR token window (seconds). Current and previous window are accepted. */
export const QR_TOKEN_WINDOW_SECONDS = 30 as const;
/** Length of the truncated HMAC hex token rendered in the QR code. */
export const QR_TOKEN_LENGTH = 8 as const;

/** Minutes a GPS check-in must dwell inside the geofence before it can be confirmed. */
export const DWELL_MINUTES = 10 as const;
/** TTL for the pending dwell record in Redis (seconds). */
export const DWELL_TTL_SECONDS = 4 * 60 * 60;
/** Max distance from the event point for both the initial ping and the confirm ping. */
export const DWELL_MAX_DISTANCE_M = 150 as const;
