import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      {children}
    </svg>
  );
}

export function IconDiscover(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconBase>
  );
}

export function IconCreate(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M6 4H4v1a3 3 0 0 0 3 3M18 4h2v1a3 3 0 0 1-3 3" />
      <path d="M12 11v3M9 20h6M10 14h4v3H10v-3Z" />
    </IconBase>
  );
}

export function IconSquad(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="10.5" r="2.5" />
      <path d="M4.5 18.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M14 18.5c0-1.8 1.4-3.2 3-3.4" />
    </IconBase>
  );
}

export function IconProfile(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" />
    </IconBase>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </IconBase>
  );
}
