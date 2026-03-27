'use client'

import type { TexturePaths } from '@/app/(dev)/prototype/types'
import {
  STUDIO_THEME,
  eyebrowStyle,
  paneSummaryStyle,
  paneSurfaceStyle,
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

function labelStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  }
}

function sectionHeadStyle() {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    color: STUDIO_THEME.baseForeground,
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
  return (
    <details open style={paneSurfaceStyle()}>
      <summary style={paneSummaryStyle()}>
        <div style={eyebrowStyle()}>Library</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: STUDIO_THEME.baseForeground }}>
          {assetsLoaded ? `${Object.keys(models).length} Models · ${Object.keys(hdris).length} HDRIs` : 'Scanning…'}
        </div>
      </summary>

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>

        {/* Models */}
        <details open style={{ display: 'grid', gap: 8, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
          <summary style={sectionHeadStyle()}>Models</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
            <div style={quickPickGridStyle(92)}>
              {Object.entries(models).map(([label, value]) => {
                const active = value === modelPath
                return (
                  <button key={label} onClick={() => onModelChange(value)} style={quickPickButtonStyle(active)}>
                    <span style={{ fontSize: 11, fontWeight: 700, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{label}</span>
                    <span style={{ fontSize: 10, color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground }}>
                      {active ? 'Active' : 'Load'}
                    </span>
                  </button>
                )
              })}
            </div>
            <label style={primaryButtonStyle()}>
              Import Model
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

        {/* Environments / HDRIs */}
        <details open style={{ display: 'grid', gap: 8, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
          <summary style={sectionHeadStyle()}>Environments</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
            <div style={quickPickGridStyle(92)}>
              {Object.entries(hdris).map(([label, value]) => {
                const active = value === hdriValue
                return (
                  <button key={label} onClick={() => onHdriChange(value)} style={quickPickButtonStyle(active)}>
                    <span style={{ fontSize: 11, fontWeight: 700, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{label}</span>
                    <span style={{ fontSize: 10, color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground }}>
                      {active ? 'Active' : 'Load'}
                    </span>
                  </button>
                )
              })}
            </div>
            <label style={primaryButtonStyle()}>
              Import HDRI
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

        {/* Material Presets */}
        <details open style={{ display: 'grid', gap: 8, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
          <summary style={sectionHeadStyle()}>Material Presets</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
            <div style={quickPickGridStyle(92)}>
              {materialPresetNames.length ? (
                materialPresetNames.map((name) => {
                  const active = name === materialPresetDraftName
                  return (
                    <button key={name} onClick={() => onLoadMaterialPreset(name)} style={quickPickButtonStyle(active)}>
                      <span style={{ fontSize: 11, fontWeight: 700, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{name}</span>
                      <span style={{ fontSize: 10, color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground }}>
                        {active ? 'Loaded' : 'Load'}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div style={{ ...statusCardStyle(), gridColumn: '1 / -1' }}>
                  <span style={labelStyle()}>Presets</span>
                  <span style={{ fontSize: 11, color: STUDIO_THEME.labelForeground }}>No saved material presets yet.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={materialPresetDraftName}
                onChange={(event) => onMaterialPresetDraftNameChange(event.target.value)}
                placeholder="Preset name"
                style={{
                  flex: 1,
                  height: 24,
                  padding: '0 8px',
                  borderRadius: STUDIO_THEME.bladeBorderRadius,
                  border: STUDIO_THEME.border,
                  background: STUDIO_THEME.containerBackground,
                  color: STUDIO_THEME.baseForeground,
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              />
              <button onClick={() => onSaveMaterialPreset(materialPresetDraftName)} style={secondaryButtonStyle()}>
                Save
              </button>
            </div>
          </div>
        </details>

        {/* Material Sets */}
        {materialSets.length > 0 && (
          <details style={{ display: 'grid', gap: 8, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
            <summary style={sectionHeadStyle()}>Material Sets</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
              {materialSets.map((set) => (
                <div key={set.name} style={statusCardStyle()}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STUDIO_THEME.baseForeground, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{set.name}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
          </details>
        )}

      </div>
    </details>
  )
}
