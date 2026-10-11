# 03 — Независимая документная модель (G2)

В `packages/project-schema` реализуй discriminated union Zod схемы для `ProjectDocument`, `Scene`, `SceneEntity`, компонентов Transform/Mesh/Material/Camera/Light, `AppPage`, Graph/Node/Edge, AssetRef и typed variables. Введи schemaVersion и чистую migration функцию. Подключи seed-проект из `examples/project-3d.v1.json` (адаптируй пример, если реальная валидная схема требует уточнений, и синхронизируй docs).

Создай server `GET draft` / `PUT draft` с optimistic `baseRevision`, транзакцией, `mutationId` идемпотентностью, TTL/cache не считаются базой. Ответ `revision`, `etag`, `savedAt`. Незаконные `parentId`, циклы, дубликаты IDs, invalid graph refs — 422. Совместимость schema — контракт между Studio и Player.

ACCEPTANCE: roundtrip serialize→deserialize→serialize сохраняет содержимое; миграции проходят fixture tests; 409 при конкурирующих ревизиях, unauthorized denied; проект перечитывается после перезагрузки Node сервера. Запрещено сериализовать движковые объекты в БД. Покажи unit/integration результаты.
