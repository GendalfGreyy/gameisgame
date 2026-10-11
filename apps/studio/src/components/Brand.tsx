/** Studio mark: an isometric block on a signal tile — "the thing you build". */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--ui-accent-fill)" />
      <g
        fill="none"
        stroke="var(--ui-accent-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M16 7.5 24 12v8.5L16 25l-8-4.5V12z" />
        <path d="m8 12 8 4.5 8-4.5M16 16.5V25" />
      </g>
      <circle cx="24" cy="8" r="2" fill="var(--ui-accent-ink)" />
    </svg>
  );
}

export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand${large ? ' brand--large' : ''}`}>
      <BrandMark size={large ? 56 : 32} />
      <span className="brand__name">
        Creator<span className="brand__studio">Studio</span>
      </span>
    </div>
  );
}
