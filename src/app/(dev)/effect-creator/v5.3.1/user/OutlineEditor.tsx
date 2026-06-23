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
  type Vec2Px,
} from '@/lib/outline-core/math'
// V4 engine (blueprint v4-foundation.md): one impartial resolve(source, adjustments). The editor
// writes the recipe; the engine owns shape. No corner-pin, no vectoriseTrace, no baked timeline.
import { mintIds, type OutlineSource, type OutlineAdjustments } from '@/lib/effect/outline-resolve'
import { useOutlineStore, NEUTRAL_FX, INITIAL_ARTWORK, type ImageFx } from './outlineStore'
import type { DesignState } from '../types'
import type { Pt } from '@/lib/effect/types'
import { UndoIcon, RedoIcon, CheckIcon, CloseIcon, AddPointIcon, DeleteIcon, ShapeIcon, TuneIcon, OutlineIcon, PreviewIcon, PreviewOffIcon , PointsIcon, MagicIcon } from './icons'
import { toast } from '../ui/Toast'
import { type ShapeKind, type ShapeParams } from './shapes'
// VECTOR CORE (reset Run 1): vector-native kinds render/commit/transform on a true Bézier VShape;
// the doc stays as the interaction SHADOW (a derived flatten artifact — bbox/hit/grips math only).
import { shapeToSVGPathD, flattenShape, insertAnchorCentered, deleteAnchorRefit, shapeBBox, type VShape } from '@/lib/vector-core'
import { cornerRadiusAdjustments, representativeLocal } from './editor/seed-defaults'
import { hasVectorDef, getShape } from '@/lib/shape-library'
// Run 8 — SVG shape upload: a downloaded/Figma-exported outline becomes a first-class vector
// shape through the export module's dialect gate (loud rejection outside the v1 boundary).
import { vshapeFromSVG, fitShapeToBox } from '@/lib/export'
// Run 2 · G6 decomposition — seam 1: pure doc-space geometry; seam 2: chip lineup + glyphs.
import { DEFAULT_SHAPE_PARAMS } from './editor/chips'
// R8 (Creator v5) — seam: PRODUCER ADAPTERS (pure source builders) live in editor/producers.
import { GEN_VECTOR_KINDS, shapePreviewD, vecFromGenerator, vecFromImageFile, traceSourceFromRaw, offsetPctToMm } from './editor/producers'
// A (KAI-9127/9128): the generation Detail/Offset controls re-derive the SHARP source from the cached raw
// AI trace (no AI re-run). Detail 100% = tightest pixel-true silhouette (Dan-confirmed default; POC-validated);
// lower = coarser straight facets. Manufacturing cuttability is a separate export gate, NOT a Detail cap.
import { type OffsetJoin } from '@/lib/effect/offset'
import { useOutlineEditing } from './editor/useOutlineEditing'
// R8 (Creator v5) — seam: ADJUSTMENT WRITERS (radius/curve/global/blend) live in useEditorAdjustments.
import { useEditorAdjustments } from './editor/useEditorAdjustments'
import { useCanvasView } from './editor/useCanvasView'
// R8 (Creator v5) — seam: GESTURE TRANSFORMS (all canvas pointer/touch handlers) live in useEditorGestures.
import { useEditorGestures } from './editor/useEditorGestures'
// R8 (Creator v5) — seam: RENDER OVERLAY (the SVG canvas — image/scrim/path/anchors/grips) lives in EditorCanvas.
import { EditorCanvas } from './editor/EditorCanvas'
import { AdjustSheet, ImageSheet, ShapeSheet, type AdjustSub } from './editor/sheets'
import { type GripId } from './editor/geometry'
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
  /** KAI-9122: the design's REAL default magic-blend as a 0–100%, mirroring what the 3D shows when
   *  bgBlur is null (0 for the sharp square, ~50 for a shaped subject). Seeds the blend ruler so the 2D
   *  preview matches the 3D instead of always defaulting to 50%. */
  defaultBlurPct?: number
}

const VIEW_W = 1000
const VIEW_H = 1000

