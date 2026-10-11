import { useEffect, useId, useState, type ReactNode } from 'react';

/** Mobile bottom sheet, 60% of the viewport by default, expandable to ~90% (docs/02 §4). */
export function Sheet({
  title,
  onClose,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ed-sheet-layer" role="presentation">
      <div className="ed-sheet-scrim" onClick={onClose} />
      <section
        className={`ed-sheet${expanded ? ' is-expanded' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        data-testid={testId}
      >
        <header className="ed-sheet__head">
          <button
            type="button"
            className="ed-sheet__handle"
            aria-label={expanded ? 'Уменьшить панель' : 'Развернуть панель'}
            onClick={() => setExpanded((value) => !value)}
          />
          <h2 id={titleId} className="ed-sheet__title">
            {title}
          </h2>
          <button type="button" className="ed-icon-btn" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="ed-sheet__body">{children}</div>
      </section>
    </div>
  );
}
