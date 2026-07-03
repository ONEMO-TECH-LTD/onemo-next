'use client'

/**
 * React × Figma — full Figma editor-chrome clone (left rail + panels + infinite canvas + Design inspector)
 * on the real React build. DEV-ONLY shell; product inherits only the Screen. NO engine wiring yet —
 * the complete Figma UI must be cloned first (Dan). Icons = @phosphor-icons/react (as the engine uses).
 *
 * Inventory replicated 1:1 from Figma's live DOM (file 4084:25997):
 *  · icon rail: Main menu · File · Agents · Assets · Tools · Variables  (rail switches the left panel)
 *  · left/File: file selector + Drafts · Pages (search/add) · Layers tree (type glyphs · lock · select)
 *  · left/Assets & Variables: expandable side panels
 *  · center: infinite pan/zoom canvas, device frame floating in a dotted field
 *  · right: Frame preset + Position · Auto layout (flow · W/H resizing dropdowns · 3×3 align · gap · padding · clip)
 *           · Appearance · Fill · Stroke · Effects · Selection colors · Layout guide · Export
 *  Spec: Inter 11px; headers 550/~0.5px near-black; fields 24px/5px radius; every value field raw-OR-token (◆).
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ListDashes, File as FileIcon, Sparkle, Package, Wrench, Hexagon,
  MagnifyingGlass, Plus, Minus, Sidebar, CaretDown, CaretRight, DotsThree, GearSix, Eye,
  AlignLeft, AlignCenterHorizontal, AlignRight, AlignTop, AlignCenterVertical, AlignBottom,
  ArrowClockwise, FlipHorizontal, FlipVertical, ArrowsOutCardinal, ArrowDown, ArrowRight,
  GridFour, SquaresFour, Copy, CircleHalf, ImageSquare, LockSimple, FrameCorners, TextT, Palette, DotsNine, DiamondsFour, Unite, Selection,
  type Icon as PIcon,
} from '@phosphor-icons/react'

const INK = 'rgba(0,0,0,0.9)', MUTE = 'rgba(0,0,0,0.45)', FAINT = 'rgba(0,0,0,0.3)'
const LINE = '#e6e7e9', FIELD = '#f5f5f5', SEL = '#0d99ff', TOKEN = '#7a3fb0', RAIL = '#fff'
const FONT = 'Inter, -apple-system, system-ui, sans-serif'
const hdr = { font: `550 11px/16px ${FONT}`, letterSpacing: '0.4px', color: INK } as const

/* ── icon button ── */
function IB({ I, title, active, on, w = 'regular', s = 16 }: { I: PIcon; title?: string; active?: boolean; on?: () => void; w?: 'thin' | 'light' | 'regular' | 'bold'; s?: number }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" title={title} onClick={on} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 24, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center', flex: 'none', background: active ? '#e5f4ff' : h ? '#f0f1f3' : 'transparent', color: active ? SEL : INK }}>
      <I size={s} weight={w} />
    </button>
  )
}

/* ── segmented button (Figma align/flip pills): 31×24 · grey #f5f5f5 · per-position radii · pure-black icon → blue when active ── */
function SegBtn({ I, pos, active, title, w = 'regular', s = 16 }: { I: PIcon; pos: 'l' | 'm' | 'r'; active?: boolean; title?: string; w?: 'thin' | 'light' | 'regular' | 'bold' | 'fill'; s?: number }) {
  const [h, setH] = useState(false)
  const radius = pos === 'l' ? '5px 0 0 5px' : pos === 'r' ? '0 5px 5px 0' : '0'
  return (
    <button type="button" title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 31, height: 24, borderRadius: radius, display: 'grid', placeItems: 'center', flex: 'none', background: h ? '#ededed' : FIELD, color: active ? SEL : '#000' }}>
      <I size={s} weight={w} />
    </button>
  )
}
/* segmented group: 1px hairline dividers between segments (Figma) */
const Seg = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'flex', gap: 1, flex: 'none' }}>{children}</div>

/* ── Figma-exact icons — SVG paths copied verbatim from Figma's Design panel DOM.
   Two-tone: tone 1 = content bars rgba(0,0,0,.898); tone 3 = alignment edge-bar rgba(0,0,0,.3). Active → Figma blue. ── */
