// Effect Creator V3 — 2D outline editor overlay (blueprint §5.3 / §6.3 / G11 / G12).
// Core toolset per §7a: anchors (drag/add/delete), Smooth, Scale, Shape presets, freehand Draw +
// magnetic snap, magic-blend toggle. Hug and the Round tool are NOT in core (parked/folded — D4/D5;
// engine-level default rounding stays internal). Continuous controls are TickBars (G12) riding the
// §6.3 tick/commit contract. The canvas sits in a safe-area layout between the bars with zoom + pan
// (G11) so every anchor is reachable and the whole image is visible.
// Renders an OutlineDocument over the flat cut-out image: the resolved outline path + draggable
// anchor handles. outline-core is the single source of truth — every edit is a canonical command
// (MoveNode / AddNode / DeleteNode / SetGlobalCornerRadius); the rendered path is DERIVED via
// resolveOutlineDocument. Styling = ONEMO design system tokens (CSS module). No three.js here.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyOutlineCommands,
  resolveOutlineDocument,
  livewirePath,
  rdpClosed,
  repairSimplePolygon,
  nodesFromTracedRing,
  fairTracedRing,
  fairingFromDetail,
  BEN_DEFAULT_DETAIL,
  type FairTracedRingOpts,
  type OutlineDocument,
  type OutlineCommand,
  type Vec2Px,
  type CostGrid,
} from '@/lib/outline-core'
import type { EffectSpecDraft, Contour } from '@/lib/effect/types'
import { buildEdgeCost } from './edgeCost'
import { useOutlineStore } from './outlineStore'
import { UndoIcon, RedoIcon, RoundIcon, SmoothIcon, ScaleIcon, PenIcon, ResetIcon, CheckIcon, CloseIcon, PlusIcon, MinusIcon, AddPointIcon, DeleteIcon, BlendIcon, ShapeIcon, TuneIcon, OutlineIcon, DiceIcon, PreviewIcon, PreviewOffIcon } from './icons'
import TickBar from '../ui/TickBar'
import { toast } from '../ui/Toast'
import { perfGesture } from '../dev/PerfHUD'
import { generateShapeRing, resampleClosed, PARAMETRIC, type ShapeKind, type ShapeParams } from './shapes'
import styles from './outline-editor.module.css'

// Shape chips — Dan's board lineup (Simbolik/LOEWE symbol alphabet) + the two generators.
// Chip icons render from the REAL generator math, so a chip can never lie about its shape.
const SHAPE_CHIPS: { kind: ShapeKind; label: string }[] = [
  { kind: 'pinched', label: 'Pinched' },
  { kind: 'daisy', label: 'Daisy' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'bolt', label: 'Bolt' },
  { kind: 'sparkle', label: 'Sparkle' },
  { kind: 'teardrop', label: 'Drop' },
  { kind: 'leaf', label: 'Leaf' },
  { kind: 'lens', label: 'Lens' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'plus', label: 'Plus' },
  { kind: 'asterisk', label: 'Asterisk' },
  { kind: 'bowtie', label: 'Bowtie' },
  { kind: 'pinwheel', label: 'Pinwheel' },
  { kind: 'pebble', label: 'Pebble' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'square', label: 'Square' },
  { kind: 'squircle', label: 'Squircle' },
  { kind: 'polygon', label: 'Polygon' },
  { kind: 'star', label: 'Star' },
  { kind: 'form', label: 'Form ✦' },
  { kind: 'blob', label: 'Blob ✦' },
]

/** Chip glyph drawn from the SAME ring math as the real shape (24px box, filled). */
function ShapeChipIcon({ kind }: { kind: ShapeKind }) {
  const d = useMemo(() => {
    const ring = generateShapeRing({ kind }, 26, 26)
    return `M ${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`
  }, [kind])
  return <svg width={24} height={24} viewBox="0 0 26 26" aria-hidden><path d={d} fill="currentColor" /></svg>
}

/** Default generator params (persist across picks within an editor session). */
const DEFAULT_SHAPE_PARAMS: Required<Omit<ShapeParams, 'kind' | 'rotateDeg'>> = {
  sides: 6, points: 5, spikiness: 45, lobes: 4, pinch: 50,
  petals: 8, depth: 55, blades: 5, swirl: 50, waviness: 50, seed: 1,
}

interface OutlineEditorProps {
  open: boolean
  imageUrl?: string
  onClose: () => void
}

const VIEW_W = 1000
const VIEW_H = 1000

// Rotate glyph (Phosphor ArrowClockwise, 256-box) drawn inside the rotate handle — white on the brand grip.
const ROTATE_GLYPH_D = 'M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z'

/** Seed a rounded-rect OutlineDocument (used only when there's no cut-out yet). */
function seedDoc(w: number, h: number): OutlineDocument {
  const m = Math.min(w, h) * 0.18
  const corner = { mode: 'inherit' as const }
  const nodes = [
    { id: 'n1', p: [m, m] as Vec2Px, role: 'corner' as const, corner },
    { id: 'n2', p: [w - m, m] as Vec2Px, role: 'corner' as const, corner },
    { id: 'n3', p: [w - m, h - m] as Vec2Px, role: 'corner' as const, corner },
    { id: 'n4', p: [m, h - m] as Vec2Px, role: 'corner' as const, corner },
  ]
  const base = {
    rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }],
    style: { globalOutlineCornerRadiusPx: Math.min(w, h) * 0.06, smoothing: 0 },
  }
  return applyOutlineCommands(base, [], {
    image: { widthPx: w, heightPx: h, sourceHash: 'seed', orientation: 'baked' },
    mode: 'semi_auto',
  })
}

/**
 * Build an editable OutlineDocument from the REAL BEN2 cut-out contour (A1d). The dense smoothed
 * contour is simplified to a control ring (rdpClosed); the rounding is already baked into the
 * points, so the global corner radius starts at 0 (no double-round). Coordinates: mm → mask px.
 */
/**
 * Self-correcting default rounding: the largest global corner radius in [0, hi] that resolves WITHOUT a
 * self-intersection. Binary-searches resolve(doc @ r) — so "max rounded" adapts to each shape instead
 * of a blind value that might cross on tight geometry.
 */
function maxSafeGlobalRadius(doc: OutlineDocument, hi: number): number {
  const clean = (r: number) =>
    resolveOutlineDocument({ ...doc, style: { ...doc.style, globalOutlineCornerRadiusPx: r } }, { flattenTolerancePx: 0.5 }).issues.length === 0
  if (clean(hi)) return hi
  let lo = 0, h = hi
  for (let i = 0; i < 14 && h - lo > 2; i++) { const m = (lo + h) / 2; if (clean(m)) lo = m; else h = m }
  return Math.floor(lo)
}

function docFromSpec(spec: EffectSpecDraft): OutlineDocument {
  const W = spec.maskWidthPx, H = spec.maskHeightPx
  const k = spec.mmPerPx || 1
  const organic = spec.generator.adapter !== 'standard'
  // Control-node simplification tolerance — the EDITABLE handle density only. Organic outlines keep
  // the EXACT dense contour as segment rawPolylines (traced ring): the rendered/cut shape is the
  // true trace, not an approximation through the anchors (the clipped-corner/wobble bug).
  const eps = Math.max(2, Math.max(W, H) * 0.022)
  // geometryMM is y-UP (the mask is loaded y-up so the 3D is upright — segment-ml.ts/mask.ts). The
  // editor draws the raw photo y-DOWN via SVG, so flip Y here to overlay the outline right-side-up on
  // the image. The editor→3D feedback re-flips (H − y) back to the engine's y-up space, so they cancel.
  const minSpacing = Math.max(3, Math.max(W, H) * 0.008)
  const toEditorPx = (ptsMM: [number, number][]) => ptsMM.map(([x, y]) => [x / k, H - y / k] as Vec2Px)
  const toRing = (ptsMM: [number, number][], prefix: string) =>
    organic
      ? nodesFromTracedRing(toEditorPx(ptsMM), eps, prefix)
      : repairSimplePolygon(rdpClosed(toEditorPx(ptsMM), eps), minSpacing).map((p, i) => ({
          id: `${prefix}${i}`, p, role: 'corner' as const, corner: { mode: 'inherit' as const },
        }))
  const rings: OutlineDocument['rings'] = [
    { id: 'r1', role: 'outer', closed: true, nodes: toRing(spec.geometryMM.outer.pts, 'o') },
  ]
  spec.geometryMM.holes.forEach((h, hi) => {
    rings.push({ id: `h${hi}`, role: 'hole', parentRingId: 'r1', closed: true, nodes: toRing(h.pts, `h${hi}n`) })
  })
  // Square path: default to MAXIMUM safe corner rounding. Traced organic rings bypass radii — exact.
  const env = { image: { widthPx: W, heightPx: H, sourceHash: spec.sourceRef.slice(0, 40), orientation: 'baked' as const }, mode: 'auto' as const }
  const probe = applyOutlineCommands({ rings, style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 } }, [], env)
  const safe = organic ? 0 : maxSafeGlobalRadius(probe, Math.round(Math.min(W, H) * 0.25))
  const base = { rings, style: { globalOutlineCornerRadiusPx: safe, smoothing: 0 } }
  return applyOutlineCommands(base, [], env)
}

/** Build an OutlineDocument from a single outer ring of points (shapes / draw). `minSpacingPx`
 *  controls anchor merging — dense parametric rings pass a SMALL value so points merge EVENLY
 *  (the default coarse merge ate points irregularly → "slightly uneven curves", Dan 2026-06-10). */
function docFromRings(outerPts: Vec2Px[], image: OutlineDocument['image'], defaultRadiusPx = 0, minSpacingPx?: number): OutlineDocument {
  const clean = repairSimplePolygon(outerPts, minSpacingPx ?? Math.max(3, Math.max(image.widthPx, image.heightPx) * 0.008))
  const nodes = (clean.length >= 3 ? clean : outerPts).map((p, i) => ({ id: `b${i}`, p, role: 'corner' as const, corner: { mode: 'inherit' as const } }))
  const base = { rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }], style: { globalOutlineCornerRadiusPx: defaultRadiusPx, smoothing: 0 } }
  return applyOutlineCommands(base, [], { image, mode: 'semi_auto' })
}

