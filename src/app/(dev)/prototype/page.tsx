'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useRef } from 'react'
import { useGesture } from '@use-gesture/react'
import { Leva } from 'leva'
import { useSceneStore } from './sceneStore'

const EffectViewer = dynamic(() => import('./EffectViewer'), { ssr: false })
const ScenePanel = dynamic(() => import('./ScenePanel'), { ssr: false })

interface DesignState {
  offsetX: number
  offsetY: number
  scale: number
}

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }
const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002

const SUEDE_SWATCHES = [
  { name: 'Black', color: '#080808' },
  { name: 'Charcoal', color: '#2a2a2a' },
  { name: 'Navy', color: '#1a1f3a' },
  { name: 'Burgundy', color: '#3d0c1c' },
  { name: 'Olive', color: '#2d3020' },
  { name: 'Sand', color: '#8a7d6b' },
  { name: 'Cream', color: '#c8bfa9' },
]

const FRAME_SWATCHES = [
  { name: 'Black', color: '#0f0f0f' },
  { name: 'White', color: '#e8e8e8' },
  { name: 'Dark Gray', color: '#333333' },
  { name: 'Silver', color: '#888888' },
]

const BG_SWATCHES = ['#ffffff', '#f5f5f5', '#e0e0e0', '#3a3a3a', '#1a1a1a', '#000000']

export default function PrototypePage() {
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [designState, setDesignState] = useState<DesignState>(INITIAL_DESIGN)
  const { colors, setBackColor, setFrameColor, setBgColor } = useSceneStore()
  const { backColor, frameColor, bgColor } = colors
  const [showColors, setShowColors] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showScenes, setShowScenes] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (artworkUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(artworkUrl)
    }
    const url = URL.createObjectURL(file)
    setArtworkUrl(url)
    setDesignState(INITIAL_DESIGN)
  }, [artworkUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({
          ...prev,
          offsetX: prev.offsetX + dx * DRAG_SENSITIVITY,
          offsetY: prev.offsetY - dy * DRAG_SENSITIVITY,
        }))
      },
      onPinch: ({ offset: [scale], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({
          ...prev,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)),
        }))
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((prev) => ({
          ...prev,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale - dy * SCROLL_SENSITIVITY)),
        }))
      },
    },
    {
      drag: { enabled: isEditing },
      pinch: { enabled: isEditing, scaleBounds: { min: MIN_SCALE, max: MAX_SCALE } },
      wheel: { enabled: isEditing },
      eventOptions: { passive: false },
    }
  )

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: bgColor, touchAction: isEditing ? 'none' : 'auto' }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      {...(isEditing ? bind() : {})}
    >
      {/* Leva admin panel — hidden by default */}
      <Leva
        collapsed={false}
        hidden={!showAdmin}
        theme={{
          colors: {
            elevation1: '#e0e0e0',
            elevation2: '#d0d0d0',
            elevation3: '#c0c0c0',
            accent1: '#666666',
            accent2: '#888888',
            accent3: '#999999',
            highlight1: '#444444',
            highlight2: '#555555',
            highlight3: '#333333',
            vivid1: '#555555',
            folderWidgetColor: '#777777',
            folderTextColor: '#222222',
            toolTipBackground: '#333333',
            toolTipText: '#ffffff',
          },
          fonts: {
            mono: 'ui-monospace, SFMono-Regular, monospace',
            sans: 'system-ui, -apple-system, sans-serif',
          },
          sizes: {
            rootWidth: '320px',
          },
        }}
      />

      <EffectViewer
        artworkUrl={artworkUrl}
        isEditing={isEditing}
        designState={designState}
        backColor={backColor}
        frameColor={frameColor}
        bgColor={bgColor}
      />

      {/* User-facing color panel */}
      {showColors && (
        <div style={{
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 12,
          padding: 16,
          zIndex: 10,
          minWidth: 160,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>Back (Suede)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {SUEDE_SWATCHES.map((s) => (
              <button
                key={s.color}
                title={s.name}
                onClick={() => setBackColor(s.color)}
                style={{
                  width: 28, height: 28, borderRadius: 6, background: s.color,
                  border: backColor === s.color ? '2px solid #2563eb' : '2px solid #ccc',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
            <input type="color" value={backColor} onChange={(e) => setBackColor(e.target.value)}
              title="Custom" style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>Frame (PETG)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {FRAME_SWATCHES.map((s) => (
              <button
                key={s.color}
                title={s.name}
                onClick={() => setFrameColor(s.color)}
                style={{
                  width: 28, height: 28, borderRadius: 6, background: s.color,
                  border: frameColor === s.color ? '2px solid #2563eb' : '2px solid #ccc',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
            <input type="color" value={frameColor} onChange={(e) => setFrameColor(e.target.value)}
              title="Custom" style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>Background</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BG_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 6, background: c,
                  border: bgColor === c ? '2px solid #2563eb' : '2px solid #ccc',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
              title="Custom" style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
          </div>
        </div>
      )}

      {/* Scene manager panel */}
      {showScenes && (
        <ScenePanel onClose={() => setShowScenes(false)} />
      )}

      {/* Bottom toolbar */}
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
          <button onClick={() => setIsEditing((prev) => !prev)}
            style={{ padding: '12px 24px', background: isEditing ? '#2563eb' : '#444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}

        {isEditing && (
          <button onClick={() => setDesignState(INITIAL_DESIGN)}
            style={{ padding: '12px 24px', background: '#666', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Reset
          </button>
        )}

        <button onClick={() => setShowColors((prev) => !prev)}
          style={{ padding: '12px 24px', background: showColors ? '#2563eb' : '#444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Colors
        </button>

        <button onClick={() => setShowScenes((prev) => !prev)}
          style={{ padding: '12px 24px', background: showScenes ? '#2563eb' : '#444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Scenes
        </button>

      </div>

      {/* Admin button — top center */}
      <button onClick={() => setShowAdmin((prev) => !prev)}
        style={{
          position: 'absolute', top: 16, right: 16,
          padding: '8px 16px', background: showAdmin ? '#dc2626' : 'rgba(0,0,0,0.3)',
          color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', zIndex: 10, opacity: 0.8,
        }}>
        {showAdmin ? 'Hide Admin' : 'Admin'}
      </button>

      {/* Edit mode indicator */}
      {isEditing && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(37, 99, 235, 0.9)', color: '#fff', padding: '8px 16px',
          borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 10,
        }}>
          Edit Mode — Drag to move, scroll to zoom ({designState.scale.toFixed(1)}x)
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = '' }} />

      {isDragging && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 600 }}>Drop image here</div>
        </div>
      )}
    </div>
  )
}
