import 'react';

declare module 'react' {
  interface CSSProperties {
    /** Stagger index read by the `.enter` animation. */
    '--i'?: number;
    /** Nesting level of a Hierarchy row (indentation). */
    '--depth'?: number;
  }
}
