import { useState } from 'react';

import { EventCard } from './EventCard.js';
import { useGeolocation, useNearbyEvents, useStartingSoon } from './hooks.js';

type Tab = 'nearby' | 'soon';

export function DiscoveryScreen({ onOpenEvent }: { onOpenEvent: (eventId: string) => void }) {
  const [tab, setTab] = useState<Tab>('nearby');
  const geo = useGeolocation();
  const nearby = useNearbyEvents(geo.position);
  const soon = useStartingSoon(geo.position);

  if (geo.error) {
    return (
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/70">{geo.error}</p>
        <button
          type="button"
          onClick={geo.refresh}
          className="rounded-xl bg-tg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Обновить локацию
        </button>
      </section>
    );
  }

  if (!geo.position) {
    return <p className="text-sm text-white/60">Определяю, где ты…</p>;
  }

  const active = tab === 'nearby' ? nearby : soon;
  const items = tab === 'nearby' ? nearby.data?.items : soon.data?.items;
  const isFallback = tab === 'nearby' && nearby.data?.fallback === true;

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        <TabButton active={tab === 'nearby'} onClick={() => setTab('nearby')}>
          Рядом
        </TabButton>
        <TabButton active={tab === 'soon'} onClick={() => setTab('soon')}>
          Через час
        </TabButton>
      </div>

      {active.isLoading ? <p className="text-sm text-white/60">Ищу гейм…</p> : null}
      {active.error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {active.error.message}
        </p>
      ) : null}

      {isFallback ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="text-sm font-medium text-amber-200">Рядом пока тихо</p>
          <p className="mt-1 text-sm text-white/70">
            Вот что начинается раньше всего — или создай своё событие и собери людей.
          </p>
        </div>
      ) : null}

      {items && items.length === 0 && !isFallback ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/70">
            {tab === 'soon'
              ? 'В ближайшие 90 минут поблизости ничего не стартует.'
              : 'Пока пусто — будь первым, кто что-то замутит.'}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {items?.map((event) => <EventCard key={event.id} event={event} onOpen={onOpenEvent} />)}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-xl bg-tg-accent px-4 py-2 text-sm font-medium text-white'
          : 'rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70'
      }
    >
      {children}
    </button>
  );
}
