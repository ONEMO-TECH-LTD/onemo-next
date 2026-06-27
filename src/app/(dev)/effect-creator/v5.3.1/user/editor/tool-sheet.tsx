'use client'

// editor/tool-sheet.tsx — the descriptor-driven tool sheets (Phase 4 step 6c · inv 30 / §0.4).
//
// ToolSheet is the GENERIC value-tool client: it renders ANY value tool from `state.tools` DATA by control.KIND
// (slider/slider-enum/swatches/toggle) — a NEW value tool of an existing kind renders with ZERO edit, just
// another `tools` entry. PickerSheet is the SHAPE-outlet picker client: it renders the picker's DATA (chips/
// params/preview) but legitimately knows shape-specific PRESENTATION (the shape glyphs, the blob dice) — a UI
// client may know its own outlet. Both consume DATA + call actions BY ID; neither receives a descriptor object
// or ctx (the Layer boundary). Replaces the per-tool hardcoded AdjustSheet/ImageSheet/ShapeSheet (deleted 6c-3).

import { useRef } from 'react'
import type { ReactNode } from 'react'
import TickBar from '../../ui/TickBar'
import {
  RoundIcon, SmoothIcon, BrightnessIcon, ContrastIcon, SaturationIcon, WarmthIcon, MinusIcon, PlusIcon,
  DiceIcon, BlurIcon, CornerIcon, DetailIcon, LineIcon, TraceDetailIcon, OffsetIcon, ShapeIcon,
} from '../icons'
import { ShapeChipIcon } from './chips'
import type { ToolControl } from './descriptors/types'
import type { ShapeKind } from '../shapes'
import type { CommitResult } from '../outlineStore'
import styles from '../outline-editor.module.css'

// icon KEY → glyph: the descriptor carries a UI-agnostic key; the skeleton maps it here (no JSX in descriptors).
// keyed by the EXACT icon string each descriptor emits (grep-verified against descriptors/*; F1 pixel).
const ICONS: Record<string, ReactNode> = {
  'trace-detail': <TraceDetailIcon />, offset: <OffsetIcon />, corner: <CornerIcon />, round: <RoundIcon />,
  detail: <DetailIcon />, smooth: <SmoothIcon />, line: <LineIcon />,
  brightness: <BrightnessIcon />, contrast: <ContrastIcon />, saturation: <SaturationIcon />, warmth: <WarmthIcon />,
  preset: <BrightnessIcon />, tint: <SaturationIcon />, vignette: <BlurIcon />, blur: <BlurIcon />, fill: <OffsetIcon />,
  shape: <ShapeIcon />,
}

export interface PickerData {
  chips: { id: string; label: string }[]
  activeKind: string | null
  paramSpecs: { key: string; label: string; control: 'stepper' | 'slider'; min: number; max: number }[]
  params: Record<string, number>
  preview: string | null
}

/** The DATA record buildTools emits per tool (value-opaque — no descriptor object; pixel 6b boundary). */
export interface ToolRecord {
  id: string; outlet: string; label: string; icon: string
  kind: 'value' | 'picker'
  control?: ToolControl
  available: boolean
  value?: unknown
  hideWhenUnavailable?: boolean
  picker?: PickerData
}

export interface ToolActions {
  previewTool: (id: string, v: unknown) => void
  commitTool: (id: string, v: unknown) => CommitResult
  pickShape: (kind: string) => CommitResult
  applyShapeParam: (key: string, value: number) => CommitResult
  previewShapeParam: (key: string, value: number) => void
  commitShapeParam: () => CommitResult
  rerollShape: () => CommitResult
  uploadShape: (file: File) => Promise<CommitResult>
}

/** ring fraction for a chip arc — sliders show value/max; non-sliders show none (off-state = nothing). */
function ringFrac(t: ToolRecord): number {
  if (t.kind !== 'value' || !t.control || !t.available) return 0
  const c = t.control
  if (c.kind === 'slider') { const v = t.value as number; return v > 0 ? v / Math.max(c.max, 1) : 0 }
  if (c.kind === 'slider-enum') { const v = (t.value as { pct: number }).pct; return v > 0 ? v / Math.max(c.max, 1) : 0 }
  return 0
}

