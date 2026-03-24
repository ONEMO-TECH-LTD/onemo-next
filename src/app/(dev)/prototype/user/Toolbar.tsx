// User-facing toolbar — stays in prod

'use client'

import { useRef, useCallback } from 'react'
import type { DesignState } from '../types'

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

interface ToolbarProps {
  artworkUrl?: string
  isEditing: boolean
  showColors: boolean
  onFile: (file: File) => void
  onToggleEdit: () => void
  onResetDesign: () => void
  onToggleColors: () => void
}

export default function Toolbar({
  artworkUrl,
  isEditing,
  showColors,
  onFile,
  onToggleEdit,
  onResetDesign,
  onToggleColors,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div style={{
        position: 'absolute',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 12,
        zIndex: 10,
      }}>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ padding: '12px 24px', background: '#000', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          {artworkUrl ? 'Replace' : 'Upload'}
        </button>

        {artworkUrl && (
          <button onClick={onToggleEdit}
            style={{ padding: '12px 24px', background: isEditing ? '#2563eb' : '#444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}

        {isEditing && (
          <button onClick={onResetDesign}
            style={{ padding: '12px 24px', background: '#666', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Reset
          </button>
        )}

        <button onClick={onToggleColors}
          style={{ padding: '12px 24px', background: showColors ? '#2563eb' : '#444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Colors
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = '' }} />
    </>
  )
}

export { INITIAL_DESIGN }
