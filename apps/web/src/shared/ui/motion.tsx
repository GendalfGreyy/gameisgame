import { useEffect, useRef, useState } from 'react';

/** Count-up number with ease-out, animating on value change. */
export function AnimatedNumber({
  value,
  className = '',
  durationMs = 900,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      return;
    }
    fromRef.current = value;

    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{display.toLocaleString('ru-RU')}</span>;
}

/** Shimmer placeholder block. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`gig-skeleton ${className}`} aria-hidden />;
}

export function EventCardSkeleton() {
  return (
    <div className="gig-card space-y-3 rounded-3xl border p-4 shadow-card">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/**
 * SVG progress ring. `progress` ∈ [0, 1]. Children render in the center.
 */
export function ProgressRing({
  progress,
  size = 168,
  stroke = 8,
  className = '',
  trackClassName = 'text-gig-surface',
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
          stroke="currentColor"
          opacity={0.35}
        />
        <defs>
          <linearGradient id="gig-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6d5efc" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gig-ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${className}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

const CONFETTI_COLORS = ['#6d5efc', '#a855f7', '#f43f5e', '#f59e0b', '#34d399', '#38bdf8'];
const CONFETTI_COUNT = 26;

/** One-shot confetti burst from the center of its container. */
export function ConfettiBurst() {
  const pieces = Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const angle = (index / CONFETTI_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 70 + Math.random() * 90;
    return {
      id: index,
      cx: `${Math.cos(angle) * distance}px`,
      cy: `${Math.sin(angle) * distance - 40}px`,
      cr: `${180 + Math.random() * 360}deg`,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] as string,
      delay: `${Math.random() * 0.12}s`,
      size: 5 + Math.random() * 5,
      round: Math.random() > 0.5,
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute left-1/2 top-1/2"
          style={{
            width: piece.size,
            height: piece.size * (piece.round ? 1 : 1.8),
            background: piece.color,
            borderRadius: piece.round ? '9999px' : '2px',
            animation: `gig-confetti 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${piece.delay} both`,
            ['--cx' as string]: piece.cx,
            ['--cy' as string]: piece.cy,
            ['--cr' as string]: piece.cr,
          }}
        />
      ))}
    </div>
  );
}

/** "+50" flying up and fading out. */
export function PointsFly({ amount }: { amount: number }) {
  return (
    <span className="gig-fly-up gig-gradient-text pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-2xl font-extrabold">
      +{amount}
    </span>
  );
}

/** Sonar/radar pulse — themed visual for empty states and dwell waiting. */
export function Sonar({ size = 180, emoji = '📍' }: { size?: number; emoji?: string }) {
  return (
    <div className="gig-sonar mx-auto" style={{ width: size, height: size }} aria-hidden>
      <div className="gig-sonar-sweep" />
      <div className="gig-sonar-ring" />
      <div className="gig-sonar-ring" style={{ animationDelay: '0.9s' }} />
      <div className="gig-sonar-ring" style={{ animationDelay: '1.8s' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="animate-float text-4xl drop-shadow-[0_0_18px_rgba(139,92,246,0.6)]">
          {emoji}
        </span>
      </div>
    </div>
  );
}

/** Wraps list children with a staggered fade-up entrance. */
export function Stagger({
  children,
  index,
  stepMs = 60,
}: {
  children: React.ReactNode;
  index: number;
  stepMs?: number;
}) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 10) * stepMs}ms` }}>
      {children}
    </div>
  );
}
