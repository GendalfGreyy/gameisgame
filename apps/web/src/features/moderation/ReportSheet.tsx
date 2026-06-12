import type { ReportTargetType } from '@game-is-game/shared';
import { useState } from 'react';

import { useCreateReport } from './hooks.js';

export function ReportSheet({
  targetType,
  targetId,
  label,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  label: string;
  onClose: () => void;
}) {
  const create = useCreateReport();
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4">
        <div className="w-full rounded-2xl border border-white/10 bg-tg-bg p-4">
          <p className="font-medium">Жалоба отправлена</p>
          <p className="mt-1 text-sm text-white/60">Модераторы посмотрят в ближайшее время.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-tg-accent py-2 text-sm font-medium text-white"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4">
      <div className="w-full space-y-3 rounded-2xl border border-white/10 bg-tg-bg p-4">
        <p className="font-medium">Пожаловаться</p>
        <p className="text-sm text-white/60">{label}</p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Что не так? (минимум 10 символов)"
          rows={4}
          className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-tg-accent"
        />
        {create.error ? <p className="text-sm text-red-300">{create.error.message}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={reason.trim().length < 10 || create.isPending}
            onClick={() =>
              create.mutate(
                { targetType, targetId, reason: reason.trim() },
                { onSuccess: () => setSent(true) },
              )
            }
            className="flex-1 rounded-xl bg-tg-accent py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {create.isPending ? 'Отправляю…' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