/** UX-1 progress ring — an arc around a tool circle showing its current value; nothing at zero. */
function ChipRing({ frac }: { frac: number }) {
  const f = Math.max(0, Math.min(1, frac))
  if (f <= 0.005) return null
  const R = 20, C = 2 * Math.PI * R
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden style={{ position: 'absolute', inset: '-10px 0 0 -10px', pointerEvents: 'none' }}>
      <circle cx={22} cy={22} r={R} fill="none" stroke="var(--color-text-primary, #1c2030)" strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={`${C * f} ${C * (1 - f)}`} transform="rotate(-90 22 22)" />
    </svg>
  )
}

/** Chip carousel with mouse drag-to-scroll (KAI-8978/F6) — touch scrolls natively; a desktop mouse drag
 *  scrolls the row and swallows the trailing click so chips don't mis-fire. */
function ChipRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; left: number } | null>(null)
  const movedRef = useRef(false)
  return (
    <div
      ref={ref}
      className={styles.chipRow}
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') return; dragRef.current = { x: e.clientX, left: ref.current?.scrollLeft ?? 0 }; movedRef.current = false }}
      onPointerMove={(e) => { const d = dragRef.current, el = ref.current; if (!d || !el) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 4) movedRef.current = true; if (movedRef.current) el.scrollLeft = d.left - dx }}
      onPointerUp={() => { dragRef.current = null }}
      onPointerLeave={() => { dragRef.current = null }}
      onClickCapture={(e) => { if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false } }}
    >
      {children}
    </div>
  )
}

/** Renders a value tool's control by kind — slider / slider-enum / swatches / toggle. Inapplicable = greyed. */
function Control({ tool, previewTool, commitTool }: { tool: ToolRecord; previewTool: ToolActions['previewTool']; commitTool: ToolActions['commitTool'] }) {
  const c = tool.control
  if (!c) return null
  if (!tool.available) {
    return (
      <div className={styles.disabledControl} aria-disabled="true">
        <TickBar label={tool.label} min={0} max={100} value={0} onChange={() => {}} onCommit={() => {}} format={(v) => `${Math.round(v)}%`} />
      </div>
    )
  }
  if (c.kind === 'slider') {
    return <div className={styles.shapeRow}><TickBar label={tool.label} min={c.min} max={c.max} step={c.step} value={tool.value as number} onChange={(v) => previewTool(tool.id, v)} onCommit={(v) => commitTool(tool.id, v)} format={c.format} /></div>
  }
  if (c.kind === 'slider-enum') {
    const val = tool.value as { pct: number; join: string }
    return (
      <>
        <div className={styles.shapeRow}><TickBar label={tool.label} min={c.min} max={c.max} step={c.step} value={val.pct} onChange={(v) => previewTool(tool.id, { ...val, pct: v })} onCommit={(v) => commitTool(tool.id, { ...val, pct: v })} format={c.format} /></div>
        <div className={styles.shapeRow} style={{ justifyContent: 'center', gap: 8 }}>
          {c.options.map((o) => (
            <button key={o.id} type="button" className={styles.stepBtn} onClick={() => commitTool(tool.id, { ...val, join: o.id })} aria-pressed={val.join === o.id} aria-label={`${tool.label} join: ${o.label}`}
              style={{ width: 'auto', padding: '4px 14px', borderRadius: 999, fontSize: 12, textTransform: 'capitalize', background: val.join === o.id ? 'var(--color-text-primary, #1c2030)' : 'transparent', color: val.join === o.id ? 'var(--color-bg, #fff)' : 'inherit', opacity: val.join === o.id ? 1 : 0.55 }}>
              {o.label}
            </button>
          ))}
        </div>
      </>
    )
  }
  if (c.kind === 'swatches') {
    const val = tool.value as string
    return (
      <div className={styles.shapeRow} style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {c.options.map((o) => (
          <button key={o.id} type="button" className={styles.stepBtn} onClick={() => commitTool(tool.id, o.id)} aria-pressed={val === o.id} aria-label={o.label}
            style={{ width: 'auto', padding: '4px 12px', borderRadius: 999, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: val === o.id ? 'var(--color-text-primary, #1c2030)' : 'transparent', color: val === o.id ? 'var(--color-bg, #fff)' : 'inherit', opacity: val === o.id ? 1 : 0.6 }}>
            {o.swatch ? <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, background: o.swatch, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} /> : null}
            {o.label}
          </button>
        ))}
      </div>
    )
  }
  if (c.kind === 'toggle') {
    const on = tool.value as boolean
    return <div className={styles.shapeRow} style={{ justifyContent: 'center' }}><button type="button" className={styles.stepBtn} onClick={() => commitTool(tool.id, !on)} aria-pressed={on} style={{ width: 'auto', padding: '6px 16px', borderRadius: 999, fontSize: 12 }}>{on ? c.onLabel : c.offLabel}</button></div>
  }
  return null
}

