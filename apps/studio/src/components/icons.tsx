import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | undefined };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconProjects = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

export const IconPlus = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconSettings = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const IconSearch = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconCube = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="m3 7 9 5 9-5M12 12v10" />
  </Svg>
);

export const IconSprite = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 15h2v-2h4v2h2M9 9h.01M15 9h.01" />
  </Svg>
);

export const IconApp = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M10 18h4" />
  </Svg>
);

export const IconCopy = (props: IconProps) => (
  <Svg {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
);

export const IconTrash = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Svg>
);

export const IconBack = (props: IconProps) => (
  <Svg {...props}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);

export const IconArrow = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconCheck = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);