const FI: Record<string, [number, string][]> = {
  alignLeft: [[1, 'M17.25 10a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75zm-4 5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75z'], [3, 'M6 17.5a.5.5 0 0 1-1 0v-12a.5.5 0 0 1 1 0z']],
  alignCenterH: [[1, 'M17.25 10a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-9.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75zm-2 5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75z'], [3, 'M13 17.5a.5.5 0 0 1-1 0V15h1zm0-4.5v-3h-1v3zm0-7.5V8h-1V5.5a.5.5 0 0 1 1 0']],
  alignRight: [[1, 'M6.75 10A.75.75 0 0 1 6 9.25v-.5A.75.75 0 0 1 6.75 8h8.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-.75.75zm4 5a.75.75 0 0 1-.75-.75v-.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-.75.75z'], [3, 'M18 17.5a.5.5 0 0 0 1 0v-12a.5.5 0 0 0-1 0z']],
  alignTop: [[1, 'M10 17.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-8.5A.75.75 0 0 1 8.75 8h.5a.75.75 0 0 1 .75.75zm5-4a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75z'], [3, 'M17.5 6a.5.5 0 0 0 0-1h-12a.5.5 0 0 0 0 1z']],
  alignCenterV: [[1, 'M10 6.75A.75.75 0 0 0 9.25 6h-.5a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75zm5 2a.75.75 0 0 0-.75-.75h-.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75z'], [3, 'M17.5 11a.5.5 0 0 1 0 1H15v-1zM13 11h-3v1h3zm-7.5 0H8v1H5.5a.5.5 0 0 1 0-1']],
  alignBottom: [[1, 'M10 6.75A.75.75 0 0 0 9.25 6h-.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75zm5 4a.75.75 0 0 0-.75-.75h-.5a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75z'], [3, 'M17.5 18a.5.5 0 0 1 0 1h-12a.5.5 0 0 1 0-1z']],
  more: [[1, 'M9 12.25c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75z'], [3, 'M19 6.5a.5.5 0 0 0-.5-.5h-12a.5.5 0 0 0 0 1h12a.5.5 0 0 0 .5-.5m0 11a.5.5 0 0 0-.5-.5h-12a.5.5 0 0 0 0 1h12a.5.5 0 0 0 .5-.5']],
  rotate: [[1, 'M11.054 9.543a1.5 1.5 0 0 1 2.007.103l3.293 3.293a1.5 1.5 0 0 1 0 2.121l-3.293 3.293a1.5 1.5 0 0 1-2.121 0L7.647 15.06a1.5 1.5 0 0 1 0-2.121l3.293-3.293zm1.3.81a.5.5 0 0 0-.707 0l-3.293 3.293a.5.5 0 0 0 0 .707l3.293 3.293a.5.5 0 0 0 .629.064l.078-.064 3.293-3.293a.5.5 0 0 0 .064-.629l-.064-.078zM9.526 5.767a3.5 3.5 0 0 1 4.949 0L16 7.292V6a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-.5.5H14a.5.5 0 0 1 0-1h1.293l-1.525-1.526a2.5 2.5 0 0 0-3.535 0l-2.38 2.379a.5.5 0 0 1-.706-.707z']],
  flipH: [[1, 'M12.5 6.5a.5.5 0 0 0-1 0v11a.5.5 0 0 0 1 0zM6 9.104a.75.75 0 0 1 1.28-.53L10 11.292a1 1 0 0 1 0 1.414l-2.72 2.72a.75.75 0 0 1-1.28-.53zm1 .603v4.586L9.293 12zm11-.603a.75.75 0 0 0-1.28-.53L14 11.292a1 1 0 0 0 0 1.414l2.72 2.72a.75.75 0 0 0 1.28-.53zm-1 .603v4.586L14.707 12z']],
  flipV: [[1, 'M17.5 12.5a.5.5 0 0 0 0-1h-11a.5.5 0 0 0 0 1zM14.896 18a.75.75 0 0 0 .53-1.28L12.708 14a1 1 0 0 0-1.414 0l-2.72 2.72a.75.75 0 0 0 .53 1.28zm-.603-1H9.707L12 14.707zm.603-11a.75.75 0 0 1 .53 1.28L12.708 10a1 1 0 0 1-1.414 0l-2.72-2.72A.75.75 0 0 1 9.103 6zm-.603 1H9.707L12 9.293z']],
}
function FIcon({ name, active, size = 24 }: { name: keyof typeof FI; active?: boolean; size?: number }) {
  const c1 = active ? SEL : 'rgba(0,0,0,0.898)'
  const c3 = active ? SEL : 'rgba(0,0,0,0.3)'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      {FI[name].map(([tone, d], i) => <path key={i} d={d} fill={tone === 3 ? c3 : c1} fillRule="evenodd" clipRule="evenodd" />)}
    </svg>
  )
}
/* segmented button carrying a Figma-exact icon (align/flip): 31×24 · grey #f5f5f5 · per-position radii */
function FSegBtn({ name, pos, active, title, fill }: { name: keyof typeof FI; pos: 'l' | 'm' | 'r'; active?: boolean; title?: string; fill?: boolean }) {
  const [h, setH] = useState(false)
  const radius = pos === 'l' ? '5px 0 0 5px' : pos === 'r' ? '0 5px 5px 0' : '0'
  return (
    <button type="button" title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: fill ? 'auto' : 31, height: 24, borderRadius: radius, display: 'grid', placeItems: 'center', flex: fill ? '1 1 0' : 'none', background: h ? '#ededed' : FIELD }}>
      <FIcon name={name} active={active} />
    </button>
  )
}
/* bare 24×24 icon button carrying a Figma-exact icon (e.g. More actions) */
function FIB({ name, title }: { name: keyof typeof FI; title?: string }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 24, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center', flex: 'none', background: h ? '#f0f1f3' : 'transparent' }}>
      <FIcon name={name} />
    </button>
  )
}

