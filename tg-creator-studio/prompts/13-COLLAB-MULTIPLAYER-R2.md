# 13 — Совместная разработка и мультиплеер (опциональный R2)

Этот этап запускай только после принятого R1. Сначала предложи отдельные ADR и миграции. Для совместного редактирования: команды, ACL roles, Yjs CRDT для типизированных участков документа, awareness cursors, conflict semantics reparent/delete; persist snapshots and reconnect, version checkpoints. Не доверяй клиенту room membership.

Для multiplayer Play: отдельный authoritative session service (например, Colyseus), room matchmaking, player state, input validation, reconciliation/interpolation, max players, disconnect/reconnect, abuse protection; проектные Blueprint-события проходят через контролируемый сетевой bridge. **Не приравнивай** совместное редактирование к multiplayer игры: это разные серверные подсистемы.

ACCEPTANCE: два редактора видят изменения с соблюдением permissions и без циклов hierarchy, два игрока видят одно игровое состояние, злоумышленник не может отправлять чужие authoritative moves. Метрики задержек и лимиты нагрузочного теста в ADR; команда publish работает со snapshot после collaboration freeze/checkpoint.
