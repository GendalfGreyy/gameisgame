import { saveIndicator, type SaveIndicator } from '@tg-creator/editor-core';

import { useEditorState } from './context.js';

const LABELS: Record<SaveIndicator, string> = {
  saved: 'Сохранено',
  dirty: 'Не сохранено',
  saving: 'Сохранение…',
  error: 'Ошибка сохранения',
  offline: 'Нет связи',
  conflict: 'Конфликт версий',
};

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** docs/02 §10.5: always an honest Saving / Saved / Offline / Conflict status. */
export function SaveStatus({ compact = false }: { compact?: boolean }) {
  const indicator = useEditorState(saveIndicator);
  const savedAt = useEditorState((state) => state.savedAt);
  const revision = useEditorState((state) => state.serverRevision);
  const save = useEditorState((state) => state.save);

  let detail = '';
  if (indicator === 'saved' && savedAt) {
    detail = `ревизия ${revision} · ${timeFormat.format(new Date(savedAt))}`;
  } else if (indicator === 'error' && save.kind === 'error') {
    detail = save.message;
  } else if (indicator === 'offline') {
    detail = 'изменения только на этом устройстве';
  }

  return (
    <span
      className={`ed-save is-${indicator}`}
      role="status"
      aria-live="polite"
      data-testid="save-status"
      data-state={indicator}
      title={detail || undefined}
    >
      <span className="ed-save__dot" aria-hidden="true" />
      <span className="ed-save__label">{LABELS[indicator]}</span>
      {!compact && detail ? <span className="ed-save__detail mono">{detail}</span> : null}
    </span>
  );
}
