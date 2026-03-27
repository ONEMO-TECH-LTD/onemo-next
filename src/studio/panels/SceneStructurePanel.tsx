'use client'

import {
  STUDIO_THEME,
  eyebrowStyle,
  mutedCopyStyle,
  paneSummaryStyle,
  paneSurfaceStyle,
} from '@/studio/theme'

type SceneFocusTarget = 'scene' | 'model' | 'environment' | 'lights' | 'camera' | 'image'

interface StructureRow {
  target: SceneFocusTarget
  label: string
  value: string
  active?: boolean
}

interface LightSummary {
  id: 'key' | 'fill' | 'rim' | string
  label: string
  enabled: boolean
  type?: string
  intensity?: number
}

export function SceneStructurePanel({
  currentScene,
  modelLabel,
  environmentLabel,
  artworkLabel,
  lightSummary,
  onFocusTarget,
}: {
  currentScene: string
  modelLabel: string
  environmentLabel: string
  artworkLabel?: string
  lightSummary: LightSummary[]
  onFocusTarget?: (target: SceneFocusTarget) => void
}) {
  const rows: StructureRow[] = [
    { target: 'scene', label: 'Scene', value: currentScene, active: true },
    { target: 'model', label: 'Model', value: modelLabel },
    { target: 'environment', label: 'Environment', value: environmentLabel },
    { target: 'camera', label: 'Camera', value: 'Live viewport camera' },
    { target: 'image', label: 'Image', value: artworkLabel ? `Artwork: ${artworkLabel}` : 'Artwork: none' },
  ]

  return (
    <details open style={paneSurfaceStyle()}>
      <summary style={paneSummaryStyle()}>
        <div style={eyebrowStyle()}>Scene / Structure</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: STUDIO_THEME.baseForeground }}>Current object graph and look-dev state</div>
      </summary>

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        <p style={mutedCopyStyle()}>
          Compact scene context for the left rail.
        </p>

        <div style={{ display: 'grid', gap: 4 }}>
          {rows.map((row) => {
            const interactive = Boolean(onFocusTarget)
            const content = (
              <>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: row.active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: row.active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.baseForeground,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {row.value}
                </span>
              </>
            )

            if (!interactive) {
              return (
                <div
                  key={row.target}
                  style={{
                    display: 'grid',
                    gap: 2,
                    minWidth: 0,
                    padding: '6px 8px',
                    borderRadius: STUDIO_THEME.bladeBorderRadius,
                    background: row.active ? STUDIO_THEME.buttonBackground : STUDIO_THEME.containerBackground,
                    color: row.active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.baseForeground,
                  }}
                >
                  {content}
                </div>
              )
            }

            return (
              <button
                key={row.target}
                onClick={() => onFocusTarget?.(row.target)}
                style={{
                  display: 'grid',
                  justifyContent: 'stretch',
                  gap: 2,
                  minWidth: 0,
                  height: 'auto',
                  padding: '6px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: row.active ? `1px solid ${STUDIO_THEME.activeBlue}` : STUDIO_THEME.border,
                  borderRadius: STUDIO_THEME.bladeBorderRadius,
                  background: row.active ? STUDIO_THEME.buttonBackground : STUDIO_THEME.containerBackground,
                  color: row.active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.baseForeground,
                }}
              >
                {content}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gap: 6, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: STUDIO_THEME.labelForeground,
            }}
          >
            Light Rig
          </div>

          <div style={{ display: 'grid', gap: 4 }}>
            {lightSummary.map((light) => (
              <div
                key={light.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 8,
                  alignItems: 'center',
                  minWidth: 0,
                  padding: '6px 8px',
                  borderRadius: STUDIO_THEME.bladeBorderRadius,
                  background: light.enabled ? STUDIO_THEME.containerBackground : STUDIO_THEME.monitorBackground,
                }}
              >
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STUDIO_THEME.baseForeground }}>{light.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: STUDIO_THEME.labelForeground,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {light.type ?? 'directional'} · intensity {light.intensity?.toFixed(2) ?? '0.00'}
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: light.enabled ? STUDIO_THEME.buttonBackground : STUDIO_THEME.containerBackground,
                    color: light.enabled ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground,
                  }}
                >
                  {light.enabled ? 'On' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}