/* ── value field: label + value + raw/token (◆) bind ── */
function Field({ label, value, bound, grow = 1, dim }: { label?: string; value: string; bound?: boolean; grow?: number; dim?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ flex: `${grow} 1 0`, minWidth: 0, height: 24, borderRadius: 5, background: h ? '#ededed' : FIELD, border: `1px solid ${h ? '#e0e0e0' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', font: `450 11px/16px ${FONT}` }}>
      {label != null && <span style={{ flex: 'none', color: FAINT }}>{label}</span>}
      <span style={{ flex: 1, minWidth: 0, color: bound ? TOKEN : dim ? MUTE : INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <span title="Apply variable" style={{ flex: 'none', display: 'grid', placeItems: 'center', color: bound ? TOKEN : FAINT, opacity: bound ? 1 : h ? 0.75 : 0 }}><Hexagon size={11} weight={bound ? 'fill' : 'regular'} /></span>
    </div>
  )
}
/* ── dropdown (W/H resizing, blend, presets): value + caret ── */
function Drop({ value, grow = 1, bound }: { value: string; grow?: number; bound?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ appearance: 'none', flex: `${grow} 1 0`, minWidth: 0, height: 24, borderRadius: 5, background: h ? '#ededed' : FIELD, border: '1px solid transparent', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', cursor: 'pointer', font: `450 11px/16px ${FONT}`, color: bound ? TOKEN : INK }}>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <CaretDown size={10} color={MUTE} />
    </button>
  )
}
/** field with a trailing inline caret label (Figma's "402 … Fill" resizing field). */
function ResizeField({ label, value, mode, bound }: { label: string; value: string; mode: string; bound?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ flex: '1 1 0', minWidth: 0, height: 24, borderRadius: 5, background: h ? '#ededed' : FIELD, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', font: `450 11px/16px ${FONT}` }}>
      <span style={{ flex: 'none', color: FAINT }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, color: bound ? TOKEN : INK, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      <span style={{ flex: 'none', color: MUTE, font: `450 11px/16px ${FONT}` }}>{mode}</span>
    </div>
  )
}
const Row = ({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) => <div style={{ display: 'flex', gap, alignItems: 'center' }}>{children}</div>
/* Figma field-row — copied verbatim from Figma's fieldset: grid 1fr 1fr 24px · gap 8 · padding 0 8 0 16 → 88px fields at 240 content. 2 stretch fields + reserved trailing icon slot. */
const FieldRow = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 8, paddingRight: 8, boxSizing: 'border-box', alignItems: 'center', ...style }}>{children}</div>
)

function Sec({ title, action, children, first, caret }: { title: string; action?: React.ReactNode; children?: React.ReactNode; first?: boolean; caret?: boolean }) {
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${LINE}`, padding: '8px 12px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24 }}>
        <span style={hdr}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: MUTE }}>{action}{caret && <CaretDown size={11} color={MUTE} />}</div>
      </div>
      {children && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, paddingLeft: 16 }}>{children}</div>}
    </div>
  )
}
function AlignGrid({ sel = 1 }: { sel?: number }) {
  return (
    <div style={{ flex: 'none', width: 68, height: 68, background: FIELD, borderRadius: 5, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: 5 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <span style={{ width: i === sel ? 9 : 3, height: 2, borderRadius: 2, background: i === sel ? SEL : FAINT }} />
        </div>
      ))}
    </div>
  )
}

/* ── ⚠️ MOCK CONTENT (layers · pages · variable collections/values) ──
   These lists are DATA, not UI — placeholders only. Wired live from the build next:
   layers ← the Screen's data-anat DOM (readWired) · pages ← app screens · variables ← the DS token graph. */
