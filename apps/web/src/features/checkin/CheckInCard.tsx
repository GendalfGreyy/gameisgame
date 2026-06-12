import type { CheckInResponse } from '@game-is-game/shared';
import { useEffect, useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { ConfettiBurst, PointsFly, ProgressRing, Sonar } from '../../shared/ui/motion.js';
import {
  Card,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from '../../shared/ui/primitives.js';
import { useCheckIn, useConfirmDwell, useGeolocation } from '../events/hooks.js';

/**
 * Check-in flow:
 *  - QR: enter (or scan) the rotating code from the host screen → instant confirm.
 *  - GPS: first ping starts the dwell ring; confirm unlocks after 10 minutes
 *    inside the geofence and sends a second ping.
 * Confirmed state celebrates: confetti burst + flying points + success haptic.
 */
export function CheckInCard({ eventId }: { eventId: string }) {
  const geo = useGeolocation();
  const checkIn = useCheckIn(eventId);
  const confirm = useConfirmDwell(eventId);
  const [qrCode, setQrCode] = useState('');
  const [pending, setPending] = useState<CheckInResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const dwellTarget = pending?.dwellConfirmAfter
    ? new Date(pending.dwellConfirmAfter).getTime()
    : null;
  const dwellStart = pending ? new Date(pending.checkedInAt).getTime() : null;
  const secondsLeft = dwellTarget ? Math.max(0, Math.ceil((dwellTarget - now) / 1000)) : 0;
  const dwellProgress =
    dwellTarget && dwellStart && dwellTarget > dwellStart
      ? Math.min(1, (now - dwellStart) / (dwellTarget - dwellStart))
      : 0;

  useEffect(() => {
    if (!dwellTarget) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [dwellTarget]);

  const result = confirm.data ?? (pending?.status === 'confirmed' ? pending : null);

  useEffect(() => {
    if (result?.status === 'confirmed') {
      haptics.success();
    }
  }, [result?.status]);

  if (result?.status === 'confirmed') {
    return (
      <Card className="relative overflow-visible border-emerald-200 bg-emerald-50/80 text-center dark:border-emerald-400/30 dark:bg-emerald-500/10">
        <ConfettiBurst />
        {result.pointsAwarded ? <PointsFly amount={result.pointsAwarded} /> : null}
        <p className="animate-pop text-4xl">🎉</p>
        <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
          Ты в игре!
        </p>
        {result.pointsAwarded ? (
          <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            +{result.pointsAwarded} очков на счёт
          </p>
        ) : null}
      </Card>
    );
  }

  if (pending && pending.status === 'pending' && pending.dwellConfirmAfter) {
    return (
      <Card className="space-y-4 text-center">
        <p className="font-semibold text-gig-ink">Ты на месте — оставайся тут</p>

        {secondsLeft > 0 ? (
          <>
            <div className="flex justify-center">
              <ProgressRing progress={dwellProgress} size={156} stroke={9}>
                <span className="font-mono text-3xl font-bold text-gig-ink">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>
                <span className="mt-1 text-xs text-gig-muted">до подтверждения</span>
              </ProgressRing>
            </div>
            <p className="text-sm leading-relaxed text-gig-muted">
              Кольцо заполнится — кнопка откроется. Очки получают те, кто реально на движе.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Sonar size={120} emoji="✅" />
            </div>
            <PrimaryButton
              className="w-full"
              disabled={confirm.isPending || !geo.position}
              onClick={() => {
                haptics.press();
                if (geo.position) {
                  confirm.mutate({ lat: geo.position.lat, lng: geo.position.lng });
                }
              }}
            >
              {confirm.isPending ? 'Подтверждаю…' : 'Подтвердить присутствие'}
            </PrimaryButton>
          </>
        )}
        {confirm.error ? <ErrorBanner message={confirm.error.message} /> : null}
      </Card>
    );
  }

  if (pending && pending.status === 'pending') {
    return (
      <Card className="text-sm text-gig-muted">
        Чек-ин на проверке — очки придут после подтверждения.
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <p className="font-semibold text-gig-ink">Чек-ин</p>

      <div className="space-y-2">
        <TextInput
          value={qrCode}
          onChange={(input) => setQrCode(input.target.value.trim())}
          placeholder="Код с экрана хоста"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <PrimaryButton
          className="w-full"
          disabled={checkIn.isPending || !geo.position || qrCode.length < 4}
          onClick={() => {
            haptics.press();
            if (geo.position) {
              checkIn.mutate(
                { lat: geo.position.lat, lng: geo.position.lng, method: 'qr', qrToken: qrCode },
                {
                  onSuccess: setPending,
                  onError: () => haptics.error(),
                },
              );
            }
          }}
        >
          Чек-ин по коду
        </PrimaryButton>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gig-muted">
        <span className="h-px flex-1 bg-black/[0.08] dark:bg-white/10" />
        или
        <span className="h-px flex-1 bg-black/[0.08] dark:bg-white/10" />
      </div>

      <SecondaryButton
        className="w-full"
        disabled={checkIn.isPending || !geo.position}
        onClick={() => {
          haptics.press();
          if (geo.position) {
            checkIn.mutate(
              { lat: geo.position.lat, lng: geo.position.lng, method: 'gps' },
              {
                onSuccess: setPending,
                onError: () => haptics.error(),
              },
            );
          }
        }}
      >
        {checkIn.isPending ? 'Отмечаюсь…' : 'GPS-чек-ин (10 минут на месте)'}
      </SecondaryButton>

      {!geo.position ? <p className="text-sm text-gig-muted">Жду геолокацию…</p> : null}
      {checkIn.error ? <ErrorBanner message={checkIn.error.message} /> : null}
    </Card>
  );
}
