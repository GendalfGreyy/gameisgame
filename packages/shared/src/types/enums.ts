export const USER_ROLES = ['user', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRIVACY_MODES = ['precise', 'approximate', 'hidden'] as const;
export type PrivacyMode = (typeof PRIVACY_MODES)[number];

export const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const CHECK_IN_STATUSES = ['confirmed', 'pending', 'rejected'] as const;
export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number];

export const CHECK_IN_METHODS = ['gps', 'qr', 'manual'] as const;
export type CheckInMethod = (typeof CHECK_IN_METHODS)[number];

export const POINTS_REASONS = [
  'check_in',
  'event_host',
  'streak_bonus',
  'invite_friend',
  'boost_refund',
  'admin_adjustment',
] as const;
export type PointsReason = (typeof POINTS_REASONS)[number];

export const BOOST_PLANS = ['spotlight_1h', 'spotlight_24h', 'super_boost'] as const;
export type BoostPlan = (typeof BOOST_PLANS)[number];

export const BOOST_STATUSES = ['pending', 'active', 'expired', 'cancelled'] as const;
export type BoostStatus = (typeof BOOST_STATUSES)[number];

export const REPORT_STATUSES = ['open', 'reviewed', 'dismissed', 'actioned'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_TARGET_TYPES = ['user', 'event', 'check_in'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
