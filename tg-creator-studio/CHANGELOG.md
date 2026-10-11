# CHANGELOG спецификации TG Creator Studio

Формат: дата, версия, изменённые файлы и причина. Любая правка docs/ обязана получить запись здесь — это журнал источника истины.

## 1.1.5 — 2026-10-11 (G3 Editor core)

- `docs/03-ENGINE-ARCHITECTURE.md` §5.1: описан фактический `editor-core` — сериализуемые команды с точными inverse, чистое применение, интеграция с `validateProjectDocument`, история с merge-группами, dirty по версии, тикеты сохранения и блокировка при конфликте, соглашение о Transform (градусы, `Rz·Ry·Rx`), SVG-схема вместо viewport до G4.
- `docs/02-UX-SCREENS.md` §3–4: отмечено реализованное в G3 — порог desktop ≥ 1024 px, правила показа Undo/Redo/Save, состояния индикатора сохранения, горячие клавиши, mobile sheets и действия без клавиатуры; Rotate/Scale gizmo, Orbit и resize панелей — G4.
- `project-schema`: схема **не менялась** (миграция не требуется); экспортированы лимиты `ID_MAX`, `NAME_MAX`, `TEXT_MAX`.
- `docs/06`: новых API-кодов нет (ошибки команд редактора — клиентские).
- TASKS/IMPLEMENTED: G3 Completed.

## 1.1.4 — 2026-10-11 (G2 Project schema)

- `docs/03-ENGINE-ARCHITECTURE.md` §4: набросок модели заменён фактической формой `ProjectDocument` **schemaVersion 2** (строгие объекты, discriminated unions для `data` компонентов, камеры, виджетов App, действий, `TypedValue`; `name` у страниц/графов, `position` у узлов, `entrySceneId: Id | null`), описаны правила целостности и цепочка миграций. Причина: промпт 03 требует типизированных компонентов вместо `data: unknown`.
- Миграция `v1 → v2` — чистая функция с golden-фикстурами; документы v1 в БД мигрируются при чтении и перезаписываются в v2 при следующем `PUT draft`.
- `examples/project-3d.v2.json`: новый канонический пример (иерархия, физика, контроллер игрока, граф, переменные). `examples/project-3d.v1.json` оставлен как вход тестов миграции.
- `docs/04-API-DATA-CONTRACT.md` §3: `GET draft` (`etag`, `savedAt`, миграция при чтении) и `PUT draft` (CAS по `baseRevision`, журнал `mutationId`, лимит `DRAFT_MAX_BYTES`, формат 409/413/422); §8 — ссылка на v2-пример и `db:seed`.
- `docs/06-ERROR-CATALOG.md`: новые `MUTATION_ID_REUSED` (409) и `DOCUMENT_TOO_LARGE` (413); `MIGRATION_FAILED` также для schemaVersion новее сервера.
- БД: таблица `creator.draft_mutations` (миграция `20261011192655_g2_draft_mutations`).
- TASKS/IMPLEMENTED: G2 Completed.

## 1.1.3 — 2026-10-11 (дизайн-направление «Мастерская»)

- `docs/02-UX-SCREENS.md` §9: палитра заменена с violet-on-navy на тёплый графит + acid-lime сигнал (и «бумажный» светлый вариант), добавлены шрифты и правила motion. Причина: отказ от узнаваемых «AI-slop» паттернов (фиолетовый акцент, Inter/системный шрифт, сетка одинаковых карточек, слабый hover) в пользу направления, связанного с продуктом-«мастерской».
- Код: `@tg-creator/ui-kit` DARK/LIGHT_TOKENS, `apps/studio` — новый визуальный слой; поведение, контракты API и схема проекта **не менялись**.

## 1.1.2 — 2026-10-11 (G1 implementation)

- `docs/06-ERROR-CATALOG.md`: новый раздел «Запросы» — код `VALIDATION_FAILED` (422) для невалидного тела/параметров запроса (не ProjectDocument; для документа остаётся `SCHEMA_INVALID`).
- `docs/04-API-DATA-CONTRACT.md` §2: `POST /auth/dev` (dev-only), `PATCH /me/preferences` (тема `telegram|system|dark|light`, плотность `comfortable|compact`), формат session/`GET /me`. §3: `GET /projects` получил `q` и `limit`, описаны keyset-пагинация, ответ `POST /projects`, `templateId`/`orientation`.
- `project-schema`: схема v1 **не менялась** (миграция не требуется); добавлены шаблоны `createProjectDocument` (`empty`/`starter` для `game3d`/`game2d`/`app`) и `cloneProjectDocument`, покрытые roundtrip-тестами.
- TASKS/IMPLEMENTED: G1 Completed.

## 1.1.1 — 2026-10-10 (G0 implementation)

- Реализован G0 Infra в monorepo game-is-game: `apps/studio`, `apps/player`, `apps/creator-api`, `apps/worker`, `packages/project-schema`, `packages/creator-shared` (`@tg-creator/shared`), Planned stubs engine/editor/…
- `docs/06-ERROR-CATALOG.md`: добавлены `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.
- `ARCHITECTURE.md`, `TASKS.md`, `IMPLEMENTED.md` синхронизированы со статусом G0 Completed.

## 1.1 — 2026-10-10

- README: исправлен перечень промптов (было «01–12», фактически 00–14); добавлена таблица «промпт → gate»; добавлена ссылка на `docs/06-ERROR-CATALOG.md`.
- NEW `docs/06-ERROR-CATALOG.md`: нормативный реестр машинных error.code, на который ссылается docs/04, §1. Раньше коды выдумывались на месте.
- `docs/04-API-DATA-CONTRACT.md`: §1 явно ссылается на каталог `docs/06-ERROR-CATALOG.md`.
- `docs/05-ROADMAP-AND-QA.md`: в таблицу gates добавлена колонка «Промпт» (01↔G0 … 12↔G11; 13–14↔G12), синхронно с README.
- `.cursor/rules/tg-creator-studio.mdc`: добавлены инварианты 13–15 (секреты, миграции schemaVersion, единый формат error.code).
- `prompts/00-START-HERE.md`: добавлен обязательный блок Definition of Done — единый протокол завершения любого этапа; чтение docs расширено до `docs/06`.
- Остальные промпты (01–14): без изменений содержания; к каждому применим DoD-протокол из промпта 00.
- Полный комплект 1.0 (`docs/01–05`, `prompts/01–14`, `examples/project-3d.v1.json`) включён в репозиторий и усилен патчами 1.1.
