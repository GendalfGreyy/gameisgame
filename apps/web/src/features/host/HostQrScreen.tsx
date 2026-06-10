import { useEffect, useState } from 'react';

import { useHostQrToken } from '../events/hooks.js';

/**
 * Rotating check-in code for the host screen. Participants enter the code in
 * their check-in card (QR rendering lands with the qr lib later — the token
 * contract is identical). The code re-fetches exactly when it expires.
 */
export function HostQrScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const qr = useHostQrToken(eventId, true);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!qr.data) {
      return;
    }
    setSecondsLeft(qr.data.expiresInSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [qr.data]);

  return (
    <section className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-white/60">
        ← Назад к событию
      </button>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">Код для чек-ина</p>

        {qr.isLoading ? <p className="mt-6 text-white/60">Получаю код…</p> : null}
        {qr.error ? (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {qr.error.message}
          </p>
        ) : null}

        {qr.data ? (
          <>
            <p className="mt-6 font-mono text-5xl font-bold tracking-[0.3em]">
              {qr.data.token.toUpperCase()}
            </p>
            <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-tg-accent transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(100, (secondsLeft / 30) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-white/50">обновится через {secondsLeft} с</p>
          </>
        ) : null}
      </div>

      <p className="text-center text-sm text-white/50">
        Покажи этот экран на входе — гости вводят код при чек-ине. Скриншот бесполезен: код
        живёт 30 секунд.
      </p>
    </section>
  );
}
