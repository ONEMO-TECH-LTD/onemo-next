/**
 * Create Studio controls — hand-authored to the golden Shape (Figma v2.3.2), token contracts
 * verbatim from the fresh live conversion (see controls.module.css). One reusable component per
 * repeated element; the flattened converter output is REFERENCE ONLY, never shipped.
 * States (press/focus per the control-states law) wire in a later pass; anatomy first.
 */
import type { ReactNode } from 'react';
import styles from './controls.module.css';

type IconSlot = { children: ReactNode };

/** Button-Round — variant "reg" (light outlined) or "spec" (dark, light-from-top gradient). */
export function ButtonRound({ variant = 'reg', children }: { variant?: 'reg' | 'spec' } & IconSlot) {
  const spec = variant === 'spec';
  return (
    <button type="button" className={spec ? `${styles.buttonSpec} ${styles.buttonSpecRound}` : styles.buttonRound}>
      <span className={spec ? styles.iconOnSpec : styles.icon}>{children}</span>
    </button>
  );
}

/** Button-Spec-Pill — the dark pill (pill padding, same gradient sheen). */
export function SpecPill({ children }: IconSlot) {
  return (
    <button type="button" className={styles.buttonSpec}>
      <span className={styles.iconOnSpec}>{children}</span>
    </button>
  );
}

/** Button-Pill-Done — the light outlined action pill. */
export function PillDone({ children }: { children: ReactNode }) {
  return <button type="button" className={styles.pillDone}>{children}</button>;
}

/** Tab — dock tab. Opacity is TOKEN-BOUND: --com-tabbar-active / --com-tabbar-inactive. */
export function Tab({ active = false, label, children }: { active?: boolean; label?: string } & IconSlot) {
  return (
    <span className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}>
      <span className={styles.tabIcon}>{children}</span>
      {label}
    </span>
  );
}
