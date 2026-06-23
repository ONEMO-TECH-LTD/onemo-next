// Magic shimmer shown over the whole surface while the Magic-wand BEN cut-out generates.
// The sweep + spinner alone signal work; the progress caption is OFF by default (Dan, 2026-06-16:
// no "Downloading…/Cutting out…" messages). A label only renders if one is explicitly passed.

'use client'

import { MagicIcon } from './icons'
import styles from './generate-shimmer.module.css'

export default function GenerateShimmer({ label = '', onCancel }: { label?: string; onCancel?: () => void }) {
  return (
    <div className={styles.overlay} aria-live="polite">
      <span className={styles.sweep} aria-hidden />
      <span className={styles.badge}>
        <span className={styles.spin}><MagicIcon /></span>
        {label && <span className={styles.label}>{label}</span>}
        {onCancel && (
          <button type="button" className={styles.cancel} onClick={onCancel} aria-label="Cancel Magic">
            Cancel
          </button>
        )}
      </span>
    </div>
  )
}
