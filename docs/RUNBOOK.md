# Runbook

## Local dev

```bash
docker compose up -d          # Postgres + Redis
pnpm install
pnpm --filter @game-is-game/db exec prisma migrate deploy
pnpm dev                      # api + web + bot
```

Tunnel HTTPS for Telegram Mini App (cloudflared / ngrok) → set `TELEGRAM_WEBAPP_URL`, `VITE_API_URL`.

## Deploy (API)

```bash
docker build -f apps/api/Dockerfile -t game-is-game-api .
docker run --env-file .env -p 3001:3001 game-is-game-api
```

Requires: `DATABASE_URL`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, JWT secrets.

## Deploy (Web)

Static build: `pnpm --filter @game-is-game/web build` → serve `apps/web/dist` behind HTTPS CDN.

Env: `VITE_API_URL`, optional `VITE_POSTHOG_KEY`, `VITE_BOOSTS_ENABLED=true`.

## Bot

Long-polling locally (`pnpm --filter @game-is-game/bot dev`). Production: webhook + same Redis for BullMQ notifications queue.

## Observability

- API logs: Pino JSON (`LOG_LEVEL`).
- Web analytics: PostHog via `VITE_POSTHOG_KEY` (HTTP capture in `analytics.ts`).
- Sentry: set `SENTRY_DSN` on API when SDK wired.

## Incidents

| Symptom | Check |
|---------|-------|
| `Invalid Telegram initData` | Bot token mismatch between bot shell and API `.env` |
| Notifications silent | Redis up? Bot worker running? Daily cap 5/user |
| Boost stuck pending | `FEATURE_BOOSTS_ENABLED=true`, bot payment handlers, `SERVICE_JWT_SECRET` |

## Migrations

```bash
pnpm --filter @game-is-game/db exec prisma migrate deploy
```

Never `--force` on production without backup.
