# Beta Soft Launch Checklist

Use before inviting the first 50–100 testers.

## Infrastructure

- [ ] `pnpm --filter @game-is-game/db exec prisma migrate deploy` on production DB
- [ ] API deployed (`apps/api/Dockerfile`) with HTTPS + health check `GET /health`
- [ ] Web static build on HTTPS CDN (`TELEGRAM_WEBAPP_URL`)
- [ ] Redis + Postgres monitored (disk, connections)
- [ ] `SERVICE_JWT_SECRET` set for bot ↔ API
- [ ] `TELEGRAM_BOT_USERNAME` set on API (invite/deeplinks)

## Telegram

- [ ] BotFather: Mini App URL → production web
- [ ] BotFather: menu button → Mini App
- [ ] Bot running (long-poll dev / webhook prod)
- [ ] Test `/start`, `/squad`, notification delivery

## Feature flags

- [ ] `FEATURE_BOOSTS_ENABLED` — enable only when Stars flow tested
- [ ] `VITE_BOOSTS_ENABLED=true` on web build when boosts go live
- [ ] `ADMIN_BOOTSTRAP_TELEGRAM_IDS` — your TG id for admin role

## Smoke test (15 min)

1. New user login via Mini App
2. Discovery → join event → check-in (QR or GPS dwell)
3. Points + leaderboard update
4. Invite link → second account → inviter gets +75
5. Friend join → notification to friend (if bot on)
6. Report event → admin reviews in **Профиль → Модерация**
7. Tonight digest fires at 17:00 (or trigger manually in staging)

## Legal / comms

- [ ] Privacy policy URL in bot `/start` or onboarding (when ready)
- [ ] Support contact (Telegram channel or @username)
- [ ] Rollback plan documented in `docs/RUNBOOK.md`

## Metrics (phase 11)

- [ ] `VITE_POSTHOG_KEY` on web
- [ ] `SENTRY_DSN` on API when SDK wired
- [ ] Watch: D1 retention, check-in success rate, report queue depth

## Go / no-go

**Go** when smoke test passes on production URLs with 2 real Telegram accounts.

**No-go** if auth fails, check-in always rejects, or notifications spam (>5/day cap broken).
