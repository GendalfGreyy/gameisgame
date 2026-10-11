import type { ProjectTypeDto } from '@tg-creator/shared';

/**
 * Schematic "blueprint" drawings for each project type. Strokes use currentColor,
 * the highlighted part uses the accent token so every theme recolours them.
 */
export function TypeArt({ type, className }: { type: ProjectTypeDto; className?: string }) {
  return (
    <svg
      className={`type-art${className ? ` ${className}` : ''}`}
      viewBox="0 0 120 80"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {type === 'game3d' && (
        <>
          <g className="type-art__faint">
            <path d="M12 58 60 34l48 24-48 24z" />
            <path d="M28 66 76 42M44 74l48-24M28 50l48 24M44 42l48 24" />
          </g>
          <path className="type-art__accent" d="M60 14 80 24v22L60 56 40 46V24z" />
          <path d="m40 24 20 10 20-10M60 34v22" />
          <circle className="type-art__dot" cx="84" cy="14" r="3" />
        </>
      )}
      {type === 'game2d' && (
        <>
          <g className="type-art__faint">
            <path d="M8 66h104" />
            <path d="M8 74h104" />
          </g>
          <rect x="14" y="54" width="36" height="12" />
          <path d="M26 54v12M38 54v12" />
          <rect x="70" y="40" width="36" height="12" />
          <path d="M82 40v12M94 40v12" />
          <path className="type-art__faint" strokeDasharray="3 4" d="M36 44c8-30 34-34 46-12" />
          <rect className="type-art__accent" x="26" y="34" width="14" height="20" rx="2" />
          <circle className="type-art__dot" cx="88" cy="20" r="3" />
        </>
      )}
      {type === 'app' && (
        <>
          <rect x="38" y="6" width="44" height="70" rx="7" />
          <path d="M54 12h12" />
          <g className="type-art__faint">
            <path d="M46 24h28M46 32h20" />
            <rect x="46" y="40" width="28" height="12" rx="2" />
          </g>
          <rect className="type-art__accent" x="46" y="58" width="28" height="9" rx="3" />
          <path className="type-art__faint" d="M20 30h12M20 38h8M88 46h12M92 54h8" />
        </>
      )}
    </svg>
  );
}