/** Outer-ring bbox center (px). */
function outerCenter(doc: OutlineDocument): Vec2Px {
  const outer = doc.rings.find((r) => r.role === 'outer')
  const pts = outer?.nodes.map((n) => n.p) ?? []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

/** Scale every node position about the outer-ring center, preserving node ids + corner specs. */
function scaleDoc(doc: OutlineDocument, factor: number): OutlineDocument {
  const [cx, cy] = outerCenter(doc)
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [cx + (n.p[0] - cx) * factor, cy + (n.p[1] - cy) * factor] as Vec2Px })) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Rotate every node position about the outer-ring center by `deg` (mobile twist / desktop handle). */
function rotateDoc(doc: OutlineDocument, deg: number): OutlineDocument {
  const [cx, cy] = outerCenter(doc)
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => { const dx = n.p[0] - cx, dy = n.p[1] - cy; return { ...n, p: [cx + dx * c - dy * s, cy + dx * s + dy * c] as Vec2Px } }) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Translate every node by (dx,dy) — drag the whole outline to reposition it within the image. */
function translateDoc(doc: OutlineDocument, dx: number, dy: number): OutlineDocument {
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [n.p[0] + dx, n.p[1] + dy] as Vec2Px })) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Anisotropic stretch about an anchor point — the crop-grip bake (pull a side: square → rectangle).
 *  Corner radius SPECS are positions-independent, so a rounded square keeps its rounding. */
function stretchDoc(doc: OutlineDocument, sx: number, sy: number, ax: number, ay: number): OutlineDocument {
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [ax + (n.p[0] - ax) * sx, ay + (n.p[1] - ay) * sy] as Vec2Px })) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Which crop grip — mid-edges stretch one axis at that edge; corners stretch both adjacent edges. */
type GripId = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

