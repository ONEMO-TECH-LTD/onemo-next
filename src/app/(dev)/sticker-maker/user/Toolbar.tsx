// Manual Sticker Maker — user toolbar (ONEMO design system)
// Styling = DS CSS custom-property tokens via a co-located CSS module (the pipeline's
// non-Tailwind :root consumption path). Pill buttons, heavy dark stroke, Chillax.

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  isEditing: boolean
  showColors: boolean
  onFile: (file: File) => void
  onToggleEdit: () => void
  onResetDesign: () => void
  onToggleColors: () => void
  onEditOutline: () => void
}

export default function Toolbar({
  artworkUrl,
  isEditing,
  showColors,
  onFile,
  onToggleEdit,
  onResetDesign,
  onToggleColors,
  onEditOutline,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className={styles.bar}>
        <button className={`${styles.pill} ${styles.primary}`} onClick={() => fileInputRef.current?.click()}>
          {artworkUrl ? 'Replace' : 'Upload'}
        </button>

        {artworkUrl && (
          <button
            className={`${styles.pill} ${isEditing ? styles.active : styles.outline}`}
            onClick={onToggleEdit}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}

        {isEditing && (
          <button className={`${styles.pill} ${styles.outline}`} onClick={onResetDesign}>
            Reset
          </button>
        )}

        <button className={`${styles.pill} ${styles.outline}`} onClick={onEditOutline}>
          Edit outline
        </button>

        <button
          className={`${styles.pill} ${showColors ? styles.active : styles.outline}`}
          onClick={onToggleColors}
        >
          Colours
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </>
  )
}

export { INITIAL_DESIGN }
