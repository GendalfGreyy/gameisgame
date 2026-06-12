import { useState } from 'react';

import { ReportSheet } from '../moderation/ReportSheet.js';
import { useAuthStore } from '../auth/store.js';
import { CheckInCard } from '../checkin/CheckInCard.js';
import {
  Card,
  ErrorBanner,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from '../../shared/ui/primitives.js';
import { boostsFeatureEnabled, useCreateBoost } from './boost.hooks.js';
import { cloneTimesFromEvent } from './create-event.util.js';
import { useCloneEvent, useEventDetail, useJoinEvent } from './hooks.js';

function formatWindow(startsAt: string, endsAt: string): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${format(startsAt)} – ${format(endsAt)}`;
}

export function EventScreen({
  eventId,
  onBack,
  onOpenHostQr,
  onCloned,
}: {
  eventId: string;
  onBack: () => void;
  onOpenHostQr: (eventId: string) => void;
  onCloned: (eventId: string) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const detail = useEventDetail(eventId);
  const join = useJoinEvent(eventId);
  const clone = useCloneEvent(eventId);
  const boost = useCreateBoost(eventId);
  const [showReport, setShowReport] = useState(false);

  if (detail.isLoading) {
    return <p className="text-sm text-gig-muted">Загружаю событие…</p>;
  }
  if (detail.error || !detail.data) {
    return (
      <section className="space-y-3">
        <GhostButton onClick={onBack}>← Назад</GhostButton>
        <ErrorBanner message={detail.error?.message ?? 'Событие не найдено'} />
      </section>
    );
  }

  const event = detail.data;
  const isHost = user?.id === event.host.id;
  const eventStarted = new Date(event.startsAt).getTime() <= Date.now();
  const eventEnded = new Date(event.endsAt).getTime() < Date.now();
  const showBoost = boostsFeatureEnabled() && isHost && !eventEnded;

  return (
    <section className="space-y-5">
      <GhostButton onClick={onBack}>← Назад</GhostButton>

      <Card className="space-y-3 p-5">
        <PageTitle title={event.title} subtitle={formatWindow(event.startsAt, event.endsAt)} />
        {event.description ? (
          <p className="text-sm leading-relaxed text-gig-muted">{event.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gig-muted">
          <span>{event.participantCount} идут</span>
          {event.maxParticipants ? <span>мест: {event.maxParticipants}</span> : null}
          <span>хост: {event.host.firstName}</span>
        </div>
      </Card>

      {isHost && !eventEnded ? (
        <PrimaryButton className="w-full" onClick={() => onOpenHostQr(event.id)}>
          Показать код для чек-ина
        </PrimaryButton>
      ) : null}

      {showBoost ? (
        <Card className="space-y-2 border-amber-200 bg-amber-50/80">
          <p className="font-semibold text-amber-900">Поднять в выдаче (Stars)</p>
          <div className="flex flex-wrap gap-2">
            {(['spotlight_1h', 'spotlight_24h', 'super_boost'] as const).map((plan) => (
              <SecondaryButton
                key={plan}
                className="px-3 py-1.5 text-xs"
                disabled={boost.isPending}
                onClick={() => boost.mutate(plan)}
              >
                {plan.replace('_', ' ')}
              </SecondaryButton>
            ))}
          </div>
          {boost.error ? <ErrorBanner message={boost.error.message} /> : null}
        </Card>
      ) : null}

      {isHost ? (
        <SecondaryButton
          className="w-full"
          disabled={clone.isPending}
          onClick={() =>
            clone.mutate(cloneTimesFromEvent(event.startsAt, event.endsAt), {
              onSuccess: (cloned) => onCloned(cloned.id),
            })
          }
        >
          {clone.isPending ? 'Создаю копию…' : 'Повторить событие'}
        </SecondaryButton>
      ) : null}
      {clone.error ? <ErrorBanner message={clone.error.message} /> : null}

      {!event.isParticipant && !eventEnded ? (
        <PrimaryButton className="w-full" disabled={join.isPending} onClick={() => join.mutate()}>
          {join.isPending ? 'Записываюсь…' : 'Я иду'}
        </PrimaryButton>
      ) : null}
      {join.error ? <ErrorBanner message={join.error.message} /> : null}

      {event.isParticipant && eventStarted && !eventEnded ? (
        <CheckInCard eventId={event.id} />
      ) : null}
      {event.isParticipant && !eventStarted ? (
        <Card className="text-sm text-gig-muted">
          Ты записан(а). Чек-ин откроется со стартом события.
        </Card>
      ) : null}

      {!isHost ? (
        <GhostButton className="w-full text-center" onClick={() => setShowReport(true)}>
          Пожаловаться на событие
        </GhostButton>
      ) : null}

      {showReport ? (
        <ReportSheet
          targetType="event"
          targetId={event.id}
          label={`Событие «${event.title}»`}
          onClose={() => setShowReport(false)}
        />
      ) : null}
    </section>
  );
}
