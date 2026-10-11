# IMPLEMENTED — TG Creator Studio

Журнал фактической готовности. Не помечай Completed без зелёного DoD.

## Spec package

| Item                                                                              | Status    | Notes                                   |
| --------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| Spec 1.0 body (`docs/01–05`, prompts 01–14, `examples/project-3d.v1.json`)        | Completed | Импортировано из загруженного комплекта |
| Spec v1.1 upgrade (README, CHANGELOG, docs/06, rules 13–15, DoD, docs/04–05 sync) | Completed | 2026-10-10                              |
| Runtime / editor code per gates G0+                                               | Partial   | G0, G1 Done; остальные gates Planned    |

## G0 Infra

| Item                                                      | Status    | Notes                                                     |
| --------------------------------------------------------- | --------- | --------------------------------------------------------- |
| `ARCHITECTURE.md` mapping → game-is-game monorepo         | Completed | `apps/creator-api` вместо `apps/api`                      |
| `packages/creator-shared` (`@tg-creator/shared`) ApiError | Completed | коды из docs/06 + INTERNAL/SERVICE_UNAVAILABLE            |
| `packages/project-schema` Zod v1 + roundtrip example      | Completed | мигратор stub (только v1)                                 |
| Planned stubs: editor-core…ui-kit                         | Completed | `PACKAGE_STATUS = 'Planned'`                              |
| `apps/studio` editor shell                                | Replaced  | заменён реальными экранами G1 (фейковая иерархия удалена) |
| `apps/player` player shell (no editor-core)               | Completed |                                                           |
| `apps/creator-api` NestJS + Prisma + `/health` (DB check) | Completed | port 3010                                                 |
| `apps/worker`                                             | Planned   | process marker only                                       |
| docker-compose Postgres/Redis                             | Completed | shared with Game is Game                                  |
| `.env.example` Creator vars                               | Completed |                                                           |
| CI (lint/typecheck/build/test)                            | Completed | existing root workflow covers new workspaces              |
| Playwright smoke for studio shell                         | Replaced  | см. G1 e2e                                                |

## G1 Auth + Dashboard

| Item                                                                  | Status    | Notes                                                            |
| --------------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `verifyTelegramInitData` (HMAC, auth_date, timing-safe, dup keys)     | Completed | test vector посчитан независимо (Python)                         |
| Sessions: opaque bearer, SHA-256 at rest, logout, TTL                 | Completed | `CREATOR_SESSION_TTL_HOURS` (168)                                |
| Default-deny `SessionGuard` + `@Public()` (health, auth)              | Completed |                                                                  |
| Dev-auth hard block                                                   | Completed | `AUTH_DEV_FORBIDDEN`; boot fails if enabled in production        |
| Global `ApiExceptionFilter` → `{error:{code,message,details}}`        | Completed | только коды docs/06; `VALIDATION_FAILED` добавлен в каталог      |
| Prisma `User`, `Session`, `Project` (schema `creator`)                | Completed | миграция `20261011173617_g1_auth_projects`                       |
| `GET /me`, `PATCH /me/preferences`                                    | Completed | тема + плотность per user                                        |
| Projects list (keyset, type, q) / create / get / draft / dup / delete | Completed | чужой проект = `NOT_FOUND`; квота `QUOTA_EXCEEDED`               |
| Auth rate limit                                                       | Partial   | in-memory per instance (Redis — G11)                             |
| `@tg-creator/telegram` bridge + browser fallback                      | Completed | initData, theme, viewport, safe areas, BackButton, header colors |
| `@tg-creator/ui-kit` theme engine                                     | Completed | Telegram/system/dark/light, WCAG-контраст, fallback палитры      |
| project-schema templates (`empty`/`starter` × 3 типа) + clone         | Completed | схема v1 без изменений                                           |
| Studio S01 (loader/auth/errors/dev-login)                             | Completed |                                                                  |
| Studio S02 dashboard (search, filter, skeleton/empty/error, actions)  | Completed | «Продолжить» последний проект                                    |
| Studio S03 wizard (type → template → name/orientation)                | Completed | modal ≥768, fullscreen на телефоне                               |
| Studio project page                                                   | Partial   | реальная структура черновика; редактор — Planned (G3–G4)         |
| Studio S18 Settings: тема, плотность, аккаунт, выход                  | Completed | privacy/render/team — в соответствующих gates                    |
| Navigation: sidebar ≥768 / bottom nav <768, Telegram BackButton       | Completed |                                                                  |
| Tests: unit, int (Postgres), Playwright e2e desktop + mobile          | Completed | CI job `creator-integration`                                     |
| Railway: `creator-api` + `creator-studio` (cozy-youthfulness)         | Completed | schema `creator` в postgis; меню бота → creator-studio           |
| Real-device check inside Telegram clients                             | Partial   | агент не открывает клиенты Telegram; нужна ручная проверка (G10) |

## Product vertical (R0/R1)

| Capability                 | Status    |
| -------------------------- | --------- |
| Telegram auth              | Completed |
| Project CRUD + schema      | Partial   |
| 3D editor edit/save/reopen | Planned   |
| Play mode                  | Planned   |
| Publish + share link       | Planned   |
