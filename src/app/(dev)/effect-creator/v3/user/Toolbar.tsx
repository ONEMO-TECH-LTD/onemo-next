// Effect Creator V3 — the CREATION row (plan A1: HOME owns creation only). Image (the print) ·
// Magic (self-sufficient auto cut) · Trim (back material color). Shape/image EDITING entries live
// in the global top bar (Edit) and the double-tap gesture — never down here.

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import { UploadIcon, MagicIcon, ColorsIcon } from './icons'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  auto: boolean        // true once the Magic-wand cut-out has been generated
  showColors: boolean
  onFile: (file: File) => void
  onGenerate: () => void
  onToggleColors: () => void
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
        {/* Shapes lives INSIDE the editor (plan D4: shape choice = editing); Edit lives in the
            global top bar + double-tap (KAI-8938's visible entry kept, relocated per D-CHROME) */}
        <Tool icon={<ColorsIcon />} label="Trim" onClick={onToggleColors} active={showColors} disabled={!artworkUrl} />
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
