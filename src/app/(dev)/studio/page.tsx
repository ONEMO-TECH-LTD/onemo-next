'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { useGesture } from '@use-gesture/react'

const TheatreViewer = dynamic(() => import('../prototype/admin/TheatreViewer'), { ssr: false })

interface DesignState {
  offsetX: number
  offsetY: number
  scale: number
}

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

export default function StudioPage() {
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [isEditing, setIsEditing] = useState(false)
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) URL.revokeObjectURL(artworkUrl)
    setArtworkUrl(URL.createObjectURL(file))
    setDesignState(INITIAL_DESIGN)
  }, [artworkUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({ ...prev, offsetX: prev.offsetX + dx * 0.001, offsetY: prev.offsetY - dy * 0.001 }))
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({ ...prev, scale: Math.max(1, Math.min(4, prev.scale - dy * 0.002)) }))
      },
    },
    { drag: { enabled: isEditing }, wheel: { enabled: isEditing }, eventOptions: { passive: false } }
  )

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', touchAction: isEditing ? 'none' : 'auto' }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      {...(isEditing ? bind() : {})}
    >
      <TheatreViewer
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={isEditing}
      />

      {/* Minimal toolbar — Theatre Studio handles all admin controls */}
      <div style={{
        position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 10,
      }}>
        <label style={{ padding: '12px 24px', background: '#000', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          {artworkUrl ? 'Replace' : 'Upload'}
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </label>
        {artworkUrl && (
          <button onClick={() => setIsEditing(!isEditing)}
            style={{ padding: '12px 24px', background: isEditing ? '#2563eb' : '#444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
    </div>
  )
}
