// Effect Creator V3 — the CREATION row (plan A1: HOME owns creation only). Image (the print) ·
// Magic (self-sufficient auto cut) · Trim (back material color). Shape/image EDITING entries live
// in the global top bar (Edit) and the double-tap gesture — never down here.

'use client'

import { useRef } from 'react'
import type { DesignState } from '../types'
import { UploadIcon, MagicIcon, ColorsIcon, EditorIcon, FiltersIcon } from './icons'
import Dock, { DockTool } from './Dock'
import styles from './toolbar.module.css'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  auto: boolean        // true once the Magic-wand cut-out has been generated
  showColors: boolean
  onFile: (file: File) => void
  onGenerate: () => void
  onToggleColors: () => void
  /** KAI-9027 (Dan's pick): 'Filters' opens photo editing — relocated from the editor pill */
  onFilters: () => void
  /** KAI-9011: the Editor entry lives HERE (right end, next to Trim) — not in the top bar */
  onEditor: () => void
  /** the design is prepared — the Editor gate (the old top-bar Edit used the same) */
  editorReady: boolean
}


export default function Toolbar({
  artworkUrl,
  auto,
  showColors,
  onFile,
  onGenerate,
  onToggleColors,
  onFilters,
  onEditor,
  editorReady,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      {/* #22/Q7 (Dan, 2026-06-10): ONE consistent menu from the first screen — the full creator
          toolbar is always present (tools disabled until an image exists); the upload tool is
          "Image" (not Upload/Replace), so there's no duplicate lone upload pill pre-image. */}
      <Dock>
        <DockTool icon={<UploadIcon />} label="Image" onClick={() => fileInputRef.current?.click()} primary={!artworkUrl} />
        {/* Magic = auto cut-out (worker BEN). Highlights once the subject cut has been generated. */}
        <DockTool icon={<MagicIcon />} label="Magic" onClick={onGenerate} active={auto} disabled={!artworkUrl} />
        {/* Shapes lives INSIDE the editor (plan D4: shape choice = editing) */}
        <DockTool icon={<ColorsIcon />} label="Trim" onClick={onToggleColors} active={showColors} disabled={!artworkUrl} />
        {/* KAI-9027 (Dan's pick): Filters = photo editing, moved out of the editor pill */}
        <DockTool icon={<FiltersIcon />} label="Filters" onClick={onFilters} disabled={!editorReady} />
        {/* KAI-9011 (Dan): renamed Edit→Editor, design-tool glyph, relocated from the top bar */}
        <DockTool icon={<EditorIcon />} label="Editor" onClick={onEditor} disabled={!editorReady} />
      </Dock>

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
