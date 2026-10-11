import 'react';

declare module 'react' {
  interface CSSProperties {
    /** Stagger index read by the `.enter` animation. */
    '--i'?: number;
  }
}
