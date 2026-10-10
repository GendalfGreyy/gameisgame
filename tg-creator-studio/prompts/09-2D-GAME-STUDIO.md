# 09 — Полноценный 2D Studio на PixiJS (G8)

Создай adapter `engine-2d` на PixiJS v8 с 2D scene, sprite, animatedSprite, text, layer, transform, camera, grid, texture assets и Tilemap. Реализуй physics 2D через отдельный Rapier2D adapter (Pixi только renderer), collision event, player controller, jump/run, mobile touch joystick/buttons, camera follow. Интегрируй Inspector, editor command bus, Blueprint, autosave, Play/Publish и Player по общей схеме, не создавай независимый backend.

ACCEPTANCE: из шаблона «2D Platformer» открыть сцену, добавить платформу и монету, поменять position touch, настроить OnCollision → score +1 → Destroy Coin, Play, управлять персонажем на телефоне, опубликовать и запустить. FPS и dispose тесты, roundtrip serialization, Playwright smoke.
