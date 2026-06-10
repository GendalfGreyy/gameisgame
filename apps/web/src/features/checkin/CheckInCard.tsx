import type { CheckInResponse } from '@game-is-game/shared';
import { useEffect, useState } from 'react';

import { useCheckIn, useConfirmDwell, useGeolocation } from '../events/hooks.js';

/**
 * Check-in flow:
 *  - QR: enter (or scan) the rotating code from the host screen → instant confirm.
 *  - GPS: first ping starts the dwell timer; confirm unlocks after 10 minutes
 *    inside the geofence and sends a second ping.
 */
export function CheckInCard({ eventId }: { eventId: string }) {
  const geo = useGeolocation();
  const checkIn = useCheckIn(eventId);
  const confirm = useConfirmDwell(eventId);
  const [qrCode, setQrCode] = useState('');
  const [pending, setPending] = useState<CheckInResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const dwellTarget = pending?.dwellConfirmAfter ? new Date(pending.dwellConfirmAfter).getTime() : null;
  const secondsLeft = dwellTarget ? Math.max(0, Math.ceil((dwellTarget - now) / 1000)) : 0;

  useEffect(() => {
    if (!dwellTarget) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [dwellTarget]);

  const result = confirm.data ?? (pending?.status === 'confirmed' ? pending : null);
  if (result?.status === 'confirmed') {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
        <p className="font-medium text-emerald-200">Чек-ин подтверждён</p>
        {result.pointsAwarded ? (
          <p className="mt-1 text-sm text-white/70">+{result.pointsAwarded} очков</p>
        ) : null}
      </div>
    );
  }

  if (pending && pending.status === 'pending' && pending.dwellConfirmAfter) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="font-medium">Ты на месте — остайся тут</p>
        {secondsLeft > 0 ? (
          <p className="text-sm text-white/70">
            Подтверждение откроется через {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, '0')}
          </p>
        ) : (
          <button
            type="button"
            disabled={confirm.isPending || !geo.position}
            onClick={() => {
              if (geo.position) {
                confirm.mutate({ lat: geo.position.lat, lng: geo.position.lng });
              }
            }}
            className="w-full rounded-xl bg-tg-accent px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {confirm.isPending ? 'Подтверждаю…' : 'Подтвердить присутствие'}
          </button>
        )}
        {confirm.error ? (
          <p className="text-sm text-red-300">{confirm.error.message}</p>
        ) : null}
      </div>
    );
  }

  if (pending && pending.status === 'pending') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/70">
          Чек-ин на проверке — очки придут после подтверждения.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="font-medium">Чек-ин</p>

      <div className="space-y-2">
        <input
          value={qrCode}
          onChange={(input) => setQrCode(input.target.value.trim())}
          placeholder="Код с экрана хоста"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full rounded-xl border border-white/15 bg-transparent px-4 py-3 text-base outline-none placeholder:text-white/40"
        />
        <button
          type="button"
          disabled={checkIn.isPending || !geo.position || qrCode.length < 4}
          onClick={() => {
            if (geo.position) {
              checkIn.mutate(
                { lat: geo.position.lat, lng: geo.position.lng, method: 'qr', qrToken: qrCode },
                { onSuccess: setPending },
              );
            }
          }}
          className="w-full rounded-xl bg-tg-accent px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          Чек-ин по коду
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        или
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        disabled={checkIn.isPending || !geo.position}
        onClick={() => {
          if (geo.position) {
            checkIn.mutate(
              { lat: geo.position.lat, lng: geo.position.lng, method: 'gps' },
              { onSuccess: setPending },
            );
          }
        }}
        className="w-full rounded-xl border border-white/15 px-4 py-3 font-medium text-white/90 disabled:opacity-60"
      >
        {checkIn.isPending ? 'Отмечаюсь…' : 'GPS-чек-ин (10 минут на месте)'}
      </button>

      {!geo.position ? (
        <p className="text-sm text-white/50">Жду геолокацию…</p>
      ) : null}
      {checkIn.error ? <p className="text-sm text-red-300">{checkIn.error.message}</p> : null}
    </div>
  );
}
