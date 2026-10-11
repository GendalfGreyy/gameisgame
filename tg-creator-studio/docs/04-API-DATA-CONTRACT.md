# 04. API и контракты данных

## 1. Принципы

Базовый REST prefix: `/api/v1`. JSON-запросы валидируются схемами и server-side ACL. `Authorization` обязателен для черновиков и операций записи. Идентификаторы — ULID/UUID; все timestamps — UTC ISO-8601, отображать локально. `mutationId` — строковый идемпотентный ключ на запись. API возвращает **машинный error.code + сообщение на русском**. Нормативный реестр кодов — `docs/06-ERROR-CATALOG.md`; незадокументированные коды запрещены. HTTP 409 — конфликт revisions; 422 — неверный документ; 413 — превышение лимита файла; 403 — нет прав; 429 — rate limit.

## 2. Auth

| Метод / URI             | Назначение                                   | Авторизация                  |
| ----------------------- | -------------------------------------------- | ---------------------------- |
| `POST /auth/telegram`   | `{initData}` → session, user profile         | Проверенная подпись initData |
| `POST /auth/dev`        | `{telegramId?,firstName?,username?}` → то же | только development + флаг    |
| `GET /me`               | Текущий пользователь, квоты, preferences     | session                      |
| `PATCH /me/preferences` | `{theme?, density?}` → preferences           | session                      |
| `POST /auth/logout`     | Завершить сессию                             | session                      |

Реализовать проверку подписи по официальному Telegram алгоритму, `auth_date` replay window, timing-safe comparison, test vectors; не сохранять raw initData в логи. Dev auth только при явном `NODE_ENV=development` и отдельном config flag, с hard block в production.

Session — непрозрачный bearer-токен (`Authorization: Bearer tgc_…`); в БД хранится только SHA-256. Ответ `POST /auth/*`: `{token, expiresAt, user}`. `GET /me`: `{user, preferences, quotas:{projects:{used,limit}}, session:{expiresAt}}`.

**Preferences** (S18): `theme ∈ telegram | system | dark | light` (по умолчанию `telegram`), `density ∈ comfortable | compact` (по умолчанию `comfortable`). Хранятся на сервере per user, клиент применяет мгновенно и кэширует локально. Схемы — `@tg-creator/shared` (`userPreferencesSchema`).

## 3. Projects + Drafts

| Метод / URI                             | Payload / результат                                    | Требуемое право        |
| --------------------------------------- | ------------------------------------------------------ | ---------------------- |
| `GET /projects?cursor=&type=&q=&limit=` | Pageable list, lastEditedAt                            | owner/editor           |
| `POST /projects`                        | `{title,type,templateId?}` → projectId/revision        | authenticated          |
| `GET /projects/:id`                     | metadata + current draft revision                      | project reader         |
| `GET /projects/:id/draft`               | `{projectId,revision,etag,savedAt,document}`           | project reader         |
| `PUT /projects/:id/draft`               | `{document, baseRevision, mutationId}` → next revision | project editor         |
| `PATCH /projects/:id/metadata`          | `{title,description,visibility}`                       | project editor         |
| `POST /projects/:id/duplicate`          | clone → new project                                    | project reader + quota |
| `POST /projects/:id/archive`            | archive flag                                           | owner                  |
| `DELETE /projects/:id`                  | soft delete + grace policy                             | owner                  |
| `GET /projects/:id/versions`            | page published/draft snapshots                         | reader                 |

`GET /projects` — keyset pagination по `(lastEditedAt desc, id desc)`, ответ `{items, nextCursor}`; `q` — поиск по названию без учёта регистра, `limit` ≤ 50 (по умолчанию 20). `POST /projects` → `201 {projectId, revision, project}`; `templateId ∈ empty | starter`, `orientation ∈ auto | portrait | landscape`. Ошибки тела запроса — `VALIDATION_FAILED` (422).

Для R0 разрешен `PUT` документа с `baseRevision` в transaction. R1 вводит патчи и history journal при необходимости, но не как обязательную преждевременную сложность.

