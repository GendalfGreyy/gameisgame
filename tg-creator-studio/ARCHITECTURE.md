# TG Creator Studio — Architecture (repo mapping)

Источник истины по продукту: `tg-creator-studio/docs/01`…`06`. Этот файл — как спека ложится на **текущий** monorepo `game-is-game`.

## Сосуществование с Game is Game

В корне уже есть продукт Game is Game (`apps/api`, `apps/web`, `apps/bot`, `packages/shared`, `packages/db`).  
Creator Studio **не перетирает** его. Для G0 добавлены отдельные приложения/пакеты со scope `@tg-creator/*`.

| Спека (`docs/03`)          | В этом репозитории        | Статус G0        |
| -------------------------- | ------------------------- | ---------------- |
| `apps/studio`              | `apps/studio`             | shell            |
| `apps/player`              | `apps/player`             | shell            |
| `apps/api`                 | `apps/creator-api`        | health + Prisma  |
| `apps/worker`              | `apps/worker`             | stub Planned     |
| `packages/project-schema`  | `packages/project-schema` | Zod + roundtrip  |
| `packages/shared` (errors) | `packages/creator-shared` | ApiError + codes |
| `editor-core`…`ui-kit`     | `packages/*`              | stubs Planned    |
| Spec docs/prompts          | `tg-creator-studio/`      | v1.1             |

Имя `apps/creator-api` вместо `apps/api` — чтобы не конфликтовать с `@game-is-game/api`.

## Принципы (из docs/03)

1. **ProjectDocument** — единственный источник истины; `schemaVersion` + миграции.
2. Editor → `EditorCommand` → document; adapters (PlayCanvas/Pixi/App) — проекции.
3. Player **не** импортирует `editor-core`.
4. Зависимости: apps → packages, не наоборот. `project-schema` без React.
5. Ошибки API — только коды из `docs/06-ERROR-CATALOG.md`.

## Локальный запуск (G0)

- Node `22` (`.nvmrc`), pnpm `9.15.0`
- `docker compose up -d` — Postgres + Redis (общие)
- `pnpm --filter @tg-creator/creator-api dev` — API `:3010`
- `pnpm --filter @tg-creator/studio dev` — Studio `:5174`
- `pnpm --filter @tg-creator/player dev` — Player `:5175`

## Gates

См. `docs/05-ROADMAP-AND-QA.md` и `TASKS.md`. Сейчас: **G0 Infra**.
