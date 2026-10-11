import { useEffect, useId, useRef } from 'react';

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** In-app modal: works the same in Telegram, desktop and mobile browsers. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <p className="dialog__text">{description}</p>
        <div className="dialog__actions">
          <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className={destructive ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Подождите…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
