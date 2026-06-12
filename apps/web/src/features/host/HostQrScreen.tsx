import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { ProgressRing } from '../../shared/ui/motion.js';
import { ErrorBanner, GhostButton } from '../../shared/ui/primitives.js';
import { useHostQrToken } from '../events/hooks.js';

const TOKEN_WINDOW_SECONDS = 30;

/**
 * "Stage mode": full-bleed dark stage with aurora background, a rotating
 * gradient ring around the QR and per-character code tiles that pop on each
 * rotation. Re-fetches exactly when the token expires; haptic tick on rotate.
 */
export function HostQrScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const qr = useHostQrToken(eventId, true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const previousToken = useRef<string | null>(null);

  useEffect(() => {
    if (!qr.data) {
      setQrImageUrl(null);
      return;
    }
    if (previousToken.current && previousToken.current !== qr.data.token) {
      haptics.tick();
    }
    previousToken.current = qr.data.token;

    setSecondsLeft(qr.data.expiresInSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [qr.data]);

  useEffect(() => {
    if (!qr.data?.token) {
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(qr.data.token, {
      width: 220,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) {
        setQrImageUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [qr.data?.token]);

  return (
    <section className="space-y-5">
      <GhostButton onClick={onBack}>← Назад к событию</GhostButton>

      <div className="relative overflow-hidden rounded-4xl bg-[#0b0b12] p-8 text-center shadow-soft">
        {/* Aurora background */}
        <div
          className="gig-aurora left-[-30%] top-[-20%] h-64 w-64"
          style={{ background: '#6d5efc' }}
        />
        <div
          className="gig-aurora right-[-25%] bottom-[-25%] h-72 w-72"
          style={{ background: '#f43f5e', animationDelay: '-4.5s' }}
        />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            Чек-ин · вход
          </p>

          {qr.isLoading ? (
            <p className="mt-10 text-white/60">Получаю код…</p>
          ) : null}
          {qr.error ? (
            <div className="mt-8">
              <ErrorBanner message={qr.error.message} />
            </div>
          ) : null}

          {qr.data ? (
            <>
              {/* Rotating gradient ring framing the QR */}
              <div className="relative mx-auto mt-8 h-[252px] w-[252px]">
                <div className="gig-stage-ring absolute inset-0 rounded-[36px] opacity-90" />
                <div className="absolute inset-[5px] flex items-center justify-center rounded-[32px] bg-[#0b0b12]">
                  {qrImageUrl ? (
                    <img
                      key={qr.data.token}
                      src={qrImageUrl}
                      alt="QR-код чек-ина"
                      className="animate-pop rounded-3xl"
                      width={220}
                      height={220}
                    />
                  ) : (
                    <div className="gig-skeleton h-[220px] w-[220px] rounded-3xl" />
                  )}
                </div>
              </div>

              {/* Per-character code tiles */}
              <div className="mt-7 flex justify-center gap-1.5" key={qr.data.token}>
                {qr.data.token.toUpperCase().split('').map((char, index) => (
                  <span
                    key={`${char}-${index}`}
                    className="animate-pop flex h-11 w-9 items-center justify-center rounded-xl bg-white/10 font-mono text-xl font-bold text-white backdrop-blur-sm"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    {char}
                  </span>
                ))}
              </div>

              <div className="mt-7 flex items-center justify-center">
                <ProgressRing
                  progress={secondsLeft / TOKEN_WINDOW_SECONDS}
                  size={64}
                  stroke={5}
                  trackClassName="text-white/15"
                >
                  <span className="text-lg font-bold text-white">{secondsLeft}</span>
                </ProgressRing>
              </div>
              <p className="mt-2 text-sm text-white/50">секунд до нового кода</p>
            </>
          ) : null}
        </div>
      </div>

      <p className="text-center text-sm leading-relaxed text-gig-muted">
        Покажи экран на входе — гости сканируют QR или вводят код. Скриншот бесполезен: код
        живёт 30 секунд.
      </p>
    </section>
  );
}
