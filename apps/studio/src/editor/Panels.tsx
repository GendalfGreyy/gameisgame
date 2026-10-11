import { findBuiltinModel } from '@tg-creator/asset-sdk';
import { useEffect, useRef } from 'react';

import { useEditorState } from './context.js';

const KIND_LABELS = {
  model: 'Модель',
  image: 'Изображение',
  audio: 'Звук',
  font: 'Шрифт',
} as const;

export function AssetsPanel() {
  const assets = useEditorState((state) => state.document.assetRefs);
  if (assets.length === 0) {
    return (
      <div className="ed-empty" data-testid="assets-panel">
        <p>В проекте пока нет ассетов.</p>
        <p className="muted">Загрузка моделей, картинок и звуков появится на этапе G5.</p>
      </div>
    );
  }
  return (
    <ul className="ed-list" data-testid="assets-panel">
      {assets.map((asset) => (
        <li key={asset.id} className="ed-list__row">
          <span>
            {KIND_LABELS[asset.kind]}
            {findBuiltinModel(asset.id)
              ? ` «${findBuiltinModel(asset.id)?.label ?? ''}» · встроенная`
              : ''}
          </span>
          <span className="mono muted">
            {asset.id} · v{asset.version}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LogicPanel() {
  const graphs = useEditorState((state) => state.document.graphs);
  return (
    <div data-testid="logic-panel">
      {graphs.length === 0 ? (
        <div className="ed-empty">
          <p>Графов логики пока нет.</p>
        </div>
      ) : (
        <ul className="ed-list">
          {graphs.map((graph) => (
            <li key={graph.id} className="ed-list__row">
              <span>{graph.name}</span>
              <span className="mono muted">
                узлов {graph.nodes.length} · связей {graph.edges.length}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="ed-empty muted">Редактор Blueprint-графов — этап G7.</p>
    </div>
  );
}

const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function ConsolePanel() {
  const log = useEditorState((state) => state.log);
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log]);
  if (log.length === 0) {
    return (
      <div className="ed-empty" data-testid="console-panel">
        <p className="muted">Здесь появятся действия редактора и ошибки проверки.</p>
      </div>
    );
  }
  return (
    <ol className="ed-console" data-testid="console-panel" aria-live="polite">
      {log.map((entry, index) => (
        <li
          key={entry.id}
          ref={index === log.length - 1 ? endRef : undefined}
          className={`ed-console__row is-${entry.level}`}
        >
          <time className="mono">{timeFormat.format(entry.at)}</time>
          <span>{entry.message}</span>
        </li>
      ))}
    </ol>
  );
}