### `GET draft`

`200 {projectId, revision, etag, savedAt, document}`, заголовки `ETag: "rev-<revision>"` и `Cache-Control: no-store`. `document` всегда текущей `schemaVersion` (2): сохранённый документ старой версии мигрируется при чтении (docs/03, §4), в БД он перезаписывается только следующим `PUT`.

### `PUT draft` request

```json
{
  "baseRevision": 11,
  "mutationId": "mut_7f3c9a1e",
  "document": { "schemaVersion": 2, "...": "..." }
}
```

- `baseRevision` — ревизия, от которой клиент начинал правку. Запись — compare-and-swap в транзакции (`UPDATE … WHERE revision = baseRevision`), `revision` растёт на 1, `title` проекта синхронизируется с `document.title`.
- `mutationId` — `[A-Za-z0-9_-]{8,100}`, генерирует клиент на каждое сохранение. Журнал `draft_mutations` в Postgres (не TTL-кэш) хранит `(projectId, mutationId) → sha256(document), baseRevision, revision, savedAt`. Повтор того же запроса (в т.ч. параллельный и после рестарта сервера) возвращает сохранённый результат без второй записи; тот же `mutationId` с другим документом или `baseRevision` → `409 MUTATION_ID_REUSED`.
- `document` проходит `parseProjectDocument` (миграция → Zod → целостность). `id`, `ownerId` и `type` должны совпадать с проектом, иначе `422 SCHEMA_INVALID`. Документ старой schemaVersion принимается и сохраняется уже мигрированным.
- Лимит сериализованного документа — `DRAFT_MAX_BYTES` = 2 MiB → `413 DOCUMENT_TOO_LARGE` (`details.limitBytes`, `details.actualBytes`); тело запроса больше 3 MB отклоняется до разбора тем же кодом.
- Ошибки документа — `422` с `details.issues[]` (≤ 100, `{code, path, message, sceneId?, entityId?, pageId?, componentId?, graphId?, nodeId?}`): `HIERARCHY_CYCLE`, `GRAPH_BROKEN_REF`, `SCHEMA_INVALID`, `MIGRATION_FAILED`. Неверная форма самого запроса — `422 VALIDATION_FAILED`. При любой ошибке ревизия не меняется.
- Чужой или удалённый проект → `404 NOT_FOUND`, без сессии → `401`.

### `PUT draft` response

`200` + заголовок `ETag`:

```json
{ "projectId": "prj_001", "revision": 12, "etag": "\"rev-12\"", "savedAt": "2026-10-10T10:15:00Z" }
```

При конфликте (`409`):

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Проект изменен в другой сессии",
    "details": { "expectedRevision": 11, "actualRevision": 12 }
  }
}
```

## 4. Asset API

| URI                         | Назначение                                      |
| --------------------------- | ----------------------------------------------- |
| `POST /assets/upload-init`  | type/size/hash → signed upload URL + assetId    |
| `POST /assets/:id/finalize` | Повторная проверка и переход в processing       |
| `GET /assets?projectId=`    | Метаданные и превью assets владельца            |
| `GET /assets/:id`           | Статус processing/ready/rejected, approved URLs |
| `DELETE /assets/:id`        | Удаление при отсутствии защищенных зависимостей |

Нельзя считать загрузку завершенной только потому, что клиент вернул success; worker валидирует и переводит asset в `ready`.

**Встроенные ассеты (G4):** `AssetRef` с ID `builtin_*` (например `{ "id": "builtin_tree", "version": "1", "kind": "model" }`) не загружаются через Asset API — клиент и Player получают их из `@tg-creator/asset-sdk`. Сервер хранит их в `assetRefs` как обычные ссылки; проверка целостности документа одинакова.

## 5. Blueprint validation

`POST /projects/:id/validate` принимает текущую ревизию или draft, возвращает `errors[]` и `warnings[]` с адресацией `{sceneId, entityId, graphId, nodeId, propertyPath, code, message}`. Publish использует тот же валидатор на сервере плюс контроль доступа, зависимостей и квот.

## 6. Publish + Public Player

| URI                                               | Назначение                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /projects/:id/publish`                      | `{baseRevision, title?, changelog?}` → `versionId/publicId/shareUrl` |
| `GET /projects/:id/versions/:versionId`           | Проверенный version manifest для автора                              |
| `POST /projects/:id/unpublish`                    | Сделать публичный alias недоступным                                  |
| `GET /public/projects/:publicId`                  | Публичная карточка + опубликованная version ref                      |
| `GET /public/versions/:versionId/manifest`        | Только разрешенный опубликованный manifest, без черновика            |
| `GET /public/versions/:versionId/assets/:assetId` | Разрешенный доступ к asset version/URL                               |

