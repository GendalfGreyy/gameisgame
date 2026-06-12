import type { EventTemplate } from '@game-is-game/shared';
import { useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { Skeleton, Stagger } from '../../shared/ui/motion.js';
import {
  ErrorBanner,
  GhostButton,
  PageTitle,
  PrimaryButton,
  TextArea,
  TextInput,
} from '../../shared/ui/primitives.js';
import {
  applyTemplate,
  defaultStartLocal,
  endFromStartLocal,
  localToIso,
} from './create-event.util.js';
import { useCreateEvent, useEventTemplates, useGeolocation } from './hooks.js';

export function CreateEventScreen({ onCreated }: { onCreated: (eventId: string) => void }) {
  const templates = useEventTemplates();
  const geo = useGeolocation();
  const create = useCreateEvent();

  const [selected, setSelected] = useState<EventTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState(defaultStartLocal);
  const [endLocal, setEndLocal] = useState('');

  const pickTemplate = (template: EventTemplate) => {
    const start = defaultStartLocal();
    setSelected(template);
    setTitle(template.title);
    setDescription(template.description);
    setStartLocal(start);
    setEndLocal(endFromStartLocal(start, template.durationMinutes));
  };

  if (templates.isLoading) {
    return (
      <section className="space-y-5">
        <PageTitle title="Создай за минуту" subtitle="Выбери формат — время и место подставим." />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="space-y-5">
        <PageTitle
          title="Создай за минуту"
          subtitle="Выбери формат — время и место подставим."
        />
        <div className="grid grid-cols-2 gap-3">
          {templates.data?.items.map((template, index) => (
            <Stagger key={template.id} index={index}>
              <button
                type="button"
                onClick={() => {
                  haptics.press();
                  pickTemplate(template);
                }}
                className="gig-card relative w-full overflow-hidden rounded-3xl border p-4 text-left shadow-card transition duration-150 active:scale-[0.96]"
              >
                <span
                  className="gig-gradient-soft-bg pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
                  style={{ opacity: index % 2 === 0 ? 0.55 : 0.35 }}
                  aria-hidden
                />
                <div className="relative space-y-2">
                  <span className="animate-float inline-block text-4xl" style={{ animationDelay: `${index * 0.35}s` }}>
                    {template.emoji}
                  </span>
                  <p className="font-bold leading-tight text-gig-ink">{template.title}</p>
                  <p className="text-xs font-medium text-gig-muted">
                    {template.durationMinutes} мин
                    {template.maxParticipants ? ` · до ${template.maxParticipants}` : ''}
                  </p>
                </div>
              </button>
            </Stagger>
          ))}
        </div>
        {templates.error ? <ErrorBanner message={templates.error.message} /> : null}
      </section>
    );
  }

  const canSubmit =
    title.trim().length >= 3 &&
    startLocal.length > 0 &&
    endLocal.length > 0 &&
    geo.position !== null &&
    !create.isPending;

  return (
    <section className="space-y-5">
      <GhostButton onClick={() => setSelected(null)}>← Другой шаблон</GhostButton>

      <PageTitle
        title={`${selected.emoji} Новое событие`}
        subtitle="Проверь детали и опубликуй."
      />

      <label className="block space-y-2">
        <span className="text-sm font-medium text-gig-muted">Название</span>
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-gig-muted">Описание</span>
        <TextArea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-gig-muted">Начало</span>
          <TextInput
            type="datetime-local"
            value={startLocal}
            onChange={(event) => setStartLocal(event.target.value)}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-gig-muted">Конец</span>
          <TextInput
            type="datetime-local"
            value={endLocal}
            onChange={(event) => setEndLocal(event.target.value)}
          />
        </label>
      </div>

      {geo.error ? (
        <ErrorBanner message={geo.error} />
      ) : null}
      {!geo.position && !geo.error ? (
        <p className="text-sm text-gig-muted">Определяю локацию для пина…</p>
      ) : null}
      {geo.position ? (
        <p className="text-xs text-gig-muted">
          Место: твоя текущая геопозиция ({geo.position.lat.toFixed(4)},{' '}
          {geo.position.lng.toFixed(4)})
        </p>
      ) : null}

      <PrimaryButton
        className="w-full"
        disabled={!canSubmit}
        onClick={() => {
          if (!geo.position) {
            return;
          }
          const payload = {
            ...applyTemplate(selected, startLocal),
            title: title.trim(),
            description: description.trim() || undefined,
            startsAt: localToIso(startLocal),
            endsAt: localToIso(endLocal),
            lat: geo.position.lat,
            lng: geo.position.lng,
            maxParticipants: selected.maxParticipants ?? undefined,
          };
          haptics.press();
          create.mutate(payload, {
            onSuccess: (event) => {
              haptics.success();
              onCreated(event.id);
            },
            onError: () => haptics.error(),
          });
        }}
      >
        {create.isPending ? 'Публикую…' : 'Опубликовать'}
      </PrimaryButton>

      {create.error ? <ErrorBanner message={create.error.message} /> : null}
    </section>
  );
}
