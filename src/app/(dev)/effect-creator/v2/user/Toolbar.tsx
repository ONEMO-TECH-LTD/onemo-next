// Manual Sticker Maker — scene toolbar (ONEMO design system).
// Icon-over-label tools (matches the outline editor's bottom toolbar). The configurator starts on the
// flat ONEMO square; Magic runs BEN to auto-cut the subject; Edit opens the 2D outline editor; Trim is
// the appearance panel (edge colour / material / colour).

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import { UploadIcon, MagicIcon, EditIcon, ColorsIcon } from './icons'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  auto: boolean        // true once the Magic-wand cut-out has been generated
  showColors: boolean
  onFile: (file: File) => void
  onGenerate: () => void
  onToggleColors: () => void
  onEditOutline: () => void
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
  onFile,
  onGenerate,
  onToggleColors,
  onEditOutline,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className={styles.bar}>
        <Tool icon={<UploadIcon />} label={artworkUrl ? 'Replace' : 'Upload'} onClick={() => fileInputRef.current?.click()} primary={!artworkUrl} />

        {artworkUrl && (
          <>
            {/* Magic = auto cut-out (BEN). Highlights once the subject cut has been generated. */}
            <Tool icon={<MagicIcon />} label="Magic" onClick={onGenerate} active={auto} />
            <Tool icon={<EditIcon />} label="Edit" onClick={onEditOutline} />
            <Tool icon={<ColorsIcon />} label="Trim" onClick={onToggleColors} active={showColors} />
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
