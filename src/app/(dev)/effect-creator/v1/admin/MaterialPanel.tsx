'use client'

import { useState } from 'react'
import FileField from './FileField'
import type { TexturePaths } from '../types'

interface SliderDef {
  key: string
  value: number
  min: number
  max: number
  step: number
}

interface ColorDef {
  key: string
  value: string
}

interface MaterialPanelProps {
  title: string                          // e.g., "Face", "Back", "Frame"
  textures: TexturePaths | Partial<TexturePaths>
  params: Record<string, number | string>
  sliders: SliderDef[]
  colors?: ColorDef[]                    // color pickers (e.g., back color, frame color)
  textureSlots?: string[]                // which texture slots to show (default: all)
  onTextureChange: (slot: keyof TexturePaths, path: string) => void
  onParamChange: (key: string, value: number | string) => void
  onSaveMaterial?: () => void
  onLoadMaterial?: () => void
}

export default function MaterialPanel({
  title,
  textures,
  params,
  sliders,
  colors = [],
  textureSlots = ['texture', 'normal', 'roughness', 'height', 'sheenColor'],
  onTextureChange,
  onParamChange,
  onSaveMaterial,
  onLoadMaterial,
}: MaterialPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      background: '#e0e0e0',
      borderRadius: 6,
      marginBottom: 4,
      overflow: 'hidden',
    }}>
      {/* Header — click to collapse */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '6px 10px',
          background: '#d0d0d0',
          border: 'none',
          borderBottom: open ? '1px solid #bbb' : 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: '#222',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, color: '#666' }}>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div style={{ padding: '6px 0' }}>
          {/* Texture file pickers */}
          <div style={{ padding: '0 6px 4px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Textures
          </div>
          {textureSlots.map((slot) => (
            <FileField
              key={slot}
              label={slot === 'sheenColor' ? 'Sheen' : slot.charAt(0).toUpperCase() + slot.slice(1)}
              value={(textures as Record<string, string>)[slot] || ''}
              type="materials"
              accept="image/*"
              slot={slot}
              onChange={(path) => onTextureChange(slot as keyof TexturePaths, path)}
            />
          ))}

          <div style={{ borderTop: '1px solid #ccc', margin: '6px 8px' }} />

          {/* Color pickers */}
          {colors.map((c) => (
            <div key={c.key} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '3px 8px',
            }}>
              <label style={{ fontSize: 11, color: '#222', width: 90, flexShrink: 0, fontFamily: 'system-ui' }}>
                {c.key}
              </label>
              <input
                type="color"
                value={c.value}
                onChange={(e) => onParamChange(c.key, e.target.value)}
                style={{ width: 28, height: 22, border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', padding: 0 }}
              />
              <span style={{ fontSize: 10, color: '#666', marginLeft: 6, fontFamily: 'monospace' }}>{c.value}</span>
            </div>
          ))}

          {/* Parameter sliders */}
          <div style={{ padding: '0 6px 2px', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Parameters
          </div>
          {sliders.map((s) => (
            <div key={s.key} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '2px 8px',
              gap: 6,
            }}>
              <label style={{ fontSize: 11, color: '#222', width: 90, flexShrink: 0, fontFamily: 'system-ui' }}>
                {s.key}
              </label>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={(params[s.key] as number) ?? s.value}
                onChange={(e) => onParamChange(s.key, parseFloat(e.target.value))}
                style={{ flex: 1, height: 4, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 10, color: '#444', width: 36, textAlign: 'right', fontFamily: 'monospace' }}>
                {((params[s.key] as number) ?? s.value).toFixed(2)}
              </span>
            </div>
          ))}

          {/* Save/Load material buttons */}
          {(onSaveMaterial || onLoadMaterial) && (
            <div style={{ display: 'flex', gap: 4, padding: '6px 8px 2px' }}>
              {onSaveMaterial && (
                <button onClick={onSaveMaterial} style={{
                  flex: 1, padding: '4px 8px', background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                }}>
                  Save Material
                </button>
              )}
              {onLoadMaterial && (
                <button onClick={onLoadMaterial} style={{
                  flex: 1, padding: '4px 8px', background: '#333', color: '#fff',
                  border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                }}>
                  Load Material
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
