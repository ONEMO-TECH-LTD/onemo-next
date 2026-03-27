'use client'

import type { ViewerConfig } from '@/app/(dev)/prototype/types'
import type { StudioOutputPayload } from '@/studio/preset/types'
import {
  STUDIO_THEME,
  eyebrowStyle,
  mutedCopyStyle,
  paneSummaryStyle,
  paneSurfaceStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  statusCardStyle,
} from '@/studio/theme'

function labelStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  }
}

function valueStyle() {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: STUDIO_THEME.baseForeground,
  } as const
}

function formatBoolean(value: boolean) {
  return value ? 'true' : 'false'
}

export function OutputReviewPanel({
  currentScene,
  viewerConfig,
  payload,
  loading,
  error,
  onRefresh,
  onExportState,
}: {
  currentScene: string
  viewerConfig: ViewerConfig
  payload: StudioOutputPayload | null
  loading: boolean
  error: string | null
  onRefresh: () => void
  onExportState: () => void
}) {
  const savedStudio = payload?.selectedStudio ?? null
  const savedRenderSettings = savedStudio?.payload.render_settings ?? null
  const capturePresets = savedStudio?.payload.capture_presets ?? []
  const runtimeRenderSettings = {
    background: viewerConfig.colors.bgColor,
    transparentBackground: viewerConfig.scene.transparentBackground ?? false,
    shadowEnabled: viewerConfig.scene.shadowEnabled ?? true,
    dprMin: viewerConfig.scene.dprMin ?? 1,
    dprMax: viewerConfig.scene.dprMax ?? 2,
    frameloop: viewerConfig.scene.frameloop ?? 'always',
  }

  const renderRows = [
    {
      key: 'background',
      label: 'background',
      runtime: runtimeRenderSettings.background,
      saved: savedRenderSettings?.background_color ?? 'not saved',
    },
    {
      key: 'transparentBackground',
      label: 'transparentBackground',
      runtime: formatBoolean(runtimeRenderSettings.transparentBackground),
      saved: savedRenderSettings
        ? formatBoolean(savedRenderSettings.transparent_background)
        : 'not saved',
    },
    {
      key: 'shadowEnabled',
      label: 'shadowEnabled',
      runtime: formatBoolean(runtimeRenderSettings.shadowEnabled),
      saved: savedRenderSettings
        ? formatBoolean(savedRenderSettings.shadow_enabled)
        : 'not saved',
    },
    {
      key: 'dprMin',
      label: 'dprMin',
      runtime: runtimeRenderSettings.dprMin.toFixed(2),
      saved: savedRenderSettings ? savedRenderSettings.dpr_min.toFixed(2) : 'not saved',
    },
    {
      key: 'dprMax',
      label: 'dprMax',
      runtime: runtimeRenderSettings.dprMax.toFixed(2),
      saved: savedRenderSettings ? savedRenderSettings.dpr_max.toFixed(2) : 'not saved',
    },
    {
      key: 'frameloop',
      label: 'frameloop',
      runtime: runtimeRenderSettings.frameloop,
      saved: savedRenderSettings?.frameloop ?? 'not saved',
    },
  ]

  return (
    <details open style={paneSurfaceStyle()}>
      <summary style={paneSummaryStyle()}>
        <div style={eyebrowStyle()}>Image / Output</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: STUDIO_THEME.baseForeground }}>
          Persisted render subset and output snapshot
        </div>
      </summary>

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        <p style={mutedCopyStyle()}>
          This panel shows the current M7 saved artifact truth from `/api/dev/output`.
          Export uses saved studio documents, not unsaved viewport state.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Requested Scene</span>
            <span style={valueStyle()}>{currentScene}</span>
          </div>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Active Saved Scene</span>
            <span style={valueStyle()}>{payload?.activeStudio?.name ?? 'none'}</span>
          </div>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Saved Studios</span>
            <span style={valueStyle()}>{payload?.studios.length ?? 0}</span>
          </div>
          <div style={statusCardStyle()}>
            <span style={labelStyle()}>Payload Generated</span>
            <span style={valueStyle()}>
              {payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString() : 'not loaded'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              ...secondaryButtonStyle(!loading),
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh Output Snapshot'}
          </button>
          <button onClick={onExportState} style={primaryButtonStyle()}>
            Export State JSON
          </button>
        </div>

        {error ? (
          <div
            style={{
              ...statusCardStyle(),
              background: 'rgba(127, 29, 29, 0.28)',
              color: '#fecaca',
            }}
          >
            <span style={labelStyle()}>Output Error</span>
            <span style={{ ...valueStyle(), color: '#fecaca' }}>{error}</span>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 6, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
          <div style={labelStyle()}>Persisted Render Settings Subset</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {renderRows.map((row) => (
              <div
                key={row.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 6,
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: STUDIO_THEME.bladeBorderRadius,
                  background: STUDIO_THEME.containerBackground,
                }}
              >
                <span style={{ fontSize: 10, color: STUDIO_THEME.labelForeground }}>{row.label}</span>
                <span style={{ ...valueStyle(), fontSize: 10 }}>runtime: {row.runtime}</span>
                <span style={{ ...valueStyle(), fontSize: 10 }}>saved: {row.saved}</span>
              </div>
            ))}
          </div>
          <p style={mutedCopyStyle()}>
            `toneMapping` remains runtime-driven through the lighting rig default in this slice.
            It is not exposed as a separately persisted operator field.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 6, paddingTop: 6, borderTop: STUDIO_THEME.border }}>
          <div style={labelStyle()}>Capture Presets (Saved ScenePreset Artifact)</div>
          {capturePresets.length ? (
            <div style={{ display: 'grid', gap: 4 }}>
              {capturePresets.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    ...statusCardStyle(),
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={valueStyle()}>{preset.id}</span>
                    <span style={{ fontSize: 10, color: STUDIO_THEME.labelForeground }}>
                      role: {preset.role} | camera: {preset.camera_preset_id}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: STUDIO_THEME.baseForeground }}>
                    {preset.width_px}x{preset.height_px} @{preset.pixel_ratio}x {preset.format}
                    {preset.quality != null ? ` q${preset.quality}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedCopyStyle()}>No saved capture presets found for this scene.</p>
          )}
        </div>
      </div>
    </details>
  )
}
