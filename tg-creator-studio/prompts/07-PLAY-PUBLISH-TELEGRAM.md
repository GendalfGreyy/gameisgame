# 07 — Play Mode, immutable publishing и запуск в Telegram (G6)

Реализуй реальный Play Runtime: clone immutable ProjectDocument, lifecycle start/update/fixedUpdate/stop/dispose, standalone renderer scene, basic Player Controller, camera, collisions через **один** физический 3D backend (Rapier adapter либо осознанно Ammo bridge, не оба на одном теле). UI `Play`/`Exit Play`, игровой Input keyboard/touch; изоляция игровых изменений от draft.

Создай `POST /projects/:id/validate`, `POST /projects/:id/publish`, version manifest, snapshot & versioned assets, publicId, `GET /public/...`, самостоятельный `apps/player` без editor импортов. Ссылка: `https://t.me/<bot>?startapp=p_<publicId>` — только после реальной настройки бота. Telegram start parameter проверяется как публичный ID, never ACL bypass; share UI.

ACCEPTANCE: создать сцену, Play, вернуться без изменения координат в draft, Publish, второй аккаунт открывает Player по прямому URL и не видит приватных прав; draft changes после publish не отражаются до нового publish; отсутствующий asset блокирует публикацию. Добавь E2E и серверные ACL тесты.
