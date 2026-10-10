# 06 — Assets, autosave, offline и конфликт версий (G5)

Сделай реальный Asset Manager: upload-init signed URL, finalize, worker validation, status pending/ready/rejected, previews, MIME/magic-byte/size/type checking, GLB/PNG/JPG/WebP/MP3/OGG policy. Структура AssetRef должна содержать версию и разрешенный URL resolver; без raw HTML/SVG/script execution.

Добавь autosave черновика на сервер после debounce через `baseRevision` + `mutationId`; UI статусы Dirty → Saving → Saved только по ack; Offline queued в IndexedDB; reconnect retry; 409 conflict modal с опциями reload, сохранить локальную копию, сравнить. Поддержи revision и reload на двух устройствах, не используй silent last-write-wins.

ACCEPTANCE: загрузить GLB/texture, назначить кубу материал, сохранить, закрыть Telegram, открыть на другом устройстве, получить ту же сцену; выключение интернета не показывает false Saved; конфликт двух клиентов не затирает документ; invalid asset отказывается; интеграционные тесты upload/status/ACL.