export default function OutlineEditor({ open, imageUrl, onClose, openMode, onMagic, defaultBlurPct = 0 }: OutlineEditorProps) {
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
  // A (KAI-9127/9128): GENERATION controls — Detail (trace tightness) + Offset (expand). Editor-local
  // (they re-derive the SOURCE from the cached raw trace, not the adjustments recipe). Detail defaults to
  // the %-that-reflects the born trace's mm-floor (value-reflection); Offset starts at 0 (= the born cut).
  const [detail, setDetail] = useState(100) // Detail 100% = tightest pixel-true trace (Dan-confirmed); lower = coarser facets
  const [offset, setOffset] = useState(0)
  const [offsetJoin, setOffsetJoin] = useState<OffsetJoin>('sharp')
  const traceDragRef = useRef<{ source: OutlineSource | null; adjustments: OutlineAdjustments } | null>(null) // pre-drag snapshot for ONE undo step across a Detail/Offset drag
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
  // KAI-9116: true ONLY while two fingers are actively pinch-zooming — the canvas drops its scrim /
  // anchors / crop grips so every zoom frame repaints just the image + outline (smooth zoom on a dense trace).
  const [pinching, setPinching] = useState(false)
  const rotateRef = useRef<{ cx: number; cy: number; start: number } | null>(null) // desktop handle drag (rotation lives on the handle; two-finger = canvas pinch, G11)
  const moveRef = useRef<{ start: Vec2Px; bbox: { minX: number; minY: number; maxX: number; maxY: number } } | null>(null) // drag-inside-to-move
  const pointersRef = useRef<Map<number, Vec2Px>>(new Map())
  // pre-edit snapshot captured on open → "Close" (✕) discards this session's edits and reverts the 3D;
  // "Done" (✓) keeps them. ✕ restores EVERYTHING the session can change in the store: the committed
  // shape (through commitGeometry), the blend, the image adjustments, and the photo position —
  // KAI-8971/F2: imageFx+artwork were missing, so a ✕ kept a 129% Bright committed. (Tune/fairing
  // prefs intentionally survive ✕ — tool calibration, not design state; Dan's #21.)
  const preEditRef = useRef<{ source: OutlineSource | null; adjustments: OutlineAdjustments | null; committedShape: VShape | null; bgBlur: number | null; imageFx: ImageFx | null; artwork: DesignState }>({ source: null, adjustments: null, committedShape: null, bgBlur: null, imageFx: null, artwork: INITIAL_ARTWORK })
  // T5: the shape the user ENTERED the editor with (sharp source + its default recipe) — Reset restores this.
  const entryRef = useRef<{ source: OutlineSource | null; adjustments: OutlineAdjustments | null }>({ source: null, adjustments: null })
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
    // snapshot FIRST — ✕ Close restores exactly this. KAI-9075: capture source+adjustments (the
    // recipe) so discard restores it losslessly via setSource, not a re-baked resolved shape.
    preEditRef.current = { source: st0.source, adjustments: st0.adjustments, committedShape: st0.committedShape, bgBlur: st0.bgBlur, imageFx: st0.imageFx, artwork: st0.artwork }
    st0.setEditorOpen(true) // §6.3: scene frozen → 3D rebuilds defer to close
    // session view/interaction state reset
    setCurveVal(0)
    setPreviewAdj(null)
    setView({ scale: 1, vx: 0, vy: 0 }) // G11: fresh session starts at fit
    setDetail(100); setOffset(0); setOffsetJoin('sharp') // A: generation dials default — Detail 100 = born tight, no offset
    setAllSelected(false)
    setShapeKind(null)
    setShapePreview(null)
    setRotateLive(null); rotateLiveRef.current = null; rotateRef.current = null
    setMoveLive(null); moveLiveRef.current = null; moveRef.current = null
    setSelVA(null); setVecLive(null); vecDragRef.current = null
    pinchRef.current = null; canvasPanRef.current = null; setPinching(false)
    pointersRef.current.clear(); clientPtsRef.current.clear()
    setPreview(false)
    setConfirmDiscard(false)
    setShowAnchors(false) // FRAME is the default for every shape (plan A3); double-tap = Points
    // sync the blend ruler to the current 3D state (null = build default ≈ 50; 0 = off)
    setBlendBlur(st0.bgBlur == null ? defaultBlurPct : Math.round(st0.bgBlur * 100)) // KAI-9122: match the 3D default, not a constant 50
    setRadius(0)
    // ── seed the session source (only when there is no live source yet) ──
    if (spec && !st0.source) {
      const image = { widthPx: spec.maskWidthPx, heightPx: spec.maskHeightPx }
      if (spec.generator.adapter !== 'standard') {
        // Magic (VD11): the immutable source IS the raw marching-squares SHARP polygon (spec.vectorShape,
        // RDP-normalized at generation). AUTO-TUNE PAUSED (Dan, 2026-06-17): Magic opens RAW + all tools
        // OFF so Dan can dial each tool manually per shape and identify the optimal settings — the
        // calibrated (and adaptive) auto-tune is wired back from that feedback. autoTuneDefaults() stays
        // dormant in editor/seed-defaults.ts.
        seedSource({ shape: mintIds(spec.vectorShape), klass: 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx, rawTracePx: spec.rawTracePx as Pt[] | undefined }, undefined, false)
      } else {
        // pre-Magic (Dan, 2026-06-10): "choose a shape" — the centered 72% square, seeded SHARP (T5) with
        // the default 8mm rounding as a reversible Radius ADJUSTMENT (not baked into the source), so Radius
        // is live on it and the slider reflects its real value.
        const base = mintIds(getShape('square', image.widthPx, image.heightPx))
        const side = Math.min(image.widthPx, image.heightPx) * 0.72
        const defaultR = Math.min(Math.round(8 / (spec.mmPerPx || 1)), Math.floor(side / 2))
        seedSource({ shape: base, klass: 'stock', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx }, cornerRadiusAdjustments(base, defaultR), false)
        setActiveAdjust('shape')
        setShapeKind('square')
        setShowAnchors(false) // rigid shape default — Points toggle re-enables
      }
    }
    // T7 value-reflection + T5 entry capture: the Radius/Curve sliders reflect the seeded/live recipe
    // (global sliders bind to adjustments.global directly); Reset restores this entry shape.
    {
      const cur = useOutlineStore.getState()
      if (cur.source) {
        // whole-shape Radius reflects the GLOBAL radius axis (dual-engine); falls back to a uniform
        // per-corner value for legacy/per-corner recipes — never a lying 0.
        setRadius(cur.adjustments.global.radius || representativeLocal(cur.adjustments, cur.source.shape, 'radius'))
        setCurveVal(representativeLocal(cur.adjustments, cur.source.shape, 'curve') * 50) // factor(0..2) → 0..100
      }
      entryRef.current = { source: cur.source, adjustments: cur.adjustments }
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

  // A (KAI-9127/9128): Detail/Offset apply only to a GENERATED source with a cached raw trace (a stock
  // pick / upload has none) — gated/greyed like Radius. They re-derive the SHARP source from that trace,
  // no AI re-run.
  const detailApplies = !!source && source.klass === 'generated' && (spec?.rawTracePx as Pt[] | undefined ?? []).length > 0

  // Re-derive the source from the cached raw trace at (detail, offset, join). previewTrace = LIVE per-tick
  // (no history); commitTrace = ONE undo step (snapshots the pre-drag state at drag start). Whole-shape
  // adjustments (Simplify/Smooth/Straighten/Radius) are preserved; per-anchor local edits are dropped
  // (their source ids no longer exist after a re-trace).
  const buildTraceSource = useCallback((d: number, o: number, join: OffsetJoin): OutlineSource | null => {
    const sp = useOutlineStore.getState().spec
    const raw = sp?.rawTracePx as Pt[] | undefined
    if (!sp || !raw?.length) return null
    const offMaxMm = Math.max(sp.maskWidthPx, sp.maskHeightPx) * sp.mmPerPx
    const shape = traceSourceFromRaw(raw, sp.maskHeightPx, sp.mmPerPx, d, offsetPctToMm(o, offMaxMm), join)
    if (!shape) return null
    return { shape: mintIds(shape), klass: 'generated', mmPerPx: sp.mmPerPx, maskHeightPx: sp.maskHeightPx, rawTracePx: raw }
  }, [])
  const previewTrace = useCallback((d: number, o: number, join: OffsetJoin) => {
    const st = useOutlineStore.getState()
    if (!traceDragRef.current) traceDragRef.current = { source: st.source, adjustments: st.adjustments }
    const next = buildTraceSource(d, o, join)
    if (next) st.setSource(next, { global: { ...st.adjustments.global }, local: {} }) // transient — no history
    setSelVA(null); setAllSelected(false)
  }, [buildTraceSource])
  const commitTrace = useCallback((d: number, o: number, join: OffsetJoin) => {
    const st = useOutlineStore.getState()
    const pre = traceDragRef.current ?? { source: st.source, adjustments: st.adjustments }
    traceDragRef.current = null
    const next = buildTraceSource(d, o, join)
    if (!next) return
    if (pre.source) { // ONE undo step for the whole drag
      histRef.current.past.push({ source: pre.source, adjustments: pre.adjustments })
      if (histRef.current.past.length > 50) histRef.current.past.shift()
      histRef.current.future = []
    }
    st.setSource(next, { global: { ...st.adjustments.global }, local: {} })
    setSelVA(null); setAllSelected(false)
  }, [buildTraceSource])

  // ── GESTURE TRANSFORMS (R8 seam 3) — every pointer/touch interaction on the canvas (anchor/handle
  //    drag, double-tap Points, pan/zoom/pinch/wheel, move-inside, crop stretch, rotate, tap-select)
  //    lives in editor/useEditorGestures. All transient drag state is in refs, so the handlers are
  //    STABLE and always read fresh state (the latest-ref pattern — no stale closures, the bug class
  //    that bit KAI-8984). Swap-test: replace the hook, the handler contract is unchanged. The hook
  //    owns interaction; the resolver owns shape; this component orchestrates + renders.
  const {
    onVAnchorDown, onVHandleDown, onVAnchorDouble,
    onSurfacePointerDown, onPointerMove, onPointerUp, onSurfaceClick, onSurfaceWheel,
    beginStretch, moveStretch, endStretch, beginRotateHandle,
  } = useEditorGestures({
    svgRef, viewRef, vshapeRef, nodeRRef, vecLiveRef,
    pointersRef, clientPtsRef, dragStartRef, nodeInteractedRef, lastTapRef,
    pinchRef, canvasPanRef, imgPanRef, vecDragRef, rotateRef, rotateLiveRef, moveRef, moveLiveRef, stretchRef,
    toViewBox, screenToContent, originPinning, applyZoom, setView,
    transformSource, applyVec,
    setVecLive, setMoveLive, setRotateLive, setStretchLive, setPinching, setAllSelected, setSelVA, setSelSeg, setShowAnchors,
    preview, activeAdjust, showAnchors, frameLocked, imgW, imgH, hitRing, hitBBox,
  })



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

  // ── ADJUSTMENT WRITERS (R8 seam 2) — Radius/Curve (local, per stable source id), Detail/Smooth/
  //    Snap/Angle/Line (global axes), and the magic-blend (bgBlur) live in editor/useEditorAdjustments.
  //    They write the source+adjustments recipe (the resolver owns shaping); selection + the editing-API
  //    setters are passed in. Swap-test: replace the hook, the recipe-writing contract is unchanged.
  const {
    sourceIdForSelection, previewRadius, commitRadius, previewCurve, commitCurve,
    writeBlend, previewGlobal, commitGlobal,
  } = useEditorAdjustments({ selVA, vshapeRef, applyAdjustments, setPreviewAdj, setBgBlur, setRadius, setCurveVal, setAllSelected })

  // T7 value-reflection on SELECTION (DEC-v5-03): selecting an anchor shows ITS stored Radius/Curve
  // (never a lying 0); deselecting restores the whole-shape value. Global sliders bind to
  // adjustments.global directly, so they reflect automatically. Fires on selection change only —
  // not during a slider drag/commit (selVA is stable then), so it never fights the writers.
  useEffect(() => {
    if (!open) return
    const st = useOutlineStore.getState()
    if (!st.source) return
    if (selVA === null) {
      // no selection → the slider is the WHOLE-SHAPE Radius (global axis); reflect its real value.
      setRadius(st.adjustments.global.radius || representativeLocal(st.adjustments, st.source.shape, 'radius'))
      setCurveVal(representativeLocal(st.adjustments, st.source.shape, 'curve') * 50)
      return
    }
    const id = sourceIdForSelection()
    const l = id ? st.adjustments.local[id] : undefined
    setRadius(l?.radius ?? 0)
    setCurveVal((l?.curve ?? 0) * 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selVA, open])

  // (Global adjustment writers previewGlobal/commitGlobal moved to useEditorAdjustments — R8 seam 2.)

  // KAI-9023: a NEW shaped spec landing mid-session (editor-dock Magic) re-seeds the SHARP source from
  // the fresh raw marching-squares polygon + the T6 auto-tune default recipe (organic by default); the
  // session stays open and this becomes the new entry shape (Reset returns here).
  const lastSpecRef = useRef(spec)
  useEffect(() => {
    if (!open) { lastSpecRef.current = spec; return }
    if (spec === lastSpecRef.current) return
    lastSpecRef.current = spec
    if (!spec || spec.generator.adapter === 'standard') return
    seedSource({ shape: mintIds(spec.vectorShape), klass: 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx, rawTracePx: spec.rawTracePx as Pt[] | undefined }) // AUTO-TUNE PAUSED (Dan) — raw + off for manual testing
    setRadius(0); setCurveVal(0); setSelVA(null); setAllSelected(false)
    setDetail(100); setOffset(0) // A: fresh Magic cut → generation dials back to born-tight defaults
    const cur = useOutlineStore.getState()
    entryRef.current = { source: cur.source, adjustments: cur.adjustments }
  }, [spec, open, seedSource])

  const onReset = useCallback(() => {
    // T5 (Dan): Reset → the shape the user ENTERED the editor with (sharp source + its default recipe),
    // fully tool-controllable — NOT a hard-coded full-stretch rounded square. Radius/Curve sliders reflect
    // the restored recipe (T7); global sliders bind to adjustments.global directly.
    const e = entryRef.current
    if (!e.source) return // nothing to reset to (the page gates entry on an uploaded image)
    seedSource(e.source, e.adjustments ?? undefined)
    setRadius(e.adjustments ? representativeLocal(e.adjustments, e.source.shape, 'radius') : 0)
    setCurveVal(e.adjustments ? representativeLocal(e.adjustments, e.source.shape, 'curve') * 50 : 0)
    setAllSelected(false)
    setShapeKind(null); setShapePreview(null)
  }, [seedSource])

  // R8: producer geometry (shapePreviewD / vecFromGenerator / vecFromImageFile) lives in
  // editor/producers (pure, seam 1). The pickers below call them with explicit dims + params.
  const genMmPerPx = () => useOutlineStore.getState().spec?.mmPerPx
  const pickShape = useCallback((kind: ShapeKind) => {
    setShapeKind(kind)
    setShapePreview(null)
    // KAI-9129: simple shapes are MATH-DERIVED — squircle = a sharp SQUARE + a whole-shape Radius recipe;
    // pill = a sharp 2:1 RECTANGLE + Radius = half the short side (stadium). Sharp source, the rounding is
    // a reversible adjustment (dial Radius to 0 → the primitive), and the slider reflects the real value.
    if (kind === 'squircle' || kind === 'pill') {
      const { widthPx, heightPx } = dimsRef.current
      const st = useOutlineStore.getState()
      const mmPerPx = st.source?.mmPerPx ?? st.spec?.mmPerPx ?? 1
      const maskHeightPx = st.source?.maskHeightPx ?? st.spec?.maskHeightPx ?? heightPx
      let base: VShape
      if (kind === 'squircle') base = mintIds(getShape('square', widthPx, heightPx))
      else { // pill: a centered 2:1 sharp rectangle
        const long = Math.min(widthPx, heightPx) * 0.72, hw = long / 2, hh = (long * 0.5) / 2
        const cx = widthPx / 2, cy = heightPx / 2
        base = mintIds({ paths: [{ anchors: [
          { p: { x: cx - hw, y: cy - hh }, hIn: null, hOut: null, corner: true },
          { p: { x: cx + hw, y: cy - hh }, hIn: null, hOut: null, corner: true },
          { p: { x: cx + hw, y: cy + hh }, hIn: null, hOut: null, corner: true },
          { p: { x: cx - hw, y: cy + hh }, hIn: null, hOut: null, corner: true },
        ] }] })
      }
      const bb = shapeBBox(base, 1)
      const half = Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2
      const r = kind === 'squircle' ? Math.round(half * 0.42) : Math.round(half) // pill: full round of the short ends → stadium
      seedSource({ shape: base, klass: 'stock', mmPerPx, maskHeightPx }, cornerRadiusAdjustments(base, r))
      setRadius(r); setAllSelected(false); setShowAnchors(false)
      return
    }
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
      applyVec(vecFromGenerator(kind, shapeParamsRef.current, dimsRef.current, genMmPerPx()), null, 'vector')
      setRadius(0); setAllSelected(false)
      setShowAnchors(false)
      return
    }
    // every ShapeKind is vector-constructed (library def or fitted generator) — an uncovered
    // kind is a build error, never a polyline (single geometry truth)
    throw new Error(`pickShape: no vector construction for shape "${kind}"`)
  }, [applyVec, seedSource])
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
      applyVec(vecFromGenerator(shapeKind, shapeParamsRef.current, dimsRef.current, genMmPerPx()), null, 'vector')
      return
    }
    throw new Error(`nudgeParam: no vector construction for shape "${shapeKind}"`)
  }, [shapeKind, applyVec])
  /** tick-bar: transient preview per tick (§6.3); commitShape applies on release. */
  const previewParam = useCallback((key: 'spikiness' | 'pinch' | 'depth' | 'swirl' | 'waviness', v: number) => {
    if (!shapeKind) return
    const next = { ...shapeParamsRef.current, [key]: v }
    shapeParamsRef.current = next; setShapeParams(next)
    if (hasVectorDef(shapeKind)) return // vector kinds regenerate exactly on release (commitShape)
    setShapePreview(shapePreviewD(shapeKind, shapeParamsRef.current, dimsRef.current))
  }, [shapeKind])
  /** blob dice: reroll the seed, regenerate immediately (undoable). */
  const rerollBlob = useCallback(() => {
    if (shapeKind !== 'blob') return
    const seed = Math.floor(Math.random() * 1e9)
    const next = { ...shapeParamsRef.current, seed }
    shapeParamsRef.current = next; setShapeParams(next)
    applyVec(vecFromGenerator('blob', shapeParamsRef.current, dimsRef.current, genMmPerPx()), null, 'vector') // Run 3: the dice rolls a vector
  }, [shapeKind, applyVec])
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
  }, [landUploadedShape])

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
      applyVec(vecFromGenerator(shapeKind, shapeParamsRef.current, dimsRef.current, genMmPerPx()), null, 'vector')
      return
    }
    // no doc commit remains — the preview is a display ring; GEN kinds committed above
  }, [shapeKind, applyVec])

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
    // KAI-9075: restore the RECIPE losslessly (source + adjustments) via the recipe-aware writer —
    // NOT commitGeometry(resolvedShape), which re-minted anchor ids + reset adjustments to all-off
    // (that wiped the editable recipe + reversibility and could spawn phantom history).
    st.setSource(pe.source, pe.adjustments ?? undefined)
    if (st.bgBlur !== pe.bgBlur) st.setBgBlur(pe.bgBlur) // KAI-9070: restore the EXACT pre-open blur incl. null (no null→0.5 coercion)
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

      <EditorCanvas
        svgRef={svgRef}
        view={view}
        imgW={imgW}
        imgH={imgH}
        imageUrl={imageUrl}
        subjMatteUrl={subjMatteUrl}
        art={art}
        fxDraft={fxDraft}
        blendBlur={blendBlur}
        vshape={vshape}
        vDisplay={vDisplay}
        pathD={pathD}
        hitRing={hitRing}
        hitBBox={hitBBox}
        hasIssues={hasIssues}
        nodeR={nodeR}
        preview={preview}
        showAnchors={showAnchors}
        selVA={selVA}
        allSelected={allSelected}
        frameLocked={frameLocked}
        rotateLive={rotateLive}
        moveLive={moveLive}
        stretchLive={stretchLive}
        pinching={pinching}
        shapePreview={shapePreview}
        nodeInteractedRef={nodeInteractedRef}
        setFrameLocked={setFrameLocked}
        onSurfacePointerDown={onSurfacePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onSurfaceClick={onSurfaceClick}
        onSurfaceWheel={onSurfaceWheel}
        onVAnchorDown={onVAnchorDown}
        onVHandleDown={onVHandleDown}
        onVAnchorDouble={onVAnchorDouble}
        beginStretch={beginStretch}
        moveStretch={moveStretch}
        endStretch={endStretch}
        beginRotateHandle={beginRotateHandle}
      />

      {/* bottom dock — status + sheets + toolbar, floating as glass over the full-bleed canvas */}
      <div className={styles.bottomDock}>
      {/* compact status line between canvas and toolbar (KAI-9120: the discard confirm is no longer an
          inline bar stacked under the canvas — it's a centered modal at the overlay root, below) */}
      <div className={styles.status}>
        {hasIssues ? (
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
          curveSelected={!!vshape} curveVal={curveVal} previewCurve={previewCurve} commitCurve={commitCurve}
          global={liveGlobal} previewGlobal={previewGlobal} commitGlobal={commitGlobal}
          detailApplies={detailApplies}
          detail={detail}
          onDetail={(v) => { setDetail(v); previewTrace(v, offset, offsetJoin) }}
          onDetailCommit={(v) => { setDetail(v); commitTrace(v, offset, offsetJoin) }}
          offset={offset}
          onOffset={(v) => { setOffset(v); previewTrace(detail, v, offsetJoin) }}
          onOffsetCommit={(v) => { setOffset(v); commitTrace(detail, v, offsetJoin) }}
          offsetJoin={offsetJoin}
          onOffsetJoin={(j) => { setOffsetJoin(j); commitTrace(detail, offset, j) }}
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

      {/* KAI-9120: discard confirm = a CENTERED MODAL over the whole overlay (not an inline bar stacked
          under the canvas, which made the image jump). Backdrop click or "Keep editing" dismisses. */}
      {confirmDiscard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Discard changes"
          onClick={() => setConfirmDiscard(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(86vw, 320px)', borderRadius: 18, padding: '20px 20px 14px', background: 'var(--color-surface, #fbfbfd)', color: 'var(--color-text-primary, #1c2030)', boxShadow: '0 18px 60px rgba(0,0,0,0.35)', textAlign: 'center', font: '500 15px system-ui, -apple-system, sans-serif' }}
          >
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Discard changes?</div>
            <div style={{ opacity: 0.7, fontSize: 13.5, lineHeight: 1.4, marginBottom: 18 }}>This will undo every edit from this session.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setConfirmDiscard(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', font: '600 14px system-ui, sans-serif', background: 'rgba(120,124,140,0.16)', color: 'inherit' }}>Keep editing</button>
              <button type="button" onClick={() => onCancel(true)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', font: '600 14px system-ui, sans-serif', background: '#e5484d', color: '#fff' }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
