# Game is Game

Telegram Mini App: nearby events, check-ins, points, leaderboards, communities, boosts.

## Quickstart

```bash
# Prereqs: Node 22+, pnpm 9+, Docker
nvm use                  # picks up .nvmrc
pnpm install
cp .env.example .env     # then fill in real values (bot token, JWT secrets)

# Local infra
docker compose up -d
pnpm --filter @game-is-game/db prisma migrate dev --name init
pnpm --filter @game-is-game/db prisma db seed

# Develop (all apps in parallel)
pnpm dev

# Per-app
pnpm --filter @game-is-game/api dev
pnpm --filter @game-is-game/web dev
pnpm --filter @game-is-game/bot dev

# Quality gates
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Workspace layout

```
apps/
  api/           NestJS backend (Game is Game)
  web/           React + Vite Mini App (Game is Game)
  bot/           grammY bot
  studio/        TG Creator Studio editor shell (@tg-creator/studio)
  player/        TG Creator public player shell (@tg-creator/player)
  creator-api/   Creator Studio NestJS API (@tg-creator/creator-api)
  worker/        Creator background worker (Planned)
packages/
  shared/        Game is Game shared types
  db/            Game is Game Prisma
  creator-shared / project-schema / editor-core / …  Creator packages (@tg-creator/*)
  config/        Shared ESLint and Prettier config
tg-creator-studio/   Product spec v1.1 + prompts + ARCHITECTURE mapping
docs/
  ARCHITECTURE.md      System overview + mermaid diagrams
  PHASES/              Phased implementation roadmap
```

## TG Creator Studio (G1)

Node **22** (`.nvmrc`), pnpm **9.15.0**. Spec: [`tg-creator-studio/`](./tg-creator-studio/).

```bash
docker compose up -d
pnpm install
# CREATOR_DATABASE_URL must use its own schema: ...?schema=creator
pnpm --filter @tg-creator/creator-api db:deploy
pnpm --filter @tg-creator/creator-api dev   # :3010  /api/v1/{health,auth,me,projects}
pnpm --filter @tg-creator/studio dev        # :5174  dashboard, wizard, settings
pnpm --filter @tg-creator/player dev        # :5175
```

Outside Telegram, set `CREATOR_DEV_AUTH=true` (development only) to get the dev-login button.
Integration tests use an isolated `creator_test` schema; e2e starts both servers itself:

```bash
pnpm --filter @tg-creator/creator-api test:int
pnpm --filter @tg-creator/studio test:e2e
```

See [`tg-creator-studio/ARCHITECTURE.md`](./tg-creator-studio/ARCHITECTURE.md) and [`CLAUDE.md`](./CLAUDE.md).
