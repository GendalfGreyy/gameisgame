# 08 — Blueprint Graph с настоящим interpreter (G7)

Сделай `logic-engine` registry, typed node schemas, serialization, validator, safe interpreter, runtime event bus и connection API. UI графа — `@xyflow/react` (React Flow только рендер). Категории узлов Events/Flow/Variables/Math/Objects/Physics/UI/Audio/Data. Первый функциональный пакет: OnStart, OnClick, OnCollision, OnTimer, Branch, Sequence, Delay, Get/Set Variable, Add/Compare, Destroy/Spawn Entity, SetTransform, UI.SetText, Debug.Log.

Запрети `eval`, `new Function`, произвольный JS и server-side исполнение пользовательского graph. Строго типизированные exec/data ports, при несовместимости connection недоступна; тестирование invalid cycles, max steps/frame, cancel timers, stop/unmount; debug error includes graphId,nodeId.

ACCEPTANCE: demo сцена: OnStart score=0; OnCollision Coin increments score, updates UI, destroys coin. Срабатывает один раз, видно runtime. После сохранения/перезагрузки graph тот же. 5 разных реальных graph тест-кейсов; граф со сломанным портом Publish не проходит. UI PC и mobile graph UX (минимально workable) проверены.