Публикация должна быть **атомарной на уровне метаданных версии**, а assets versioned/immutable. `shareUrl` строится только для настоящего настроенного bot username. Если бот не сконфигурирован, тестовый environment должен честно возвращать `PUBLISH_LINK_NOT_CONFIGURED`, а не выдумывать рабочую ссылку.

## 7. Data Collections API для App Builder

| URI                                               | Назначение                                               |
| ------------------------------------------------- | -------------------------------------------------------- |
| `GET/POST /projects/:id/collections`              | schema коллекции, право Owner/Editor                     |
| `GET/PATCH/DELETE /projects/:id/collections/:cid` | изменить/удалить schema в разрешенной границе            |
| `POST /runtime/:publicId/actions/:actionId`       | публично разрешенное **типизированное действие** проекта |
| `GET /runtime/:publicId/data/:collectionId`       | выборка только по policy проекта и текущего игрока       |

Для каждой коллекции определить `readPolicy` и `writePolicy`: `ownerOnly`, `authenticatedOwnRows`, `publicRead`, `publicCreate` и дополнительные field-level constraints. Запрещено делать «универсальный CRUD всего по publicId» без policy. Коллекция записей — не часть ProjectDocument и не попадает в version snapshot; схема коллекции версионируется отдельно.

## 8. Пример минимального документа

Канонический пример текущей версии — `examples/project-3d.v2.json` (проходит `parseProjectDocument`, загружается в dev-БД `pnpm --filter @tg-creator/creator-api db:seed`). `examples/project-3d.v1.json` сохранён как вход для тестов миграции. `title` и `ownerId` внутри документа не заменяют права в базе. Graph runtime не обязан присутствовать в пустой сцене.

## 9. Сохранение на разных устройствах

- Draft содержит `revision` на сервере и `localPatchQueue` в браузерном IndexedDB.
- Сохранение `revision=N` отклоняется с 409, если в БД `revision=N+1`.
- На конфликт пользователь выбирает загрузить серверную версию, сохранить локальную копию проекта или открыть экран сравнения; **никогда не затирать изменения молча**.
- После reconnect с неподтвержденными local changes статус остается `Есть несинхронизированные изменения` до успешного ответа.
- R2 collaboration внедряется отдельной подсистемой поверх документа, не заменяя историю опубликованных версий.

## 10. Тесты контрактов

1. Telegram initData с неверным HMAC → 401; просроченный auth_date → 401.
2. Автор A не может читать/редактировать приватный проект B → 403/404 (единая политика разглашения существования).
3. JSON c несуществующим `parentId` или циклом → 422, исходный revision без изменений.
4. Два параллельных PUT с одним `baseRevision` → успех первого, 409 второго.
5. Повторный `mutationId` не создает двойного эффекта.
6. Публикация при missing asset → ошибка с указанием assetId.
7. Изменение draft после publish не меняет manifest опубликованной версии.
8. Игрок без прав не может менять чужую Data Collection.
9. Снятие с публикации скрывает публичный alias, но не уничтожает черновик.
10. Player не может вызывать editor API без разрешений, даже зная project ID.
