// Magic shimmer shown over the whole surface while the Magic-wand BEN cut-out generates — doubles as
// the loading state for the 30-60s segmentation, resolving into the cut-out when it's ready.

'use client'

import { MagicIcon } from './icons'
import styles from './generate-shimmer.module.css'

export default function GenerateShimmer() {
  return (
    <div className={styles.overlay} aria-live="polite">
      <span className={styles.sweep} aria-hidden />
      <span className={styles.badge}>
        <span className={styles.spin}><MagicIcon /></span>
        <span className={styles.label}>Cutting out…</span>
      </span>
    </div>
  )
}
