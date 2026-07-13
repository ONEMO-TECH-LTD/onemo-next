/**
 * ONEMO control components — factored from the converted Shape screen's repeated instances.
 * Each is the flattened converter output turned into ONE reusable component with a variant prop
 * and an icon slot. The token contracts (controls.module.css) are the converter's exact emitted
 * bindings — this is the "component library topped up from the screen" proof, NOT the compiler-v2
 * P3 deliverable (that generates these losslessly + automatically; this is a hand-factored seed).
 */
import type { ReactNode } from 'react';
import styles from './controls.module.css';

type IconSlot = { children: ReactNode };

/** Button-Round — light (Reg) or dark-gradient (Spec) round control with a glyph. */
export function ButtonRound({ variant = 'reg', children }: { variant?: 'reg' | 'spec' } & IconSlot) {
  const isSpec = variant === 'spec';
  return (
    <button type="button" className={isSpec ? styles.buttonSpec : styles.buttonRound}>
      <span className={isSpec ? styles.iconOnSpec : styles.icon}>{children}</span>
    </button>
  );
}

/** Button-Spec-Pill — the dark pill with the top-light gradient sheen. */
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

/** Tab — active (full) or inactive (dimmed) dock tab. Opacity is the INTERIM raw value (Dan's
 *  authored 1 / 0.85); rebind to --com-tabbar-active/inactive once the DS pipeline emits them
 *  (E11 sync gap). Marked so it can't masquerade as a token-bound contract. */
export function Tab({ active = false, children }: { active?: boolean } & IconSlot) {
  return (
    <span className={styles.tab} style={{ opacity: active ? 1 : 0.85 /* TODO: --com-tabbar-active/inactive (E11) */ }}>
      <span className={styles.icon}>{children}</span>
    </span>
  );
}
