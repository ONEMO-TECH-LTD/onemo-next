'use client'

import { useState } from 'react'
import type { TexturePaths } from '@/app/(dev)/prototype/types'
import {
  STUDIO_THEME,
  inputStyle,
  primaryButtonStyle,
  quickPickButtonStyle,
  quickPickGridStyle,
  secondaryButtonStyle,
  statusCardStyle,
} from '@/studio/theme'

type MaterialKey = 'face' | 'back' | 'frame'

interface MaterialTextureGroup {
  key: MaterialKey
  label: string
  textures: Partial<TexturePaths>
  slots: Array<keyof TexturePaths>
}

interface MaterialSet {
  name: string
  textures: Partial<TexturePaths>
}

type LibraryTab = 'models' | 'environments' | 'materials'

function labelStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  }
}

function tabButtonStyle(active: boolean) {
  return {
    flex: 1,
    padding: '7px 4px',
    border: 'none',
    borderBottom: active ? `2px solid ${STUDIO_THEME.activeBlue}` : '2px solid transparent',
    background: 'transparent',
    color: active ? '#ffffff' : STUDIO_THEME.labelForeground,
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
  } as const
}

export function LibraryPanel({
  assetsLoaded,
  models,
  hdris,
  materialSets,
  materialPresetNames,
  materialPresetDraftName,
  modelPath,
  hdriValue,
  materialGroups,
  onModelChange,
  onHdriChange,
  onAssetUpload,
  onApplyMaterialSet,
  onMaterialPresetDraftNameChange,
  onSaveMaterialPreset,
  onLoadMaterialPreset,
}: {
  assetsLoaded: boolean
  models: Record<string, string>
  hdris: Record<string, string>
  materialSets: ReadonlyArray<MaterialSet>
  materialPresetNames: string[]
  materialPresetDraftName: string
  modelPath: string
  hdriValue: string
  materialGroups: ReadonlyArray<MaterialTextureGroup>
  onModelChange: (value: string) => void
  onHdriChange: (value: string) => void
  onAssetUpload: (type: 'shapes' | 'env', file: File) => Promise<void> | void
  onApplyMaterialSet: (material: MaterialKey, textures: Partial<TexturePaths>) => void
  onMaterialPresetDraftNameChange: (value: string) => void
  onSaveMaterialPreset: (value: string) => void
  onLoadMaterialPreset: (value: string) => void
}) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('models')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 200,
        background: STUDIO_THEME.baseBackground,
        fontFamily: STUDIO_THEME.fontFamily,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          borderBottom: STUDIO_THEME.border,
          background: STUDIO_THEME.panelBackground,
        }}
      >
        <button style={tabButtonStyle(activeTab === 'models')} onClick={() => setActiveTab('models')}>
          Models
        </button>
        <button style={tabButtonStyle(activeTab === 'environments')} onClick={() => setActiveTab('environments')}>
          Environments
        </button>
        <button style={tabButtonStyle(activeTab === 'materials')} onClick={() => setActiveTab('materials')}>
          Materials
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Models tab */}
        {activeTab === 'models' && (
          <div style={{ padding: 8, display: 'grid', gap: 8 }}>
            {/* Section header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={labelStyle()}>
                {assetsLoaded ? `${Object.keys(models).length} Models` : 'Scanning…'}
              </span>
              <label style={primaryButtonStyle()}>
                Import
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

            {/* Asset grid — 64px thumbnails */}
            <div style={quickPickGridStyle(64)}>
              {Object.entries(models).map(([label, value]) => {
                const active = value === modelPath
                return (
                  <button key={label} onClick={() => onModelChange(value)} style={quickPickButtonStyle(active)}>
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        background: '#111',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        color: active ? STUDIO_THEME.activeBlue : STUDIO_THEME.labelForeground,
                      }}
                    >
                      ◻
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
                        textAlign: 'center',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        lineHeight: 1.2,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Environments tab */}
        {activeTab === 'environments' && (
          <div style={{ padding: 8, display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={labelStyle()}>
                {assetsLoaded ? `${Object.keys(hdris).length} HDRIs` : 'Scanning…'}
              </span>
              <label style={primaryButtonStyle()}>
                Import
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

            <div style={quickPickGridStyle(64)}>
              {Object.entries(hdris).map(([label, value]) => {
                const active = value === hdriValue
                return (
                  <button key={label} onClick={() => onHdriChange(value)} style={quickPickButtonStyle(active)}>
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        background: 'radial-gradient(circle at 40% 40%, #555, #111)',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        color: active ? STUDIO_THEME.activeBlue : STUDIO_THEME.labelForeground,
                      }}
                    >
                      ◉
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
                        textAlign: 'center',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        lineHeight: 1.2,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Materials tab */}
        {activeTab === 'materials' && (
          <div style={{ padding: 8, display: 'grid', gap: 12 }}>

            {/* Material Presets */}
            <div style={{ display: 'grid', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={labelStyle()}>Material Presets</span>
              </div>

              <div style={quickPickGridStyle(64)}>
                {materialPresetNames.length ? (
                  materialPresetNames.map((name) => {
                    const active = name === materialPresetDraftName
                    return (
                      <button key={name} onClick={() => onLoadMaterialPreset(name)} style={quickPickButtonStyle(active)}>
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            background: '#111',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            color: active ? STUDIO_THEME.activeBlue : STUDIO_THEME.labelForeground,
                          }}
                        >
                          ◈
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
                            textAlign: 'center',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            lineHeight: 1.2,
                          }}
                        >
                          {name}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div style={{ ...statusCardStyle(), gridColumn: '1 / -1' }}>
                    <span style={labelStyle()}>No saved presets</span>
                  </div>
                )}
              </div>

              {/* Save preset */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={materialPresetDraftName}
                  onChange={(event) => onMaterialPresetDraftNameChange(event.target.value)}
                  placeholder="Preset name"
                  style={{ ...inputStyle(), flex: 1 }}
                />
                <button onClick={() => onSaveMaterialPreset(materialPresetDraftName)} style={secondaryButtonStyle()}>
                  Save
                </button>
              </div>
            </div>

            {/* Material Sets */}
            {materialSets.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={labelStyle()}>Material Sets</span>
                {materialSets.map((set) => (
                  <div key={set.name} style={{ ...statusCardStyle(), padding: '6px 8px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: STUDIO_THEME.baseForeground,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {set.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {materialGroups.map((materialGroup) => (
                        <button
                          key={`${set.name}-${materialGroup.key}`}
                          onClick={() => onApplyMaterialSet(materialGroup.key, set.textures)}
                          style={secondaryButtonStyle()}
                        >
                          Apply to {materialGroup.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