/* layers tree — MOCK */
type Node = { name: string; type: 'frame' | 'image' | 'comp'; depth: number; kids?: boolean; open?: boolean; locked?: boolean; sel?: boolean; comp?: boolean }
const TREE: Node[] = [
  { name: 'LOCKED OPTIONS', type: 'frame', depth: 0, kids: true },
  { name: 'onemo-surface-bg-430×932@3× 1', type: 'image', depth: 1 },
  { name: 'onemo-surface-bg-430×932@2× 1', type: 'image', depth: 1 },
  { name: 'CANDIDATES', type: 'frame', depth: 0, kids: true, open: true },
  { name: 'Top Section', type: 'frame', depth: 1 },
  { name: 'Editor 402 iphone - apple blur glass', type: 'frame', depth: 1, kids: true, open: true },
  { name: 'Status bar', type: 'comp', depth: 2, comp: true, locked: true },
  { name: 'Top Section', type: 'frame', depth: 2 },
  { name: 'Canvas', type: 'frame', depth: 2 },
  { name: 'Bottom Section', type: 'frame', depth: 2, sel: true },
  { name: 'Toolbar - Bottom - Safari', type: 'frame', depth: 2, locked: true },
  { name: 'Editor 402 iphone - apple blur glass', type: 'frame', depth: 1 },
  { name: 'Editor 402 iphone - apple blur glass', type: 'frame', depth: 1 },
  { name: 'Editor 402 iphone', type: 'frame', depth: 1 },
]
function LayerRow({ n }: { n: Node }) {
  const [h, setH] = useState(false)
  const G = n.type === 'image' ? ImageSquare : n.comp ? Hexagon : FrameCorners
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', height: 28, paddingRight: 8, paddingLeft: 8 + n.depth * 16, background: n.sel ? '#e5f4ff' : h ? '#f4f5f6' : 'transparent', cursor: 'pointer', gap: 6 }}>
      <span style={{ width: 12, flex: 'none', color: FAINT }}>{n.kids && (n.open ? <CaretDown size={11} /> : <CaretRight size={11} />)}</span>
      <G size={13} color={n.comp ? TOKEN : MUTE} weight="regular" style={{ flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, font: `400 11px/1 ${FONT}`, color: n.comp ? TOKEN : n.sel ? INK : INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
      {n.locked && <LockSimple size={12} color={FAINT} weight="regular" style={{ flex: 'none' }} />}
    </div>
  )
}

const PAGES = ['_DS Reference Components', 'DESIGN SYSTEM - full (current)', 'ONEMO BRAND IDENTITY', 'PROTOTYPING', 'Components +', 'ICONS']

/* ── Variables library (full-page, opened by the Variables rail item) ──
   Collections + counts are the REAL DS token collections (read live from Figma's variables editor). */
const COLLECTIONS: [string, number][] = [
  ['.0-Branding-Col', 600], ['.1.0-Prim-Col', 131], ['.1.1-Prim-Dim', 45], ['.1.2-Prim-Type', 28], ['.1.3-Prim-Track', 34], ['.1.4-Prim-Ratios', 21],
  ['.2.0-Al-Col', 79], ['.2.1-Al-Dim', 23], ['.2.2-Al-Type', 95], ['.2.3-Al-Radii', 11], ['.2.4-Al-Container', 12], ['.2.5-Al-Breakpoints', 8],
  ['3.0-Sem-Col', 86], ['3.1-Sem-Dim-Fluid', 23], ['3.2-Sem-Dim-Static', 23], ['3.3-Sem-Type-Fluid', 156], ['3.4-Sem-Border', 5], ['3.5-Sem-Radii', 11], ['3.6-Sem-Container', 13], ['3.7-Sem-Breakpoints', 8],
  ['5.0-Effects', 21], ['4.0-Com', 4],
]
const VGROUPS: [string, number, number][] = [['All', 600, 0], ['DUSTY', 288, 0], ['Royal Plum', 12, 1], ['Velvet Orchid', 12, 1], ['Blackberry Cream', 12, 1]]
const RAMPS: { group: string; rows: [number, string][] }[] = [
  { group: 'Royal Plum', rows: [[1, 'ED84D2'], [2, 'E869C7'], [3, 'E24EBB'], [4, 'DB33AF'], [5, 'C8259D'], [6, 'AB2286'], [7, '8E1E70'], [8, '72195A'], [9, '5F154B'], [10, '4D123C'], [11, '3A0E2D'], [12, '280A1F']] },
  { group: 'Velvet Orchid', rows: [[1, 'D4A8E2'], [2, 'C790D9'], [3, 'BB79CF'], [4, 'AE63C5'], [5, 'A14CBA'], [6, '8D41A4']] },
]
function VariablesLibrary() {
  const [colSel, setColSel] = useState(0)
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
      {/* collections + groups */}
      <div style={{ width: 300, flex: 'none', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
          <span style={{ flex: 1, minWidth: 0, font: `550 12px/1 ${FONT}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ONEMO DS v2.3.1 - 1 July +</span>
          <IB I={Sidebar} title="Toggle panel" s={15} />
        </div>
        <div style={{ padding: '10px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={hdr}>Collections</span><IB I={Plus} title="Create collection" s={14} /></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {COLLECTIONS.map(([n, c], i) => (
            <button key={n} type="button" onClick={() => setColSel(i)} style={{ appearance: 'none', border: 0, cursor: 'pointer', width: '100%', height: 30, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderRadius: 5, background: i === colSel ? '#f0f1f3' : 'transparent', color: INK }}>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `${i === colSel ? 550 : 400} 11px/1 ${FONT}` }}>{n}</span>
              <span style={{ flex: 'none', color: MUTE, font: `400 11px/1 ${FONT}` }}>{c}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${LINE}` }}><span style={hdr}>Groups</span><IB I={ListDashes} title="Sort" s={14} /></div>
        <div style={{ maxHeight: 150, overflowY: 'auto', padding: '0 6px 8px' }}>
          {VGROUPS.map(([n, c, d], i) => (
            <div key={n + i} style={{ height: 28, display: 'flex', alignItems: 'center', padding: `0 8px 0 ${8 + d * 16}px`, borderRadius: 5, background: i === 0 ? '#e5f4ff' : 'transparent', font: `${i === 0 ? 600 : 400} 11px/1 ${FONT}` }}>
              <span style={{ flex: 1, minWidth: 0 }}>{n}</span><span style={{ color: MUTE, fontWeight: 400 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
      {/* table */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
          <span style={{ font: `550 12px/1 ${FONT}` }}>{COLLECTIONS[colSel][0]}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 200, height: 26, background: FIELD, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', color: MUTE, font: `400 11px/1 ${FONT}` }}><MagnifyingGlass size={13} /> Search</div>
            <IB I={GearSix} title="Filter" s={14} /><IB I={Plus} title="New mode" s={14} />
          </div>
        </div>
        <div style={{ height: 32, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', font: `400 11px/1 ${FONT}`, color: MUTE }}>
          <span style={{ width: 280, padding: '0 16px' }}>Name</span><span style={{ flex: 1, padding: '0 16px' }}>Light</span><span style={{ flex: 'none', width: 40, display: 'grid', placeItems: 'center' }}><Plus size={13} color={MUTE} /></span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {RAMPS.map(r => (
            <div key={r.group}>
              <div style={{ padding: '12px 16px 6px', font: `400 11px/1 ${FONT}`, color: MUTE }}>DUSTY / <span style={{ color: INK, fontWeight: 600 }}>{r.group}</span></div>
              {r.rows.map(([num, hex]) => (
                <div key={num} style={{ height: 36, borderBottom: '1px solid #f2f2f3', display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 280, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, font: `400 11px/1 ${FONT}` }}><Palette size={14} color={MUTE} /> {num}</span>
                  <span style={{ flex: 1, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, font: `400 11px/1 ${FONT}` }}><span style={{ width: 14, height: 14, borderRadius: 3, background: '#' + hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} /> {hex}</span>
                  <span style={{ width: 40 }} />
                </div>
              ))}
            </div>
          ))}
          <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', color: MUTE, font: `400 11px/1 ${FONT}`, cursor: 'pointer' }}><Plus size={14} /> Create variable</div>
        </div>
      </div>
    </div>
  )
}

/* Paint/effect row — swatch + name + opacity% + eye + remove (Fill · Stroke · Effects · Selection colors). */
function PaintRow({ swatch, name, op, grad }: { swatch?: string; name: string; op: number; grad?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, minWidth: 0, height: 24, borderRadius: 5, background: FIELD, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
        <span style={{ flex: 'none', width: 14, height: 14, borderRadius: 3, background: grad ? 'linear-gradient(135deg,#111,#bbb)' : '#' + (swatch || 'fff'), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' }} />
        <span style={{ flex: 1, minWidth: 0, font: `450 11px/1 ${FONT}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ flex: 'none', font: `450 11px/1 ${FONT}`, color: INK }}>{op}</span>
        <span style={{ flex: 'none', color: FAINT, font: `400 11px/1 ${FONT}` }}>%</span>
      </div>
      <IB I={Eye} title="Toggle visibility" s={14} /><IB I={Minus} title="Remove" s={14} />
    </div>
  )
}

/* ⚠️ MOCK section content — DATA (read from the selected element's props via the reader later), NOT hardcoded UI.
   Empty array → the section renders its EMPTY state (header + Add only); non-empty → the content state. */
const MOCK = {
  fills: [{ hex: 'FFFFFF', op: 100 }],
  strokes: [{ hex: '000000', op: 100, position: 'Inside', weight: 1 }],
  effects: [{ type: 'Drop shadow' }],
  selectionColors: [{ hex: '000000', op: 100 }, { name: 'Linear', op: 100, grad: true }, { hex: 'FFFFFF', op: 100 }],
  layoutGuides: [{ size: 'Grid 10px' }],
}

export default function ReactFigmaPage() {
  const [rail, setRail] = useState<'file' | 'assets' | 'variables'>('file')
  const [tab, setTab] = useState<'design' | 'prototype'>('design')
  const [view, setView] = useState({ x: 300, y: 70, z: 0.6 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top
        setView(v => { const nz = Math.min(4, Math.max(0.05, v.z * (1 - e.deltaY * 0.0016))); const k = nz / v.z; return { z: nz, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k } })
      } else setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const onDown = useCallback((e: React.PointerEvent) => { if (e.button !== 0 && e.button !== 1) return; pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }, [view.x, view.y])
  const onMove = useCallback((e: React.PointerEvent) => { if (pan.current) setView(v => ({ ...v, x: pan.current!.vx + (e.clientX - pan.current!.x), y: pan.current!.vy + (e.clientY - pan.current!.y) })) }, [])
  const onUp = useCallback(() => { pan.current = null }, [])

  // resizable panels — edge drag handles + min/max (Figma canon). Document-level listeners = robust through the whole drag.
  const [leftW, setLeftW] = useState(240)
  const [rightW, setRightW] = useState(265)
  const startResize = (side: 'l' | 'r') => (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX, startW = side === 'l' ? leftW : rightW
    const onMove = (ev: PointerEvent) => { const dx = ev.clientX - startX; side === 'l' ? setLeftW(Math.max(208, Math.min(400, startW + dx))) : setRightW(Math.max(232, Math.min(440, startW - dx))) }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }
  const handleStyle = (side: 'left' | 'right'): React.CSSProperties => ({ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 8, cursor: 'ew-resize', zIndex: 30 })

  const railItems: [PIcon, string, typeof rail | null][] = [
    [FileIcon, 'File', 'file'], [Sparkle, 'Agents', null], [Package, 'Assets', 'assets'], [Wrench, 'Tools', null], [Hexagon, 'Variables', 'variables'],
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#fff', fontFamily: FONT, color: INK, userSelect: 'none' }}>
      {/* ░░ ICON RAIL ░░ */}
      <nav style={{ width: 56, flex: 'none', borderRight: `1px solid ${LINE}`, background: RAIL, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
        <button type="button" title="Main menu" style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 32, height: 32, display: 'grid', placeItems: 'center', color: INK, marginBottom: 6 }}><ListDashes size={20} /></button>
        <div style={{ width: 20, borderTop: `1px solid ${LINE}`, margin: '4px 0 8px' }} />
        {railItems.map(([I, label, key]) => {
          const active = key !== null && rail === key
          return (
            <button key={label} type="button" title={label} onClick={() => key && setRail(key)}
              style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 56, height: 52, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: active ? '#e5f4ff' : 'transparent', color: active ? SEL : INK }}>
              <I size={20} weight="regular" />
              <span style={{ font: `450 9px/14px ${FONT}`, color: active ? SEL : INK }}>{label}</span>
            </button>
          )
        })}
      </nav>

      {rail === 'variables' ? <VariablesLibrary /> : (<>
      {/* ░░ LEFT PANEL (rail-switched) ░░ */}
      <aside style={{ width: leftW, flex: 'none', position: 'relative', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* file selector */}
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flex: 'none' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ font: `550 12px/1 ${FONT}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ONEMO DS v2.3.1</span>
            <CaretDown size={11} color={MUTE} />
          </span>
          <IB I={Sidebar} title="Toggle panel" s={15} />
        </div>

        {rail === 'file' && (
          <>
            <div style={{ padding: '6px 12px 2px', font: `400 11px/1 ${FONT}`, color: MUTE }}>Drafts ›</div>
            <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={hdr}>Pages</span>
              <span style={{ display: 'flex', gap: 4, color: MUTE }}><MagnifyingGlass size={13} /><Plus size={13} /></span>
            </div>
            <div style={{ padding: '0 6px' }}>
              {PAGES.map((p, i) => (
                <div key={p} style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRadius: 5, background: i === 4 ? '#f0f1f3' : 'transparent', font: `400 11px/1 ${FONT}`, color: i === 4 ? INK : MUTE }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                  {i === 4 && <TextT size={12} color={'#1f9e6b'} />}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${LINE}`, marginTop: 6 }}>
              <span style={hdr}>Layers</span>
              <IB I={ListDashes} title="Collapse layers" s={14} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>{TREE.map((n, i) => <LayerRow key={i} n={n} />)}</div>
          </>
        )}
        {rail === 'assets' && (
          <>
            <div style={{ padding: '10px 12px' }}><div style={{ height: 28, background: FIELD, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', color: MUTE, font: `400 11px/1 ${FONT}` }}><MagnifyingGlass size={13} /> Search components…</div></div>
            <div style={{ padding: '4px 12px', font: `400 11px/1.6 ${FONT}`, color: FAINT }}>Local components + libraries expand here (Assets panel).</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '4px 12px' }}>
              {['RoundButton', 'Dock', 'Dial', 'Glass', 'Surface', 'Ruler'].map(c => (
                <div key={c} style={{ height: 56, borderRadius: 6, border: `1px solid ${LINE}`, display: 'grid', placeItems: 'center', font: `450 10px/1 ${FONT}`, color: MUTE }}>{c}</div>
              ))}
            </div>
          </>
        )}
        {rail === 'variables' && (
          <>
            <div style={{ padding: '10px 12px 4px', ...hdr }}>Variable collections</div>
            <div style={{ padding: '0 8px' }}>
              {['Prim-Col', 'Al-Col', 'Sem-Col', 'Sem-Dim-Fluid', 'Sem-Type-Fluid', 'Com'].map(c => (
                <div key={c} style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRadius: 5, font: `400 11px/1 ${FONT}`, color: INK }}><Hexagon size={12} color={TOKEN} /> {c}</div>
              ))}
            </div>
            <div style={{ padding: '8px 12px', font: `400 11px/1.6 ${FONT}`, color: FAINT }}>Collections read from the DS token graph once the engine is wired.</div>
          </>
        )}
        <div onPointerDown={startResize('l')} style={handleStyle('right')} />
      </aside>

      {/* ░░ INFINITE CANVAS ░░ */}
      <main ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ flex: 1, minWidth: 0, background: '#f0f0f0', position: 'relative', overflow: 'hidden', cursor: pan.current ? 'grabbing' : 'default' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(0,0,0,.09) 1px, transparent 1px)', backgroundSize: `${24 * view.z}px ${24 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }} />
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.z})`, transformOrigin: '0 0' }}>
          <div style={{ font: `550 10px/1 ${FONT}`, color: SEL, marginBottom: 8, marginLeft: 2 }}>Editor 402 · 402 × 871</div>
          <div data-screen-host style={{ width: 402, height: 871, background: '#fff', borderRadius: 4, boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 12px 40px -8px rgba(0,0,0,.25)', display: 'grid', placeItems: 'center', color: FAINT, font: `400 12px/1.6 ${FONT}`, textAlign: 'center', padding: 24 }}>
            The real engine-connected Screen<br />mounts here — after the shell.
          </div>
        </div>
        <div style={{ position: 'absolute', left: 12, bottom: 12, height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', background: '#fff', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,.14)', font: `450 11px/1 ${FONT}` }}>
          <IB I={Minus} title="Zoom out" s={13} on={() => setView(v => ({ ...v, z: Math.max(0.05, v.z - 0.1) }))} />
          <span style={{ minWidth: 34, textAlign: 'center' }}>{Math.round(view.z * 100)}%</span>
          <IB I={Plus} title="Zoom in" s={13} on={() => setView(v => ({ ...v, z: Math.min(4, v.z + 0.1) }))} />
        </div>
      </main>

      {/* ░░ RIGHT — Design inspector ░░ */}
      <aside style={{ width: rightW, flex: 'none', position: 'relative', borderLeft: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div onPointerDown={startResize('r')} style={handleStyle('left')} />
        <div style={{ height: 40, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 20, padding: '0 16px', flex: 'none' }}>
          {(['design', 'prototype'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, font: `550 11px/16px ${FONT}`, color: tab === t ? INK : 'rgba(0,0,0,0.5)', textTransform: 'capitalize' }}>{t}</button>
          ))}
          <span style={{ marginLeft: 'auto', color: 'rgba(0,0,0,0.5)', font: `450 11px/1 ${FONT}` }}>{Math.round(view.z * 100)}%</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Frame preset + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40, padding: '0 16px', borderBottom: `1px solid ${LINE}` }}>
            <button type="button" style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, font: `550 13px/22px ${FONT}`, letterSpacing: '-0.03px', color: '#000', padding: 0 }}>Frame <CaretDown size={11} color={INK} /></button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              <IB I={DotsNine} title="Select matching layers" s={16} /><IB I={DiamondsFour} title="Create component" s={16} /><IB I={Unite} title="Union" s={16} /><IB I={CaretDown} title="Boolean operations" s={12} />
            </div>
          </div>

          <Sec title="Position" first>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)' }}>Alignment</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Seg><FSegBtn name="alignLeft" pos="l" title="Align left" /><FSegBtn name="alignCenterH" pos="m" title="Align horizontal centers" /><FSegBtn name="alignRight" pos="r" title="Align right" /></Seg>
                <Seg><FSegBtn name="alignTop" pos="l" title="Align top" /><FSegBtn name="alignCenterV" pos="m" title="Align vertical centers" /><FSegBtn name="alignBottom" pos="r" title="Align bottom" /></Seg>
                <FIB name="more" title="More actions" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)' }}>Position</span>
              <FieldRow><Field label="X" value="296" /><Field label="Y" value="341" /></FieldRow>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)' }}>Rotation</span>
              <FieldRow><Field label="↻" value="0°" /><div style={{ display: 'flex', gap: 1, width: '100%' }}><FSegBtn name="rotate" pos="l" fill title="Rotate 90° right" /><FSegBtn name="flipH" pos="m" fill title="Flip horizontal" /><FSegBtn name="flipV" pos="r" fill title="Flip vertical" /></div></FieldRow>
            </div>
          </Sec>

          <Sec title="Auto layout" action={<><IB I={GearSix} title="Settings" s={14} /><IB I={Minus} title="Remove" s={14} /></>}>
            <Seg>{[ArrowsOutCardinal, ArrowDown, ArrowRight, GridFour].map((I, i) => <SegBtn key={i} I={I} pos={i === 0 ? 'l' : i === 3 ? 'r' : 'm'} active={i === 1} title={['Freeform', 'Vertical', 'Horizontal', 'Grid'][i]} />)}</Seg>
            <FieldRow><ResizeField label="W" value="402" mode="Fill" bound /><ResizeField label="H" value="871" mode="Fixed" /><IB I={FrameCorners} title="Lock aspect ratio" s={14} /></FieldRow>
            <FieldRow style={{ alignItems: 'flex-start' }}>
              <AlignGrid sel={1} />
              <Field label="Gap" value="16" bound />
              <IB I={GearSix} title="Spacing mode" s={14} />
            </FieldRow>
            <FieldRow><Field label="⊞" value="0" bound /><Field label="⊟" value="0" /><IB I={FrameCorners} title="Individual padding" s={14} /></FieldRow>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: `400 11px/1 ${FONT}`, cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ width: 12, height: 12, accentColor: SEL }} /> Clip content</label>
          </Sec>

          <Sec title="Appearance" action={<><IB I={Hexagon} title="Apply variable mode" s={13} /><IB I={Eye} title="Visibility" s={14} /></>}>
            <FieldRow><Field label="◑" value="100%" /><Field label="⌜" value="0" /><IB I={FrameCorners} title="Individual corners" s={14} /></FieldRow>
            <FieldRow><span style={{ font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)'}}>Opacity</span><span style={{ font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)'}}>Corner radius</span></FieldRow>
          </Sec>

          <Sec title="Fill" action={<><IB I={SquaresFour} title="Styles" s={14} /><IB I={Plus} title="Add fill" s={14} /></>}>
            {MOCK.fills.map((f, i) => <PaintRow key={i} swatch={f.hex} name={f.hex} op={f.op} />)}
          </Sec>
          <Sec title="Stroke" action={<><IB I={SquaresFour} title="Styles" s={14} /><IB I={Plus} title="Add stroke" s={14} /></>}>
            {MOCK.strokes.map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PaintRow swatch={s.hex} name={s.hex} op={s.op} />
                <Row><span style={{ flex: 1, font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)'}}>Position</span><span style={{ flex: 1, font: `500 9px/14px ${FONT}`, color: 'rgba(0,0,0,0.5)'}}>Weight</span><span style={{ width: 56 }} /></Row>
                <Row><Drop value={s.position} /><Field label="≡" value={String(s.weight)} /><IB I={GearSix} title="Advanced stroke" s={14} /><IB I={SquaresFour} title="Stroke style" s={14} /></Row>
              </div>
            ))}
          </Sec>
          <Sec title="Effects" action={<><IB I={SquaresFour} title="Styles" s={14} /><IB I={Plus} title="Add effect" s={14} /></>}>
            {MOCK.effects.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0, height: 24, borderRadius: 5, background: FIELD, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                  <span style={{ flex: 'none', width: 14, height: 14, borderRadius: 3, background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' }} />
                  <span style={{ flex: 1, font: `450 11px/1 ${FONT}` }}>{e.type}</span>
                </div>
                <IB I={Eye} title="Toggle" s={14} /><IB I={Minus} title="Remove" s={14} />
              </div>
            ))}
          </Sec>
          <Sec title="Selection colors" action={<span style={{ font: `400 10px/1 ${FONT}`, color: MUTE }}>+22</span>}>
            {MOCK.selectionColors.map((c, i) => <PaintRow key={i} swatch={c.hex} name={c.name || c.hex || ''} op={c.op} grad={c.grad} />)}
          </Sec>
          <Sec title="Layout guide" action={<><IB I={SquaresFour} title="Styles" s={14} /><IB I={Plus} title="Add layout guide" s={14} /></>}>
            {MOCK.layoutGuides.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IB I={GridFour} title="Grid" s={14} />
                <Drop value={g.size} />
                <IB I={Eye} title="Toggle" s={14} /><IB I={Minus} title="Remove" s={14} />
              </div>
            ))}
          </Sec>
          <Sec title="Export" action={<IB I={Plus} title="Add export setting" s={14} />}>
            <button type="button" style={{ appearance: 'none', width: '100%', height: 28, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', cursor: 'pointer', font: `500 11px/1 ${FONT}`, color: INK }}>Export Editor 402</button>
          </Sec>
        </div>
      </aside>
      </>)}
    </div>
  )
}
