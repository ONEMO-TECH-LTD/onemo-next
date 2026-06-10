// Effect Creator V3 — scene toolbar (ONEMO design system).
// ONE persistent surface (no phases, no "Finish in 3D" — blueprint §5): the object is live in 3D the
// whole time. Tools: Upload/Replace · Magic (worker BEN cut-out) · Edit (outline overlay) ·
// Position (G1 — pan/zoom the photo within the shape, restored first-class) · Trim (appearance) ·
// Save (feasibility gate → recipe + payload → library).

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import { UploadIcon, MagicIcon, EditIcon, ColorsIcon, PositionIcon, SaveIcon } from './icons'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  auto: boolean        // true once the Magic-wand cut-out has been generated
  showColors: boolean
  /** G1 Position mode — pan/zoom the artwork inside the shape (matrix-only transforms). */
  positioning: boolean
  onFile: (file: File) => void
  onGenerate: () => void
  onToggleColors: () => void
  onEditOutline: () => void
  onTogglePosition: () => void
  onSave: () => void
}

/** One scene tool: icon over a small label (mobile-first touch target). */
function Tool({ icon, label, onClick, active, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; primary?: boolean
}) {
  return (
    <button
      type="button"
      className={`${styles.tool} ${active ? styles.active : ''} ${primary ? styles.primary : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
    >
      <span className={styles.toolIcon}>{icon}</span>
      <span className={styles.toolLabel}>{label}</span>
    </button>
  )
}

export default function Toolbar({
  artworkUrl,
  auto,
  showColors,
  positioning,
  onFile,
  onGenerate,
  onToggleColors,
  onEditOutline,
  onTogglePosition,
  onSave,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className={styles.bar}>
        <Tool icon={<UploadIcon />} label={artworkUrl ? 'Replace' : 'Upload'} onClick={() => fileInputRef.current?.click()} primary={!artworkUrl} />

        {artworkUrl && (
          <>
            {/* Magic = auto cut-out (worker BEN). Highlights once the subject cut has been generated. */}
            <Tool icon={<MagicIcon />} label="Magic" onClick={onGenerate} active={auto} />
            <Tool icon={<EditIcon />} label="Edit" onClick={onEditOutline} />
            {/* G1: position the photo WITHIN the shape — the silently-lost tool, restored first-class. */}
            <Tool icon={<PositionIcon />} label="Position" onClick={onTogglePosition} active={positioning} />
            <Tool icon={<ColorsIcon />} label="Trim" onClick={onToggleColors} active={showColors} />
            <Tool icon={<SaveIcon />} label="Save" onClick={onSave} />
          </>
        )}
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
