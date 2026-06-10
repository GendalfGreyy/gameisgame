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
  api/    NestJS backend (auth, events, check-ins, points, payments, moderation)
  web/    React + Vite Mini App (MapLibre, Tailwind, TanStack Query, Zustand)
  bot/    grammY bot (commands, deep links, BullMQ notification consumer)
packages/
  shared/ Cross-package types, zod schemas, domain constants
  db/     Prisma schema + migrations + seed
  config/ Shared ESLint and Prettier config
docs/
  ARCHITECTURE.md      System overview + mermaid diagrams
  PHASES/              Phased implementation roadmap
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the big picture and [`CLAUDE.md`](./CLAUDE.md) for conventions enforced by Claude Code sessions.
