// Effect Creator V3 — 2D outline editor overlay (REBUILD-PLAN-v2 Layer A).
// One room for every shape source. Modes: Shape (sources) · Adjust (Radius · Curve · Tune ✦) ·
// Image (Bright/Contrast/Color/Warmth/Blend + photo-as-gesture). Frame is the default state;
// double-tap = Points; the node bar owns point work. Continuous controls are TickBars (G12)
// riding the §6.3 tick/commit contract. The canvas sits in a safe-area layout between the bars with zoom + pan
// (G11) so every anchor is reachable and the whole image is visible.
// Renders THE vector truth over the flat cut-out image: true SVG curves + on-demand anchors.
// Every edit is a VShape operation committed through the single writer (commitGeometry) — there
// is no document model in this editor (REBUILD-PLAN-v2 §B2). Transient tick morphs render as
// display-only rings. Styling = ONEMO design system tokens (CSS module). No three.js here.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  validateSelfIntersection,
  rdpClosed,
  type Vec2Px,
} from '@/lib/outline-core/math'
import { MIN_ANCHOR_SEPARATION_MM } from '@/lib/effect/geometry-truth'
// V4 engine (blueprint v4-foundation.md): one impartial resolve(source, adjustments). The editor
// writes the recipe; the engine owns shape. No corner-pin, no vectoriseTrace, no baked timeline.
import { mintIds, type GlobalAdjustments, type LocalAdjustment } from '@/lib/effect/outline-resolve'
import { standardBirthShape } from '@/lib/effect/prepare-effect'
import { useOutlineStore, NEUTRAL_FX, INITIAL_ARTWORK, type ImageFx } from './outlineStore'
import type { DesignState } from '../types'
import type { Pt } from '@/lib/effect/types'
import { UndoIcon, RedoIcon, CheckIcon, CloseIcon, AddPointIcon, DeleteIcon, ShapeIcon, TuneIcon, OutlineIcon, PreviewIcon, PreviewOffIcon , PointsIcon, MagicIcon } from './icons'
import { toast } from '../ui/Toast'
import { perfGesture } from '../dev/PerfHUD'
import { generateShapeRing, resampleClosed, type ShapeKind, type ShapeParams } from './shapes'
// VECTOR CORE (reset Run 1): vector-native kinds render/commit/transform on a true Bézier VShape;
// the doc stays as the interaction SHADOW (a derived flatten artifact — bbox/hit/grips math only).
import { shapeToSVGPathD, flattenShape, filletShape, ringToVPath, nearestOnPath, insertAnchorCentered, deleteAnchorRefit, shapeBBox, type VShape, type VAnchor, type Vec2 } from '@/lib/vector-core'
import { hasVectorDef, getShape } from '@/lib/shape-library'
// Run 8 — SVG shape upload: a downloaded/Figma-exported outline becomes a first-class vector
// shape through the export module's dialect gate (loud rejection outside the v1 boundary).
import { vshapeFromSVG, fitShapeToBox } from '@/lib/export'
// Run 10 — image-shape upload: threshold mask → the SAME trace machinery as Magic → fitted vector.
import { maskFromImageData } from '@/lib/effect/image-shape'
import { smoothMask } from '@/lib/effect/mask'
import { traceContourRaw } from '@/lib/effect/contour'

// Run-3 live generators: dense internal sample → ONE Schneider fit at spawn → vector path out.
// Segments never leave the generator (blueprint modules/generators.md).
const GEN_VECTOR_KINDS = new Set<ShapeKind>(['daisy', 'pinwheel', 'form', 'blob'])
// Run 2 · G6 decomposition — seam 1: pure doc-space geometry; seam 2: chip lineup + glyphs.
import { DEFAULT_SHAPE_PARAMS } from './editor/chips'
import { useOutlineEditing } from './editor/useOutlineEditing'
import { useCanvasView } from './editor/useCanvasView'
import { AdjustSheet, ImageSheet, ShapeSheet, type AdjustSub } from './editor/sheets'
import { pointInPolygon, type GripId } from './editor/geometry'
import styles from './outline-editor.module.css'
import TopBar, { TopBarButton } from './TopBar'
import Dock, { DockTool } from './Dock'

interface OutlineEditorProps {
  open: boolean
  imageUrl?: string
  onClose: () => void
  /** Structure A (#27): the toolbar's creation modes open THIS editor in that mode. */
  openMode?: 'shape' | 'image' | null
  /** Magic ✦ trail chip (plan A2/D7): runs the SAME auto-cut the hero shortcut runs — one
   *  pipeline, two doors. Magic is self-sufficient, so the editor closes and the cut lands in 3D. */
  onMagic?: () => void
}

const VIEW_W = 1000
const VIEW_H = 1000

/** display-only ring → SVG polyline `d` (transient previews render rings, never documents). */
function ringPathD(ring: ReadonlyArray<readonly [number, number]>): string {
  return ring.length ? `M ${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z` : ''
}

// Rotate glyph (Phosphor ArrowClockwise, 256-box) drawn inside the rotate handle — white on the brand grip.
const ROTATE_GLYPH_D = 'M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z'


