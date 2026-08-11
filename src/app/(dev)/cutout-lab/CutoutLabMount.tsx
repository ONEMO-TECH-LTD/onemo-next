'use client'

import { useState, type CSSProperties } from 'react'
import CutoutStudio, { type CutoutStudioCalibrationSurface } from '@/components/cutout-studio/CutoutStudio'
import { CHIP_RANGE, VEC_CHIPS } from '@/components/cutout-studio/ui-config'

const phoneDiagnostics = {
  setStage(stage: string | null) {
    try { if (stage === null) localStorage.removeItem('lab-detect-stage'); else localStorage.setItem('lab-detect-stage', stage) } catch { /* private mode / no storage */ }
  },
  getLastStage() {
    try { return localStorage.getItem('lab-detect-stage') } catch { return null }
  },
}

export function CutoutLabMount({ admin }: { admin: boolean }) {
  const [vecChip, setVecChip] = useState<(typeof VEC_CHIPS)[number]>('detail')

  const calibration = admin ? (surface: CutoutStudioCalibrationSurface) => {
    const [lo, hi] = CHIP_RANGE[vecChip]
    const value = vecChip === 'detail' ? hi - surface.settings.detail : surface.settings[vecChip]
    const setValue = (next: number) => surface.setTune(vecChip === 'detail' ? { detail: hi - next } : { [vecChip]: next })
    const chipButton = (active: boolean): CSSProperties => ({
      ...button, padding: '4px 10px', fontSize: 12,
      background: active ? '#0f172a' : '#f1f5f9', color: active ? '#fff' : '#0f172a',
    })

    return {
      vectorChips: VEC_CHIPS.map((chip) => (
        <button key={chip} onClick={() => setVecChip(chip)} style={chipButton(vecChip === chip)}>{chip}</button>
      )),
      vectorKnob: (
        <div style={knobRow}>
          <span style={{ fontWeight: 700, minWidth: 90 }}>{vecChip === 'detail' ? 'detail (0 = full)' : vecChip}</span>
          <input type="number" min={lo} max={hi} value={value}
            onChange={(event) => setValue(Math.max(lo, Math.min(hi, Math.round(+event.target.value))))}
            style={{ width: 54, padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
          <input type="range" min={lo} max={hi} step={1} value={value}
            onChange={(event) => setValue(+event.target.value)} style={{ flex: 1, maxWidth: 420 }}
            onPointerDown={() => surface.setDragging(true)} onPointerUp={() => surface.setDragging(false)}
            onPointerCancel={() => surface.setDragging(false)} />
        </div>
      ),
      panel: <CalibrationPanel surface={surface} />,
    }
  } : undefined

  return <CutoutStudio calibration={calibration} diagnostics={phoneDiagnostics} />
}

function CalibrationPanel({ surface }: { surface: CutoutStudioCalibrationSurface }) {
  const rows = [
    { label: 'swath width', value: surface.paintCfg.swathMult, lo: 0, hi: 12, step: 0.1, display: `${surface.paintCfg.swathMult}×`, set: (value: number) => surface.setPaintCfg({ swathMult: value }) },
    { label: 'smoothing', value: Math.round(surface.paintCfg.polishStrength * 100), lo: 0, hi: 100, step: 1, display: `${Math.round(surface.paintCfg.polishStrength * 100)}%`, set: (value: number) => surface.setPaintCfg({ polishStrength: value / 100 }) },
    { label: 'loop-close', value: surface.paintCfg.closeFrac, lo: 0, hi: 1, step: 0.01, display: surface.paintCfg.closeFrac.toFixed(2), set: (value: number) => surface.setPaintCfg({ closeFrac: value }) },
  ]

  return (
    <div style={{ marginTop: 16, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b', marginBottom: 8 }}>⚙️ Cutout calibration (admin)</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={labelStyle}>output source</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flex: 1 }}>
          <input aria-label="original resolution output" type="checkbox" checked={surface.outputOriginal} disabled={!surface.hasCut || surface.busy}
            onChange={(event) => surface.setOutputOriginal(event.target.checked)} />
          {surface.outputOriginal ? 'original upload' : 'capped 1536px'}
        </label>
        <span style={{ fontSize: 11, fontWeight: 700, minWidth: 110, textAlign: 'right' }}>
          {surface.outputSourceSize ? `${surface.outputSourceSize.w}×${surface.outputSourceSize.h}` : '—'}
          {surface.outputPrepareMs != null ? ` · ${surface.outputPrepareMs}ms` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={labelStyle}>edge finish</span>
        <input aria-label="shared edge finish" type="range" min={0} max={12} step={1} value={surface.edgeFinishPx}
          onChange={(event) => surface.setEdgeFinishPx(Number(event.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, fontWeight: 700, width: 40, textAlign: 'right' }}>{surface.edgeFinishPx}px</span>
      </div>
      {rows.map(({ label, value, lo, hi, step, display, set }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={labelStyle}>{label}</span>
          <input aria-label={`Paint ${label}`} type="range" min={lo} max={hi} step={step} value={value}
            onChange={(event) => set(Number(event.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 700, width: 40, textAlign: 'right' }}>{display}</span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Original upload is the default Preview/Save source; the editor/mask stays at 1024px. Edge finish is shared by Detect/u2net and GrabCut; Paint controls recalculate the latest Paint shape / erase stroke live, otherwise they apply to the next stroke.</div>
    </div>
  )
}

const button: CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
const knobRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 12, color: '#475569' }
const labelStyle: CSSProperties = { fontSize: 12, color: '#475569', width: 92 }
