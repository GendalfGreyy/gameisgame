import { useAuthStore } from '../auth/store.js';
import { CheckInCard } from '../checkin/CheckInCard.js';
import { useEventDetail, useJoinEvent } from './hooks.js';

function formatWindow(startsAt: string, endsAt: string): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${format(startsAt)} – ${format(endsAt)}`;
}

export function EventScreen({
  eventId,
  onBack,
  onOpenHostQr,
}: {
  eventId: string;
  onBack: () => void;
  onOpenHostQr: (eventId: string) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const detail = useEventDetail(eventId);
  const join = useJoinEvent(eventId);

  if (detail.isLoading) {
    return <p className="text-sm text-white/60">Загружаю событие…</p>;
  }
  if (detail.error || !detail.data) {
    return (
      <section className="space-y-3">
        <button type="button" onClick={onBack} className="text-sm text-white/60">
          ← Назад
        </button>
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {detail.error?.message ?? 'Событие не найдено'}
        </p>
      </section>
    );
  }

  const event = detail.data;
  const isHost = user?.id === event.host.id;
  const eventStarted = new Date(event.startsAt).getTime() <= Date.now();
  const eventEnded = new Date(event.endsAt).getTime() < Date.now();

  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-white/60">
        ← Назад
      </button>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-2xl font-semibold">{event.title}</h2>
        <p className="mt-1 text-sm text-white/60">{formatWindow(event.startsAt, event.endsAt)}</p>
        {event.description ? (
          <p className="mt-3 text-sm text-white/80">{event.description}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-4 text-sm text-white/70">
          <span>{event.participantCount} идут</span>
          {event.maxParticipants ? <span>мест: {event.maxParticipants}</span> : null}
          <span>хост: {event.host.firstName}</span>
        </div>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={() => onOpenHostQr(event.id)}
          className="w-full rounded-xl bg-tg-accent px-4 py-3 font-medium text-white"
        >
          Показать код для чек-ина
        </button>
      ) : null}

      {!event.isParticipant && !eventEnded ? (
        <button
          type="button"
          disabled={join.isPending}
          onClick={() => join.mutate()}
          className="w-full rounded-xl bg-tg-accent px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {join.isPending ? 'Записываюсь…' : 'Я иду'}
        </button>
      ) : null}
      {join.error ? <p className="text-sm text-red-300">{join.error.message}</p> : null}

      {event.isParticipant && eventStarted && !eventEnded ? (
        <CheckInCard eventId={event.id} />
      ) : null}
      {event.isParticipant && !eventStarted ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Ты записан(а). Чек-ин откроется со стартом события.
        </p>
      ) : null}
    </section>
  );
}
