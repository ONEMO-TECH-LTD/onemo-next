'use client'

// FiltersSurface — KAI-9124/9125: the standalone Filters HERO surface. Filters used to open the 2D
// editor in image mode; now it's its OWN bottom-sheet takeover over the LIVE 3D scene (the scene is NOT
// frozen, so every change previews on the real object in real time). It applies image-stage appearance —
// one-tap PRESETS, image-fx (bright/contrast/color/warmth), composite effects (vignette/tint), the
// magic-blend, and fill/tile — directly to the 3D + print composite through the store. ✓ keeps, ✕ reverts.

import { useRef, useState } from 'react'
import { useOutlineStore, NEUTRAL_FX, type ImageFx } from './outlineStore'
import { PRESET_LABELS, type PresetKey } from '@/lib/effect/composite'
import TickBar from '../ui/TickBar'
import { CheckIcon, CloseIcon, BrightnessIcon, ContrastIcon, SaturationIcon, WarmthIcon, BlurIcon } from './icons'
import { fxToPct, fxFromPct } from './editor/sheets'

const PRESETS: PresetKey[] = ['none', 'bw', 'noir', 'sepia', 'vivid', 'fade', 'cool', 'warm', 'duotone']
const TINTS: { label: string; value: string | null }[] = [
  { label: 'None', value: null }, { label: 'Warm', value: '#ff8a3d' }, { label: 'Rose', value: '#ff5d8f' },
  { label: 'Cool', value: '#3da5ff' }, { label: 'Mint', value: '#37d6a0' }, { label: 'Mono', value: '#8a8f9c' },
]
type Sub = 'brightness' | 'contrast' | 'saturate' | 'warmth' | 'vignette' | 'blend'
const SUBS: { k: Sub; label: string; icon: React.ReactNode }[] = [
  { k: 'brightness', label: 'Bright', icon: <BrightnessIcon /> },
  { k: 'contrast', label: 'Contrast', icon: <ContrastIcon /> },
  { k: 'saturate', label: 'Color', icon: <SaturationIcon /> },
  { k: 'warmth', label: 'Warmth', icon: <WarmthIcon /> },
  { k: 'vignette', label: 'Vignette', icon: <BlurIcon /> },
  { k: 'blend', label: 'Blend', icon: <BlurIcon /> },
]

export default function FiltersSurface({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const setImageFx = useOutlineStore((s) => s.setImageFx)
  const setBgBlur = useOutlineStore((s) => s.setBgBlur)
  const setWrapTile = useOutlineStore((s) => s.setWrapTile)
  // snapshot the pre-open appearance so ✕ reverts losslessly
  const preRef = useRef({ fx: useOutlineStore.getState().imageFx, blur: useOutlineStore.getState().bgBlur, tile: useOutlineStore.getState().wrapTile })
  const [fx, setFx] = useState<ImageFx>(useOutlineStore.getState().imageFx ?? NEUTRAL_FX)
  const [blend, setBlend] = useState(() => { const b = useOutlineStore.getState().bgBlur; return b == null ? 0 : Math.round(b * 100) })
  const [tile, setTile] = useState(useOutlineStore.getState().wrapTile)
  const [sub, setSub] = useState<Sub>('brightness')

  // every change writes the store LIVE → ShapedModel recomposes the 3D + print composite immediately.
  const apply = (next: ImageFx) => { setFx(next); setImageFx(next) }
  const writeBlend = (pct: number) => { setBlend(pct); setBgBlur(pct <= 0 ? 0 : pct / 100) }
  const writeTile = (v: boolean) => { setTile(v); setWrapTile(v) }
  const onKeep = () => onDone()
  const onRevert = () => { const p = preRef.current; setImageFx(p.fx); setBgBlur(p.blur); setWrapTile(p.tile); onCancel() }

  const glass: React.CSSProperties = { pointerEvents: 'auto', background: 'rgba(248,248,250,0.96)', color: '#1c2030', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 34px rgba(0,0,0,0.22)' }
  const chipBtn = (active: boolean): React.CSSProperties => ({ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', font: '600 13px system-ui, sans-serif', background: active ? '#1c2030' : 'rgba(120,124,140,0.14)', color: active ? '#fff' : 'inherit', whiteSpace: 'nowrap' })
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

        {/* PRESETS (one-tap looks) */}
        <div style={{ ...row, marginBottom: 10 }} aria-label="Presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => apply({ ...fx, preset: p })} aria-pressed={(fx.preset ?? 'none') === p} style={chipBtn((fx.preset ?? 'none') === p)}>{PRESET_LABELS[p]}</button>
          ))}
        </div>

        {/* TINT swatches (composite effect) */}
        <div style={{ ...row, alignItems: 'center', marginBottom: 12 }} aria-label="Tint">
          <span style={{ flex: '0 0 auto', opacity: 0.6, fontSize: 12, paddingLeft: 0 }}>Tint</span>
          {TINTS.map((t) => (
            <button key={t.label} type="button" onClick={() => apply({ ...fx, tint: t.value })} aria-label={`Tint ${t.label}`} aria-pressed={(fx.tint ?? null) === t.value}
              style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 999, cursor: 'pointer', border: (fx.tint ?? null) === t.value ? '2px solid #1c2030' : '2px solid rgba(0,0,0,0.12)', background: t.value ?? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 10px 10px' }} />
          ))}
        </div>

        {/* sub-tabs + fill toggle */}
        <div style={{ ...row, marginBottom: 4 }}>
          {SUBS.map((s) => (
            <button key={s.k} type="button" onClick={() => setSub(s.k)} aria-pressed={sub === s.k} aria-label={s.label} style={{ ...chipBtn(sub === s.k), display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'flex', transform: 'scale(0.8)' }}>{s.icon}</span>{s.label}
            </button>
          ))}
          <button type="button" onClick={() => writeTile(!tile)} aria-pressed={tile} aria-label="Fill mode" style={chipBtn(tile)}>{tile ? 'Tile fill' : 'Clamp'}</button>
        </div>

        {/* the active control */}
        <div style={{ padding: '6px 16px 2px' }}>
          {sub === 'vignette' ? (
            <TickBar label="Vignette" min={0} max={100} value={Math.round((fx.vignette ?? 0) * 100)} onChange={(v) => apply({ ...fx, vignette: v / 100 })} onCommit={(v) => apply({ ...fx, vignette: v / 100 })} format={(v) => `${Math.round(v)}%`} />
          ) : sub === 'blend' ? (
            <TickBar label="Blend" min={0} max={100} value={blend} onChange={writeBlend} onCommit={writeBlend} format={(v) => (v === 0 ? 'off' : `${Math.round(v)}%`)} />
          ) : (
            <TickBar label={sub} min={0} max={100} value={Math.round(fxToPct(sub, fx[sub]))} onChange={(v) => apply({ ...fx, [sub]: fxFromPct(sub, v) })} onCommit={(v) => apply({ ...fx, [sub]: fxFromPct(sub, v) })} format={(v) => `${Math.round(v)}%`} />
          )}
        </div>
      </div>
    </div>
  )
}
