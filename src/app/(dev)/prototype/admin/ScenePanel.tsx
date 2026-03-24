'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSceneStore } from './sceneStore'
import AssetUpload from './AssetUpload'

function refreshAssets() {
  // Reload page to refresh Leva dropdowns with new assets
  // Leva useControls options are static at mount — full reload needed
  window.location.reload()
}

export default function ScenePanel() {
  const [scenes, setScenes] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const getConfig = useSceneStore((s) => s.getConfig)
  const applyConfig = useSceneStore((s) => s.applyConfig)
  const currentScene = useSceneStore((s) => s.currentScene)
  const setCurrentScene = useSceneStore((s) => s.setCurrentScene)
  const initialized = useSceneStore((s) => s._initialized)
  const setInitialized = useSceneStore((s) => s.setInitialized)

  const fetchScenes = useCallback(async () => {
    const res = await fetch('/api/dev/scenes')
    const data = await res.json()
    setScenes(data.scenes || [])
  }, [])

  // Load default scene on first mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchScenes()
    if (!initialized) {
      fetch('/api/dev/scenes/default')
        .then((r) => r.json())
        .then((config) => {
          applyConfig(config)
          setInitialized()
        })
        .catch(() => {})
    }
  }, [fetchScenes, initialized, applyConfig, setInitialized])

  const handleSave = async () => {
    const name = newName.trim() || currentScene
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
    setCurrentScene(name.replace(/[^a-zA-Z0-9_-]/g, '-'))
    await fetchScenes()
  }

  const handleLoad = async (name: string) => {
    if (!name) return
    setLoading(true)
    const res = await fetch(`/api/dev/scenes/${name}`)
    const config = await res.json()
    applyConfig(config)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!currentScene || currentScene === 'default') return
    await fetch(`/api/dev/scenes/${currentScene}`, { method: 'DELETE' })
    setCurrentScene('default')
    await handleLoad('default')
    await fetchScenes()
  }

  const isDefault = currentScene === 'default'

  return (
    <div
      style={{
        background: 'rgba(224, 224, 224, 0.95)',
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        color: '#222',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Scene</div>

      {/* Scene selector — loads on change */}
      <select
        value={currentScene}
        onChange={(e) => {
          const name = e.target.value
          setCurrentScene(name)
          handleLoad(name)
        }}
        style={{
          width: '100%',
          padding: '5px 6px',
          marginBottom: 6,
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {scenes.map((s) => (
          <option key={s} value={s}>
            {s}{s === 'default' ? ' (base)' : ''}
          </option>
        ))}
      </select>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => handleLoad(currentScene)}
          disabled={loading}
          style={{
            flex: 1, padding: '4px 8px',
            background: '#333', color: '#fff',
            border: 'none', borderRadius: 4,
            cursor: 'pointer', fontSize: 11,
          }}
        >
          {loading ? '...' : 'Reload'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1, padding: '4px 8px',
            background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 4,
            cursor: 'pointer', fontSize: 11,
          }}
        >
          {saving ? '...' : 'Save'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isDefault}
          title={isDefault ? 'Default scene is protected' : 'Delete scene'}
          style={{
            padding: '4px 8px',
            background: isDefault ? '#ccc' : '#dc2626',
            color: '#fff', border: 'none', borderRadius: 4,
            cursor: isDefault ? 'default' : 'pointer', fontSize: 11,
          }}
        >
          Del
        </button>
      </div>

      {/* Save as new */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="new scene name"
          style={{
            flex: 1, padding: '4px 6px',
            background: '#fff', border: '1px solid #ccc',
            borderRadius: 4, fontSize: 12, boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleSave}
          disabled={!newName.trim() || saving}
          style={{
            padding: '4px 8px',
            background: newName.trim() ? '#2563eb' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 4,
            cursor: newName.trim() ? 'pointer' : 'default', fontSize: 11,
            whiteSpace: 'nowrap',
          }}
        >
          Save As
        </button>
      </div>

      {/* Asset uploads */}
      <div style={{ borderTop: '1px solid #ccc', paddingTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#666' }}>Upload Assets</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <AssetUpload type="shapes" accept=".glb,.gltf" label="+ Model" onUploaded={refreshAssets} />
          <AssetUpload type="env" accept=".exr,.hdr,.hdri" label="+ HDRI" onUploaded={refreshAssets} />
          <AssetUpload type="materials" accept="image/*" label="+ Texture" onUploaded={refreshAssets} />
        </div>
      </div>
    </div>
  )
}
