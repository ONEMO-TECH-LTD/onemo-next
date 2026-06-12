// THE global top bar — ONE component identity on every screen (plan A1/D-CHROME; fab-qa F-UX1:
// the hero wore floating corner pills while the editor wore a flat strip — same controls, two
// app identities). Anatomy: ✕/undo-redo LEFT · RESET center ONLY-when-dirty (a real button —
// fab-qa F-UX2: bare gold text read as a warning label) · the screen's commit actions RIGHT.
// The editor composes the same classes from outline-editor.module.css; the hero mounts this.

'use client'

import type { ReactNode } from 'react'
import styles from './outline-editor.module.css'

export function TopBarButton({ icon, label, onClick, disabled, primary, active }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean; active?: boolean
}) {
  return (
    <button type="button" className={`${styles.topTool} ${primary ? styles.topToolPrimary : ''} ${active ? styles.topToolActive : ''}`} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active} title={label}>
      <span className={styles.toolIcon}>{icon}</span>
      <span className={styles.topToolLabel}>{label}</span>
    </button>
  )
}

/** RESET — a real button with affordance, appears only when dirty (UX-3 mechanics unchanged). */
export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.resetBtn} onClick={onClick} aria-label="Reset" title="Reset">
      RESET
    </button>
  )
}

export default function TopBar({ left, dirty, onReset, right }: {
  left: ReactNode
  dirty: boolean
  onReset?: () => void
  right: ReactNode
}) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topInner}>
        {left}
        {dirty && onReset ? <ResetButton onClick={onReset} /> : <span className={styles.resetSpacer} aria-hidden />}
        {right}
      </div>
    </div>
  )
}
