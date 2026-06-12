// Magic shimmer shown over the whole surface while the Magic-wand BEN cut-out generates.
// G5 honest loading: the label says what the wait actually IS — downloading the model vs cutting —
// instead of a long mystery shimmer. The page passes the live worker progress state.

'use client'

import { MagicIcon } from './icons'
import styles from './generate-shimmer.module.css'

export default function GenerateShimmer({ label = 'Cutting out…', onCancel }: { label?: string; onCancel?: () => void }) {
  return (
    <div className={styles.overlay} aria-live="polite">
      <span className={styles.sweep} aria-hidden />
      <span className={styles.badge}>
        <span className={styles.spin}><MagicIcon /></span>
        <span className={styles.label}>{label}</span>
        {onCancel && (
          <button type="button" className={styles.cancel} onClick={onCancel} aria-label="Cancel Magic">
            Cancel
          </button>
        )}
      </span>
    </div>
  )
}