export default function OutlineEditor({ open, imageUrl, onClose, openMode, onMagic }: OutlineEditorProps) {
  // KAI-8976/F4: every history entry carries the dial state that produced its shape, so
  // undo/redo restore a TRUTHFUL readout (the Detail ruler lied at 89% after undo). The source is
  // the COMMITTED dial state — updated only at seed/commit/reset/undo, never by preview ticks
  // (the TickBar's onChange moves the live refs DURING the drag, before the commit pushes).
  // V4: the editor session over the store's source+adjustments truth (resolve = the display shape).
  const { source, adjustments, display, displayRef, preview: previewAdj, setPreview: setPreviewAdj, applyAdjustments, seedSource, reBaseline, transformSource, undo: undoEdit, redo: redoEdit, histRef } = useOutlineEditing()
  // aliases — the gesture/render code reads the RESOLVED display as the working VShape.
  const vshape = display
  const vshapeRef = displayRef
  // every MANUAL op (drag / insert / delete / sharpen / producer pick) RE-BASELINES: the new VShape
  // becomes a fresh immutable source (adjustments off). Radius / Curve / global tools write adjustments.
  const applyVec = useCallback((v: VShape, _base?: VShape | null, _lin?: 'trace' | 'vector') => reBaseline(() => v), [reBaseline])
  // the live global recipe shown by the sliders (preview during a drag, else the committed truth).
  const liveGlobal = (previewAdj ?? adjustments).global

  const [radius, setRadius] = useState(0)        // Round: selected-corner radius px (local adjustment)

  // Apple layout: the editor's bottom is a MODE pill (Shape · Adjust · Image); each mode shows a
  // row of circular sub-tools sharing ONE ruler. Adjust = Radius · Curve · Tune ✦ (plan A2 —
  // Scale DELETED per D5, the frame owns it; Blend lives in Image mode per #8).
  const [activeAdjust, setActiveAdjust] = useState<'shape' | 'adjust' | 'image' | null>(null)
  const [adjustSub, setAdjustSub] = useState<AdjustSub>('radius')
  const [curveVal, setCurveVal] = useState(0) // Curve ruler 0..100 — 0 = straight (OFF), reversible
  const [blendBlur, setBlendBlur] = useState(50) // blend intensity 0–100; 0 = off (ruler IS the switch)
  // Shape tool: pick a preset/parametric shape as the starting outline. shapeKind = the shape currently
  // being tuned (null = none picked this session → only chips show). Params drive live regeneration.
  const [shapeKind, setShapeKind] = useState<ShapeKind | null>(null)
  // one params object for every parametric shape/generator (ref mirrors it so rapid stepper taps
  // and tick storms read the latest values — state closures lag)
  const [shapeParams, setShapeParams] = useState({ ...DEFAULT_SHAPE_PARAMS })
  const shapeParamsRef = useRef(shapeParams)
  useEffect(() => { shapeParamsRef.current = shapeParams }, [shapeParams])
  const [shapePreview, setShapePreview] = useState<string | null>(null) // live morph while dragging a shape control — a display-only SVG `d` ring (never geometry)
  // V4: the global recipe (Detail/Smooth/Snap/Angle/Line) lives in `adjustments.global` — INDEPENDENT
  // 0..100 axes (no Detail↔Smooth coupling). Slider ticks preview through the editing hook (no commit);
  // release commits via applyAdjustments. There is no separate `d`-string tune preview — the display
  // re-resolves from the live recipe.
  // #28 Image tool (Apple-pattern: circular sub-icons + ONE shared ruler). Position pans/zooms the
  // PHOTO under the fixed cutline (the scene's G1, now inside the editor); adjustments preview live
  // via CSS filter here and bake into the print composite on commit (one composeFront).
  const [imageSub, setImageSub] = useState<'brightness' | 'contrast' | 'saturate' | 'warmth' | 'blend'>('brightness')
  const [fxDraft, setFxDraft] = useState<ImageFx>(NEUTRAL_FX)
  const imgPanRef = useRef<{ startClient: [number, number]; art0: { offsetX: number; offsetY: number; scale: number } } | null>(null)
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
  // "Done" (✓) keeps them. ✕ restores EVERYTHING the session can change in the store: the committed
  // shape (through commitGeometry), the blend, the image adjustments, and the photo position —
  // KAI-8971/F2: imageFx+artwork were missing, so a ✕ kept a 129% Bright committed. (Tune/fairing
  // prefs intentionally survive ✕ — tool calibration, not design state; Dan's #21.)
  const preEditRef = useRef<{ committedShape: VShape | null; bgBlur: number | null; imageFx: ImageFx | null; artwork: DesignState }>({ committedShape: null, bgBlur: null, imageFx: null, artwork: INITIAL_ARTWORK })
  const [allSelected, setAllSelected] = useState(false) // tap inside the cut → select every corner, edit them together
  const [frameLocked, setFrameLocked] = useState(true) // 6.2/6.3: corner pull = SCALE when locked / deform when unlocked
  const nodeInteractedRef = useRef(false) // a node tap just happened → suppress the bubbling surface-click (which would re-select all)
  const dragStartRef = useRef<Vec2Px | null>(null) // pointer-down point → distinguish a tap (select) from a drag (move)
  const nodeRRef = useRef(11) // current node radius in content px (segment-tap hit tolerance)
  const svgRef = useRef<SVGSVGElement>(null)
  // content dims for the G11 view machinery (image space — independent of any document model)
  const dimsRef = useRef({ widthPx: VIEW_W, heightPx: VIEW_H })
  useEffect(() => {
    const sync = () => {
      const sp = useOutlineStore.getState().spec
      if (sp) dimsRef.current = { widthPx: sp.maskWidthPx, heightPx: sp.maskHeightPx }
    }
    sync()
    return useOutlineStore.subscribe(sync)
  }, [])
  // Run 2 · seam 4: the G11 view machinery lives in editor/useCanvasView.
  const { view, setView, viewRef, screenToContent, originPinning, applyZoom, toViewBox } = useCanvasView(svgRef, dimsRef)
  const pinchRef = useRef<{ d0: number; scale0: number; c0: Vec2Px } | null>(null) // two-finger pinch zoom (client-space)
  const canvasPanRef = useRef<{ startClient: Vec2Px; vx0: number; vy0: number } | null>(null) // drag-outside pan (zoomed)
  const clientPtsRef = useRef<Map<number, Vec2Px>>(new Map()) // pointerId → CLIENT coords (pinch math)
  const spec = useOutlineStore((s) => s.spec)
  // image dims (the canvas space) — from the spec, with the inert pre-image placeholder size
  const imgW = spec?.maskWidthPx ?? VIEW_W
  const imgH = spec?.maskHeightPx ?? VIEW_H
  const setBgBlur = useOutlineStore((s) => s.setBgBlur)
  const subjMatteUrl = useOutlineStore((s) => s.subjMatteUrl)
  const art = useOutlineStore((s) => s.artwork)
  const [preview, setPreview] = useState(false) // hide anchors/handles to see the clean result (no exit)
  // Points state: entered by the explicit Frame⇄Points mode button (Dan, KAI-9022) OR by
  // double-tapping the shape body — the gesture alone proved unreachable on Magic cuts.
  const [showAnchors, setShowAnchors] = useState(true)
  // Run 6 — points on demand: selected vector anchor (outer path index), transient drag shape
  // (per-tick preview only; ONE applyVec on release — §6.3), and the active drag descriptor.
  const [selVA, setSelVA] = useState<number | null>(null)
  const [selSeg, setSelSeg] = useState<number | null>(null) // 6.7: tapped segment (Points) — node bar inserts at ITS midpoint
  // KAI-9013: pointer-based double-tap detector (350ms/24px — the hero's proven thresholds);
  // the dblclick event missed real touch/trackpad sequences and was gated to the shape FILL.
  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const [vecLive, setVecLive] = useState<VShape | null>(null)
  const vecLiveRef = useRef<VShape | null>(null)
  useEffect(() => { vecLiveRef.current = vecLive }, [vecLive])
  const vecDragRef = useRef<{ kind: 'p' | 'hIn' | 'hOut'; ai: number; orig: VShape; moved: boolean } | null>(null)

  const syncSlidersTo = useCallback(() => {
    setRadius(0)
    setCurveVal(0)
    setAllSelected(false)
    setSelVA(null)
    setSelSeg(null)
    setVecLive(null)
  }, [])
  // Undo/redo step the {source, adjustments} history (VD10); the hook restores the store, we just
  // resync the transient slider/selection UI to the restored state.
  const undo = useCallback(() => { if (undoEdit()) syncSlidersTo() }, [undoEdit, syncSlidersTo])
  const redo = useCallback(() => { if (redoEdit()) syncSlidersTo() }, [redoEdit, syncSlidersTo])

  // Open the editor FROM the V4 truth (blueprint §2): the store holds `source + adjustments`. On a
  // FRESH design (source null) we seed an OutlineSource; on REOPEN the live source+adjustments persist
  // (resolve = display). The seed is NOT undoable. §6.3 freeze defers the 3D rebuild to close; ✕ Close
  // restores the pre-open snapshot.
  useEffect(() => {
    if (!open) return
    const st0 = useOutlineStore.getState()
    // snapshot FIRST — ✕ Close restores exactly this through the one writer (committedShape = resolved)
    preEditRef.current = { committedShape: st0.committedShape, bgBlur: st0.bgBlur, imageFx: st0.imageFx, artwork: st0.artwork }
    st0.setEditorOpen(true) // §6.3: scene frozen → 3D rebuilds defer to close
    // session view/interaction state reset
    setCurveVal(0)
    setPreviewAdj(null)
    setView({ scale: 1, vx: 0, vy: 0 }) // G11: fresh session starts at fit
    setAllSelected(false)
    setShapeKind(null)
    setShapePreview(null)
    setRotateLive(null); rotateLiveRef.current = null; rotateRef.current = null
    setMoveLive(null); moveLiveRef.current = null; moveRef.current = null
    setSelVA(null); setVecLive(null); vecDragRef.current = null
    pinchRef.current = null; canvasPanRef.current = null
    pointersRef.current.clear(); clientPtsRef.current.clear()
    setPreview(false)
    setConfirmDiscard(false)
    setShowAnchors(false) // FRAME is the default for every shape (plan A3); double-tap = Points
    // sync the blend ruler to the current 3D state (null = build default ≈ 50; 0 = off)
    setBlendBlur(st0.bgBlur == null ? 50 : Math.round(st0.bgBlur * 100))
    setRadius(0)
    // ── seed the session source (only when there is no live source yet) ──
    if (spec && !st0.source) {
      const image = { widthPx: spec.maskWidthPx, heightPx: spec.maskHeightPx }
      if (spec.generator.adapter !== 'standard') {
        // Magic (VD11): the immutable source IS the raw marching-squares straight polygon (spec.vectorShape,
        // RDP-normalized at generation). all-off → this exact polygon. Every tool (Detail / Smooth /
        // Radius / Curve) is a reversible adjustment ON it — no re-fair, no corner-pin on entry.
        seedSource({ shape: mintIds(spec.vectorShape), klass: 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx, rawTracePx: spec.rawTracePx as Pt[] | undefined }, undefined, false)
      } else {
        // pre-Magic (Dan, 2026-06-10): "choose a shape" — the centered 72% square with 8mm corners,
        // as a stock-class source (the rounding lives in the source vector; all-off shows it verbatim).
        const base = getShape('square', image.widthPx, image.heightPx)
        const side = Math.min(image.widthPx, image.heightPx) * 0.72
        const defaultR = Math.min(Math.round(8 / (spec.mmPerPx || 1)), Math.floor(side / 2))
        seedSource({ shape: mintIds(filletShape(base, defaultR)), klass: 'stock', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx }, undefined, false)
        setActiveAdjust('shape')
        setShapeKind('square')
        setShowAnchors(false) // rigid shape default — Points toggle re-enables
      }
    }
    // (no spec → nothing to seed; the page gates editor entry on an uploaded image)
    setImageSub('brightness')
    setAdjustSub('radius')
    setFxDraft(st0.imageFx ?? NEUTRAL_FX)
    imgPanRef.current = null
    // #27: toolbar creation modes land in the matching editor mode. The decision reads the
    // PRE-OPEN committed state (preEditRef) — the seed itself commits (visible = committed), so
    // reading the store here would always say "committed" and kill the choose-a-shape opening
    // (caught visually: pre-Magic opens were landing in Adjust instead of the Shape sheet).
    if (openMode === 'image') setActiveAdjust('image') // KAI-9027: the hero Filters entry
    else if (openMode === 'shape') setActiveAdjust('shape')
    else if (spec?.generator.adapter !== 'standard' || preEditRef.current.committedShape) setActiveAdjust('adjust')
    else setActiveAdjust('shape') // pre-Magic standard, nothing committed before open: choose a shape (Dan, 2026-06-10)
    histRef.current = { past: [], future: [] } // fresh undo history per session (the seed is not undoable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // RENDER CORE (single truth): the vector display shape is the ONE render source; transient
  // tick previews (tune/generator morphs) are display-only `d` strings layered above it.

  // Radius range = the TRUE geometric max of the CURRENT shape (KAI-8940): half the short side of
  // its box — 100% on a square IS the inscribed circle. The old ¼-image clamp stopped the slider
  // at ~69% of the square's real maximum, which is why 100% never made the circle.
  const maxRadius = useMemo(() => {
    if (vshape) {
      const bb = shapeBBox(vshape, 1)
      return Math.max(1, Math.round(Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2))
    }
    return Math.max(1, Math.round(Math.min(imgW, imgH) / 2))
  }, [vshape, imgW, imgH])

  // (REBUILD-PLAN-v2 §B3: the old editor→3D contour-push effect lived HERE, gated on `open` —
  // the close-boundary bug class. It is gone: commitGeometry derives the contour inside every
  // commit, synchronously. No geometry state rides a React effect.)

  // Vector display shape: the in-flight anchor/handle drag (vecLive) supersedes the committed
  // vshape; the live Scale preview transforms it exactly (affine on anchors+handles). One source
  // for BOTH the rendered path and the anchor/handle overlay, so they never desync mid-gesture.
  const vDisplay = useMemo(() => {
    if (!vshape) return null
    return vecLive ?? vshape
  }, [vshape, vecLive])

  // The rendered path: true SVG curves from the display shape (crisp at any zoom).
  const pathD = useMemo(() => {
    // a producer morph (generator tick) supersedes as a display ring; else the resolved display as
    // TRUE SVG curves — crisp at ANY zoom. Global/radius/curve ticks re-resolve `vshape` directly,
    // so there is no separate tune-preview string.
    if (shapePreview) return shapePreview
    return vDisplay ? shapeToSVGPathD(vDisplay, 2) : ''
  }, [shapePreview, vDisplay])

  // HIT RING (session adapter, ring math only): the displayed shape flattened once per commit —
  // feeds inside-tests, bboxes, grips. Never persisted, never geometry.
  const hitRing = useMemo<Vec2Px[]>(() => {
    if (!vDisplay) return []
    try { return flattenShape(vDisplay, 0.5)[0]?.map((pt) => [pt.x, pt.y] as Vec2Px) ?? [] } catch { return [] }
  }, [vDisplay])
  const hitBBox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of hitRing) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
    return { minX, minY, maxX, maxY }
  }, [hitRing])
  // inline manufacturability guardrail — same ring-math verdict class as the engine gate
  const hasIssues = useMemo(() => hitRing.length >= 4 && validateSelfIntersection(hitRing, 'outer').length > 0, [hitRing])
  // tier-2 availability: Radius needs a CORNER to round. Keyed off the IMMUTABLE SOURCE (which always
  // keeps its corners), NOT the resolved display — otherwise rounding every corner removes the display
  // corners, greys the control, and you can't dial Radius back to 0 (Codex F3 reversibility bug).
  const radiusApplies = useMemo(
    () => (!!source && source.shape.paths.some((p) => p.anchors.some((a) => a.corner))) ||
          (!!vshape && vshape.paths[0].anchors.some((a) => a.corner)),
    [source, vshape],
  )

  // Run 6 — points on demand: build the transient shape for an in-flight anchor/handle drag.
  // Anchor drag translates p + both handles together; a SMOOTH anchor's handle drag mirrors the
  // opposite handle's DIRECTION while preserving its own length (Figma default); a CORNER
  // anchor's handles move independently.
  const vecDragShape = useCallback((d: { kind: 'p' | 'hIn' | 'hOut'; ai: number; orig: VShape }, at: Vec2Px): VShape => {
    const path = d.orig.paths[0]
    const anchors = path.anchors.map((a) => ({ ...a }))
    const a = anchors[d.ai]
    if (!a) return d.orig
    if (d.kind === 'p') {
      const dx = at[0] - a.p.x, dy = at[1] - a.p.y
      anchors[d.ai] = {
        ...a,
        p: { x: at[0], y: at[1] },
        hIn: a.hIn ? { x: a.hIn.x + dx, y: a.hIn.y + dy } : a.hIn,
        hOut: a.hOut ? { x: a.hOut.x + dx, y: a.hOut.y + dy } : a.hOut,
      }
    } else {
      const h = { x: at[0], y: at[1] }
      const upd: VAnchor = { ...a, [d.kind === 'hIn' ? 'hIn' : 'hOut']: h }
      if (!a.corner) {
        const otherKey = d.kind === 'hIn' ? 'hOut' : 'hIn'
        const oh = a[otherKey]
        if (oh) {
          const dx = a.p.x - h.x, dy = a.p.y - h.y
          const L = Math.hypot(dx, dy) || 1e-12
          const ol = Math.hypot(oh.x - a.p.x, oh.y - a.p.y)
          upd[otherKey] = { x: a.p.x + (dx / L) * ol, y: a.p.y + (dy / L) * ol }
        }
      }
      anchors[d.ai] = upd
    }
    return { paths: [{ anchors }, ...d.orig.paths.slice(1)] }
  }, [])

  const onVAnchorDown = useCallback(
    (i: number) => (e: React.PointerEvent) => {
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      nodeInteractedRef.current = true
      setAllSelected(false)
      setSelVA(i)
      dragStartRef.current = toViewBox(e.clientX, e.clientY)
      if (vshapeRef.current) vecDragRef.current = { kind: 'p', ai: i, orig: vshapeRef.current, moved: false }
    },
    [toViewBox, vshapeRef],
  )
  const onVHandleDown = useCallback(
    (i: number, kind: 'hIn' | 'hOut') => (e: React.PointerEvent) => {
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      nodeInteractedRef.current = true
      dragStartRef.current = toViewBox(e.clientX, e.clientY)
      if (vshapeRef.current) vecDragRef.current = { kind, ai: i, orig: vshapeRef.current, moved: false }
    },
    [toViewBox, vshapeRef],
  )
  // double-tap a vector anchor → delete with re-fit (ring stays valid, ≥3 anchors)
  const onVAnchorDouble = useCallback(
    (i: number) => (e: React.MouseEvent) => {
      e.stopPropagation()
      const v = vshapeRef.current
      if (!v || v.paths[0].anchors.length <= 3) return
      applyVec({ paths: [deleteAnchorRefit(v.paths[0], i), ...v.paths.slice(1)] }, null)
      setSelVA(null)
    },
    [applyVec, vshapeRef],
  )


  // Surface pointer-down: track active pointers (for the two-finger twist). A second surface
  // pointer (while not dragging a node) arms the rotate gesture.
  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (preview) return // view-only
      // KAI-9013: two primary downs within 350ms/24px ANYWHERE on the surface = Frame ⇄ Points
      // (no fill gate — on a Magic cut most of the canvas is outside the outline). Image mode
      // keeps its pan gesture untouched.
      if (e.isPrimary && activeAdjust !== 'image') {
        const lt = lastTapRef.current
        const now = performance.now()
        if (lt && now - lt.t < 350 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 24) {
          lastTapRef.current = null
          setShowAnchors((v) => !v)
          setSelVA(null)
          setAllSelected(false)
          return
        }
        lastTapRef.current = { x: e.clientX, y: e.clientY, t: now }
      }
      const p = toViewBox(e.clientX, e.clientY)
      pointersRef.current.set(e.pointerId, p)
      clientPtsRef.current.set(e.pointerId, [e.clientX, e.clientY])
      // Image mode: a single finger inside pans the PHOTO under the cutline (plan A2 — position
      // is a direct gesture, no Position button; works whichever dial is active)
      if (activeAdjust === 'image' && pointersRef.current.size === 1) {
        const a = useOutlineStore.getState().artwork
        imgPanRef.current = { startClient: [e.clientX, e.clientY], art0: { ...a } }
        return
      }
      // a second surface finger → PINCH: canvas zoom + pan (G11). Rotation stays on the handle.
      if (pointersRef.current.size === 2) {
        moveRef.current = null; setMoveLive(null); moveLiveRef.current = null
        canvasPanRef.current = null
        const cp = [...clientPtsRef.current.values()]
        const d0 = Math.hypot(cp[1][0] - cp[0][0], cp[1][1] - cp[0][1]) || 1
        const cMid: Vec2Px = [(cp[0][0] + cp[1][0]) / 2, (cp[0][1] + cp[1][1]) / 2]
        pinchRef.current = { d0, scale0: viewRef.current.scale, c0: screenToContent(cMid[0], cMid[1], viewRef.current) }
        return
      }
      // single finger pressed INSIDE the outline → arm a move (tap vs drag decided by the threshold)
      if (hitRing.length >= 3 && pointInPolygon(p, hitRing)) {
        moveRef.current = { start: p, bbox: hitBBox }
      } else if (viewRef.current.scale > 1.01) {
        // outside the outline while zoomed in → pan the canvas (G11 fine edge work)
        canvasPanRef.current = { startClient: [e.clientX, e.clientY], vx0: viewRef.current.vx, vy0: viewRef.current.vy }
      }
    },
    // KAI-8984: activeAdjust was missing — the svg kept a STALE closure after a mode switch, so
    // the first drag in Image mode routed to move-the-outline instead of pan-the-photo (and
    // silently committed a shape move). The dep makes the handler follow the mode.
    [toViewBox, hitRing, hitBBox, preview, screenToContent, viewRef, activeAdjust],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, toViewBox(e.clientX, e.clientY))
      if (clientPtsRef.current.has(e.pointerId)) clientPtsRef.current.set(e.pointerId, [e.clientX, e.clientY])
      // Run 6: live vector anchor/handle drag — per-tick transient only, ONE applyVec on release (§6.3)
      if (vecDragRef.current) {
        const at = toViewBox(e.clientX, e.clientY)
        const d = vecDragRef.current
        const s = dragStartRef.current
        if (!d.moved && s && Math.hypot(at[0] - s[0], at[1] - s[1]) <= 2) return // tap threshold
        d.moved = true
        setVecLive(vecDragShape(d, at))
        return
      }
      // #28: live photo pan (Image-Position) — fractions of the texture span, matching the scene's G1
      if (imgPanRef.current) {
        const svg = svgRef.current
        if (svg) {
          const rect = svg.getBoundingClientRect()
          const { startClient, art0 } = imgPanRef.current
          const fx = (e.clientX - startClient[0]) / rect.width
          const fy = (e.clientY - startClient[1]) / rect.height
          const st = useOutlineStore.getState()
          st.setArtwork({ ...art0, offsetX: Math.max(-0.5, Math.min(0.5, art0.offsetX + fx)), offsetY: Math.max(-0.5, Math.min(0.5, art0.offsetY - fy)) })
        }
        return
      }
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
          const W = imgW, H = imgH
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
        const W = imgW, H = imgH
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
    },
    [toViewBox, imgW, imgH, originPinning, vecDragShape, setView, viewRef],
  )

  const commitRotate = useCallback(() => {
    const rl = rotateLiveRef.current
    if (rl && Math.abs(rl.deg) > 0.01) {
      // exact rotation on the SOURCE (ids preserved → per-anchor adjustments survive the transform)
      const rad = (rl.deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad)
      const t = (p: Vec2) => ({ x: rl.cx + (p.x - rl.cx) * c - (p.y - rl.cy) * s, y: rl.cy + (p.x - rl.cx) * s + (p.y - rl.cy) * c })
      transformSource(t)
    }
    rotateLiveRef.current = null; setRotateLive(null)
    nodeInteractedRef.current = true // suppress the click that follows so it doesn't re-select-all
  }, [transformSource])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    clientPtsRef.current.delete(e.pointerId)
    // Run 6: release an anchor/handle drag → ONE history entry; a manual point edit invalidates
    // the pristine fillet base (Radius adopts the current geometry on next use).
    if (vecDragRef.current) {
      const d = vecDragRef.current
      vecDragRef.current = null
      const live = vecLiveRef.current
      setVecLive(null)
      if (d.moved && live) applyVec(live, null)
      return
    }
    if (imgPanRef.current) { imgPanRef.current = null; nodeInteractedRef.current = true; return }
    if (pinchRef.current) { if (clientPtsRef.current.size < 2) pinchRef.current = null; return }
    if (canvasPanRef.current) { canvasPanRef.current = null; nodeInteractedRef.current = true; return }
    if (rotateRef.current) { rotateRef.current = null; commitRotate(); return }
    if (moveRef.current) {
      const ml = moveLiveRef.current
      moveRef.current = null
      if (ml) {
        const t = (p: Vec2) => ({ x: p.x + ml.dx, y: p.y + ml.dy })
        transformSource(t)
        moveLiveRef.current = null; setMoveLive(null)
      }
      return // no move = a tap → onSurfaceClick selects all
    }
  }, [commitRotate, applyVec, transformSource])

  // Run 6 — explicit vector-anchor actions (the nodeBar): add centered ON the curve after the
  // selected anchor (Figma "insert between"), or delete with re-fit.
  const onVAddAfter = useCallback(() => {
    const v = vshapeRef.current
    if (!v || selVA === null) return
    applyVec({ paths: [insertAnchorCentered(v.paths[0], selVA), ...v.paths.slice(1)] }, null)
    setSelVA(selVA + 1)
    setShowAnchors(true)
  }, [selVA, applyVec, vshapeRef])
  const onVDelete = useCallback(() => {
    const v = vshapeRef.current
    if (!v || selVA === null) return
    if (v.paths[0].anchors.length > 3) applyVec({ paths: [deleteAnchorRefit(v.paths[0], selVA), ...v.paths.slice(1)] }, null)
    setSelVA(null)
  }, [selVA, applyVec, vshapeRef])
  // KAI-8982 D2 — sharpen ⇄ smooth the selected anchor (Dan's 06-07 ruling: the user makes sharp
  // corners deliberately). Sharpen marks the anchor a TRUE corner (handles go independent);
  // smooth re-mirrors the handles collinear (average tangent, lengths preserved).
  const onVToggleCorner = useCallback(() => {
    const v = vshapeRef.current
    if (!v || selVA === null) return
    const anchors = v.paths[0].anchors.map((a) => ({ ...a }))
    const a = anchors[selVA]
    if (!a) return
    if (a.corner) {
      const hIn = a.hIn, hOut = a.hOut
      if (hIn && hOut) {
        const inL = Math.hypot(hIn.x - a.p.x, hIn.y - a.p.y)
        const outL = Math.hypot(hOut.x - a.p.x, hOut.y - a.p.y)
        let tx = (hOut.x - a.p.x) / (outL || 1) - (hIn.x - a.p.x) / (inL || 1)
        let ty = (hOut.y - a.p.y) / (outL || 1) - (hIn.y - a.p.y) / (inL || 1)
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
        anchors[selVA] = { ...a, corner: false, hIn: { x: a.p.x - tx * inL, y: a.p.y - ty * inL }, hOut: { x: a.p.x + tx * outL, y: a.p.y + ty * outL } }
      } else {
        anchors[selVA] = { ...a, corner: false }
      }
    } else {
      anchors[selVA] = { ...a, corner: true } // handles stay where they are — now independent
    }
    applyVec({ paths: [{ anchors }, ...v.paths.slice(1)] }, null)
  }, [selVA, applyVec, vshapeRef])

  // (Hug is PARKED out of core — D4. The engine's fields-once SDF evaluator stays ready in
  // outline-core/prepareSdfBlend for its post-core refinement; no UI tool ships here.)

  // Tap the surface (not a node): inside the cut → SELECT ALL corners (scale/twist them together);
  // outside → deselect. (Node taps stopPropagation, so they never reach here.)
  const onSurfaceClick = useCallback((e: React.MouseEvent) => {
    if (preview) return
    if (nodeInteractedRef.current) { nodeInteractedRef.current = false; return } // a node tap → keep single selection
    if ((e.target as Element)?.tagName === 'circle') return // tapped a node handle, not the surface
    const p = toViewBox(e.clientX, e.clientY)
    // 6.7 (Points): a tap ON the line selects that SEGMENT — the node bar's + inserts at its midpoint
    if (showAnchors && vshapeRef.current) {
      const hit = nearestOnPath(vshapeRef.current.paths[0], { x: p[0], y: p[1] })
      if (hit.dist < nodeRRef.current * 1.6) {
        setSelSeg(hit.seg)
        setSelVA(null)
        setAllSelected(false)
        return
      }
    }
    setSelSeg(null)
    if (hitRing.length >= 3 && pointInPolygon(p, hitRing)) {
      setSelVA(null)
      setAllSelected(true)
    } else {
      setSelVA(null)
      setAllSelected(false)
    }
  }, [hitRing, toViewBox, preview, showAnchors, vshapeRef])

  // ── LOCAL adjustments (Radius / Curve) — keyed by STABLE source id (VD2/VD9), reversible (off →
  //    exact source corner), PINNED through any global pass. Edits ALWAYS map to a SOURCE id (the
  //    selected anchor's own id when present — a filleted corner carries its source id (F1) — else the
  //    NEAREST source anchor). So there is NO bake fallback and globals are never silently reset (F1).
  const sourceIdForSelection = useCallback((): string | null => {
    const disp = vshapeRef.current
    if (!disp || selVA === null) return null
    const a = disp.paths[0].anchors[selVA]
    if (!a) return null
    const src = useOutlineStore.getState().source
    if (!src) return null
    const ids = new Set<string>()
    src.shape.paths.forEach((p) => p.anchors.forEach((x) => { if (x.id) ids.add(x.id) }))
    if (a.id && ids.has(a.id)) return a.id // direct — source anchor, pinned anchor, or filleted carrying its id
    let best: string | null = null, bd = Infinity // transient faired anchor → nearest source id (stay on recipe)
    src.shape.paths.forEach((p) => p.anchors.forEach((x) => {
      if (!x.id) return
      const d = (x.p.x - a.p.x) ** 2 + (x.p.y - a.p.y) ** 2
      if (d < bd) { bd = d; best = x.id }
    }))
    return best
  }, [selVA, vshapeRef])

  /** write a local adjustment onto target source ids (preview or commit). */
  const writeLocal = useCallback((ids: string[], mut: LocalAdjustment, commit: boolean) => {
    if (!ids.length) return
    const adj = useOutlineStore.getState().adjustments
    const local = { ...adj.local }
    for (const id of ids) local[id] = { ...local[id], ...mut }
    const next = { global: adj.global, local }
    if (commit) applyAdjustments(next); else setPreviewAdj(next)
  }, [applyAdjustments, setPreviewAdj])

  // RADIUS — a SELECTED corner rounds alone; with NO selection it rounds EVERY corner (whole-shape,
  // like the old build). 0 = sharp (off), reversible. Targets SOURCE corner ids → pinned through global.
  const radiusTargets = useCallback((): string[] => {
    const sel = sourceIdForSelection()
    if (sel) return [sel]
    const src = useOutlineStore.getState().source
    return src ? src.shape.paths.flatMap((p) => p.anchors.filter((a) => a.corner && a.id).map((a) => a.id as string)) : []
  }, [sourceIdForSelection])
  const previewRadius = useCallback((v: number) => { setRadius(v); writeLocal(radiusTargets(), { radius: v }, false) }, [writeLocal, radiusTargets])
  const commitRadius = useCallback((v: number) => {
    setRadius(v)
    const t0 = performance.now()
    writeLocal(radiusTargets(), { radius: v }, true)
    perfGesture('round-commit', performance.now() - t0)
  }, [writeLocal, radiusTargets])
  // CURVE — bend the SELECTED anchor (needs a point selected). 0 = straight (off), 100 = strong.
  const previewCurve = useCallback((v: number) => { setCurveVal(v); const id = sourceIdForSelection(); if (id) writeLocal([id], { curve: (v / 100) * 2 }, false) }, [writeLocal, sourceIdForSelection])
  const commitCurve = useCallback((v: number) => {
    setCurveVal(v)
    const t0 = performance.now()
    const id = sourceIdForSelection(); if (id) writeLocal([id], { curve: (v / 100) * 2 }, true)
    perfGesture('curve-commit', performance.now() - t0)
  }, [writeLocal, sourceIdForSelection])
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
    const b = hitBBox
    if (!(b.maxX > b.minX) || !(b.maxY > b.minY)) return
    const ax = which.includes('w') ? b.maxX : which.includes('e') ? b.minX : (b.minX + b.maxX) / 2
    const ay = which.includes('n') ? b.maxY : which.includes('s') ? b.minY : (b.minY + b.maxY) / 2
    stretchRef.current = { which, ax, ay, bbox: b, sx: 1, sy: 1 }
  }, [hitBBox])
  const moveStretch = useCallback((e: React.PointerEvent) => {
    const st = stretchRef.current
    if (!st) return
    const [px, py] = toViewBox(e.clientX, e.clientY)
    const b = st.bbox
    const W = imgW, H = imgH
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
    // 6.2: a LOCKED frame scales uniformly on corner pulls (aspect preserved); edges always stretch
    if (frameLocked && st.which.length === 2) { const u = Math.max(sx, sy); sx = u; sy = u }
    stretchRef.current = { ...st, sx, sy }
    setStretchLive({ sx, sy, ax: st.ax, ay: st.ay })
  }, [toViewBox, imgW, imgH, frameLocked])
  const endStretch = useCallback(() => {
    const st = stretchRef.current
    if (!st) return
    stretchRef.current = null
    setStretchLive(null)
    if (Math.abs(st.sx - 1) < 0.004 && Math.abs(st.sy - 1) < 0.004) return // a tap, not a pull
    const t0 = performance.now()
    {
      // exact anisotropic transform on the SOURCE (ids preserved → per-anchor adjustments survive)
      const t = (p: Vec2) => ({ x: st.ax + (p.x - st.ax) * st.sx, y: st.ay + (p.y - st.ay) * st.sy })
      transformSource(t)
    }
    perfGesture('stretch-commit', performance.now() - t0)
  }, [transformSource])

  // ── GLOBAL adjustments (Detail / Smooth / Snap / Angle / Line) — INDEPENDENT 0..100 axes written to
  //    adjustments.global. Slider ticks PREVIEW (the display re-resolves; no commit, no history);
  //    release COMMITS via applyAdjustments. The fairing + fold guard live in resolve() (VD12) — the
  //    editor never fits, fairs, or repairs here. Reversible: every axis OFF → exact source.
  const previewGlobal = useCallback((g: GlobalAdjustments) => {
    const t0 = performance.now()
    setPreviewAdj({ global: g, local: useOutlineStore.getState().adjustments.local })
    perfGesture('tune-tick', performance.now() - t0)
  }, [setPreviewAdj])
  const commitGlobal = useCallback((g: GlobalAdjustments) => {
    const t0 = performance.now()
    applyAdjustments({ global: g, local: useOutlineStore.getState().adjustments.local })
    setAllSelected(false)
    perfGesture('tune-commit', performance.now() - t0)
  }, [applyAdjustments])

  // KAI-9023: a NEW shaped spec landing mid-session (editor-dock Magic) re-seeds the source from the
  // fresh raw marching-squares polygon (all-off = raw); the session stays open.
  const lastSpecRef = useRef(spec)
  useEffect(() => {
    if (!open) { lastSpecRef.current = spec; return }
    if (spec === lastSpecRef.current) return
    lastSpecRef.current = spec
    if (!spec || spec.generator.adapter === 'standard') return
    seedSource({ shape: mintIds(spec.vectorShape), klass: 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx, rawTracePx: spec.rawTracePx as Pt[] | undefined })
    setRadius(0); setCurveVal(0); setSelVA(null); setAllSelected(false)
  }, [spec, open, seedSource])

  const onReset = useCallback(() => {
    // KAI-9025 (Dan): Reset → the original full-image square with 8mm corners, for EVERY class. THE one
    // birth construction (standardBirthShape — product birth uses it too, so they can't diverge), as a
    // fresh stock-class source with adjustments OFF.
    if (!spec) return // no design in the editor (the page gates entry) — nothing to reset
    const birth = standardBirthShape(spec.maskWidthPx, spec.maskHeightPx)
    seedSource({ shape: mintIds(birth.vectorShape), klass: 'stock', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx })
    setRadius(0); setCurveVal(0)
    setAllSelected(false)
    setShapeKind(null); setShapePreview(null)
  }, [spec, seedSource])

  // TRANSIENT PREVIEW ONLY: the live morph shown while a generator tick-bar drags — a display
  // ring `d`, never geometry (commitShape fits ONCE into the vector on release).
  const shapePreviewD = useCallback((kind: ShapeKind, overrides: Partial<ShapeParams> = {}): string => {
    const { widthPx, heightPx } = dimsRef.current
    const ring = resampleClosed(generateShapeRing({ kind, ...shapeParamsRef.current, ...overrides }, widthPx, heightPx), Math.max(widthPx, heightPx) / 220)
    return ringPathD(ring)
  }, [])
  /** Run 3: a live generator's output FITTED ONCE into a true vector path (sub-10ms). */
  const vecFromGenerator = useCallback((kind: ShapeKind, overrides: Partial<ShapeParams> = {}): VShape => {
    const { widthPx, heightPx } = dimsRef.current
    const ring = resampleClosed(generateShapeRing({ kind, ...shapeParamsRef.current, ...overrides }, widthPx, heightPx), Math.max(widthPx, heightPx) / 600)
    const tol = Math.max(0.4, Math.min(widthPx, heightPx) / 1600)
    // compaction budget 2x fit tolerance + the mm-true pair floor (KAI-8974 re-gate: the daisy's
    // 10px valley double survived the relative floor — finger distinctness is a PHYSICAL fact)
    const minPair = MIN_ANCHOR_SEPARATION_MM / (useOutlineStore.getState().spec?.mmPerPx || 70 / Math.max(widthPx, heightPx))
    const path = ringToVPath(ring.map(([x, y]) => ({ x, y })), 60, tol, undefined, tol * 2, minPair)
    return { paths: [path] }
  }, [])
  const pickShape = useCallback((kind: ShapeKind) => {
    setShapeKind(kind)
    setShapePreview(null)
    // VECTOR CORE: vector-native kinds spawn as TRUE Bézier shapes from the static library —
    // zero sampling, zero fitting; the doc becomes a derived shadow for interaction math.
    if (hasVectorDef(kind)) {
      const { widthPx, heightPx } = dimsRef.current
      const sp = shapeParamsRef.current
      const base = getShape(kind, widthPx, heightPx, { sides: sp.sides, points: sp.points, spikiness: sp.spikiness })
      applyVec(base, base, 'vector')
      setRadius(0); setAllSelected(false)
      setShowAnchors(false)
      return
    }
    const overrides: Partial<ShapeParams> = {}
    if (kind === 'blob') { // fresh blob per pick; the dice rerolls further
      overrides.seed = Math.floor(Math.random() * 1e9)
      const next = { ...shapeParamsRef.current, seed: overrides.seed! }
      shapeParamsRef.current = next; setShapeParams(next)
    }
    // Run 3: live generators spawn as FITTED vector paths — segments never leave the generator
    if (GEN_VECTOR_KINDS.has(kind)) {
      applyVec(vecFromGenerator(kind, overrides), null, 'vector')
      setRadius(0); setAllSelected(false)
      setShowAnchors(false)
      return
    }
    // every ShapeKind is vector-constructed (library def or fitted generator) — an uncovered
    // kind is a build error, never a polyline (single geometry truth)
    throw new Error(`pickShape: no vector construction for shape "${kind}"`)
  }, [applyVec, vecFromGenerator])
  /** stepper: ±delta on an integer param, regenerate immediately (undoable). */
  const nudgeParam = useCallback((key: 'sides' | 'points' | 'lobes' | 'petals' | 'blades', delta: number, min: number, max: number) => {
    if (!shapeKind) return
    const n = Math.max(min, Math.min(max, (shapeParamsRef.current[key] ?? min) + delta))
    const next = { ...shapeParamsRef.current, [key]: n }
    shapeParamsRef.current = next; setShapeParams(next)
    // vector kinds (polygon/star) regenerate their exact construction with the new param
    if (hasVectorDef(shapeKind)) {
      const { widthPx, heightPx } = dimsRef.current
      const base = getShape(shapeKind, widthPx, heightPx, { sides: next.sides, points: next.points, spikiness: next.spikiness })
      applyVec(base, base, 'vector')
      return
    }
    // generator kinds re-fit their new construction (petals/blades/lobes steppers)
    if (GEN_VECTOR_KINDS.has(shapeKind)) {
      applyVec(vecFromGenerator(shapeKind, { [key]: n }), null, 'vector')
      return
    }
    throw new Error(`nudgeParam: no vector construction for shape "${shapeKind}"`)
  }, [shapeKind, applyVec, vecFromGenerator])
  /** tick-bar: transient preview per tick (§6.3); commitShape applies on release. */
  const previewParam = useCallback((key: 'spikiness' | 'pinch' | 'depth' | 'swirl' | 'waviness', v: number) => {
    if (!shapeKind) return
    const next = { ...shapeParamsRef.current, [key]: v }
    shapeParamsRef.current = next; setShapeParams(next)
    if (hasVectorDef(shapeKind)) return // vector kinds regenerate exactly on release (commitShape)
    setShapePreview(shapePreviewD(shapeKind, { [key]: v }))
  }, [shapeKind, shapePreviewD])
  /** blob dice: reroll the seed, regenerate immediately (undoable). */
  const rerollBlob = useCallback(() => {
    if (shapeKind !== 'blob') return
    const seed = Math.floor(Math.random() * 1e9)
    const next = { ...shapeParamsRef.current, seed }
    shapeParamsRef.current = next; setShapeParams(next)
    applyVec(vecFromGenerator('blob', { seed }), null, 'vector') // Run 3: the dice rolls a vector
  }, [shapeKind, applyVec, vecFromGenerator])
  /** Land an uploaded shape: fit into the image box, first-class vector. SVG keeps itself as the
   *  pristine base (clean authored corners); a traced image adopts no base (fitted geometry). */
  const landUploadedShape = useCallback((raw: VShape, withBase: boolean) => {
    const { widthPx, heightPx } = dimsRef.current
    const v = fitShapeToBox(raw, widthPx, heightPx)
    applyVec(v, withBase ? v : null, 'vector')
    setShapeKind(null)
    setShapePreview(null)
    setRadius(0); setAllSelected(false)
    setShowAnchors(false)
  }, [applyVec])
  /** Image upload (V4): decode → threshold mask → the SAME machinery as Magic — smoothMask →
   *  traceContourRaw → RDP-straight polygon. NO corner-pin, NO fairing: the result is a raw
   *  marching-squares OutlineSource; the editor's tools shape it (impartial with Magic / stock / drawn).
   *  Winding is matched to Magic's source (signedArea<0 in y-down editor space) so the mesh edge can
   *  never invert for an upload. landUploadedShape box-fits it before it becomes the source. */
  const vecFromImageFile = useCallback(async (file: File): Promise<VShape> => {
    const bmp = await createImageBitmap(file)
    try {
      const MAX = 512
      const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
      const w = Math.max(2, Math.round(bmp.width * k)), h = Math.max(2, Math.round(bmp.height * k))
      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')!
      ctx.drawImage(bmp, 0, 0, w, h)
      const { mask, width, height } = maskFromImageData(ctx.getImageData(0, 0, w, h))
      // mask hygiene Magic applies before tracing — Otsu on anti-aliased edges leaves sub-px jitter.
      const ring = traceContourRaw(smoothMask(mask, width, height, 3), width, height)
      if (!ring) throw new Error('No clear shape found — try an image with a stronger silhouette')
      // canvas coords ARE y-down (= editor space). traceContourRaw normalizes CCW; reverse it so the
      // upload source matches Magic's source winding (signedArea<0 in y-down) — no edge inversion.
      const oriented = [...ring].reverse()
      const straight = rdpClosed(oriented.map(([x, y]) => [x, y] as Vec2Px), 1.0)
      if (straight.length < 3) throw new Error('No clear shape found — try an image with a stronger silhouette')
      return { paths: [{ anchors: straight.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }] }
    } finally {
      bmp.close()
    }
  }, [])
  /** Run 8 + Run 10 — ONE upload entry: SVG outlines import verbatim through the dialect gate;
   *  images are vectorised under the hood. Failures are loud product language, never a mangle. */
  const onUploadShape = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // same file can be re-picked
    if (!file) return
    const isSVG = file.type.includes('svg') || /\.svg$/i.test(file.name)
    ;(isSVG
      ? file.text().then((text) => landUploadedShape(vshapeFromSVG(text), true))
      : vecFromImageFile(file).then((v) => landUploadedShape(v, false))
    ).catch((err: unknown) => toast('error', err instanceof Error ? err.message : 'This file could not be read'))
  }, [landUploadedShape, vecFromImageFile])

  const commitShape = useCallback(() => {
    if (shapeKind && hasVectorDef(shapeKind)) {
      const { widthPx, heightPx } = dimsRef.current
      const sp = shapeParamsRef.current
      applyVec(getShape(shapeKind, widthPx, heightPx, { sides: sp.sides, points: sp.points, spikiness: sp.spikiness }), null, 'vector')
      return
    }
    if (shapeKind && GEN_VECTOR_KINDS.has(shapeKind)) {
      // release bakes the live doc-morph into ONE fitted vector (§6.3: transient ticks, vector commit)
      setShapePreview(null)
      applyVec(vecFromGenerator(shapeKind), null, 'vector')
      return
    }
    // no doc commit remains — the preview is a display ring; GEN kinds committed above
  }, [shapeKind, applyVec, vecFromGenerator])

  // Rotation handlers — desktop handle + two-finger gesture both drive rotatePreview, baked on release.
  const beginRotateHandle = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const cx = (hitBBox.minX + hitBBox.maxX) / 2, cy = (hitBBox.minY + hitBBox.maxY) / 2
    const at = toViewBox(e.clientX, e.clientY)
    rotateRef.current = { cx, cy, start: Math.atan2(at[1] - cy, at[0] - cx) }
  }, [toViewBox, hitBBox])
  const toggleShape = useCallback(() => {
    setActiveAdjust((a) => (a === 'shape' ? null : 'shape'))
    setShapeKind(null); setShapePreview(null) // open the picker fresh (chips only) — no stale active shape
    setShowAnchors(false) // KAI-9020 symmetry: shape picking is frame-level work
  }, [])

  // Saving is AUTOMATIC: every edit commits THE truth through the single writer and the 3D follows
  // at the close boundary. So there's no explicit Save — "Done" just closes back to the scene (the
  // approved shape is already what's shown). It also collapses any open sub-menu first.
  const onDone = useCallback(() => {
    setActiveAdjust(null)
    setSelVA(null)
    setAllSelected(false)
    useOutlineStore.getState().setEditorOpen(false) // §6.3 boundary: the deferred 3D rebuild fires now
    onClose()
  }, [onClose])

  // UX-2 discard protection: a DIRTY ✕ asks once (tap ✕ again to discard) — no native dialog.
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // ✕ Close = discard this session's edits: restore the pre-open truth through THE one writer
  // (shape + contour revert atomically), revert blend + image-fx + photo position, exit.
  // (Done keeps; commits were live.) KAI-8971/F2: fx/artwork revert was missing.
  const onCancel = useCallback((force = false) => {
    if (histRef.current.past.length > 0 && !confirmDiscard && !force) { setConfirmDiscard(true); return }
    setConfirmDiscard(false)
    const pe = preEditRef.current
    const st = useOutlineStore.getState()
    st.commitGeometry(pe.committedShape) // null → back to the born truth (spec.vectorShape)
    if (st.bgBlur !== pe.bgBlur) st.setBgBlur(pe.bgBlur != null ? pe.bgBlur : 0.5) // revert blend (null ≈ build default)
    st.setImageFx(pe.imageFx)
    st.setArtwork(pe.artwork)
    setActiveAdjust(null)
    setSelVA(null)
    setAllSelected(false)
    st.setEditorOpen(false) // §6.3 boundary
    onClose()
  }, [onClose])

  if (!open) return null

  const canUndo = histRef.current.past.length > 0
  const canRedo = histRef.current.future.length > 0
  const nodeR = ((imgW / VIEW_W) * 11) / view.scale // constant on-screen size at any zoom (G11)
  nodeRRef.current = nodeR
  // Desktop rotate handle — a grip on a short stem above the outline, shown when all anchors are selected.
  let rotHandle: { bx: number; by: number; hy: number } | null = null
  if (allSelected && !preview && hitRing.length) {
    const bx = (hitBBox.minX + hitBBox.maxX) / 2
    rotHandle = { bx, by: hitBBox.minY, hy: hitBBox.minY - nodeR * 4 }
  }
  // live direct-manipulation transform on the outline group (stretch / rotate / move) — real-time, no doc rebuild
  const liveXform = stretchLive
    ? `translate(${stretchLive.ax} ${stretchLive.ay}) scale(${stretchLive.sx} ${stretchLive.sy}) translate(${-stretchLive.ax} ${-stretchLive.ay})`
    : rotateLive ? `rotate(${rotateLive.deg} ${rotateLive.cx} ${rotateLive.cy})` : moveLive ? `translate(${moveLive.dx} ${moveLive.dy})` : undefined
  // Crop grips (Dan: iOS-crop reference) — boxy shapes only; grips track the bbox, including the
  // live stretch (rendered OUTSIDE the transformed group so the pill strokes never distort).
  // 6.1: FRAME is the default for EVERY shape (Magic, committed, presets) — grips visible unless
  // Points is active, Preview hides chrome, or a transient morph is mid-flight
  const cropMode = !!vshape && !showAnchors && !preview && !shapePreview
  let cropBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  if (cropMode && hitRing.length) {
    let { minX, minY, maxX, maxY } = hitBBox
    if (stretchLive) {
      const m = (v: number, a: number, s: number) => a + (v - a) * s
      minX = m(minX, stretchLive.ax, stretchLive.sx); maxX = m(maxX, stretchLive.ax, stretchLive.sx)
      minY = m(minY, stretchLive.ay, stretchLive.sy); maxY = m(maxY, stretchLive.ay, stretchLive.sy)
    }
    cropBox = { minX, minY, maxX, maxY }
  }
  // #28: photo pan/zoom preview — mirrors the 3D texture mapping (x = s·X − W(s−1)/2 − ox·W)
  const artXform = art.scale !== 1 || art.offsetX !== 0 || art.offsetY !== 0
    ? `translate(${(-imgW * (art.scale - 1)) / 2 - art.offsetX * imgW} ${(-imgH * (art.scale - 1)) / 2 + art.offsetY * imgH}) scale(${art.scale})`
    : undefined
  const fxFilter = fxDraft.brightness !== 100 || fxDraft.contrast !== 100 || fxDraft.saturate !== 100 || fxDraft.warmth > 0
    ? `brightness(${fxDraft.brightness}%) contrast(${fxDraft.contrast}%) saturate(${fxDraft.saturate}%)${fxDraft.warmth > 0 ? ` sepia(${Math.round(fxDraft.warmth * 0.45)}%)` : ''}`
    : undefined
  // magic-blend live preview in the canvas: blurred photo + sharp subject overlay; blur reacts to intensity
  const showBlend = blendBlur > 0 && !!subjMatteUrl && !!imageUrl // 0 = off (the ruler IS the switch)
  const blendSd = (blendBlur / 100) * (imgW / 25)

  return (
    <div className={styles.overlay}>
      {/* THE shared global top bar (plan A2/D-CHROME) — same component as the hero (KAI-8986);
          per-screen diff is button payloads only. Points has no button — double-tap (A3 grammar). */}
      <TopBar
        leading={<TopBarButton icon={<CloseIcon />} label="Close" onClick={() => onCancel()} />}
        left={(
          <>
            <TopBarButton icon={<UndoIcon />} label="Undo" onClick={undo} disabled={!canUndo} />
            <TopBarButton icon={<RedoIcon />} label="Redo" onClick={redo} disabled={!canRedo} />
          </>
        )}
        dirty={canUndo}
        onReset={onReset}
        right={(
          <>
            <TopBarButton
              icon={<PointsIcon />}
              label="Points"
              active={showAnchors}
              disabled={preview}
              onClick={() => { setShowAnchors((v) => !v); setSelVA(null); setAllSelected(false) }}
            />
            <TopBarButton icon={preview ? <PreviewOffIcon /> : <PreviewIcon />} label={preview ? 'Edit' : 'Preview'} onClick={() => setPreview((v) => !v)} />
            <TopBarButton icon={<CheckIcon />} label="Done" onClick={onDone} primary={canUndo} />
          </>
        )}
      />

      <div className={styles.canvas}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`${view.vx} ${view.vy} ${imgW / view.scale} ${imgH / view.scale}`}
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onSurfaceClick}
          onWheel={(e) => {
            // Image mode: scroll zooms the PHOTO within the shape (position = gesture, plan A2)
            if (activeAdjust === 'image') {
              const st = useOutlineStore.getState()
              const a = st.artwork
              st.setArtwork({ ...a, scale: Math.max(1, Math.min(4, a.scale * Math.exp(-e.deltaY * 0.0022))) })
              return
            }
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
          <g transform={artXform} style={fxFilter ? { filter: fxFilter } : undefined}>
          {imageUrl && (showBlend ? (
            // magic blend: blurred full photo + the sharp BEN subject (matte is y-up → flip to editor y-down)
            <>
              <image href={imageUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" filter="url(#kaiBgBlur)" />
              <image href={subjMatteUrl!} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" transform={`translate(0 ${imgH}) scale(1 -1)`} />
            </>
          ) : (
            <image href={imageUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />
          ))}
          </g>
          </g>
          {(
            <>
              {/* scrim dims outside the cut; hidden during a live transform (its hole would lag the move/rotate) */}
              {imageUrl && pathD && !preview && !rotateLive && !moveLive && !stretchLive && (
                <path className={styles.scrim} fillRule="evenodd" d={`M0 0H${imgW}V${imgH}H0Z ${pathD}`} />
              )}
              <g transform={liveXform}>
                {!preview && <path className={`${styles.path} ${hasIssues ? styles.pathError : ''}`} d={pathD} />}
                {/* anchors hidden in Preview (clean result); point work is vector-native below */}
                {/* Run 6 — the vector skeleton: minimal intentional anchors, summoned on demand.
                    The selected anchor reveals its Bézier handles; drags are transient until release. */}
                {!preview && showAnchors && vDisplay && (() => {
                  const anchors = vDisplay.paths[0].anchors
                  const sel = selVA !== null ? anchors[selVA] : null
                  return (
                    <g>
                      {sel && (['hIn', 'hOut'] as const).map((k) => {
                        const h = sel[k]
                        if (!h) return null
                        return (
                          <g key={k}>
                            <line className={styles.rotateStem} x1={sel.p.x} y1={sel.p.y} x2={h.x} y2={h.y} />
                            <circle
                              className={`${styles.node} ${styles.nodeActive}`}
                              cx={h.x} cy={h.y} r={nodeR * 0.62}
                              onPointerDown={onVHandleDown(selVA!, k)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </g>
                        )
                      })}
                      {anchors.map((a, i) => (
                        <circle
                          key={`va${i}`}
                          className={`${styles.node} ${selVA === i ? styles.nodeSelected : ''}`}
                          cx={a.p.x} cy={a.p.y} r={nodeR}
                          onPointerDown={onVAnchorDown(i)}
                          onDoubleClick={onVAnchorDouble(i)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ))}
                    </g>
                  )
                })()}
                {/* KAI-9014: the twist handle rides ALL-SELECTED in ANY view — Dan tap-selects in
                    frame mode (the default); the old showAnchors gate hid it there */}
                {!preview && rotHandle && (
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
              {/* 6.3: the padlock chip rides the frame — corner pulls SCALE locked / DEFORM unlocked */}
              {!preview && cropBox && !rotateLive && !moveLive && !stretchLive && (
                <g
                  transform={`translate(${cropBox.maxX + nodeR * 1.6} ${cropBox.minY - nodeR * 1.6})`}
                  onPointerDown={(e) => { e.stopPropagation(); nodeInteractedRef.current = true }}
                  onClick={(e) => { e.stopPropagation(); setFrameLocked((v) => !v) }}
                  style={{ cursor: 'pointer' }}
                  aria-label={frameLocked ? 'Frame locked — corner pull scales' : 'Frame unlocked — corner pull deforms'}
                >
                  <circle className={styles.lockChip} r={nodeR * 1.5} />
                  <g transform={`scale(${nodeR * 0.09}) translate(-8 -9)`} style={{ pointerEvents: 'none' }}>
                    {/* padlock: body + shackle (open when unlocked) */}
                    <rect x={3} y={8} width={10} height={8} rx={1.6} fill="#fff" />
                    <path d={frameLocked ? 'M5 8 V5.6 A3 3 0 0 1 11 5.6 V8' : 'M5 8 V5.6 A3 3 0 0 1 11 5.6'} fill="none" stroke="#fff" strokeWidth={1.8} />
                  </g>
                </g>
              )}
              {/* Crop-style stretch grips — OUTSIDE the live-transform group (the pill strokes must
                  never distort); positions track cropBox, which already includes the live stretch. */}
              {!preview && cropBox && !rotateLive && !moveLive && (() => {
                const { minX, minY, maxX, maxY } = cropBox
                const mx = (minX + maxX) / 2, my = (minY + maxY) / 2
                // Apple-crop proportions (Dan's reference): delicate thin strokes, modest arms —
                // the HIT area below keeps the full touch target.
                const arm = Math.min(nodeR * 2.1, (maxX - minX) * 0.18, (maxY - minY) * 0.18)
                const lenH = Math.min(nodeR * 2.4, (maxX - minX) * 0.22)
                const lenV = Math.min(nodeR * 2.4, (maxY - minY) * 0.22)
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
                        <path className={styles.gripUnder} d={g.d} strokeWidth={nodeR * 0.8} />
                        <path className={styles.grip} d={g.d} strokeWidth={nodeR * 0.55} />
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
        {confirmDiscard ? (
          <span className={styles.discardBar}>
            Discard the changes from this session?
            <button type="button" className={styles.keepBtn} onClick={() => setConfirmDiscard(false)}>Keep editing</button>
            <button type="button" className={styles.discardBtn} onClick={() => onCancel(true)}>Discard</button>
          </span>
        ) : hasIssues ? (
          /* a WARNING is sanctioned (failure state) — instructional helper text is not (KAI-9014) */
          <span className={styles.warn}>This shape can’t be cut cleanly — fix the crossing</span>
        ) : null}
      </div>

      {/* Run 2 · seam 5: the three tool sheets live in editor/sheets (verbatim moves). */}
      {activeAdjust === 'adjust' && (
        <AdjustSheet
          cornerMode={!!(vshape && selVA !== null && vshape.paths[0].anchors[selVA]?.corner)}
          radiusApplies={radiusApplies}
          adjustSub={adjustSub} setAdjustSub={setAdjustSub}
          maxRadius={maxRadius} radius={radius} previewRadius={previewRadius} commitRadius={commitRadius}
          curveSelected={selVA !== null} curveVal={curveVal} previewCurve={previewCurve} commitCurve={commitCurve}
          global={liveGlobal} previewGlobal={previewGlobal} commitGlobal={commitGlobal}
        />
      )}
      {activeAdjust === 'image' && (
        <ImageSheet imageSub={imageSub} setImageSub={setImageSub} fxDraft={fxDraft} setFxDraft={setFxDraft}
          blendBlur={blendBlur} setBlendBlur={setBlendBlur} writeBlend={writeBlend} />
      )}
      {activeAdjust === 'shape' && (
        <ShapeSheet
          shapeKind={shapeKind} pickShape={pickShape} shapeParams={shapeParams}
          nudgeParam={nudgeParam} previewParam={previewParam} commitShape={commitShape}
          rerollBlob={rerollBlob} onUploadShape={onUploadShape}
        />
      )}

      {/* the NODE BAR (6.6-6.8): a selected ANCHOR gets add-after/delete/sharpen⇄smooth; a
          selected SEGMENT gets + insert at ITS midpoint (shape-preserving) */}
      {vshape && selVA !== null && (
        <div className={styles.nodeBar}>
          <button type="button" className={styles.nodeAction} onClick={onVAddAfter}>
            <AddPointIcon /><span>Add point</span>
          </button>
          <button type="button" className={styles.nodeAction} onClick={onVDelete}>
            <DeleteIcon /><span>Delete point</span>
          </button>
          <button type="button" className={styles.nodeAction} onClick={onVToggleCorner}>
            <OutlineIcon /><span>{vshape.paths[0].anchors[selVA]?.corner ? 'Smooth' : 'Sharpen'}</span>
          </button>
        </div>
      )}
      {vshape && selVA === null && selSeg !== null && showAnchors && (
        <div className={styles.nodeBar}>
          <button type="button" className={styles.nodeAction} onClick={() => {
            const v = vshapeRef.current
            if (!v || selSeg === null) return
            applyVec({ paths: [insertAnchorCentered(v.paths[0], selSeg), ...v.paths.slice(1)] }, null)
            setSelVA(selSeg + 1)
            setSelSeg(null)
          }}>
            <AddPointIcon /><span>Add point here</span>
          </button>
        </div>
      )}

      {/* KAI-9021: THE pill island — the hero's Dock, same structure, editor tool payloads */}
      <Dock inline>
        <DockTool icon={<ShapeIcon />} label="Shape" onClick={toggleShape} active={activeAdjust === 'shape'} />
        {/* KAI-9023 (Dan): the hero's Magic, same place in the island — but the editor STAYS OPEN
            and the fresh cut lands in the 2D session (the spec-change effect below re-seeds) */}
        {onMagic && <DockTool icon={<MagicIcon />} label="Magic" onClick={onMagic} />}
        {/* Dan (2026-06-15): Adjust is the LANDING mode — pressing it just shows the Adjust sheet; it
            never hides the menu and never flips frame→points. Per-corner work is the Points toggle. */}
        <DockTool icon={<TuneIcon />} label="Adjust" onClick={() => setActiveAdjust('adjust')} active={activeAdjust === 'adjust'} />
        {/* KAI-9027: the Image entry moved to the hero as 'Filters' — image mode still exists,
            reached from there (and stays active when entered) */}
      </Dock>
    </div>
    </div>
  )
}