/** Outer-ring bbox (px). */
function outerBbox(doc: OutlineDocument): { minX: number; minY: number; maxX: number; maxY: number } {
  const outer = doc.rings.find((r) => r.role === 'outer')
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of outer?.nodes ?? []) { const [x, y] = n.p; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

/** Ray-cast point-in-polygon — used to detect a tap inside the cut area (→ select all corners). */
function pointInPolygon(p: Vec2Px, poly: Vec2Px[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
    const hit = (yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

/** Closest point on segment ab to p, with squared distance. */
function projectToSeg(p: Vec2Px, a: Vec2Px, b: Vec2Px): { pt: Vec2Px; d2: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const pt: Vec2Px = [a[0] + t * dx, a[1] + t * dy]
  const ex = p[0] - pt[0], ey = p[1] - pt[1]
  return { pt, d2: ex * ex + ey * ey }
}

/** A touch-target toolbar button: icon over a tiny label (mobile-first). */
function ToolBtn({ icon, label, onClick, disabled, active, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; primary?: boolean
}) {
  return (
    <button
      type="button"
      className={`${styles.tool} ${active ? styles.toolActive : ''} ${primary ? styles.toolPrimary : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
    >
      <span className={styles.toolIcon}>{icon}</span>
      <span className={styles.toolLabel}>{label}</span>
    </button>
  )
}

/** Top-bar tool — same icon-over-label mobile style as the bottom tools, fixed width (doesn't stretch). */
function TopTool({ icon, label, onClick, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button type="button" className={styles.topTool} onClick={onClick} disabled={disabled} aria-label={label}>
      <span className={styles.toolIcon}>{icon}</span>
      <span className={styles.topToolLabel}>{label}</span>
    </button>
  )
}

export default function OutlineEditor({ open, imageUrl, onClose }: OutlineEditorProps) {
  const [doc, setDoc] = useState<OutlineDocument>(() => seedDoc(VIEW_W, VIEW_H))
  const [drag, setDrag] = useState<{ ringId: string; nodeId: string; pos: Vec2Px } | null>(null)
  const [radius, setRadius] = useState(0)        // Round: global (or selected-corner) radius px
  const [maxRadius, setMaxRadius] = useState(120) // Round tick-bar range (¼ of the short side)
  const [smoothing, setSmoothing] = useState(0) // 0–100 → style.smoothing 0..1 (Catmull-Rom spline)
  const [scale, setScale] = useState(100) // 50–150 relative resize of the whole cut-out; bakes on release
  const [drawPts, setDrawPts] = useState<Vec2Px[] | null>(null) // non-null = Manual draw in progress (A3a)
  const [edgeCost, setEdgeCost] = useState<CostGrid | null>(null) // image edge-cost grid for the livewire (A3b)
  const [selectedNode, setSelectedNode] = useState<{ ringId: string; nodeId: string } | null>(null) // anchor add/delete target
  const [activeAdjust, setActiveAdjust] = useState<'round' | 'smooth' | 'scale' | 'blend' | 'shape' | 'tune' | null>(null) // which adjustment sheet is revealed (mobile: one at a time)
  const [blendOn, setBlendOn] = useState(true) // "magic blend" on/off (the soft real-background blur on the 3D front)
  const [blendBlur, setBlendBlur] = useState(50) // magic-blend intensity 0–100 (50 ≈ the build default)
  // Shape tool: pick a preset/parametric shape as the starting outline. shapeKind = the shape currently
  // being tuned (null = none picked this session → only chips show). Params drive live regeneration.
  const [shapeKind, setShapeKind] = useState<ShapeKind | null>(null)
  // one params object for every parametric shape/generator (ref mirrors it so rapid stepper taps
  // and tick storms read the latest values — state closures lag)
  const [shapeParams, setShapeParams] = useState({ ...DEFAULT_SHAPE_PARAMS })
  const shapeParamsRef = useRef(shapeParams)
  useEffect(() => { shapeParamsRef.current = shapeParams }, [shapeParams])
  const [shapePreview, setShapePreview] = useState<OutlineDocument | null>(null) // live morph while dragging a shape control
  // BEN runtime tuning (Dan, 2026-06-10): re-fair the RAW trace with live params so the optimal
  // settings are found by testing in the run, not guessed. detail = the master 0–100 dial;
  // fairParams = the advanced per-knob values (master commit re-derives them via fairingFromDetail).
  const [detail, setDetail] = useState(BEN_DEFAULT_DETAIL)
  const detailRef = useRef(detail)
  useEffect(() => { detailRef.current = detail }, [detail])
  const [fairParams, setFairParams] = useState<FairTracedRingOpts>(() => fairingFromDetail(BEN_DEFAULT_DETAIL))
  const [tunePreview, setTunePreview] = useState<OutlineDocument | null>(null) // live re-fair while dragging a tune bar
  // Rotation = a whole-outline transform: two-finger twist (mobile) / drag the rotate handle (desktop,
  // shown when all anchors are selected). rotatePreview = the live rotated doc; baked (undoable) on release.
  // Live direct-manipulation transforms — cheap SVG transform during the gesture, baked to the doc on
  // release (so it's real-time, not a per-move document rebuild). rotateLive = rotate about center;
  // moveLive = translate the whole outline.
  const [rotateLive, setRotateLive] = useState<{ deg: number; cx: number; cy: number } | null>(null)
  const rotateLiveRef = useRef<{ deg: number; cx: number; cy: number } | null>(null)
  const [moveLive, setMoveLive] = useState<{ dx: number; dy: number } | null>(null)
  const moveLiveRef = useRef<{ dx: number; dy: number } | null>(null)
  // Crop-style stretch (Dan, 2026-06-10): boxy shapes get iOS-crop grips — pull a mid-edge to
  // stretch at that line (square→rectangle), pull a corner to stretch both adjacent edges. Live
  // SVG transform during the gesture; baked (undoable) on release.
  const [stretchLive, setStretchLive] = useState<{ sx: number; sy: number; ax: number; ay: number } | null>(null)
  const stretchRef = useRef<{ which: GripId; ax: number; ay: number; bbox: { minX: number; minY: number; maxX: number; maxY: number }; sx: number; sy: number } | null>(null)
  const rotateRef = useRef<{ cx: number; cy: number; start: number } | null>(null) // desktop handle drag (rotation lives on the handle; two-finger = canvas pinch, G11)
  const moveRef = useRef<{ start: Vec2Px; bbox: { minX: number; minY: number; maxX: number; maxY: number } } | null>(null) // drag-inside-to-move
  const pointersRef = useRef<Map<number, Vec2Px>>(new Map())
  // pre-edit snapshot captured on open → "Close" (✕) discards this session's edits and reverts the 3D;
  // "Done" (✓) keeps them. Holds the 3D contour, the persisted editor doc, and the blend at open time.
  const preEditRef = useRef<{ contourMM: Contour | null; editedDoc: OutlineDocument | null; bgBlur: number | null }>({ contourMM: null, editedDoc: null, bgBlur: null })
  const [allSelected, setAllSelected] = useState(false) // tap inside the cut → select every corner, edit them together
  const [freehandPreview, setFreehandPreview] = useState<Vec2Px[] | null>(null) // live freehand stroke (A3d)
  const freehandRef = useRef<Vec2Px[] | null>(null)
  const freehandMovedRef = useRef(false)
  const nodeInteractedRef = useRef(false) // a node tap just happened → suppress the bubbling surface-click (which would re-select all)
  const dragStartRef = useRef<Vec2Px | null>(null) // pointer-down point → distinguish a tap (select) from a drag (move)
  const svgRef = useRef<SVGSVGElement>(null)
  // G11 canvas view: zoom + pan expressed AS the viewBox (so getScreenCTM().inverse() keeps every
  // gesture's px math correct with zero per-handler changes). scale 1 = fit; vx/vy = view origin.
  const [view, setView] = useState<{ scale: number; vx: number; vy: number }>({ scale: 1, vx: 0, vy: 0 })
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  const pinchRef = useRef<{ d0: number; scale0: number; c0: Vec2Px } | null>(null) // two-finger pinch zoom (client-space)
  const canvasPanRef = useRef<{ startClient: Vec2Px; vx0: number; vy0: number } | null>(null) // drag-outside pan (zoomed)
  const clientPtsRef = useRef<Map<number, Vec2Px>>(new Map()) // pointerId → CLIENT coords (pinch math)
  const idRef = useRef(0)
  const spec = useOutlineStore((s) => s.spec)
  const setEditedContourMM = useOutlineStore((s) => s.setEditedContourMM)
  const setBgBlur = useOutlineStore((s) => s.setBgBlur)
  const subjMatteUrl = useOutlineStore((s) => s.subjMatteUrl)
  const [preview, setPreview] = useState(false) // hide anchors/handles to see the clean result (no exit)
  // Points toggle (Dan, 2026-06-10): anchors stay ON for free-form outlines but OFF for rigid
  // parametric shapes — a circle has ~60 vertices; one stray drag spoils it. Toggle in the topbar.
  const [showAnchors, setShowAnchors] = useState(true)
  const dirtyRef = useRef(false) // true once the user has actually edited (so the 3D follows edits, not the open)

  // Undo/redo (A1b): a doc-snapshot history. Covers BOTH command edits (move/add/delete/corner/smooth)
  // and whole-doc generator swaps (blend/draw/simplify/reset) uniformly. docRef mirrors the latest doc
  // so the wrapper can snapshot the pre-edit state without stale closures.
  const docRef = useRef(doc)
  useEffect(() => { docRef.current = doc }, [doc])
  const histRef = useRef<{ past: OutlineDocument[]; future: OutlineDocument[] }>({ past: [], future: [] })
  const [, bumpHist] = useState(0)
  const applyDoc = useCallback((next: OutlineDocument) => {
    histRef.current.past.push(docRef.current)
    if (histRef.current.past.length > 50) histRef.current.past.shift()
    histRef.current.future = []
    dirtyRef.current = true
    docRef.current = next
    setDoc(next)
    useOutlineStore.getState().setEditedDoc(next) // persist so reopening restores edits
    bumpHist((v) => v + 1)
  }, [])
  const syncSlidersTo = useCallback((d: OutlineDocument) => {
    setRadius(d.style.globalOutlineCornerRadiusPx)
    setSmoothing(Math.round(d.style.smoothing * 100))
    setScale(100)
    setSelectedNode(null)
    setAllSelected(false)
    setDrag(null)
  }, [])
  const undo = useCallback(() => {
    const h = histRef.current
    if (!h.past.length) return
    const prev = h.past.pop()!
    h.future.unshift(docRef.current)
    dirtyRef.current = true
    docRef.current = prev
    setDoc(prev)
    useOutlineStore.getState().setEditedDoc(prev)
    syncSlidersTo(prev)
    bumpHist((v) => v + 1)
  }, [syncSlidersTo])
  const redo = useCallback(() => {
    const h = histRef.current
    if (!h.future.length) return
    const next = h.future.shift()!
    h.past.push(docRef.current)
    dirtyRef.current = true
    docRef.current = next
    setDoc(next)
    useOutlineStore.getState().setEditedDoc(next)
    syncSlidersTo(next)
    bumpHist((v) => v + 1)
  }, [syncSlidersTo])

  // Build a fresh edit doc from the current cut-out each time the editor opens (A1d).
  useEffect(() => {
    if (!open) return
    // Snapshot the pre-edit state so ✕ Close can discard this session's edits (revert the 3D + persisted doc).
    const st0 = useOutlineStore.getState()
    preEditRef.current = { contourMM: st0.editedContourMM ?? (spec ? spec.geometryMM : null), editedDoc: st0.editedDoc, bgBlur: st0.bgBlur }
    // Restore prior edits if they belong to the current cut-out; else derive a fresh editable contour.
    const stored = useOutlineStore.getState().editedDoc
    const useStored = !!stored && !!spec && stored.image.sourceHash === spec.sourceRef.slice(0, 40)
    const d = useStored ? stored! : spec ? docFromSpec(spec) : seedDoc(VIEW_W, VIEW_H)
    setDoc(d)
    setRadius(d.style.globalOutlineCornerRadiusPx)
    setMaxRadius(Math.round(Math.min(d.image.widthPx, d.image.heightPx) * 0.25))
    setSmoothing(Math.round(d.style.smoothing * 100))
    setScale(100)
    setView({ scale: 1, vx: 0, vy: 0 }) // G11: fresh session starts at fit
    setDrag(null)
    setDrawPts(null)
    setSelectedNode(null)
    setAllSelected(false)
    setActiveAdjust(null)
    setShapeKind(null)
    setShapePreview(null)
    setTunePreview(null)
    {
      // #21: Dan's tuned settings are the defaults — restore them, never reset to factory
      const saved = useOutlineStore.getState().fairing
      setDetail(saved?.detail ?? BEN_DEFAULT_DETAIL)
      setFairParams(saved?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL))
    }
    setRotateLive(null); rotateLiveRef.current = null; rotateRef.current = null
    setMoveLive(null); moveLiveRef.current = null; moveRef.current = null
    pinchRef.current = null; canvasPanRef.current = null
    pointersRef.current.clear(); clientPtsRef.current.clear()
    useOutlineStore.getState().setEditorOpen(true) // §6.3: scene frozen → 3D rebuilds defer to close
    setPreview(false)
    setShowAnchors(true)
    // sync the magic-blend control to the current 3D state (null = build default ≈ on @ 50%)
    const curBlur = useOutlineStore.getState().bgBlur
    setBlendOn(curBlur == null || curBlur > 0)
    setBlendBlur(curBlur == null ? 50 : curBlur > 0 ? Math.round(curBlur * 100) : 50)
    setEdgeCost(null)
    dirtyRef.current = false // opening is not an edit — don't drive the 3D until the user changes something
    // Dan (2026-06-10): entering the editor BEFORE Magic means "choose a shape" — the full-bleed
    // standard square buries its handles at the image edges. Open the Shape sheet with Square
    // preselected and show the centered square as the starting selection (NOT dirty — it becomes
    // real only when the user commits an edit / picks a chip).
    let opened = d
    if (!useStored && spec && spec.generator.adapter === 'standard' && !useOutlineStore.getState().editedContourMM) {
      const ring = generateShapeRing({ kind: 'square' }, d.image.widthPx, d.image.heightPx)
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity
      for (const [x, y] of ring) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y }
      // default rounding lives in the DOC (committed truth, ~8mm-on-70mm product language) — NOT a
      // slider transient. The old radius-0 seed left the Round slider synced to the discarded
      // full-bleed doc, so the square RENDERED rounded while the document was sharp (undo exposed
      // it — caught live 2026-06-10).
      const defaultR = Math.round(Math.min(mxx - mnx, mxy - mny) * 0.12)
      opened = docFromRings(ring, d.image, defaultR)
      setDoc(opened)
      setRadius(defaultR)
      setActiveAdjust('shape')
      setShapeKind('square')
      setShowAnchors(false) // rigid shape default — Points toggle re-enables
    }
    docRef.current = opened
    histRef.current = { past: [], future: [] } // fresh undo history per editing session
    if (imageUrl) {
      const prior = spec
        ? spec.geometryMM.outer.pts.map(([x, y]) => [(x / (spec.mmPerPx || 1)) / spec.maskWidthPx, (y / (spec.mmPerPx || 1)) / spec.maskHeightPx] as [number, number])
        : undefined
      buildEdgeCost(imageUrl, 600, prior).then(setEdgeCost).catch(() => setEdgeCost(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = useCallback(
    (cmd: OutlineCommand) => {
      const d = docRef.current
      try {
        applyDoc(applyOutlineCommands(d.baseSnapshot, [...d.commands, cmd], { image: d.image, mode: d.mode }))
      } catch (e) {
        // Replay desync (command/node ids vs baseSnapshot — the V1 silent-edit-loss bug):
        // self-heal by REBASING — the current rings/style become a fresh baseSnapshot and the new command
        // applies on top, so the user's edit is never silently discarded. G4: failures SPEAK.
        console.warn('[outline-editor] replay desync — rebasing onto current doc:', e)
        try {
          applyDoc(applyOutlineCommands({ rings: d.rings, style: d.style, generator: d.generator }, [cmd], { image: d.image, mode: d.mode }))
        } catch (e2) {
          console.error('[outline-editor] commit failed even after rebase — edit dropped:', e2)
          toast('error', 'That edit could not be applied — nothing was changed')
        }
      }
    },
    [applyDoc],
  )

  // Display doc reflects the in-flight drag + live transient controls (instant, §6.3 preview-only).
  // Round is BACK as its own control (use proved it ≠ Smooth): exact arc radius, per-corner when a
  // node is selected; Smooth = organic spline softening.
  const displayDoc = useMemo(() => {
    let d: OutlineDocument = doc
    if (selectedNode) {
      d = { ...doc, rings: doc.rings.map((r) => (r.id !== selectedNode.ringId ? r : { ...r, nodes: r.nodes.map((n) => (n.id === selectedNode.nodeId ? { ...n, corner: { ...n.corner, mode: 'manual' as const, outlineCornerRadiusPx: radius } } : n)) })) }
    } else if (radius !== doc.style.globalOutlineCornerRadiusPx) {
      d = { ...doc, style: { ...doc.style, globalOutlineCornerRadiusPx: radius } }
    }
    // live Smooth control (transient)
    const sm = smoothing / 100
    if (sm !== d.style.smoothing) d = { ...d, style: { ...d.style, smoothing: sm } }
    // live scale preview — resize all node positions about the center (bakes on release)
    if (scale !== 100) {
      const [cx, cy] = outerCenter(d)
      const f = scale / 100
      d = { ...d, rings: d.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [cx + (n.p[0] - cx) * f, cy + (n.p[1] - cy) * f] as Vec2Px })) })) }
    }
    if (drag) {
      d = { ...d, rings: d.rings.map((r) => (r.id !== drag.ringId ? r : { ...r, nodes: r.nodes.map((n) => (n.id === drag.nodeId ? { ...n, p: drag.pos } : n)) })) }
    }
    return d
  }, [doc, drag, radius, selectedNode, smoothing, scale])

  // Live morphs supersede the normal display: tune re-fair > shape-tool preview > doc.
  const shown = tunePreview ?? shapePreview ?? displayDoc
  const resolved = useMemo(() => resolveOutlineDocument(shown, { flattenTolerancePx: 0.15 }), [shown])
  const hasIssues = resolved.issues.length > 0 // inline manufacturability guardrail (self-intersection etc.)

  // editor → 3D: push the COMMITTED resolved outline (mm) so the 3D suede object follows real edits
  // (ADDENDUM D step 4 "the 3D follows" / step 8 "what you approve is what's made"). Keyed on the
  // committed `doc` (not the transient drag), so the 3D updates on commit — 2D leads, 3D lags.
  useEffect(() => {
    if (!open || !spec || !dirtyRef.current) return
    const res = resolveOutlineDocument(doc, { flattenTolerancePx: 0.15 })
    if (res.issues.length) return // never push an un-manufacturable (self-intersecting) shape to the 3D
    const k = spec.mmPerPx || 1
    const H = doc.image.heightPx
    // The mesh maps image-top→3D-bottom for GEOMETRY while the texture's flipY keeps the IMAGE upright
    // (invisible on a symmetric shape, but it mirrors an asymmetric EDIT). Feed Y in the engine's
    // upright-geometry space (flip within image height) so an edit at the top of the editor lands at
    // the top of the 3D object — WYSIWYG. The Y-flip reflects the ring → reverse it to keep the
    // mesh's expected winding (outer CCW / holes CW) so edge normals + inset stay outward.
    const toMM = (ring: Vec2Px[]): Vec2Px[] => ring.map(([x, y]) => [x * k, (H - y) * k] as Vec2Px).reverse()
    const outerIdx = doc.rings.findIndex((r) => r.role === 'outer')
    if (outerIdx < 0 || !res.flattenedRingsPx[outerIdx]?.length) return
    const outer = toMM(res.flattenedRingsPx[outerIdx])
    const holes = doc.rings
      .map((r, i) => (r.role === 'hole' && res.flattenedRingsPx[i]?.length ? toMM(res.flattenedRingsPx[i]) : null))
      .filter((h): h is Vec2Px[] => h !== null)
    setEditedContourMM({ outer: { pts: outer }, holes: holes.map((h) => ({ pts: h })) })
  }, [doc, open, spec, setEditedContourMM])

  // Draw the RESOLVED (unflattened) rings: the manufacturing flatten's chord tolerance read as
  // visible facets on curves at editor zoom (Dan, 2026-06-10). Flattened stays for mm export.
  const pathD = useMemo(
    () =>
      resolved.resolvedRingsPx
        .map((ring) => (ring.length ? `M ${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z` : ''))
        .join(' '),
    [resolved],
  )

  // Manual draw path: between placed anchors, SNAP to image edges via the livewire when an edge-cost
  // grid is available (A3b magnetic lasso); otherwise straight segments (A3a, e.g. no image).
  const drawPath = useMemo<Vec2Px[]>(() => {
    const pts = drawPts
    if (!pts || pts.length === 0) return []
    if (!edgeCost || pts.length < 2) return pts
    const W = doc.image.widthPx, H = doc.image.heightPx, gw = edgeCost.width, gh = edgeCost.height
    const toGrid = (p: Vec2Px): [number, number] => [(p[0] / W) * gw, (p[1] / H) * gh]
    const toView = (c: [number, number]): Vec2Px => [((c[0] + 0.5) / gw) * W, ((c[1] + 0.5) / gh) * H]
    const out: Vec2Px[] = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const cells = livewirePath(edgeCost, toGrid(pts[i - 1]), toGrid(pts[i]))
      for (let j = 1; j < cells.length; j++) out.push(toView(cells[j]))
    }
    return out
  }, [drawPts, edgeCost, doc.image])

  // G11 view helpers — the viewBox IS the zoom/pan state: viewBox = `vx vy W/scale H/scale`.
  // screenToContent mirrors preserveAspectRatio="xMidYMid meet" for an arbitrary scale/origin, so
  // pinch/wheel math can solve for the new origin that pins a content point under the cursor.
  const screenToContent = useCallback((clientX: number, clientY: number, v: { scale: number; vx: number; vy: number }): Vec2Px => {
    const svg = svgRef.current
    const W = docRef.current.image.widthPx, H = docRef.current.image.heightPx
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    const vbW = W / v.scale, vbH = H / v.scale
    const k = Math.min(rect.width / vbW, rect.height / vbH) // 'meet'
    const padX = (rect.width - vbW * k) / 2, padY = (rect.height - vbH * k) / 2
    return [v.vx + (clientX - rect.left - padX) / k, v.vy + (clientY - rect.top - padY) / k]
  }, [])

  /** Solve the view origin that places content point c under client point (clientX, clientY) at `scale`. */
  const originPinning = useCallback((c: Vec2Px, clientX: number, clientY: number, scale: number): { vx: number; vy: number } => {
    const svg = svgRef.current
    const W = docRef.current.image.widthPx, H = docRef.current.image.heightPx
    if (!svg) return { vx: 0, vy: 0 }
    const rect = svg.getBoundingClientRect()
    const vbW = W / scale, vbH = H / scale
    const k = Math.min(rect.width / vbW, rect.height / vbH)
    const padX = (rect.width - vbW * k) / 2, padY = (rect.height - vbH * k) / 2
    const vx = c[0] - (clientX - rect.left - padX) / k
    const vy = c[1] - (clientY - rect.top - padY) / k
    // clamp so the view window stays on the content
    return {
      vx: Math.max(0, Math.min(W - vbW, vx)),
      vy: Math.max(0, Math.min(H - vbH, vy)),
    }
  }, [])

  const applyZoom = useCallback((focusClientX: number, focusClientY: number, newScaleRaw: number, from: { scale: number; vx: number; vy: number }) => {
    const newScale = Math.max(1, Math.min(6, newScaleRaw))
    const c = screenToContent(focusClientX, focusClientY, from)
    const { vx, vy } = originPinning(c, focusClientX, focusClientY, newScale)
    setView({ scale: newScale, vx: newScale === 1 ? 0 : vx, vy: newScale === 1 ? 0 : vy })
  }, [screenToContent, originPinning])

  const toViewBox = useCallback((clientX: number, clientY: number): Vec2Px => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const m = svg.getScreenCTM()
    if (!m) return [0, 0]
    const loc = pt.matrixTransform(m.inverse())
    return [loc.x, loc.y]
  }, [])

  const onNodeDown = useCallback(
    (ringId: string, nodeId: string) => (e: React.PointerEvent) => {
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      nodeInteractedRef.current = true
      setAllSelected(false)
      setSelectedNode({ ringId, nodeId })
      const node = doc.rings.find((r) => r.id === ringId)?.nodes.find((n) => n.id === nodeId)
      setRadius(node?.corner.outlineCornerRadiusPx ?? doc.style.globalOutlineCornerRadiusPx)
      const at = toViewBox(e.clientX, e.clientY)
      dragStartRef.current = at
      setDrag({ ringId, nodeId, pos: at })
    },
    [toViewBox, doc],
  )

  // Surface pointer-down: track active pointers (for the two-finger twist), and start a freehand stroke
  // in draw mode. A second surface pointer (while not dragging a node) arms the rotate gesture.
  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (preview) return // view-only
      const p = toViewBox(e.clientX, e.clientY)
      pointersRef.current.set(e.pointerId, p)
      clientPtsRef.current.set(e.pointerId, [e.clientX, e.clientY])
      if (drawPts !== null) {
        freehandRef.current = [p]
        freehandMovedRef.current = false
        return
      }
      // a second surface finger → PINCH: canvas zoom + pan (G11). Rotation stays on the handle.
      if (pointersRef.current.size === 2 && !drag) {
        moveRef.current = null; setMoveLive(null); moveLiveRef.current = null
        canvasPanRef.current = null
        const cp = [...clientPtsRef.current.values()]
        const d0 = Math.hypot(cp[1][0] - cp[0][0], cp[1][1] - cp[0][1]) || 1
        const cMid: Vec2Px = [(cp[0][0] + cp[1][0]) / 2, (cp[0][1] + cp[1][1]) / 2]
        pinchRef.current = { d0, scale0: viewRef.current.scale, c0: screenToContent(cMid[0], cMid[1], viewRef.current) }
        return
      }
      // single finger pressed INSIDE the outline → arm a move (tap vs drag decided by the threshold)
      const oi = docRef.current.rings.findIndex((r) => r.role === 'outer')
      const ring = oi >= 0 ? resolved.flattenedRingsPx[oi] : null
      if (ring && ring.length >= 3 && pointInPolygon(p, ring)) {
        moveRef.current = { start: p, bbox: outerBbox(docRef.current) }
      } else if (viewRef.current.scale > 1.01) {
        // outside the outline while zoomed in → pan the canvas (G11 fine edge work)
        canvasPanRef.current = { startClient: [e.clientX, e.clientY], vx0: viewRef.current.vx, vy0: viewRef.current.vy }
      }
    },
    [drawPts, toViewBox, drag, resolved, preview, screenToContent],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, toViewBox(e.clientX, e.clientY))
      if (clientPtsRef.current.has(e.pointerId)) clientPtsRef.current.set(e.pointerId, [e.clientX, e.clientY])
      // two-finger pinch → canvas zoom (G11): pin the start centroid's content point under the live centroid
      if (pinchRef.current && clientPtsRef.current.size >= 2) {
        const cp = [...clientPtsRef.current.values()]
        const d = Math.hypot(cp[1][0] - cp[0][0], cp[1][1] - cp[0][1]) || 1
        const mid: Vec2Px = [(cp[0][0] + cp[1][0]) / 2, (cp[0][1] + cp[1][1]) / 2]
        const { d0, scale0, c0 } = pinchRef.current
        const newScale = Math.max(1, Math.min(6, scale0 * (d / d0)))
        const { vx, vy } = originPinning(c0, mid[0], mid[1], newScale)
        setView({ scale: newScale, vx: newScale === 1 ? 0 : vx, vy: newScale === 1 ? 0 : vy })
        return
      }
      // single-finger canvas pan while zoomed (armed outside the outline)
      if (canvasPanRef.current) {
        const { startClient, vx0, vy0 } = canvasPanRef.current
        const svg = svgRef.current
        if (svg) {
          const W = docRef.current.image.widthPx, H = docRef.current.image.heightPx
          const v = viewRef.current
          const rect = svg.getBoundingClientRect()
          const vbW = W / v.scale, vbH = H / v.scale
          const k = Math.min(rect.width / vbW, rect.height / vbH)
          const vx = Math.max(0, Math.min(W - vbW, vx0 - (e.clientX - startClient[0]) / k))
          const vy = Math.max(0, Math.min(H - vbH, vy0 - (e.clientY - startClient[1]) / k))
          setView({ scale: v.scale, vx, vy })
        }
        return
      }
      // desktop rotate handle → live rotate (cheap SVG transform; doc bakes on release)
      if (rotateRef.current) {
        const at = toViewBox(e.clientX, e.clientY)
        const { cx, cy, start } = rotateRef.current
        const live = { deg: ((Math.atan2(at[1] - cy, at[0] - cx) - start) * 180) / Math.PI, cx, cy }
        rotateLiveRef.current = live; setRotateLive(live)
        return
      }
      // drag inside → live move (translate), clamped so the outline stays within the image
      if (moveRef.current) {
        const at = toViewBox(e.clientX, e.clientY)
        const { start, bbox } = moveRef.current
        const W = doc.image.widthPx, H = doc.image.heightPx
        let dx = at[0] - start[0], dy = at[1] - start[1]
        dx = Math.max(-bbox.minX, Math.min(W - bbox.maxX, dx))
        dy = Math.max(-bbox.minY, Math.min(H - bbox.maxY, dy))
        if (moveLiveRef.current || Math.hypot(dx, dy) > 2) { // past the tap threshold → it's a move
          const live = { dx, dy }
          moveLiveRef.current = live; setMoveLive(live)
          nodeInteractedRef.current = true // suppress the click that would otherwise re-select-all
        }
        return
      }
      if (drag) { setDrag({ ...drag, pos: toViewBox(e.clientX, e.clientY) }); return }
      if (drawPts !== null && freehandRef.current) {
        const p = toViewBox(e.clientX, e.clientY)
        freehandRef.current.push(p)
        const a = freehandRef.current[0]
        if (Math.hypot(p[0] - a[0], p[1] - a[1]) > Math.max(doc.image.widthPx, doc.image.heightPx) * 0.02) freehandMovedRef.current = true
        setFreehandPreview([...freehandRef.current])
      }
    },
    [drag, drawPts, toViewBox, doc.image, originPinning],
  )

  const commitRotate = useCallback(() => {
    const rl = rotateLiveRef.current
    if (rl && Math.abs(rl.deg) > 0.01) applyDoc(rotateDoc(docRef.current, rl.deg))
    rotateLiveRef.current = null; setRotateLive(null)
    nodeInteractedRef.current = true // suppress the click that follows so it doesn't re-select-all
  }, [applyDoc])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    clientPtsRef.current.delete(e.pointerId)
    if (pinchRef.current) { if (clientPtsRef.current.size < 2) pinchRef.current = null; return }
    if (canvasPanRef.current) { canvasPanRef.current = null; nodeInteractedRef.current = true; return }
    if (rotateRef.current) { rotateRef.current = null; commitRotate(); return }
    if (moveRef.current) {
      const ml = moveLiveRef.current
      moveRef.current = null
      if (ml) { applyDoc(translateDoc(docRef.current, ml.dx, ml.dy)); moveLiveRef.current = null; setMoveLive(null) }
      return // no move = a tap → onSurfaceClick selects all
    }
    if (drag) {
      const s = dragStartRef.current
      const moved = !s || Math.hypot(drag.pos[0] - s[0], drag.pos[1] - s[1]) > 2
      if (moved) commit({ op: 'MoveNode', ringId: drag.ringId, nodeId: drag.nodeId, to: drag.pos }) // a tap (no move) just selects
      setDrag(null)
      return
    }
    if (drawPts !== null && freehandRef.current) {
      const stroke = freehandRef.current
      freehandRef.current = null
      setFreehandPreview(null)
      if (freehandMovedRef.current && stroke.length > 2) {
        const eps = Math.max(2, Math.max(doc.image.widthPx, doc.image.heightPx) * 0.01)
        const simp = rdpClosed(stroke, eps) // freehand → smoothed control nodes (A3d)
        setDrawPts((prev) => [...(prev ?? []), ...simp])
      } else {
        setDrawPts((prev) => [...(prev ?? []), stroke[0]]) // a tap = one anchor
      }
      freehandMovedRef.current = false
    }
  }, [drag, drawPts, commit, doc.image, commitRotate, applyDoc])

  // Delete a control point (double-click a handle); keep a ring valid (≥3 nodes).
  const onNodeDoubleClick = useCallback(
    (ringId: string, nodeId: string) => (e: React.MouseEvent) => {
      e.stopPropagation()
      const ring = doc.rings.find((r) => r.id === ringId)
      if (ring && ring.nodes.length > 3) commit({ op: 'DeleteNode', ringId, nodeId })
    },
    [doc, commit],
  )

  // Add a control point on the nearest outer-ring segment (double-click the surface).
  const onSurfaceDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const p = toViewBox(e.clientX, e.clientY)
      const ring = doc.rings.find((r) => r.role === 'outer')
      if (!ring) return
      let best = { afterId: ring.nodes[0].id, d2: Infinity, at: p }
      for (let i = 0; i < ring.nodes.length; i++) {
        const a = ring.nodes[i].p, b = ring.nodes[(i + 1) % ring.nodes.length].p
        const { pt, d2 } = projectToSeg(p, a, b)
        if (d2 < best.d2) best = { afterId: ring.nodes[i].id, d2, at: pt }
      }
      commit({ op: 'AddNode', ringId: ring.id, afterNodeId: best.afterId, node: { id: `a${idRef.current++}`, p: best.at, role: 'corner', corner: { mode: 'inherit' } } })
    },
    [doc, commit, toViewBox],
  )

  // Explicit anchor controls (in addition to double-tap): delete the selected point, or add a new one
  // right after it (at the midpoint to its next neighbour), then select the new point.
  const onDeleteSelected = useCallback(() => {
    if (!selectedNode) return
    const ring = doc.rings.find((r) => r.id === selectedNode.ringId)
    if (ring && ring.nodes.length > 3) commit({ op: 'DeleteNode', ringId: selectedNode.ringId, nodeId: selectedNode.nodeId })
    setSelectedNode(null)
  }, [selectedNode, doc, commit])
  const onAddAfterSelected = useCallback(() => {
    if (!selectedNode) return
    const ring = doc.rings.find((r) => r.id === selectedNode.ringId)
    if (!ring) return
    const i = ring.nodes.findIndex((n) => n.id === selectedNode.nodeId)
    if (i < 0) return
    const a = ring.nodes[i].p, b = ring.nodes[(i + 1) % ring.nodes.length].p
    const mid: Vec2Px = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const newId = `a${idRef.current++}`
    commit({ op: 'AddNode', ringId: ring.id, afterNodeId: selectedNode.nodeId, node: { id: newId, p: mid, role: 'corner', corner: { mode: 'inherit' } } })
    setSelectedNode({ ringId: ring.id, nodeId: newId })
  }, [selectedNode, doc, commit])

  const onReset = useCallback(() => {
    const d = spec ? docFromSpec(spec) : seedDoc(VIEW_W, VIEW_H)
    applyDoc(d) // reset restores the base shape — undoable + pushed back to the 3D
    setRadius(d.style.globalOutlineCornerRadiusPx)
    setSmoothing(Math.round(d.style.smoothing * 100))
    setScale(100)
    setDrag(null)
    setSelectedNode(null)
    setAllSelected(false)
    setShapeKind(null)
    setShapePreview(null)
  }, [spec, applyDoc])

  // (Hug is PARKED out of core — D4. The engine's fields-once SDF evaluator stays ready in
  // outline-core/prepareSdfBlend for its post-core refinement; no UI tool ships here.)

  // Manual mode (A3a) — draw the outline by hand: click to place anchors, Finish to close the ring.
  const startDraw = useCallback(() => { setDrawPts([]); setDrag(null) }, [])
  // Tap the surface (not a node): inside the cut → SELECT ALL corners (scale/twist them together);
  // outside → deselect. (Node taps stopPropagation, so they never reach here.)
  const onSurfaceClick = useCallback((e: React.MouseEvent) => {
    if (drawPts !== null || preview) return
    if (nodeInteractedRef.current) { nodeInteractedRef.current = false; return } // a node tap → keep single selection
    if ((e.target as Element)?.tagName === 'circle') return // tapped a node handle, not the surface
    const p = toViewBox(e.clientX, e.clientY)
    const outerIdx = doc.rings.findIndex((r) => r.role === 'outer')
    const ring = outerIdx >= 0 ? resolved.flattenedRingsPx[outerIdx] : null
    if (ring && ring.length >= 3 && pointInPolygon(p, ring)) {
      setSelectedNode(null)
      setAllSelected(true)
    } else {
      setSelectedNode(null)
      setAllSelected(false)
    }
  }, [drawPts, doc, resolved, toViewBox, preview])

  const commitRadius = useCallback((v: number) => {
    setRadius(v)
    const t0 = performance.now()
    if (selectedNode) commit({ op: 'SetCorner', ringId: selectedNode.ringId, nodeId: selectedNode.nodeId, corner: { mode: 'manual', outlineCornerRadiusPx: v } })
    else commit({ op: 'SetGlobalCornerRadius', outlineCornerRadiusPx: v })
    perfGesture('round-commit', performance.now() - t0)
  }, [selectedNode, commit])
  const commitSmoothing = useCallback((v: number) => {
    setSmoothing(v)
    const t0 = performance.now()
    commit({ op: 'SetSmoothing', smoothing: v / 100 })
    perfGesture('smooth-commit', performance.now() - t0)
  }, [commit])
  // Scale: the slider previews live (displayDoc), then bakes the relative factor on release; the −/+
  // buttons bake a fixed ±5% step. Both resize all node positions about the center, preserving corners.
  const commitScale = useCallback((v: number) => {
    if (v === 100) { setScale(100); return }
    const t0 = performance.now()
    applyDoc(scaleDoc(docRef.current, v / 100))
    setScale(100)
    perfGesture('scale-commit', performance.now() - t0)
  }, [applyDoc])
  const nudgeScale = useCallback((deltaPct: number) => {
    applyDoc(scaleDoc(docRef.current, (100 + deltaPct) / 100))
    setScale(100)
  }, [applyDoc])
  // "Magic blend" — the soft real-background blur composited behind the subject on the 3D front
  // texture (the "magic blend" Dan loves). Edit-mode only control; on/off + intensity. Writes the
  // store's bgBlur (0 = off/sharp · 0..1 = intensity ·  ShapedModel re-composes the front, no re-segment).
  const writeBlend = useCallback((on: boolean, pct: number) => setBgBlur(on ? pct / 100 : 0), [setBgBlur])

  // Crop grips: pointer-captured on the grip element itself — self-contained, never threads
  // through the surface gesture handlers (stopPropagation keeps move/select-all/pan out).
  const beginStretch = useCallback((which: GripId) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    nodeInteractedRef.current = true
    const b = outerBbox(docRef.current)
    if (!(b.maxX > b.minX) || !(b.maxY > b.minY)) return
    const ax = which.includes('w') ? b.maxX : which.includes('e') ? b.minX : (b.minX + b.maxX) / 2
    const ay = which.includes('n') ? b.maxY : which.includes('s') ? b.minY : (b.minY + b.maxY) / 2
    stretchRef.current = { which, ax, ay, bbox: b, sx: 1, sy: 1 }
  }, [])
  const moveStretch = useCallback((e: React.PointerEvent) => {
    const st = stretchRef.current
    if (!st) return
    const [px, py] = toViewBox(e.clientX, e.clientY)
    const b = st.bbox
    const W = docRef.current.image.widthPx, H = docRef.current.image.heightPx
    const MIN = Math.min(W, H) * 0.06 // smallest the shape may shrink to
    let sx = 1, sy = 1
    if (st.which.includes('e')) sx = (px - st.ax) / (b.maxX - st.ax)
    if (st.which.includes('w')) sx = (st.ax - px) / (st.ax - b.minX)
    if (st.which.includes('n')) sy = (st.ay - py) / (st.ay - b.minY)
    if (st.which.includes('s')) sy = (py - st.ay) / (b.maxY - st.ay)
    // clamps: never invert, never below MIN, moving edge stays inside the image
    if (st.which.includes('e')) sx = Math.min(sx, (W - st.ax) / (b.maxX - st.ax))
    if (st.which.includes('w')) sx = Math.min(sx, st.ax / (st.ax - b.minX))
    if (st.which.includes('n')) sy = Math.min(sy, st.ay / (st.ay - b.minY))
    if (st.which.includes('s')) sy = Math.min(sy, (H - st.ay) / (b.maxY - st.ay))
    sx = Math.max(sx, MIN / (b.maxX - b.minX))
    sy = Math.max(sy, MIN / (b.maxY - b.minY))
    if (st.which === 'n' || st.which === 's') sx = 1
    if (st.which === 'e' || st.which === 'w') sy = 1
    stretchRef.current = { ...st, sx, sy }
    setStretchLive({ sx, sy, ax: st.ax, ay: st.ay })
  }, [toViewBox])
  const endStretch = useCallback(() => {
    const st = stretchRef.current
    if (!st) return
    stretchRef.current = null
    setStretchLive(null)
    if (Math.abs(st.sx - 1) < 0.004 && Math.abs(st.sy - 1) < 0.004) return // a tap, not a pull
    const t0 = performance.now()
    applyDoc(stretchDoc(docRef.current, st.sx, st.sy, st.ax, st.ay))
    perfGesture('stretch-commit', performance.now() - t0)
  }, [applyDoc])

  // Tune (BEN dash): re-run the fairing pipeline on the RAW pre-fairing trace with live params.
  // Per-tick = preview only; commit on release rebuilds the document (undoable) — §6.3. Re-tracing
  // replaces any manual anchor edits on the ring (it's a re-derivation of the base outline).
  const canTune = !!spec?.rawTracePx && spec.rawTracePx.length >= 24
  const buildTunedDoc = useCallback((params: FairTracedRingOpts): OutlineDocument | null => {
    const raw = spec?.rawTracePx
    if (!raw) return null
    const H = spec.maskHeightPx
    const rawEditorPx = raw.map(([x, y]) => [x, H - y] as Vec2Px) // y-up mask → y-down editor px
    const eps = Math.max(2, Math.max(spec.maskWidthPx, H) * 0.022)
    const nodes = nodesFromTracedRing(fairTracedRing(rawEditorPx, params), eps, 'o')
    const base = {
      rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }],
      style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 },
    }
    return applyOutlineCommands(base, [], { image: docRef.current.image, mode: 'auto' })
  }, [spec])
  const previewTune = useCallback((params: FairTracedRingOpts) => {
    const t0 = performance.now()
    const d = buildTunedDoc(params)
    if (d) setTunePreview(d)
    perfGesture('tune-tick', performance.now() - t0)
  }, [buildTunedDoc])
  const commitTune = useCallback((params: FairTracedRingOpts, detailVal?: number) => {
    const t0 = performance.now()
    const d = buildTunedDoc(params)
    setTunePreview(null)
    if (!d) return
    setFairParams(params)
    applyDoc(d)
    setSelectedNode(null)
    setAllSelected(false)
    // #21: tuned settings become the durable defaults — Magic reads them from the store
    useOutlineStore.getState().setFairing({ detail: detailVal ?? detailRef.current, params })
    perfGesture('tune-commit', performance.now() - t0)
  }, [buildTunedDoc, applyDoc])

  // Shape tool: build a fresh OutlineDocument from a preset/parametric shape's point ring (centered, fit
  // to the image), seeded into our node model so Smooth/Scale/drag all apply (radius 0 — shapes are
  // exact; softening is the Smooth control). Discrete params (sides/points) regenerate immediately; the
  // continuous ones (spikiness/rotate) preview while dragging and bake on release.
  const buildShapeDoc = useCallback((kind: ShapeKind, overrides: Partial<ShapeParams> = {}): OutlineDocument => {
    const img = docRef.current.image
    // uniform arc-length resample → evenly spaced anchors → vector-true curves (no irregular
    // merging); tiny minSpacing so the even spacing survives docFromRings' cleanup.
    const ring = resampleClosed(generateShapeRing({ kind, ...shapeParamsRef.current, ...overrides }, img.widthPx, img.heightPx), Math.max(img.widthPx, img.heightPx) / 220)
    return docFromRings(ring, img, 0, 1.5)
  }, [])
  const pickShape = useCallback((kind: ShapeKind) => {
    setShapeKind(kind)
    setShapePreview(null)
    const overrides: Partial<ShapeParams> = {}
    if (kind === 'blob') { // fresh blob per pick; the dice rerolls further
      overrides.seed = Math.floor(Math.random() * 1e9)
      const next = { ...shapeParamsRef.current, seed: overrides.seed! }
      shapeParamsRef.current = next; setShapeParams(next)
    }
    applyDoc(buildShapeDoc(kind, overrides))
    setSmoothing(0); setScale(100); setSelectedNode(null); setAllSelected(false)
    setShowAnchors(false) // rigid shape: vertex anchors off by default (toggle to edit points)
  }, [applyDoc, buildShapeDoc])
  /** stepper: ±delta on an integer param, regenerate immediately (undoable). */
  const nudgeParam = useCallback((key: 'sides' | 'points' | 'lobes' | 'petals' | 'blades', delta: number, min: number, max: number) => {
    if (!shapeKind) return
    const n = Math.max(min, Math.min(max, (shapeParamsRef.current[key] ?? min) + delta))
    const next = { ...shapeParamsRef.current, [key]: n }
    shapeParamsRef.current = next; setShapeParams(next)
    applyDoc(buildShapeDoc(shapeKind, { [key]: n }))
  }, [shapeKind, applyDoc, buildShapeDoc])
  /** tick-bar: transient preview per tick (§6.3); commitShape applies on release. */
  const previewParam = useCallback((key: 'spikiness' | 'pinch' | 'depth' | 'swirl' | 'waviness', v: number) => {
    if (!shapeKind) return
    const next = { ...shapeParamsRef.current, [key]: v }
    shapeParamsRef.current = next; setShapeParams(next)
    setShapePreview(buildShapeDoc(shapeKind, { [key]: v }))
  }, [shapeKind, buildShapeDoc])
  /** blob dice: reroll the seed, regenerate immediately (undoable). */
  const rerollBlob = useCallback(() => {
    if (shapeKind !== 'blob') return
    const seed = Math.floor(Math.random() * 1e9)
    const next = { ...shapeParamsRef.current, seed }
    shapeParamsRef.current = next; setShapeParams(next)
    applyDoc(buildShapeDoc('blob', { seed }))
  }, [shapeKind, applyDoc, buildShapeDoc])
  const commitShape = useCallback(() => {
    if (shapePreview) { applyDoc(shapePreview); setShapePreview(null) }
  }, [shapePreview, applyDoc])

  // Rotation handlers — desktop handle + two-finger gesture both drive rotatePreview, baked on release.
  const beginRotateHandle = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const [cx, cy] = outerCenter(docRef.current)
    const at = toViewBox(e.clientX, e.clientY)
    rotateRef.current = { cx, cy, start: Math.atan2(at[1] - cy, at[0] - cx) }
  }, [toViewBox])
  const toggleShape = useCallback(() => {
    setActiveAdjust((a) => (a === 'shape' ? null : 'shape'))
    setShapeKind(null); setShapePreview(null) // open the picker fresh (chips only) — no stale active shape
  }, [])

  const finishDraw = useCallback(() => {
    if (drawPath.length >= 3) {
      const eps = Math.max(2, Math.max(doc.image.widthPx, doc.image.heightPx) * 0.004)
      applyDoc(docFromRings(rdpClosed(drawPath, eps), doc.image))
      setSmoothing(0); setScale(100); setSelectedNode(null); setAllSelected(false)
      setShapeKind(null); setShapePreview(null)
    }
    setDrawPts(null)
  }, [drawPath, doc.image, applyDoc])
  const cancelDraw = useCallback(() => setDrawPts(null), [])

  // Saving is AUTOMATIC: every edit commits to the doc-history + persists (editedDoc) + drives the 3D
  // live, and switching tools never resets it. So there's no explicit Save — "Done" just closes back to
  // the scene (the approved shape is already what's shown). It also collapses any open sub-menu first.
  const onDone = useCallback(() => {
    setActiveAdjust(null)
    setSelectedNode(null)
    setAllSelected(false)
    useOutlineStore.getState().setEditorOpen(false) // §6.3 boundary: the deferred 3D rebuild fires now
    onClose()
  }, [onClose])

  // ✕ Close = discard this session's edits: revert the 3D contour, the persisted editor doc, and the
  // blend to the pre-edit snapshot, then exit. (Done keeps them; saving during the session was automatic.)
  const onCancel = useCallback(() => {
    const pe = preEditRef.current
    const st = useOutlineStore.getState()
    st.setEditedContourMM(pe.contourMM) // 3D rebuilds the pre-edit shape
    st.setEditedDoc(pe.editedDoc)       // reopening shows the pre-edit outline, not this session's edits
    if (st.bgBlur !== pe.bgBlur) st.setBgBlur(pe.bgBlur != null ? pe.bgBlur : 0.5) // revert blend (null ≈ build default)
    setActiveAdjust(null)
    setSelectedNode(null)
    setAllSelected(false)
    st.setEditorOpen(false) // §6.3 boundary
    onClose()
  }, [onClose])

  if (!open) return null

  const drawing = drawPts !== null
  const canUndo = histRef.current.past.length > 0
  const canRedo = histRef.current.future.length > 0
  const nodeR = ((doc.image.widthPx / VIEW_W) * 11) / view.scale // constant on-screen size at any zoom (G11)
  const drawPathD = drawPath.length ? `M ${drawPath.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')}` : ''
  // Desktop rotate handle — a grip on a short stem above the outline, shown when all anchors are selected.
  const rotOuterIdx = doc.rings.findIndex((r) => r.role === 'outer')
  const rotOuterRing = rotOuterIdx >= 0 ? resolved.flattenedRingsPx[rotOuterIdx] : null
  let rotHandle: { bx: number; by: number; hy: number } | null = null
  if (allSelected && !drawing && !preview && rotOuterRing && rotOuterRing.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity
    for (const [x, y] of rotOuterRing) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x }
    const bx = (minX + maxX) / 2
    rotHandle = { bx, by: minY, hy: minY - nodeR * 4 }
  }
  // live direct-manipulation transform on the outline group (stretch / rotate / move) — real-time, no doc rebuild
  const liveXform = stretchLive
    ? `translate(${stretchLive.ax} ${stretchLive.ay}) scale(${stretchLive.sx} ${stretchLive.sy}) translate(${-stretchLive.ax} ${-stretchLive.ay})`
    : rotateLive ? `rotate(${rotateLive.deg} ${rotateLive.cx} ${rotateLive.cy})` : moveLive ? `translate(${moveLive.dx} ${moveLive.dy})` : undefined
  // Crop grips (Dan: iOS-crop reference) — boxy shapes only; grips track the bbox, including the
  // live stretch (rendered OUTSIDE the transformed group so the pill strokes never distort).
  const cropMode = shapeKind !== null && !drawing && !preview && !shapePreview && !tunePreview // #32: every preset is reshapeable
  let cropBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  if (cropMode && rotOuterIdx >= 0 && resolved.flattenedRingsPx[rotOuterIdx]?.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of resolved.flattenedRingsPx[rotOuterIdx]) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    if (stretchLive) {
      const m = (v: number, a: number, s: number) => a + (v - a) * s
      minX = m(minX, stretchLive.ax, stretchLive.sx); maxX = m(maxX, stretchLive.ax, stretchLive.sx)
      minY = m(minY, stretchLive.ay, stretchLive.sy); maxY = m(maxY, stretchLive.ay, stretchLive.sy)
    }
    cropBox = { minX, minY, maxX, maxY }
  }
  // magic-blend live preview in the canvas: blurred photo + sharp subject overlay; blur reacts to intensity
  const showBlend = blendOn && !!subjMatteUrl && !!imageUrl
  const blendSd = (blendBlur / 100) * (doc.image.widthPx / 25)

  return (
    <div className={styles.overlay}>
      {/* Top bar (mobile canon): history on the left, commit/exit on the right; creative tools live
          at the bottom in the thumb zone. */}
      <div className={styles.topbar}>
        <div className={styles.topInner}>
          {/* ✕ Close = discard this session's edits; Done = keep them. Evenly distributed, no title. */}
          <TopTool icon={<CloseIcon />} label="Close" onClick={onCancel} />
          {!drawing && (
            <>
              <TopTool icon={<UndoIcon />} label="Undo" onClick={undo} disabled={!canUndo} />
              <TopTool icon={<RedoIcon />} label="Redo" onClick={redo} disabled={!canRedo} />
              <TopTool icon={<ResetIcon />} label="Reset" onClick={onReset} />
              {/* Preview = hide anchors/handles to see the clean result without exiting */}
              <TopTool icon={preview ? <PreviewOffIcon /> : <PreviewIcon />} label={preview ? 'Edit' : 'Preview'} onClick={() => setPreview((v) => !v)} />
              {/* Points = toggle vertex anchors (rigid shapes start OFF — Dan) */}
              <TopTool icon={<OutlineIcon />} label="Points" onClick={() => setShowAnchors((v) => !v)} />
            </>
          )}
          <TopTool icon={<CheckIcon />} label="Done" onClick={onDone} />
        </div>
      </div>

      <div className={styles.canvas}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`${view.vx} ${view.vy} ${doc.image.widthPx / view.scale} ${doc.image.heightPx / view.scale}`}
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onSurfaceClick}
          onDoubleClick={drawing ? undefined : onSurfaceDoubleClick}
          onWheel={(e) => {
            // G11: scroll/trackpad zoom about the cursor (the viewBox IS the zoom state)
            applyZoom(e.clientX, e.clientY, viewRef.current.scale * Math.exp(-e.deltaY * 0.0022), viewRef.current)
          }}
        >
          <defs>
            <filter id="kaiBgBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={blendSd} />
            </filter>
            {/* #24: Preview clips the photo to the cut outline — the final cut-out, no periphery */}
            {preview && pathD && <clipPath id="kaiCutPreview"><path d={pathD} /></clipPath>}
          </defs>
          <g clipPath={preview && pathD ? 'url(#kaiCutPreview)' : undefined}>
          {imageUrl && (showBlend ? (
            // magic blend: blurred full photo + the sharp BEN subject (matte is y-up → flip to editor y-down)
            <>
              <image href={imageUrl} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" filter="url(#kaiBgBlur)" />
              <image href={subjMatteUrl!} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" transform={`translate(0 ${doc.image.heightPx}) scale(1 -1)`} />
            </>
          ) : (
            <image href={imageUrl} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" />
          ))}
          </g>
          {drawing ? (
            <>
              {drawPathD && <path className={styles.drawPath} d={drawPathD} />}
              {freehandPreview && freehandPreview.length > 1 && (
                <path className={styles.drawPath} d={`M ${freehandPreview.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')}`} />
              )}
              {(drawPts ?? []).map((p, i) => (
                <circle key={`d${i}`} className={styles.node} cx={p[0]} cy={p[1]} r={nodeR} />
              ))}
            </>
          ) : (
            <>
              {/* scrim dims outside the cut; hidden during a live transform (its hole would lag the move/rotate) */}
              {imageUrl && pathD && !preview && !rotateLive && !moveLive && !stretchLive && (
                <path className={styles.scrim} fillRule="evenodd" d={`M0 0H${doc.image.widthPx}V${doc.image.heightPx}H0Z ${pathD}`} />
              )}
              <g transform={liveXform}>
                {!preview && <path className={`${styles.path} ${hasIssues ? styles.pathError : ''}`} d={pathD} />}
                {/* anchors + rotate handle hidden in Preview (clean result) */}
                {!preview && showAnchors && shown.rings.map((ring) =>
                  ring.nodes.map((n) => {
                    const active = drag?.nodeId === n.id
                    return (
                      <circle
                        key={`${ring.id}:${n.id}`}
                        className={`${styles.node} ${active ? styles.nodeActive : ''} ${allSelected || selectedNode?.nodeId === n.id ? styles.nodeSelected : ''}`}
                        cx={n.p[0]}
                        cy={n.p[1]}
                        r={nodeR}
                        onPointerDown={onNodeDown(ring.id, n.id)}
                        onDoubleClick={onNodeDoubleClick(ring.id, n.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )
                  }),
                )}
                {!preview && showAnchors && rotHandle && (
                  <g>
                    <line className={styles.rotateStem} x1={rotHandle.bx} y1={rotHandle.by} x2={rotHandle.bx} y2={rotHandle.hy} />
                    {/* grip is larger than the anchors and carries a rotate glyph */}
                    <circle className={styles.rotateHandle} cx={rotHandle.bx} cy={rotHandle.hy} r={nodeR * 1.7} onPointerDown={beginRotateHandle} onClick={(e) => e.stopPropagation()} />
                    <g transform={`translate(${rotHandle.bx} ${rotHandle.hy}) scale(${nodeR * 0.0095}) translate(-128 -128)`} style={{ pointerEvents: 'none' }}>
                      <path d={ROTATE_GLYPH_D} fill="#fff" />
                    </g>
                  </g>
                )}
              </g>
              {/* Crop-style stretch grips — OUTSIDE the live-transform group (the pill strokes must
                  never distort); positions track cropBox, which already includes the live stretch. */}
              {!preview && cropBox && !rotateLive && !moveLive && (() => {
                const { minX, minY, maxX, maxY } = cropBox
                const mx = (minX + maxX) / 2, my = (minY + maxY) / 2
                const arm = Math.min(nodeR * 3, (maxX - minX) * 0.22, (maxY - minY) * 0.22)
                const lenH = Math.min(nodeR * 4, (maxX - minX) * 0.3)
                const lenV = Math.min(nodeR * 4, (maxY - minY) * 0.3)
                const grips: { id: GripId; d: string; cursor: string }[] = [
                  { id: 'n', d: `M ${mx - lenH / 2} ${minY} L ${mx + lenH / 2} ${minY}`, cursor: 'ns-resize' },
                  { id: 's', d: `M ${mx - lenH / 2} ${maxY} L ${mx + lenH / 2} ${maxY}`, cursor: 'ns-resize' },
                  { id: 'w', d: `M ${minX} ${my - lenV / 2} L ${minX} ${my + lenV / 2}`, cursor: 'ew-resize' },
                  { id: 'e', d: `M ${maxX} ${my - lenV / 2} L ${maxX} ${my + lenV / 2}`, cursor: 'ew-resize' },
                  { id: 'nw', d: `M ${minX + arm} ${minY} L ${minX} ${minY} L ${minX} ${minY + arm}`, cursor: 'nwse-resize' },
                  { id: 'ne', d: `M ${maxX - arm} ${minY} L ${maxX} ${minY} L ${maxX} ${minY + arm}`, cursor: 'nesw-resize' },
                  { id: 'sw', d: `M ${minX + arm} ${maxY} L ${minX} ${maxY} L ${minX} ${maxY - arm}`, cursor: 'nesw-resize' },
                  { id: 'se', d: `M ${maxX - arm} ${maxY} L ${maxX} ${maxY} L ${maxX} ${maxY - arm}`, cursor: 'nwse-resize' },
                ]
                return (
                  <g>
                    {grips.map((g) => (
                      <g key={g.id}>
                        <path className={styles.gripUnder} d={g.d} strokeWidth={nodeR * 1.5} />
                        <path className={styles.grip} d={g.d} strokeWidth={nodeR * 1.1} />
                        <path
                          className={styles.gripHit}
                          d={g.d}
                          strokeWidth={nodeR * 3.4}
                          style={{ cursor: g.cursor }}
                          onPointerDown={beginStretch(g.id)}
                          onPointerMove={moveStretch}
                          onPointerUp={endStretch}
                          onPointerCancel={endStretch}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        />
                      </g>
                    ))}
                  </g>
                )
              })()}
            </>
          )}
        </svg>
      </div>

      {/* bottom dock — status + sheets + toolbar, floating as glass over the full-bleed canvas */}
      <div className={styles.bottomDock}>
      {/* compact status line between canvas and toolbar */}
      <div className={styles.status}>
        {preview
          ? <span className={styles.approved}>Preview — tap Edit to keep editing</span>
          : drawing
          ? 'Tap to place points, or drag to draw freehand'
          : hasIssues
            ? <span className={styles.warn}>This shape can’t be cut cleanly — fix the crossing</span>
            : allSelected
              ? 'All corners selected — scale or twist them together'
              : selectedNode
                ? 'Drag this point, or add/delete from the bar below'
                : 'Tap inside to select all · drag inside to move · drag points · double-tap to add/remove · pinch/scroll to zoom'}
      </div>

      {/* reveal-on-tap adjustment sheet — every continuous control is the shared TickBar (G12):
          per-tick = transient visual preview only; commit fires once on release (§6.3). */}
      {!drawing && activeAdjust && activeAdjust !== 'shape' && activeAdjust !== 'tune' && (
        <div className={styles.sheet}>
          {activeAdjust === 'round' && (
            <TickBar label={selectedNode ? 'Corner' : 'Radius'} min={0} max={maxRadius} value={Math.min(radius, maxRadius)} onChange={setRadius} onCommit={commitRadius} format={(v) => `${Math.round((v / Math.max(maxRadius, 1)) * 100)}%`} />
          )}
          {activeAdjust === 'smooth' && (
            <TickBar label="Smooth" min={0} max={100} value={smoothing} onChange={setSmoothing} onCommit={commitSmoothing} format={(v) => `${Math.round(v)}%`} />
          )}
          {activeAdjust === 'scale' && (
            <>
              <button type="button" className={styles.stepBtn} onClick={() => nudgeScale(-5)} aria-label="Scale down"><MinusIcon /></button>
              <TickBar label="Scale" min={50} max={150} value={scale} onChange={setScale} onCommit={commitScale} format={(v) => `${Math.round(v)}%`} />
              <button type="button" className={styles.stepBtn} onClick={() => nudgeScale(5)} aria-label="Scale up"><PlusIcon /></button>
            </>
          )}
          {activeAdjust === 'blend' && (
            <>
              <button
                type="button"
                className={`${styles.toggleBtn} ${blendOn ? styles.toggleBtnOn : ''}`}
                onClick={() => { const next = !blendOn; setBlendOn(next); writeBlend(next, blendBlur) }}
                aria-pressed={blendOn}
                aria-label="Toggle magic blend"
              >
                {blendOn ? 'On' : 'Off'}
              </button>
              <TickBar
                label="Blend"
                min={0}
                max={100}
                value={blendBlur}
                disabled={!blendOn}
                onChange={setBlendBlur}
                onCommit={(v) => { setBlendBlur(v); writeBlend(blendOn, v) }}
                format={(v) => `${Math.round(v)}%`}
              />
            </>
          )}
        </div>
      )}

      {/* Tune (BEN dash, Dan 2026-06-10): live fairing params over the raw trace — find the optimal
          settings by testing in the run. Detail = master (10–20% = patch-simple default); advanced
          bars expose each engine knob; master commit re-derives the advanced values. */}
      {!drawing && activeAdjust === 'tune' && canTune && (
        <div className={styles.shapeSheet}>
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Detail</span>
            <TickBar
              label="Detail" min={0} max={100} value={detail}
              onChange={(v) => { setDetail(v); previewTune(fairingFromDetail(v)) }}
              onCommit={(v) => { setDetail(v); commitTune(fairingFromDetail(v), v) }}
              format={(v) => `${Math.round(v)}%`}
            />
          </div>
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Smooth</span>
            <TickBar
              label="Smooth strength" min={1} max={30} step={0.5} value={fairParams.smoothPx ?? 6}
              onChange={(v) => previewTune({ ...fairParams, smoothPx: v })}
              onCommit={(v) => commitTune({ ...fairParams, smoothPx: v })}
              format={(v) => `${v.toFixed(1)}px`}
            />
          </div>
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Snap</span>
            <TickBar
              label="Line snap band" min={0} max={20} step={0.5} value={fairParams.detailPx ?? 4}
              onChange={(v) => previewTune({ ...fairParams, detailPx: v })}
              onCommit={(v) => commitTune({ ...fairParams, detailPx: v })}
              format={(v) => `${v.toFixed(1)}px`}
            />
          </div>
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Min line</span>
            <TickBar
              label="Min line length" min={20} max={200} step={5} value={fairParams.minLinePx ?? 50}
              onChange={(v) => previewTune({ ...fairParams, minLinePx: v })}
              onCommit={(v) => commitTune({ ...fairParams, minLinePx: v })}
              format={(v) => `${Math.round(v)}px`}
            />
          </div>
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Angle</span>
            <TickBar
              label="Sharpest angle" min={10} max={90} step={1} value={fairParams.maxTurnDeg ?? 35}
              onChange={(v) => previewTune({ ...fairParams, maxTurnDeg: v })}
              onCommit={(v) => commitTune({ ...fairParams, maxTurnDeg: v })}
              format={(v) => `${Math.round(v)}°`}
            />
          </div>
        </div>
      )}

      {/* Shape tool — Dan's board lineup + the form/blob generators; parametric kinds reveal controls */}
      {!drawing && activeAdjust === 'shape' && (
        <div className={styles.shapeSheet}>
          <div className={styles.chipRow}>
            {SHAPE_CHIPS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                className={`${styles.chip} ${shapeKind === kind ? styles.chipActive : ''}`}
                onClick={() => pickShape(kind)}
                aria-pressed={shapeKind === kind}
                aria-label={label}
              >
                <span className={styles.chipIcon}><ShapeChipIcon kind={kind} /></span>
                <span className={styles.chipLabel}>{label}</span>
              </button>
            ))}
          </div>
          {shapeKind && PARAMETRIC[shapeKind] && (
            <div className={styles.shapeControls}>
              {shapeKind === 'polygon' && (
                <div className={styles.shapeRow}>
                  <span className={styles.shapeName}>Sides</span>
                  <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('sides', -1, 3, 12)} aria-label="Fewer sides"><MinusIcon /></button>
                  <span className={styles.shapeVal}>{shapeParams.sides}</span>
                  <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('sides', 1, 3, 12)} aria-label="More sides"><PlusIcon /></button>
                </div>
              )}
              {shapeKind === 'star' && (
                <>
                  <div className={styles.shapeRow}>
                    <span className={styles.shapeName}>Points</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('points', -1, 3, 12)} aria-label="Fewer points"><MinusIcon /></button>
                    <span className={styles.shapeVal}>{shapeParams.points}</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('points', 1, 3, 12)} aria-label="More points"><PlusIcon /></button>
                  </div>
                  <div className={styles.shapeRow}>
                    <TickBar label="Spike" min={5} max={95} value={shapeParams.spikiness} onChange={(v) => previewParam('spikiness', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
                  </div>
                </>
              )}
              {shapeKind === 'daisy' && (
                <>
                  <div className={styles.shapeRow}>
                    <span className={styles.shapeName}>Petals</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('petals', -1, 5, 12)} aria-label="Fewer petals"><MinusIcon /></button>
                    <span className={styles.shapeVal}>{shapeParams.petals}</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('petals', 1, 5, 12)} aria-label="More petals"><PlusIcon /></button>
                  </div>
                  <div className={styles.shapeRow}>
                    <TickBar label="Depth" min={0} max={100} value={shapeParams.depth} onChange={(v) => previewParam('depth', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
                  </div>
                </>
              )}
              {shapeKind === 'pinwheel' && (
                <>
                  <div className={styles.shapeRow}>
                    <span className={styles.shapeName}>Blades</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('blades', -1, 3, 8)} aria-label="Fewer blades"><MinusIcon /></button>
                    <span className={styles.shapeVal}>{shapeParams.blades}</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('blades', 1, 3, 8)} aria-label="More blades"><PlusIcon /></button>
                  </div>
                  <div className={styles.shapeRow}>
                    <TickBar label="Swirl" min={0} max={100} value={shapeParams.swirl} onChange={(v) => previewParam('swirl', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
                  </div>
                </>
              )}
              {shapeKind === 'form' && (
                <>
                  <div className={styles.shapeRow}>
                    <span className={styles.shapeName}>Lobes</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('lobes', -1, 3, 8)} aria-label="Fewer lobes"><MinusIcon /></button>
                    <span className={styles.shapeVal}>{shapeParams.lobes}</span>
                    <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('lobes', 1, 3, 8)} aria-label="More lobes"><PlusIcon /></button>
                  </div>
                  <div className={styles.shapeRow}>
                    <TickBar label="Pinch" min={0} max={100} value={shapeParams.pinch} onChange={(v) => previewParam('pinch', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
                  </div>
                </>
              )}
              {shapeKind === 'blob' && (
                <>
                  <div className={styles.shapeRow}>
                    <TickBar label="Wavy" min={0} max={100} value={shapeParams.waviness} onChange={(v) => previewParam('waviness', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
                  </div>
                  <div className={styles.shapeRow}>
                    <button type="button" className={styles.nodeAction} onClick={rerollBlob}>
                      <DiceIcon /><span>New blob</span>
                    </button>
                  </div>
                </>
              )}
              <div className={styles.shapeHint}>Rotate: twist with two fingers, or drag the handle after selecting all corners</div>
            </div>
          )}
        </div>
      )}

      {/* contextual anchor actions — appear when a single point is selected */}
      {!drawing && selectedNode && (
        <div className={styles.nodeBar}>
          <button type="button" className={styles.nodeAction} onClick={onAddAfterSelected}>
            <AddPointIcon /><span>Add point</span>
          </button>
          <button type="button" className={styles.nodeAction} onClick={onDeleteSelected}>
            <DeleteIcon /><span>Delete point</span>
          </button>
        </div>
      )}

      {/* bottom toolbar — thumb-reachable icon tools; full-width bar, content capped + centered on desktop */}
      <div className={styles.toolbar}>
        <div className={styles.toolInner}>
        {drawing ? (
          <>
            <ToolBtn icon={<CloseIcon />} label="Cancel" onClick={cancelDraw} />
            <ToolBtn icon={<CheckIcon />} label={`Finish (${drawPts?.length ?? 0})`} onClick={finishDraw} disabled={(drawPts?.length ?? 0) < 3} primary />
          </>
        ) : (
          <>
            <ToolBtn icon={<ShapeIcon />} label="Shape" onClick={toggleShape} active={activeAdjust === 'shape'} />
            {canTune && <ToolBtn icon={<TuneIcon />} label="Tune" onClick={() => setActiveAdjust((a) => (a === 'tune' ? null : 'tune'))} active={activeAdjust === 'tune'} />}
            <ToolBtn icon={<RoundIcon />} label={selectedNode ? 'Corner' : 'Radius'} onClick={() => setActiveAdjust((a) => (a === 'round' ? null : 'round'))} active={activeAdjust === 'round'} />
            <ToolBtn icon={<SmoothIcon />} label="Smooth" onClick={() => setActiveAdjust((a) => (a === 'smooth' ? null : 'smooth'))} active={activeAdjust === 'smooth'} />
            <ToolBtn icon={<ScaleIcon />} label="Scale" onClick={() => setActiveAdjust((a) => (a === 'scale' ? null : 'scale'))} active={activeAdjust === 'scale'} />
            <ToolBtn icon={<BlendIcon />} label="Blend" onClick={() => setActiveAdjust((a) => (a === 'blend' ? null : 'blend'))} active={activeAdjust === 'blend'} />
            <ToolBtn icon={<PenIcon />} label="Draw" onClick={startDraw} />
          </>
        )}
        </div>
      </div>
      </div>
    </div>
  )
}
