# CLAUDE.md — apps/bot (grammY bot)

Two responsibilities: (1) handle Telegram commands and deep links, (2) consume the BullMQ notifications queue produced by `apps/api`.

## Layout

- `src/commands/` — one file per `/command`. Pure handlers, no DB writes.
- `src/middleware/` — auth (resolve telegram_id → user_id via api or read-only Prisma), rate-limit, error boundary.
- `src/notifications/` — BullMQ workers, one per job type (`event_starting_soon`, `friend_joined_event`, …).
- `src/deeplinks/` — parse `startapp=...` parameters into typed intents.
- `src/api-client/` — typed HTTP client to `apps/api` (uses service-to-service JWT).

## Patterns

- Notification rate cap: max 5 messages per user per 24h (per-user Redis counter). Drop oldest if exceeded.
- All deep links use `t.me/<bot>/<short>?startapp=<base64url payload>` — never raw query strings.
- `pre_checkout_query` must be answered within 10 seconds. Validate the boost is still `pending` and answer fast.

## DO NOT

- Do not import Prisma client for writes. Writes go through `apps/api` HTTP endpoints with a service JWT.
- Do not log message contents that contain user-generated text in production (could leak DMs).
- Do not handle `successful_payment` without idempotency on `telegram_payment_charge_id`.
- Do not block the event loop in command handlers. If work takes > 1 s, enqueue and respond instantly.
