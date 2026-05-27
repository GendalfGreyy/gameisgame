# CLAUDE.md — Game is Game (root)

## WHAT

Telegram Mini App that answers "where is something interesting happening near me, who from my friends is there, and how do I earn points by joining?" — discovery → join → check-in → points → leaderboard → invite → return.

## STACK

- **Monorepo**: pnpm 9 + Turborepo 2
- **Backend** (`apps/api`): NestJS + TypeScript + Prisma + PostgreSQL 16 + PostGIS + Redis + BullMQ
- **Frontend** (`apps/web`): React 18 + Vite + TypeScript + Tailwind + TanStack Query + Zustand + MapLibre GL + `@twa-dev/sdk`
- **Bot** (`apps/bot`): grammY (TypeScript)
- **Shared** (`packages/shared`): types + zod schemas consumed by both web and api
- **DB** (`packages/db`): Prisma schema, migrations, seeds
- **Config** (`packages/config`): shared ESLint + Prettier configs
- **Payments**: Telegram Stars (`XTR`) for digital goods; Stripe reserved for physical tickets only
- **Auth**: Telegram `initData` HMAC-SHA256 validation → own JWT (15 min) + Redis-stored refresh (30 d)

## CONVENTIONS

- TypeScript strict everywhere. No `any`, no `// @ts-ignore`. Use `unknown` + narrowing.
- All cross-package types live in `@game-is-game/shared`.
- DTOs and API contracts: zod schemas, not handwritten types.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`).
- Tests next to code: unit (`*.spec.ts`), integration (`*.int-spec.ts`), e2e in `test/` per app.
- One feature = one PR. No "drive-by" refactors mixed with feature work.

## COMMANDS

```bash
pnpm install              # install all workspaces
pnpm dev                  # turbo run dev (all apps in parallel)
pnpm --filter @game-is-game/api dev    # one app
pnpm test                 # turbo run test
pnpm lint                 # turbo run lint
pnpm typecheck            # turbo run typecheck
pnpm build                # turbo run build
pnpm format               # prettier --write
```

## DO_NOT

- Do not call Telegram Bot API directly from the frontend. Always proxy via `apps/api`.
- Do not store exact user coordinates in PG beyond an active event check-in. Live location is Redis-only with TTL.
- Do not use `any`, `as any`, `@ts-ignore`, or non-null `!` without a comment explaining why it is safe.
- Do not `git push --force` to `main`. Use `--force-with-lease` on feature branches only.
- Do not skip the auth guard on new endpoints. Default-deny — opt in to public.
- Do not bypass the points ledger by updating `User.total_points` directly. Always write through `PointsService.award`.
- Do not commit secrets. `.env` is gitignored; use `.env.example` for shape.
- Do not introduce new top-level dependencies without explaining why in the PR.
