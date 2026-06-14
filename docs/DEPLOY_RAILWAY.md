# Deploy to Railway (production)

One Railway **Project** with **3 app services** + **Redis**. Database: **Supabase** (PostGIS) — Railway Postgres does not ship PostGIS out of the box.

| Service  | Config file             | Public domain | Notes                                             |
| -------- | ----------------------- | ------------- | ------------------------------------------------- |
| `api`    | `apps/api/railway.toml` | Yes           | NestJS, `/health`                                 |
| `web`    | `apps/web/railway.toml` | Yes           | Mini App — set `VITE_API_URL` **before** build    |
| `bot`    | `apps/bot/railway.toml` | **No**        | Long-polling worker + BullMQ consumer             |
| Redis    | Railway plugin          | No            | Shared by `api` + `bot`                           |
| Postgres | **Supabase** (external) | No            | Session pooler URL, not direct `db.*.supabase.co` |

> Bot uses **long polling** (`bot.start()`). No Telegram webhook setup required.

---

## 0. Stop local stack (avoid 409 Conflict)

When Railway bot runs, **do not** run local bot or cloudflared:

```bash
./scripts/stop-local-dev.sh
```

---

## 1. GitHub

Railway deploys from GitHub. Root directory = **repo root** (empty). Each service sets **Config file path** separately.

```bash
git push origin main
```

---

## 2. Create Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → `GendalfGreyy/gameisgame`
2. Add **Redis**: `+ Create` → **Database** → **Redis**
3. **Do not** use Railway Postgres for this app — use Supabase (PostGIS).

### Supabase DATABASE_URL

In Supabase → **Settings** → **Database** → **Connection string** → **Session pooler** (IPv4):

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
```

Example project ref from setup: `litbokmrzazqiohsjdgb`

---

## 3. Service settings (all three)

For **api**, **web**, **bot** → **Settings**:

| Setting          | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Root Directory   | _(empty)_                                                                   |
| Config file path | `apps/api/railway.toml` / `apps/web/railway.toml` / `apps/bot/railway.toml` |

| Service | Public Networking  |
| ------- | ------------------ |
| `api`   | ✅ Generate Domain |
| `web`   | ✅ Generate Domain |
| `bot`   | ❌ Disabled        |

---

## 4. Deploy order

```mermaid
flowchart LR
  A[1. api deploy] --> B[2. copy api + web domains]
  B --> C[3. set web VITE_API_URL]
  C --> D[4. redeploy web]
  D --> E[5. set TELEGRAM_WEBAPP_URL everywhere]
  E --> F[6. deploy bot]
  F --> G[7. BotFather URL]
```

### Step 1 — Deploy `api` first

Generate domain. Known domain from setup:

```
https://game-is-gameapi-production.up.railway.app
```

Verify after deploy:

```bash
curl https://game-is-gameapi-production.up.railway.app/health
# → {"status":"ok"}
```

If you see `Application not found` — deploy failed or service is not running. Check **Deployments → Logs**.

#### `api` variables

| Variable                | Value                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`              | `production`                                                      |
| `DATABASE_URL`          | Supabase session pooler URL (see above)                           |
| `REDIS_URL`             | `${{Redis.REDIS_URL}}`                                            |
| `TELEGRAM_BOT_TOKEN`    | from @BotFather                                                   |
| `TELEGRAM_BOT_USERNAME` | `gamelsgamebot`                                                   |
| `JWT_SECRET`            | `openssl rand -base64 48`                                         |
| `JWT_REFRESH_SECRET`    | `openssl rand -base64 48`                                         |
| `SERVICE_JWT_SECRET`    | `openssl rand -base64 48`                                         |
| `API_PUBLIC_URL`        | `https://<api-domain>.up.railway.app`                             |
| `API_CORS_ORIGINS`      | `https://<web-domain>.up.railway.app`                             |
| `TELEGRAM_WEBAPP_URL`   | `https://<web-domain>.up.railway.app` _(after web domain exists)_ |
| `LOG_LEVEL`             | `info`                                                            |

---

### Step 2 — Deploy `web`

Generate domain (e.g. `game-is-game-web-production.up.railway.app`).

#### `web` variables — **must exist before build**

| Variable                  | Value                                 |
| ------------------------- | ------------------------------------- |
| `NODE_ENV`                | `production`                          |
| `VITE_API_URL`            | `https://<api-domain>.up.railway.app` |
| `VITE_MAPLIBRE_STYLE_URL` | MapTiler style URL (optional)         |

After changing `VITE_API_URL` → **Redeploy** web (rebuild required).

Verify:

```bash
curl -I https://<web-domain>.up.railway.app/
# → HTTP/2 200
```

---

### Step 3 — Update `api` with web URL

Back on `api` service, set (if not yet):

```
TELEGRAM_WEBAPP_URL=https://<web-domain>.up.railway.app
API_CORS_ORIGINS=https://<web-domain>.up.railway.app
```

Redeploy `api`.

---

### Step 4 — Deploy `bot`

No public domain. **Disable Public Networking.**

#### `bot` variables

| Variable              | Value                                        |
| --------------------- | -------------------------------------------- |
| `NODE_ENV`            | `production`                                 |
| `TELEGRAM_BOT_TOKEN`  | same as `api`                                |
| `TELEGRAM_WEBAPP_URL` | `https://<web-domain>.up.railway.app`        |
| `API_PUBLIC_URL`      | `https://<api-domain>.up.railway.app`        |
| `REDIS_URL`           | `${{Redis.REDIS_URL}}` _(same Redis as api)_ |
| `SERVICE_JWT_SECRET`  | same as `api`                                |

Check logs: `Starting Game is Game bot…` with no crash loop.

---

## 5. BotFather (one-time after web domain is stable)

1. [@BotFather](https://t.me/BotFather) → `/mybots` → **@gamelsgamebot**
2. **Bot Settings** → **Menu Button** / **Mini App**
3. URL: `https://<web-domain>.up.railway.app` (no trailing slash)

Remove any old `trycloudflare.com` URLs.

---

## 6. Smoke test

1. Open bot in Telegram → tap **Open Mini App**
2. App loads (no DNS / 502 errors)
3. Auth succeeds (no `Invalid initData`)
4. Map / events load (no CORS / Failed to fetch)

---

## Troubleshooting

| Symptom                                | Fix                                                  |
| -------------------------------------- | ---------------------------------------------------- |
| `Application not found` on Railway URL | Service crashed — check deploy logs                  |
| Build fails on `modules 2`             | Duplicate files in repo — pull latest `main`         |
| `prisma migrate` P1001                 | Use Supabase **pooler** URL, not direct host         |
| PostGIS migration error                | Must use Supabase (or Postgres with PostGIS enabled) |
| Mini App blank / Failed to fetch       | Wrong `VITE_API_URL` — redeploy **web** after fix    |
| `Invalid Telegram initData`            | `TELEGRAM_BOT_TOKEN` mismatch on `api` vs bot        |
| Bot 409 Conflict                       | Stop local bot: `./scripts/stop-local-dev.sh`        |
| `/squad` API unavailable               | Set `SERVICE_JWT_SECRET` on both `api` and `bot`     |
| CORS error in browser                  | Add web domain to `API_CORS_ORIGINS` on `api`        |

---

## Local dev after Railway switch

Keep using Docker for Postgres/Redis locally. Do **not** run local bot while Railway bot is active.

```bash
docker compose up -d
pnpm --filter @game-is-game/api dev
pnpm --filter @game-is-game/web dev
# bot: only if Railway bot is stopped
```

For Telegram Mini App testing locally you still need cloudflared — or test directly on Railway web URL.
