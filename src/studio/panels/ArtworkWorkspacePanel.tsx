'use client'

import { Button } from '@heroui/react'
import type { DesignState } from '@/app/(dev)/prototype/types'
import {
  STUDIO_THEME,
  eyebrowStyle,
  mutedCopyStyle,
  paneSummaryStyle,
  paneSurfaceStyle,
  quickPickButtonStyle,
  quickPickGridStyle,
  statusCardStyle,
  statusGridStyle,
} from '@/studio/theme'

function formatMetric(value: number) {
  return value.toFixed(2)
}

function labelStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  }
}

export function ArtworkWorkspacePanel({
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
  return (
    <details open style={paneSurfaceStyle()}>
      <summary style={paneSummaryStyle()}>
        <div style={eyebrowStyle()}>Artwork</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: STUDIO_THEME.baseForeground }}>Asset Browser / Placement Workflow</div>
      </summary>

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        <p style={mutedCopyStyle()}>
          Artwork browsing and placement live here.
        </p>

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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="button button--sm button--primary cursor-pointer inline-flex items-center h-6 px-2 text-[11px] rounded-[var(--radius-xxs,2px)]">
            {hasArtwork ? 'Replace Artwork' : 'Upload Artwork'}
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
            Reset Placement
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
      </div>
    </details>
  )
}
