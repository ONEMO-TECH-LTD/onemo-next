'use client'

import FileField from './FileField'

interface AssetPanelProps {
  modelPath: string
  hdriPath: string
  texture: string
  normalMap: string
  roughnessMap: string
  heightMap: string
  sheenMap: string
  onModelChange: (path: string) => void
  onHdriChange: (path: string) => void
  onTextureChange: (path: string) => void
  onNormalChange: (path: string) => void
  onRoughnessChange: (path: string) => void
  onHeightChange: (path: string) => void
  onSheenChange: (path: string) => void
}

export default function AssetPanel({
  modelPath, hdriPath, texture, normalMap, roughnessMap, heightMap, sheenMap,
  onModelChange, onHdriChange, onTextureChange, onNormalChange, onRoughnessChange, onHeightChange, onSheenChange,
}: AssetPanelProps) {
  return (
    <div style={{
      background: 'rgba(224, 224, 224, 0.95)',
      borderRadius: 8,
      padding: '8px 0',
      marginTop: 8,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ padding: '0 8px 4px', fontSize: 12, fontWeight: 600, color: '#222' }}>Assets</div>
      <FileField label="Model" value={modelPath} type="shapes" accept=".glb,.gltf" onChange={onModelChange} />
      <FileField label="HDRI" value={hdriPath} type="env" accept=".exr,.hdr,.hdri" onChange={onHdriChange} />
      <div style={{ borderTop: '1px solid #ccc', margin: '4px 8px' }} />
      <FileField label="Texture" value={texture} type="materials" accept="image/*" slot="texture" onChange={onTextureChange} />
      <FileField label="Normal" value={normalMap} type="materials" accept="image/*" slot="normal" onChange={onNormalChange} />
      <FileField label="Roughness" value={roughnessMap} type="materials" accept="image/*" slot="roughness" onChange={onRoughnessChange} />
      <FileField label="Height" value={heightMap} type="materials" accept="image/*" slot="height" onChange={onHeightChange} />
      <FileField label="Sheen" value={sheenMap} type="materials" accept="image/*" slot="sheen" onChange={onSheenChange} />
    </div>
  )
}
