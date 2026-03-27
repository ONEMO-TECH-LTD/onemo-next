'use client'

import type { TexturePaths } from '@/app/(dev)/prototype/types'

type MaterialKey = 'face' | 'back' | 'frame'

interface MaterialTextureGroup {
  key: MaterialKey
  label: string
  textures: Partial<TexturePaths>
  slots: Array<keyof TexturePaths>
}

function sectionStyle() {
  return {
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 16,
    padding: 14,
  } as const
}

function fieldLabel(label: string) {
  return (
    <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(226, 232, 240, 0.56)' }}>
      {label}
    </span>
  )
}

export function AssetsWorkspacePanel({
  assetsLoaded,
  models,
  hdris,
  modelPath,
  hdriValue,
  materialGroups,
  onModelChange,
  onHdriChange,
  onAssetUpload,
  onTextureChange,
  onTextureUpload,
}: {
  assetsLoaded: boolean
  models: Record<string, string>
  hdris: Record<string, string>
  modelPath: string
  hdriValue: string
  materialGroups: ReadonlyArray<MaterialTextureGroup>
  onModelChange: (value: string) => void
  onHdriChange: (value: string) => void
  onAssetUpload: (type: 'shapes' | 'env', file: File) => Promise<void> | void
  onTextureChange: (material: MaterialKey, slot: keyof TexturePaths, value: string) => void
  onTextureUpload: (material: MaterialKey, slot: keyof TexturePaths, file: File) => Promise<void> | void
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={sectionStyle()}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Library Status</div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'rgba(226, 232, 240, 0.72)' }}>
            Asset workflows stay custom on purpose. This workspace is for picking and loading library assets without burying them inside the registry control stack.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
          {[
            { label: 'Index', value: assetsLoaded ? 'Ready' : 'Scanning' },
            { label: 'Models', value: `${Object.keys(models).length}` },
            { label: 'HDRIs', value: `${Object.keys(hdris).length}` },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'grid',
                gap: 4,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(2, 6, 23, 0.44)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
              }}
            >
              {fieldLabel(item.label)}
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <details open style={sectionStyle()}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Model Library</summary>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            {fieldLabel('Active Model')}
            <select
              value={modelPath}
              onChange={(event) => onModelChange(event.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148, 163, 184, 0.22)',
                background: '#020617',
                color: '#f8fafc',
              }}
            >
              {Object.entries(models).map(([label, value]) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              background: '#f8fafc',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Upload Model
            <input
              type="file"
              accept=".glb,.gltf"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onAssetUpload('shapes', file)
                event.target.value = ''
              }}
            />
          </label>
        </div>
      </details>

      <details open style={sectionStyle()}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Environment Library</summary>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            {fieldLabel('Active HDRI')}
            <select
              value={hdriValue}
              onChange={(event) => onHdriChange(event.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148, 163, 184, 0.22)',
                background: '#020617',
                color: '#f8fafc',
              }}
            >
              {Object.entries(hdris).map(([label, value]) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              background: '#f8fafc',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Upload HDRI
            <input
              type="file"
              accept=".exr,.hdr,.hdri"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onAssetUpload('env', file)
                event.target.value = ''
              }}
            />
          </label>
        </div>
      </details>

      {materialGroups.map((materialGroup, index) => (
        <details key={materialGroup.key} open={index === 0} style={sectionStyle()}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{materialGroup.label} Texture Library</summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {materialGroup.slots.map((slot) => (
              <div key={`${materialGroup.key}-${slot}`} style={{ display: 'grid', gap: 6 }}>
                {fieldLabel(`${materialGroup.label} ${slot}`)}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    value={materialGroup.textures[slot] ?? ''}
                    onChange={(event) => onTextureChange(materialGroup.key, slot, event.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(148, 163, 184, 0.22)',
                      background: '#020617',
                      color: '#f8fafc',
                    }}
                  />

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void onTextureUpload(materialGroup.key, slot, file)
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
