import WebApp from '@twa-dev/sdk';

/**
 * Telegram haptic feedback wrappers. Every call is best-effort — older
 * clients without HapticFeedback just no-op.
 */

function impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') {
  try {
    WebApp.HapticFeedback.impactOccurred(style);
  } catch {
    /* unsupported client */
  }
}

function notify(type: 'success' | 'error' | 'warning') {
  try {
    WebApp.HapticFeedback.notificationOccurred(type);
  } catch {
    /* unsupported client */
  }
}

export const haptics = {
  /** Tab switches, chips, small toggles. */
  tap: () => impact('light'),
  /** Card opens, primary buttons. */
  press: () => impact('medium'),
  /** Check-in confirmed, event published. */
  success: () => notify('success'),
  /** Failed validation, errors. */
  error: () => notify('error'),
  /** QR code rotation tick. */
  tick: () => impact('soft'),
};
