// Effect Creator V3 — scene toolbar (ONEMO design system).
// ONE persistent surface (no phases, no "Finish in 3D" — blueprint §5): the object is live in 3D the
// whole time. Tools: Upload/Replace · Magic (worker BEN cut-out) · Edit (outline overlay) ·
// Position (G1 — pan/zoom the photo within the shape, restored first-class) · Trim (appearance) ·
// Save (feasibility gate → recipe + payload → library).

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import { UploadIcon, MagicIcon, ColorsIcon, SaveIcon, ShapeIcon, EditIcon } from './icons'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  auto: boolean        // true once the Magic-wand cut-out has been generated
  showColors: boolean
  onFile: (file: File) => void
  onGenerate: () => void
  onToggleColors: () => void
  /** Structure A (#27): creation modes at toolbar level — each opens the SAME editor in that mode.
   *  Position stays folded into the editor's Image tool. Edit is BACK as a visible tool
   *  (Dan reversal, KAI-8938: "the edit button must come back" — tap-the-object still works too;
   *  both re-open the editor on the EXISTING committed shape, zero data loss). */
  onShapes: () => void
  onEdit: () => void
  onSave: () => void
}

/** One scene tool: icon over a small label (mobile-first touch target). */
function Tool({ icon, label, onClick, active, primary, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; primary?: boolean; disabled?: boolean
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

export default function Toolbar({
  artworkUrl,
  auto,
  showColors,
  onFile,
  onGenerate,
  onToggleColors,
  onShapes,
  onEdit,
  onSave,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      {/* #22/Q7 (Dan, 2026-06-10): ONE consistent menu from the first screen — the full creator
          toolbar is always present (tools disabled until an image exists); the upload tool is
          "Image" (not Upload/Replace), so there's no duplicate lone upload pill pre-image. */}
      <div className={styles.bar}>
        <Tool icon={<UploadIcon />} label="Image" onClick={() => fileInputRef.current?.click()} primary={!artworkUrl} />
        {/* Magic = auto cut-out (worker BEN). Highlights once the subject cut has been generated. */}
        <Tool icon={<MagicIcon />} label="Magic" onClick={onGenerate} active={auto} disabled={!artworkUrl} />
        {/* #27 structure A: creation modes side by side — each drops into the SAME editor */}
        <Tool icon={<ShapeIcon />} label="Shapes" onClick={onShapes} disabled={!artworkUrl} />
        {/* KAI-8938: the always-available way back into the committed outline (tap-the-object remains) */}
        <Tool icon={<EditIcon />} label="Edit" onClick={onEdit} disabled={!artworkUrl} />
        <Tool icon={<ColorsIcon />} label="Trim" onClick={onToggleColors} active={showColors} disabled={!artworkUrl} />
        <Tool icon={<SaveIcon />} label="Save" onClick={onSave} disabled={!artworkUrl} />
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
