// Trim — material color selection (REBUILD-PLAN-v2 D-TRIM, Dan's ruling: the old Trim panel is
// stale; Trim = the BACK material color, chosen like a shape). Tap Trim → the creation row swaps
// to this centered carousel of round material swatches; tap = the 3D back recolors LIVE (the
// object IS the preview; AP Filters anatomy: selected swatch enlarged + ringed). Scope this wave:
// back material color ONLY — no background, no edge color (photo color lives in the editor's
// Image mode). Palette: MOCK colors + a free color picker (Dan: "make mock colours and colour
// picker for now") — the real suede catalog replaces the mocks in a later round.

'use client'

import { useRef } from 'react'
import { CheckIcon, CloseIcon } from './icons'
import styles from './trim-carousel.module.css'

/** mock suede palette — placeholders until the real material catalog round */
const MOCK_SUEDE = ['#7a4a3a', '#2b3550', '#9a8d78', '#46604a', '#1c1f26', '#c9b8a0']

interface TrimCarouselProps {
  backColor: string
  onBackColor: (c: string) => void
  /** ✓ keep the selection and close the takeover (the page pushes the history step) */
  onDone: () => void
  /** ✕ revert to the pre-open color and close */
  onCancel: () => void
}

export default function TrimCarousel({ backColor, onBackColor, onDone, onCancel }: TrimCarouselProps) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const sel = backColor.toLowerCase()
  return (
    <div className={styles.bar} aria-label="Trim — back material color">
      <button type="button" className={styles.action} onClick={onCancel} aria-label="Cancel trim">
        <CloseIcon />
      </button>
      <div className={styles.row}>
        {MOCK_SUEDE.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch} ${sel === c ? styles.swatchSelected : ''}`}
            style={{ background: c }}
            onClick={() => onBackColor(c)}
            aria-label={`Material color ${c}`}
            aria-pressed={sel === c}
          />
        ))}
        {/* free pick — the ⊕ picker (native, mobile-friendly); a custom color shows selected */}
        <button
          type="button"
          className={`${styles.swatch} ${styles.picker} ${MOCK_SUEDE.includes(sel) ? '' : styles.swatchSelected}`}
          onClick={() => pickerRef.current?.click()}
          aria-label="Pick a custom color"
        >
          <span className={styles.pickerGlyph}>+</span>
        </button>
        <input
          ref={pickerRef}
          type="color"
          value={backColor}
          className={styles.hiddenInput}
          onChange={(e) => onBackColor(e.target.value)}
          aria-label="Custom color picker"
        />
      </div>
      <button type="button" className={`${styles.action} ${styles.confirm}`} onClick={onDone} aria-label="Done — keep this color">
        <CheckIcon />
      </button>
    </div>
  )
}
