// THE global top bar — ONE component identity on every screen (plan A1/D-CHROME).
// Anatomy: left cluster · RESET center ONLY-when-dirty (a Phosphor icon button like its
// siblings — KAI-9003) · the screen's commit actions RIGHT.

'use client'

import type { ReactNode } from 'react'
import styles from './outline-editor.module.css'
import { ResetIcon } from './icons'

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

/** RESET — a Phosphor icon button like its siblings (KAI-9003), appears only when dirty (UX-3). */
export function ResetButton({ onClick }: { onClick: () => void }) {
  return <TopBarButton icon={<ResetIcon />} label="Reset" onClick={onClick} />
}

export default function TopBar({ leading, left, dirty, onReset, right }: {
  /** screen-specific control ahead of the pills (editor: Close) */
  leading?: ReactNode
  /** the Undo/Redo cluster — rendered as its own pill (KAI-9012) */
  left: ReactNode
  dirty: boolean
  onReset?: () => void
  right: ReactNode
}) {
  // KAI-9012 (Dan): TWO pills — [Undo·Redo] and a separate [Reset] pill (only when dirty)
  return (
    <div className={styles.topbar}>
      <div className={styles.topInner}>
        {leading}
        <span className={styles.barPill}>{left}</span>
        {dirty && onReset ? <span className={styles.barPill}><ResetButton onClick={onReset} /></span> : <span className={styles.resetSpacer} aria-hidden />}
        {right}
      </div>
    </div>
  )
}
