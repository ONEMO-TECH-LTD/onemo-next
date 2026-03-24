'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSceneStore } from './sceneStore'

export default function ScenePanel({ onClose }: { onClose: () => void }) {
  const [scenes, setScenes] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const getConfig = useSceneStore((s) => s.getConfig)
  const applyConfig = useSceneStore((s) => s.applyConfig)

  const fetchScenes = useCallback(async () => {
    const res = await fetch('/api/dev/scenes')
    const data = await res.json()
    setScenes(data.scenes || [])
  }, [])

  // Load scenes on mount — fetch is external system sync, not cascading setState
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchScenes() }, [fetchScenes])

  const handleSave = async () => {
    const name = newName.trim() || selected
    if (!name) return
    setSaving(true)
    const config = getConfig(name)
    await fetch('/api/dev/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setNewName('')
    await fetchScenes()
    setSelected(name.replace(/[^a-zA-Z0-9_-]/g, '-'))
  }

  const handleLoad = async () => {
    if (!selected) return
    setLoading(true)
    const res = await fetch(`/api/dev/scenes/${selected}`)
    const config = await res.json()
    applyConfig(config)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    await fetch(`/api/dev/scenes/${selected}`, { method: 'DELETE' })
    setSelected('')
    await fetchScenes()
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: 16,
        background: 'rgba(224, 224, 224, 0.95)',
        borderRadius: 8,
        padding: 16,
        zIndex: 10,
        minWidth: 240,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        color: '#222',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Scenes</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: '#666',
          }}
        >
          x
        </button>
      </div>

      {/* Scene selector */}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          marginBottom: 8,
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 13,
        }}
      >
        <option value="">-- Select scene --</option>
        {scenes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Load / Delete */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={handleLoad}
          disabled={!selected || loading}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: selected ? '#333' : '#aaa',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: selected ? 'pointer' : 'default',
            fontSize: 12,
          }}
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
        <button
          onClick={handleDelete}
          disabled={!selected}
          style={{
            padding: '6px 12px',
            background: selected ? '#dc2626' : '#aaa',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: selected ? 'pointer' : 'default',
            fontSize: 12,
          }}
        >
          Delete
        </button>
      </div>

      {/* Save current */}
      <div style={{ borderTop: '1px solid #ccc', paddingTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          Save current as:
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={selected || 'scene-name'}
          style={{
            width: '100%',
            padding: '6px 8px',
            marginBottom: 6,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || (!newName.trim() && !selected)}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {saving
            ? 'Saving...'
            : newName.trim()
              ? `Save as "${newName.trim()}"`
              : selected
                ? `Overwrite "${selected}"`
                : 'Save'}
        </button>
      </div>
    </div>
  )
}
