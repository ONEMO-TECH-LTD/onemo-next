// THE bottom dock — ONE pill-island component on every screen (KAI-9021, Dan: "this must be the
// same pill island as hero - nothing must change with changes from creator to editor - same
// structure different icons for different tools"). The hero positions it absolutely over the
// scene; the editor centers it in its bottom slot — same island, payload-only differences
// (the TopBar/KAI-8986 identity model applied to the bottom dock).

'use client'

import type { ReactNode } from 'react'
import styles from './toolbar.module.css'

/** One dock tool: icon over a small label (mobile-first touch target). */
export function DockTool({ icon, label, onClick, active, primary, disabled }: {
  icon: ReactNode; label: string; onClick: () => void; active?: boolean; primary?: boolean; disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`${styles.tool} ${active ? styles.active : ''} ${primary ? styles.primary : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
      aria-pressed={active}
      aria-label={label}
    >
      <span className={styles.toolIcon}>{icon}</span>
      <span className={styles.toolLabel}>{label}</span>
    </button>
  )
}

/** The island pill. `float` (hero/default) = absolute bottom-center over the scene;
 *  `inline` (editor) = the same pill centered in the layout's bottom slot. */
export default function Dock({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return inline ? (
    <div className={styles.dockSlot}>
      <div className={`${styles.bar} ${styles.barInline}`}>{children}</div>
    </div>
  ) : (
    <div className={styles.bar}>{children}</div>
  )
}
