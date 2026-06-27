'use client'

// FiltersSurface — the standalone Filters HERO surface (KAI-9124/9125). Phase 4 (§0a): a descriptor CLIENT —
// it renders its OWN bespoke glass bottom-sheet but DRIVES the SAME image descriptors as the editor (via the
// live image composer useImageFilters), so removing/disabling an image tool removes it from BOTH surfaces (the
// bundling test spans the hero). Live over the 3D scene: every change previews on the real object. ✓ keeps, ✕ reverts.

import { useRef, useState } from 'react'
import { useOutlineStore } from './outlineStore'
import { useImageFilters } from './editor/useImageFilters'
import TickBar from '../ui/TickBar'
import { CheckIcon, CloseIcon, BrightnessIcon, ContrastIcon, SaturationIcon, WarmthIcon, BlurIcon } from './icons'

// the hero's sub-tab lineup (the SLIDER image tools); preset/tint render as their own chip/swatch rows below.
const SUBS: { id: string; icon: React.ReactNode }[] = [
  { id: 'brightness', icon: <BrightnessIcon /> },
  { id: 'contrast', icon: <ContrastIcon /> },
  { id: 'saturate', icon: <SaturationIcon /> },
  { id: 'warmth', icon: <WarmthIcon /> },
  { id: 'vignette', icon: <BlurIcon /> },
  { id: 'blend', icon: <BlurIcon /> },
]

export default function FiltersSurface({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  // snapshot the pre-open appearance so ✕ reverts losslessly (the flow-revert KAI-9244 supersedes this in 6d-2).
  const preRef = useRef({ fx: useOutlineStore.getState().imageFx, blur: useOutlineStore.getState().bgBlur, tile: useOutlineStore.getState().wrapTile })
  const { imageTool, previewTool, commitTool } = useImageFilters() // composer: subscribes + drives the image descriptors
  const [sub, setSub] = useState('brightness')

  const onKeep = () => onDone()
  const onRevert = () => {
    const p = preRef.current
    const st = useOutlineStore.getState()
    st.setImageFx(p.fx); st.setBgBlur(p.blur); st.setWrapTile(p.tile)
    onCancel()
  }

  const preset = imageTool('preset')
  const tint = imageTool('tint')
  const fill = imageTool('fill')
  const active = imageTool(sub)

  const glass: React.CSSProperties = { pointerEvents: 'auto', background: 'rgba(248,248,250,0.96)', color: '#1c2030', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 34px rgba(0,0,0,0.22)' }
  const chipBtn = (on: boolean): React.CSSProperties => ({ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', font: '600 13px system-ui, sans-serif', background: on ? '#1c2030' : 'rgba(120,124,140,0.14)', color: on ? '#fff' : 'inherit', whiteSpace: 'nowrap' })
  const row: React.CSSProperties = { display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 2px', scrollbarWidth: 'none' }

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ ...glass, width: 'min(100%, 520px)', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }} role="dialog" aria-label="Filters">
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px' }}>
          <button type="button" onClick={onRevert} aria-label="Cancel filters" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}><CloseIcon /></button>
          <span style={{ font: '600 15px system-ui, sans-serif' }}>Filters</span>
          <button type="button" onClick={onKeep} aria-label="Apply filters" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1c8a52', display: 'flex' }}><CheckIcon /></button>
        </div>

        {/* PRESETS (one-tap looks) — the preset descriptor's swatch options */}
        {preset?.control.kind === 'swatches' && (
          <div style={{ ...row, marginBottom: 10 }} aria-label="Presets">
            {preset.control.options.map((o) => (
              <button key={o.id} type="button" onClick={() => commitTool('preset', o.id)} aria-pressed={preset.value === o.id} style={chipBtn(preset.value === o.id)}>{o.label}</button>
            ))}
          </div>
        )}

        {/* TINT swatches — the tint descriptor's swatch options (swatch = the dot colour; null = checkerboard) */}
        {tint?.control.kind === 'swatches' && (
          <div style={{ ...row, alignItems: 'center', marginBottom: 12 }} aria-label="Tint">
            <span style={{ flex: '0 0 auto', opacity: 0.6, fontSize: 12, paddingLeft: 0 }}>Tint</span>
            {tint.control.options.map((o) => (
              <button key={o.id} type="button" onClick={() => commitTool('tint', o.id)} aria-label={`Tint ${o.label}`} aria-pressed={tint.value === o.id}
                style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 999, cursor: 'pointer', border: tint.value === o.id ? '2px solid #1c2030' : '2px solid rgba(0,0,0,0.12)', background: o.swatch ?? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 10px 10px' }} />
            ))}
          </div>
        )}

        {/* sub-tabs (slider tools) + fill toggle */}
        <div style={{ ...row, marginBottom: 4 }}>
          {SUBS.map((s) => {
            const t = imageTool(s.id)
            if (!t) return null
            return (
              <button key={s.id} type="button" onClick={() => setSub(s.id)} aria-pressed={sub === s.id} aria-label={t.label} style={{ ...chipBtn(sub === s.id), display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'flex', transform: 'scale(0.8)' }}>{s.icon}</span>{t.label}
              </button>
            )
          })}
          {fill?.control.kind === 'toggle' && (
            <button type="button" onClick={() => commitTool('fill', !fill.value)} aria-pressed={!!fill.value} aria-label="Fill mode" style={chipBtn(!!fill.value)}>{fill.value ? fill.control.onLabel : fill.control.offLabel}</button>
          )}
        </div>

        {/* the active slider control (driven by its descriptor's read/preview/commit) */}
        <div style={{ padding: '6px 16px 2px' }}>
          {active?.control.kind === 'slider' && (
            <TickBar
              label={active.label}
              min={active.control.min}
              max={active.control.max}
              step={active.control.step}
              value={active.value as number}
              onChange={(v) => previewTool(sub, v)}
              onCommit={(v) => commitTool(sub, v)}
              format={active.control.format}
            />
          )}
        </div>
      </div>
    </div>
  )
}
