// Effect Configurator — scene toolbar (ONEMO design system).
// Icon-over-label tools (matches the outline editor's bottom toolbar). The configurator starts on the
// flat ONEMO square; Magic runs BEN to auto-cut the subject; Edit opens the 2D outline editor; Trim is
// the appearance panel (edge colour / material / colour).

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import { UploadIcon, MagicIcon, EditIcon, ColorsIcon, CubeIcon, BackIcon } from './icons'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  auto: boolean        // true once the Magic-wand cut-out has been generated
  showColors: boolean
  /** 'create' = 2D shape & face (no WebGL); 'finish' = 3D finish & fit (golden scene mounted). */
  phase: 'create' | 'finish'
  onFile: (file: File) => void
  onGenerate: () => void
  onToggleColors: () => void
  onEditOutline: () => void
  /** create → finish: mount the on-demand 3D golden scene (Phase B). */
  onFinish: () => void
  /** finish → create: back to the 2D creation surface. */
  onBackToCreate: () => void
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
  phase,
  onFile,
  onGenerate,
  onToggleColors,
  onEditOutline,
  onFinish,
  onBackToCreate,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className={styles.bar}>
        {phase === 'finish' ? (
          // Phase B (3D finish & fit): back to the 2D creation surface + appearance (Trim).
          <>
            <Tool icon={<BackIcon />} label="2D" onClick={onBackToCreate} />
            <Tool icon={<ColorsIcon />} label="Trim" onClick={onToggleColors} active={showColors} />
          </>
        ) : (
          // Phase A (2D shape & face): upload, Magic, Edit, then Finish in 3D.
          <>
            <Tool icon={<UploadIcon />} label={artworkUrl ? 'Replace' : 'Upload'} onClick={() => fileInputRef.current?.click()} primary={!artworkUrl} />
            {artworkUrl && (
              <>
                {/* Magic = auto cut-out (BEN). Highlights once the subject cut has been generated. */}
                <Tool icon={<MagicIcon />} label="Magic" onClick={onGenerate} active={auto} />
                <Tool icon={<EditIcon />} label="Edit" onClick={onEditOutline} />
                {/* Finish in 3D mounts the golden scene on demand (Phase B) — no WebGL until here. */}
                <Tool icon={<CubeIcon />} label="Finish in 3D" onClick={onFinish} />
              </>
            )}
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
