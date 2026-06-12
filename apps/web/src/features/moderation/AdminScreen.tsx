import { useReviewReport, useAdminReports } from './hooks.js';

const TARGET_LABELS: Record<string, string> = {
  user: 'Пользователь',
  event: 'Событие',
  check_in: 'Чек-ин',
};

export function AdminScreen({ onBack }: { onBack: () => void }) {
  const reports = useAdminReports(true);
  const review = useReviewReport();

  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-white/60">
        ← Профиль
      </button>

      <div>
        <h2 className="text-xl font-semibold">Модерация</h2>
        <p className="mt-1 text-sm text-white/60">Открытые жалобы</p>
      </div>

      {reports.isLoading ? <p className="text-sm text-white/60">Загружаю…</p> : null}
      {reports.error ? (
        <p className="text-sm text-red-300">{reports.error.message}</p>
      ) : null}

      {reports.data && reports.data.items.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Очередь пуста — всё чисто.
        </p>
      ) : null}

      <ul className="space-y-3">
        {reports.data?.items.map((report) => (
          <li key={report.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">
              {TARGET_LABELS[report.targetType] ?? report.targetType} ·{' '}
              {new Date(report.createdAt).toLocaleString('ru-RU')}
            </p>
            <p className="mt-1 font-mono text-xs text-white/60">{report.targetId}</p>
            <p className="mt-2 text-sm">{report.reason}</p>
            <p className="mt-1 text-xs text-white/50">
              от {report.reporter.firstName}
              {report.reporter.username ? ` (@${report.reporter.username})` : ''}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({ reportId: report.id, body: { status: 'dismissed' } })
                }
                className="flex-1 rounded-lg border border-white/15 py-2 text-xs"
              >
                Отклонить
              </button>
              <button
                type="button"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({ reportId: report.id, body: { status: 'actioned' } })
                }
                className="flex-1 rounded-lg bg-red-500/80 py-2 text-xs font-medium text-white"
              >
                Принять меры
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
