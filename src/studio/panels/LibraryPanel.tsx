'use client'

import { useState } from 'react'
import { Button, Tabs, Tab, TabList } from '@heroui/react'
import type { DesignState, TexturePaths } from '@/app/(dev)/prototype/types'
import {
  STUDIO_THEME,
  quickPickButtonStyle,
  quickPickGridStyle,
  statusCardStyle,
  statusGridStyle,
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

type LibraryTab = 'models' | 'environments' | 'materials' | 'artwork'

function labelStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  }
}

function formatMetric(value: number) {
  return value.toFixed(2)
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
  // Artwork props
  hasArtwork,
  artworks,
  artworkUrl,
  isEditing,
  designState,
  onArtworkFile,
  onArtworkSelect,
  onToggleEditing,
  onResetArtwork,
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
  // Artwork props
  hasArtwork: boolean
  artworks: Record<string, string>
  artworkUrl?: string
  isEditing: boolean
  designState: DesignState
  onArtworkFile: (file: File) => void
  onArtworkSelect: (value: string) => void
  onToggleEditing: () => void
  onResetArtwork: () => void
}) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('models')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: STUDIO_THEME.baseBackground,
        fontFamily: STUDIO_THEME.fontFamily,
      }}
    >
      {/* Tab bar — HeroUI Tabs (React Aria structure) */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as LibraryTab)}
        className="w-full shrink-0 border-b border-[var(--semantic-border-primary)] bg-[var(--semantic-bg-quaternary)]"
      >
        <TabList className="flex gap-0 px-1">
          <Tab id="models" className="h-8 px-2 text-[11px] font-medium text-[var(--semantic-text-secondary)] data-[selected]:text-[var(--semantic-text-primary)] data-[selected]:border-b-2 data-[selected]:border-[var(--semantic-bg-brand-solid)] cursor-pointer outline-none">Models</Tab>
          <Tab id="environments" className="h-8 px-2 text-[11px] font-medium text-[var(--semantic-text-secondary)] data-[selected]:text-[var(--semantic-text-primary)] data-[selected]:border-b-2 data-[selected]:border-[var(--semantic-bg-brand-solid)] cursor-pointer outline-none">Envs</Tab>
          <Tab id="materials" className="h-8 px-2 text-[11px] font-medium text-[var(--semantic-text-secondary)] data-[selected]:text-[var(--semantic-text-primary)] data-[selected]:border-b-2 data-[selected]:border-[var(--semantic-bg-brand-solid)] cursor-pointer outline-none">Materials</Tab>
          <Tab id="artwork" className="h-8 px-2 text-[11px] font-medium text-[var(--semantic-text-secondary)] data-[selected]:text-[var(--semantic-text-primary)] data-[selected]:border-b-2 data-[selected]:border-[var(--semantic-bg-brand-solid)] cursor-pointer outline-none">Artwork</Tab>
        </TabList>
      </Tabs>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Models tab */}
        {activeTab === 'models' && (
          <div style={{ padding: 8, display: 'grid', gap: 8 }}>
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
              <label className="button button--sm button--primary cursor-pointer inline-flex items-center h-6 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]">

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
              <label className="button button--sm button--primary cursor-pointer inline-flex items-center h-6 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]">

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

        {/* Materials tab — browse and load only */}
        {activeTab === 'materials' && (
          <div style={{ padding: 8, display: 'grid', gap: 8 }}>
            <span style={labelStyle()}>
              {materialPresetNames.length ? `${materialPresetNames.length} Presets` : 'No saved presets'}
            </span>

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
          </div>
        )}

        {/* Artwork tab */}
        {activeTab === 'artwork' && (
          <div style={{ padding: 8, display: 'grid', gap: 10 }}>

            <div style={statusGridStyle(3)}>
              {[
                { label: 'Artwork', value: hasArtwork ? 'Loaded' : 'Empty' },
                { label: 'Mode', value: isEditing ? 'Editing' : 'Locked' },
                { label: 'Scale', value: formatMetric(designState.scale) },
              ].map((item) => (
                <div key={item.label} style={statusCardStyle()}>
                  <span style={labelStyle()}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: STUDIO_THEME.baseForeground }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label className="button button--sm button--primary cursor-pointer inline-flex items-center h-6 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]">

                {hasArtwork ? 'Replace' : 'Upload Artwork'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onArtworkFile(file)
                    event.target.value = ''
                  }}
                />
              </label>

              <Button
                size="sm"
                variant={isEditing ? 'secondary' : 'ghost'}
                onPress={onToggleEditing}
                className="h-6 min-h-0 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]"
              >
                {isEditing ? 'Done Editing' : 'Edit Placement'}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onPress={onResetArtwork}
                className="h-6 min-h-0 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]"
              >
                Reset
              </Button>
            </div>

            <div style={statusGridStyle(3)}>
              {[
                { label: 'Offset X', value: formatMetric(designState.offsetX) },
                { label: 'Offset Y', value: formatMetric(designState.offsetY) },
                { label: 'Scale', value: formatMetric(designState.scale) },
              ].map((metric) => (
                <div key={metric.label} style={statusCardStyle()}>
                  <span style={labelStyle()}>{metric.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: STUDIO_THEME.baseForeground }}>{metric.value}</span>
                </div>
              ))}
            </div>

            {Object.entries(artworks).length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={labelStyle()}>Artwork Library</div>
                <div style={quickPickGridStyle(92)}>
                  {Object.entries(artworks).map(([label, value]) => {
                    const active = value === artworkUrl
                    return (
                      <button
                        key={label}
                        onClick={() => onArtworkSelect(value)}
                        style={quickPickButtonStyle(active)}
                      >
                        <img
                          src={value}
                          alt={label}
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            objectFit: 'cover',
                            borderRadius: STUDIO_THEME.bladeBorderRadius,
                            background: STUDIO_THEME.monitorBackground,
                          }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 700, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{label}</span>
                        <span style={{ fontSize: 10, color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground }}>
                          {active ? 'Active artwork' : 'Select artwork'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

          </div>
        )}

      </div>
    </div>
  )
}
