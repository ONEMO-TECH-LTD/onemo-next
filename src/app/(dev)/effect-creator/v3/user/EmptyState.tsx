// Pre-upload default view — a ONEMO square (8mm-equivalent rounded corners) with a pearly-glass
// surface and a centred "load image" control. Replaces the blank canvas; tapping it opens the picker.

'use client'

import { useRef } from 'react'
import { UploadIcon } from './icons'
import styles from './empty-state.module.css'

export default function EmptyState({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.square} onClick={() => inputRef.current?.click()} aria-label="Add an image">
        <span className={styles.sheen} aria-hidden />
        <span className={styles.center}>
          <span className={styles.iconRing}><UploadIcon /></span>
          <span className={styles.label}>Add your image</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
      />
    </div>
  )
}
