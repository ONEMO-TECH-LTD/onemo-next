'use client'

import type { ShapeSpecDraft, ShapedPreviewSettings } from '../shaped/shape-spec'

interface ShapedControlPanelProps {
  enabled: boolean
  artworkUrl?: string
  draft: ShapeSpecDraft | null
  error: string | null
  settings: ShapedPreviewSettings
  onEnabledChange: (enabled: boolean) => void
  onSettingsChange: (settings: ShapedPreviewSettings) => void
}

function round(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : '-'
}

export default function ShapedControlPanel({
  enabled,
  artworkUrl,
  draft,
  error,
  settings,
  onEnabledChange,
  onSettingsChange,
}: ShapedControlPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      left: 16,
      top: 16,
      width: 300,
      padding: 16,
      borderRadius: 18,
      background: 'rgba(14, 12, 10, 0.84)',
      color: '#fff',
      zIndex: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
      backdropFilter: 'blur(14px)',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>Shaped Effect v2</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', marginTop: 2 }}>
            Golden scene + fresh cut-out mesh
          </div>
        </div>
        <button
          onClick={() => onEnabledChange(!enabled)}
          style={{
            padding: '8px 10px',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 999,
            color: '#fff',
            background: enabled ? '#1b7f5f' : '#4b5563',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '14px 0' }} />

      <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
        Cut-out threshold: {settings.threshold}
      </label>
      <input
        type="range"
        min={8}
        max={110}
        value={settings.threshold}
        onChange={(event) => onSettingsChange({ ...settings, threshold: Number(event.target.value) })}
        style={{ width: '100%' }}
      />

      <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '12px 0 6px' }}>
        Minimum dimension: {settings.targetMinDimensionMm}mm
      </label>
      <input
        type="range"
        min={70}
        max={150}
        step={5}
        value={settings.targetMinDimensionMm}
        onChange={(event) => onSettingsChange({ ...settings, targetMinDimensionMm: Number(event.target.value) })}
        style={{ width: '100%' }}
      />

      <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '12px 0 6px' }}>
        RDP simplify: {settings.simplifyEpsilonMm.toFixed(2)}mm
      </label>
      <input
        type="range"
        min={0.15}
        max={0.8}
        step={0.05}
        value={settings.simplifyEpsilonMm}
        onChange={(event) => onSettingsChange({ ...settings, simplifyEpsilonMm: Number(event.target.value) })}
        style={{ width: '100%' }}
      />

      <div style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.08)',
        fontSize: 12,
        lineHeight: 1.55,
      }}>
        {!artworkUrl ? (
          <div>Upload artwork to generate the approved cut-out preview.</div>
        ) : !enabled ? (
          <div>Turn shaped mode on to replace the golden object with the cut-out mesh.</div>
        ) : error ? (
          <div style={{ color: '#fecaca' }}>{error}</div>
        ) : draft ? (
          <>
            <div><strong>Adapter:</strong> {draft.generator.model_version}</div>
            <div><strong>Size:</strong> {round(draft.dimensions_mm.width)} x {round(draft.dimensions_mm.height)}mm</div>
            <div><strong>Thickness:</strong> {draft.dimensions_mm.thickness_body}mm</div>
            <div><strong>Edge:</strong> rounded {draft.dimensions_mm.edge_radius_mm}mm, not bevel</div>
            <div><strong>Nodes:</strong> {draft.geometry_mm.outer.length}</div>
            <div><strong>Attachment:</strong> adaptive 54mm grid stub</div>
          </>
        ) : (
          <div>Generating mask and rounded 3D preview...</div>
        )}
      </div>
    </div>
  )
}