/** The value-tool sheet: a chip row of the given tools + the active tool's control. Hides hideWhenUnavailable
 *  tools when inapplicable (generation tools), greys the rest's control (edit tools) — the editor's exact UX. */
export function ToolSheet({ tools, activeId, setActiveId, actions }: { tools: ToolRecord[]; activeId: string | null; setActiveId: (id: string) => void; actions: ToolActions }) {
  const shown = tools.filter((t) => t.kind === 'value' && !(t.hideWhenUnavailable && !t.available))
  const active = shown.find((t) => t.id === activeId) ?? shown[0]
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {shown.map((t) => (
          <button key={t.id} type="button" className={`${styles.chip} ${active?.id === t.id ? styles.chipActive : ''}`} onClick={() => setActiveId(t.id)} aria-pressed={active?.id === t.id} aria-label={t.label}>
            <span className={styles.chipIcon} style={{ position: 'relative' }}>{ICONS[t.icon] ?? null}<ChipRing frac={ringFrac(t)} /></span>
            <span className={styles.chipLabel}>{t.label}</span>
            {active?.id === t.id && <span className={styles.activeDot} aria-hidden="true" />}
          </button>
        ))}
      </ChipRow>
      <div className={styles.shapeControls}>
        {active && <Control tool={active} previewTool={actions.previewTool} commitTool={actions.commitTool} />}
      </div>
    </div>
  )
}

/** The SHAPE-outlet picker client: Upload + the shape chips, then the active kind's parametric controls (+ the
 *  blob dice). Renders the picker's DATA + calls the picker actions BY VERB; shape-specific presentation (the
 *  shape glyphs, the blob affordance) is this client's job — NOT leaked into the descriptor. */
export function PickerSheet({ tool, actions }: { tool: ToolRecord; actions: ToolActions }) {
  const p = tool.picker
  if (!p) return null
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        <label className={styles.chip} aria-label="Upload a shape (SVG or image)">
          <span className={styles.chipIcon}><PlusIcon /></span>
          <span className={styles.chipLabel}>Upload</span>
          <input type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void actions.uploadShape(f) }} />
        </label>
        {p.chips.map((c) => (
          <button key={c.id} type="button" className={`${styles.chip} ${p.activeKind === c.id ? styles.chipActive : ''}`} onClick={() => actions.pickShape(c.id)} aria-pressed={p.activeKind === c.id} aria-label={c.label}>
            <span className={styles.chipIcon}><ShapeChipIcon kind={c.id as ShapeKind} /></span>
            <span className={styles.chipLabel}>{c.label}</span>
          </button>
        ))}
      </ChipRow>
      {p.activeKind && p.paramSpecs.length > 0 && (
        <div className={styles.shapeControls}>
          {p.paramSpecs.map((spec) => spec.control === 'stepper' ? (
            <div key={spec.key} className={styles.shapeRow}>
              <span className={styles.shapeName}>{spec.label}</span>
              <button type="button" className={styles.stepBtn} onClick={() => actions.applyShapeParam(spec.key, Math.max(spec.min, (p.params[spec.key] ?? spec.min) - 1))} aria-label={`Fewer ${spec.label}`}><MinusIcon /></button>
              <span className={styles.shapeVal}>{p.params[spec.key]}</span>
              <button type="button" className={styles.stepBtn} onClick={() => actions.applyShapeParam(spec.key, Math.min(spec.max, (p.params[spec.key] ?? spec.min) + 1))} aria-label={`More ${spec.label}`}><PlusIcon /></button>
            </div>
          ) : (
            <div key={spec.key} className={styles.shapeRow}>
              <TickBar label={spec.label} min={spec.min} max={spec.max} value={p.params[spec.key] ?? spec.min} onChange={(v) => actions.previewShapeParam(spec.key, v)} onCommit={() => actions.commitShapeParam()} format={(v) => `${Math.round(v)}%`} />
            </div>
          ))}
          {p.activeKind === 'blob' && (
            <div className={styles.shapeRow}><button type="button" className={styles.nodeAction} onClick={() => actions.rerollShape()}><DiceIcon /><span>New blob</span></button></div>
          )}
        </div>
      )}
    </div>
  )
}
