# TASKS — TG Creator Studio

Обновляй статусы на каждом этапе (DoD из `prompts/00-START-HERE.md`).

| Gate | Промпт | Название            | Status    | Notes                                   |
| ---- | ------ | ------------------- | --------- | --------------------------------------- |
| G0   | 01     | Infra               | Completed | Monorepo @tg-creator/\* рядом с GiG     |
| G1   | 02     | Auth + Dashboard    | Completed | S01–S03 + S18 (тема/плотность)          |
| G2   | 03     | Project schema      | Partial   | Zod v1 + roundtrip в G0; gate G2 глубже |
| G3   | 04     | Editor core         | Planned   | без Timeline R2                         |
| G4   | 05     | 3D engine           | Planned   |                                         |
| G5   | 06     | Assets & Save       | Planned   |                                         |
| G6   | 07     | Play & Publish      | Planned   |                                         |
| G7   | 08     | Blueprint           | Planned   |                                         |
| G8   | 09     | 2D Studio           | Planned   |                                         |
| G9   | 10     | App Builder         | Planned   |                                         |
| G10  | 11     | Mobile QA           | Planned   |                                         |
| G11  | 12     | Production          | Planned   |                                         |
| G12  | 13     | R2 Collaboration    | Planned   | после G11                               |
| G12  | 14     | R2 AI / Marketplace | Planned   | после G11                               |

**Status:** `Planned` | `Partial` | `Completed`

## Сейчас

- **G0 Infra Completed**, **G1 Auth + Dashboard Completed** — см. `IMPLEMENTED.md`.
- Следующий шаг: **промпт 03** (Project schema, G2) — только после подтверждения.

### G1 — что сделано

- [x] Проверка raw `initData` на сервере (HMAC-SHA256, `auth_date` window, timing-safe, test vector из Python).
- [x] Opaque bearer-сессии (в БД только SHA-256), logout, `SESSION_EXPIRED`, глобальный default-deny guard.
- [x] Dev-auth: только `NODE_ENV=development` + `CREATOR_DEV_AUTH`; API не стартует с флагом в production.
- [x] Prisma `User`/`Session`/`Project` в отдельной схеме `creator`.
- [x] `GET /me`, `PATCH /me/preferences`, `GET/POST /projects`, `GET /projects/:id`, `GET /projects/:id/draft`, `POST /projects/:id/duplicate`, `DELETE /projects/:id` (soft).
- [x] Studio: S01 загрузка/вход, S02 dashboard, S03 wizard, страница проекта (честно: редактор Planned G3–G4), S18 «Настройки» с темой и плотностью.
- [x] `@tg-creator/telegram` bridge (theme, viewport, safe areas, BackButton) с fallback для браузера.
- [x] Unit + int (реальная Postgres) + Playwright e2e (desktop + mobile).

### Перенесено / ограничения G1

- `POST /projects/:id/archive`, `PATCH /projects/:id/metadata`, `PUT /draft` — по контракту, этапы G2/G5.
- Rate limit auth — in-memory per instance; Redis-лимитер — G11.
- Квота проектов проверяется без сериализуемой транзакции (возможен +1 при гонке) — ужесточить в G11.
