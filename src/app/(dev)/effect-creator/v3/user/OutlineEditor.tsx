// Effect Creator V3 — 2D outline editor overlay (blueprint §5.3 / §6.3 / G11 / G12).
// Core toolset per §7a: anchors (drag/add/delete), Smooth, Scale, Shape presets, magic-blend
// toggle. (Draw was removed entirely — Dan, KAI-8962.) Hug and the Round tool are NOT in core (parked/folded — D4/D5;
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
  nodesFromTracedRing,
  fairTracedRing,
  fairingFromDetail,
  BEN_DEFAULT_DETAIL,
  type FairTracedRingOpts,
  type OutlineDocument,
  type OutlineCommand,
  type Vec2Px,
} from '@/lib/outline-core'
import { useOutlineStore, NEUTRAL_FX, type ImageFx } from './outlineStore'
import { UndoIcon, RedoIcon, ResetIcon, CheckIcon, CloseIcon, AddPointIcon, DeleteIcon, ShapeIcon, TuneIcon, ImageToolIcon, OutlineIcon, PreviewIcon, PreviewOffIcon } from './icons'
import { toast } from '../ui/Toast'
import { perfGesture } from '../dev/PerfHUD'
import { generateShapeRing, resampleClosed, type ShapeKind, type ShapeParams } from './shapes'
// VECTOR CORE (reset Run 1): vector-native kinds render/commit/transform on a true Bézier VShape;
// the doc stays as the interaction SHADOW (a derived flatten artifact — bbox/hit/grips math only).
import { shapeToSVGPathD, transformShape, filletShape, filletShapeSmart, filletPathSmart, ringToVPath, nearestOnPath, insertAnchorAt, insertAnchorCentered, deleteAnchorRefit, shapeBBox, type VShape, type VAnchor, type Vec2 } from '@/lib/vector-core'
import { hasVectorDef, getShape } from '@/lib/shape-library'
// Run 8 — SVG shape upload: a downloaded/Figma-exported outline becomes a first-class vector
// shape through the export module's dialect gate (loud rejection outside the v1 boundary).
import { vshapeFromSVG, fitShapeToBox } from '@/lib/export'
// Run 10 — image-shape upload: threshold mask → the SAME trace machinery as Magic → fitted vector.
import { maskFromImageData } from '@/lib/effect/image-shape'
import { traceContourRaw } from '@/lib/effect/contour'

// Run-3 live generators: dense internal sample → ONE Schneider fit at spawn → vector path out.
// Segments never leave the generator (blueprint modules/generators.md).
const GEN_VECTOR_KINDS = new Set<ShapeKind>(['daisy', 'pinwheel', 'form', 'blob'])
// Run 2 · G6 decomposition — seam 1: pure doc-space geometry; seam 2: chip lineup + glyphs.
import { DEFAULT_SHAPE_PARAMS } from './editor/chips'
import { useEditorHistory } from './editor/useEditorHistory'
import { useCanvasView } from './editor/useCanvasView'
import { AdjustSheet, ImageSheet, ShapeSheet } from './editor/sheets'
import { seedDoc, docFromRings, outerCenter, scaleDoc, rotateDoc, translateDoc, stretchDoc, outerBbox, pointInPolygon, projectToSeg, type GripId } from './editor/geometry'
import styles from './outline-editor.module.css'

interface OutlineEditorProps {
  open: boolean
  imageUrl?: string
  onClose: () => void
  /** Structure A (#27): the toolbar's creation modes open THIS editor in that mode. */
  openMode?: 'shape' | null
}

const VIEW_W = 1000
const VIEW_H = 1000

// Rotate glyph (Phosphor ArrowClockwise, 256-box) drawn inside the rotate handle — white on the brand grip.
const ROTATE_GLYPH_D = 'M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z'

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

export default function OutlineEditor({ open, imageUrl, onClose, openMode }: OutlineEditorProps) {
  const { doc, setDoc, docRef, vshape, vshapeRef, vBaseRef, histRef, applyDocRaw, applyVec, undoRaw, redoRaw } = useEditorHistory(() => seedDoc(VIEW_W, VIEW_H))
  const [drag, setDrag] = useState<{ ringId: string; nodeId: string; pos: Vec2Px } | null>(null)
  const [radius, setRadius] = useState(0)        // Round: global (or selected-corner) radius px

  const [smoothing, setSmoothing] = useState(0) // 0–100 → style.smoothing 0..1 (Catmull-Rom spline)
  const [scale, setScale] = useState(100) // 50–150 relative resize of the whole cut-out; bakes on release
  const [selectedNode, setSelectedNode] = useState<{ ringId: string; nodeId: string } | null>(null) // anchor add/delete target
  // #35 Apple layout: the editor's bottom is a MODE pill (Shape · Adjust · Image · Draw); each
  // mode shows a row of circular sub-tools sharing ONE ruler — no more dock-of-everything.
  const [activeAdjust, setActiveAdjust] = useState<'shape' | 'adjust' | 'image' | null>(null)
  const [adjustSub, setAdjustSub] = useState<'radius' | 'curve' | 'scale' | 'blend' | 'detail' | 'smooth' | 'snap' | 'line' | 'angle'>('radius')
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
  // #28 Image tool (Apple-pattern: circular sub-icons + ONE shared ruler). Position pans/zooms the
  // PHOTO under the fixed cutline (the scene's G1, now inside the editor); adjustments preview live
  // via CSS filter here and bake into the print composite on commit (one composeFront).
  const [imageSub, setImageSub] = useState<'position' | 'brightness' | 'contrast' | 'saturate' | 'warmth'>('position')
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
  // "Done" (✓) keeps them. Holds the 3D contour, the persisted editor doc, and the blend at open time.
  // pre-edit snapshot (single truth): ✕ Close restores it through commitGeometry; Done keeps.
  const preEditRef = useRef<{ committedShape: VShape | null; bgBlur: number | null }>({ committedShape: null, bgBlur: null })
  const [allSelected, setAllSelected] = useState(false) // tap inside the cut → select every corner, edit them together
  const nodeInteractedRef = useRef(false) // a node tap just happened → suppress the bubbling surface-click (which would re-select all)
  const dragStartRef = useRef<Vec2Px | null>(null) // pointer-down point → distinguish a tap (select) from a drag (move)
  const svgRef = useRef<SVGSVGElement>(null)
  // Run 2 · seam 4: the G11 view machinery lives in editor/useCanvasView.
  const { view, setView, viewRef, screenToContent, originPinning, applyZoom, toViewBox } = useCanvasView(svgRef, docRef)
  const pinchRef = useRef<{ d0: number; scale0: number; c0: Vec2Px } | null>(null) // two-finger pinch zoom (client-space)
  const canvasPanRef = useRef<{ startClient: Vec2Px; vx0: number; vy0: number } | null>(null) // drag-outside pan (zoomed)
  const clientPtsRef = useRef<Map<number, Vec2Px>>(new Map()) // pointerId → CLIENT coords (pinch math)
  const idRef = useRef(0)
  const spec = useOutlineStore((s) => s.spec)
  const setBgBlur = useOutlineStore((s) => s.setBgBlur)
  const subjMatteUrl = useOutlineStore((s) => s.subjMatteUrl)
  const art = useOutlineStore((s) => s.artwork)
  const [preview, setPreview] = useState(false) // hide anchors/handles to see the clean result (no exit)
  // Points toggle (Dan, 2026-06-10): anchors stay ON for free-form outlines but OFF for rigid
  // parametric shapes — a circle has ~60 vertices; one stray drag spoils it. Toggle in the topbar.
  const [showAnchors, setShowAnchors] = useState(true)
  // Run 6 — points on demand: selected vector anchor (outer path index), transient drag shape
  // (per-tick preview only; ONE applyVec on release — §6.3), and the active drag descriptor.
  const [selVA, setSelVA] = useState<number | null>(null)
  const [vecLive, setVecLive] = useState<VShape | null>(null)
  const vecLiveRef = useRef<VShape | null>(null)
  useEffect(() => { vecLiveRef.current = vecLive }, [vecLive])
  const vecDragRef = useRef<{ kind: 'p' | 'hIn' | 'hOut'; ai: number; orig: VShape; moved: boolean } | null>(null)

  const syncSlidersTo = useCallback((d: OutlineDocument) => {
    setRadius(d.style.globalOutlineCornerRadiusPx)
    setSmoothing(Math.round(d.style.smoothing * 100))
    setScale(100)
    setSelectedNode(null)
    setAllSelected(false)
    setDrag(null)
    setSelVA(null)
    setVecLive(null)
  }, [])
  // Run 2 · seam 3: the history ENGINE lives in editor/useEditorHistory; these wrappers keep
  // the component-side effects (selection clears, slider sync) visible at the call layer.
  const applyDoc = useCallback((next: OutlineDocument) => {
    applyDocRaw(next)
    setSelVA(null) // a doc-level edit exits vector mode → the vector selection clears with it
    setVecLive(null)
  }, [applyDocRaw])
  const undo = useCallback(() => { const d = undoRaw(); if (d) syncSlidersTo(d) }, [undoRaw, syncSlidersTo])
  const redo = useCallback(() => { const d = redoRaw(); if (d) syncSlidersTo(d) }, [redoRaw, syncSlidersTo])

  // Open the editor FROM the single truth (REBUILD-PLAN-v2 §B3): session = committedShape if one
  // exists, else the design's born vector (Magic re-fit at saved Tune prefs / the centered square
  // seed pre-Magic). The seed COMMITS — visible = committed at every moment; the §6.3 freeze
  // defers the 3D rebuild to the close boundary. ✕ Close restores the pre-open snapshot.
  useEffect(() => {
    if (!open) return
    const st0 = useOutlineStore.getState()
    // snapshot FIRST — ✕ Close restores exactly this through the one writer
    preEditRef.current = { committedShape: st0.committedShape, bgBlur: st0.bgBlur }
    st0.setEditorOpen(true) // §6.3: scene frozen → 3D rebuilds defer to close
    // session view/interaction state reset
    setScale(100)
    setSmoothing(0)
    setView({ scale: 1, vx: 0, vy: 0 }) // G11: fresh session starts at fit
    setDrag(null)
    setSelectedNode(null)
    setAllSelected(false)
    setShapeKind(null)
    setShapePreview(null)
    setTunePreview(null)
    {
      // #21: Dan's tuned settings are the defaults — restore them, never reset to factory
      const saved = st0.fairing
      setDetail(saved?.detail ?? BEN_DEFAULT_DETAIL)
      setFairParams(saved?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL))
    }
    setRotateLive(null); rotateLiveRef.current = null; rotateRef.current = null
    setMoveLive(null); moveLiveRef.current = null; moveRef.current = null
    setSelVA(null); setVecLive(null); vecDragRef.current = null
    pinchRef.current = null; canvasPanRef.current = null
    pointersRef.current.clear(); clientPtsRef.current.clear()
    setPreview(false)
    setShowAnchors(true)
    // sync the magic-blend control to the current 3D state (null = build default ≈ on @ 50%)
    setBlendOn(st0.bgBlur == null || st0.bgBlur > 0)
    setBlendBlur(st0.bgBlur == null ? 50 : st0.bgBlur > 0 ? Math.round(st0.bgBlur * 100) : 50)
    setRadius(0)
    // ── seed the session truth ──
    if (spec) {
      const image = { widthPx: spec.maskWidthPx, heightPx: spec.maskHeightPx, sourceHash: spec.sourceRef.slice(0, 40), orientation: 'baked' as const }
      let v0: VShape
      let base: VShape | null = null
      if (st0.committedShape) {
        v0 = st0.committedShape // reopening restores TRUE curves — the committed truth itself
      } else if (spec.generator.adapter !== 'standard') {
        // Magic: re-fit the trace at the saved Tune prefs (same engine as generation); the born
        // truth is the always-valid fallback — never a doc, never a polyline
        const savedF = st0.fairing
        v0 = vecFromTrace(savedF?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL)) ?? spec.vectorShape
      } else {
        // Dan (2026-06-10): entering the editor BEFORE Magic means "choose a shape" — the
        // full-bleed square buries its handles, so the session starts on the centered square,
        // exact arcs at the 8mm absolute default (KAI-8940), clamped to the inscribable max
        base = getShape('square', image.widthPx, image.heightPx)
        const side = Math.min(image.widthPx, image.heightPx) * 0.72
        const defaultR = Math.min(Math.round(8 / (spec.mmPerPx || 1)), Math.floor(side / 2))
        v0 = filletShape(base, defaultR)
        setRadius(defaultR)
        setActiveAdjust('shape')
        setShapeKind('square')
        setShowAnchors(false) // rigid shape default — Points toggle re-enables
      }
      applyVec(v0, base) // COMMITS the seed (visible = committed); §6.3 defers the 3D to close
    } else {
      setDoc(seedDoc(VIEW_W, VIEW_H)) // no image yet — inert placeholder (page gates the editor)
    }
    setImageSub('position')
    setAdjustSub('radius')
    setFxDraft(st0.imageFx ?? NEUTRAL_FX)
    imgPanRef.current = null
    // #27: toolbar creation modes land in the matching editor mode; default mode = Adjust
    if (openMode === 'shape') setActiveAdjust('shape')
    else if (spec?.generator.adapter !== 'standard' || useOutlineStore.getState().committedShape) setActiveAdjust('adjust')
    histRef.current = { past: [], future: [] } // fresh undo history per session (the seed is not undoable)
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
    [applyDoc, docRef],
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

  // Radius range = the TRUE geometric max of the CURRENT shape (KAI-8940): half the short side of
  // its box — 100% on a square IS the inscribed circle. The old ¼-image clamp stopped the slider
  // at ~69% of the square's real maximum, which is why 100% never made the circle.
  const maxRadius = useMemo(() => {
    if (vshape) {
      const bb = shapeBBox(vshape, 1)
      return Math.max(1, Math.round(Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2))
    }
    const bb = outerBbox(doc)
    return Math.max(1, Math.round(Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2))
  }, [vshape, doc])
  const hasIssues = resolved.issues.length > 0 // inline manufacturability guardrail (self-intersection etc.)

  // (REBUILD-PLAN-v2 §B3: the old editor→3D contour-push effect lived HERE, gated on `open` —
  // the close-boundary bug class. It is gone: commitGeometry derives the contour inside every
  // commit, synchronously. No geometry state rides a React effect.)

  // Vector display shape: the in-flight anchor/handle drag (vecLive) supersedes the committed
  // vshape; the live Scale preview transforms it exactly (affine on anchors+handles). One source
  // for BOTH the rendered path and the anchor/handle overlay, so they never desync mid-gesture.
  const vDisplay = useMemo(() => {
    if (!vshape) return null
    let v = vecLive ?? vshape
    if (scale !== 100) {
      const [cx, cy] = outerCenter(doc)
      const f = scale / 100
      v = transformShape(v, (p: Vec2) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f }))
    }
    return v
  }, [vshape, vecLive, scale, doc])

  // Draw the RESOLVED (unflattened) rings: the manufacturing flatten's chord tolerance read as
  // visible facets on curves at editor zoom (Dan, 2026-06-10). Flattened stays for mm export.
  const pathD = useMemo(() => {
    // VECTOR CORE: true curves render as true SVG C commands — crisp at ANY zoom, zero chords.
    if (vDisplay) return shapeToSVGPathD(vDisplay, 2)
    return resolved.resolvedRingsPx
      .map((ring) => (ring.length ? `M ${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z` : ''))
      .join(' ')
  }, [resolved, vDisplay])

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
      setSelectedNode(null)
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

  // Surface pointer-down: track active pointers (for the two-finger twist). A second surface
  // pointer (while not dragging a node) arms the rotate gesture.
  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (preview) return // view-only
      const p = toViewBox(e.clientX, e.clientY)
      pointersRef.current.set(e.pointerId, p)
      clientPtsRef.current.set(e.pointerId, [e.clientX, e.clientY])
      // #28 Image-Position sub-mode: single finger pans the PHOTO under the cutline
      if (activeAdjust === 'image' && imageSub === 'position' && pointersRef.current.size === 1) {
        const a = useOutlineStore.getState().artwork
        imgPanRef.current = { startClient: [e.clientX, e.clientY], art0: { ...a } }
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
    [toViewBox, drag, resolved, preview, screenToContent, docRef, viewRef],
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
    },
    [drag, toViewBox, doc.image, originPinning, vecDragShape, docRef, setView, viewRef],
  )

  const commitRotate = useCallback(() => {
    const rl = rotateLiveRef.current
    if (rl && Math.abs(rl.deg) > 0.01) {
      if (vshapeRef.current) {
        // exact rotation on anchors+handles
        const rad = (rl.deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad)
        const t = (p: Vec2) => ({ x: rl.cx + (p.x - rl.cx) * c - (p.y - rl.cy) * s, y: rl.cy + (p.x - rl.cx) * s + (p.y - rl.cy) * c })
        applyVec(transformShape(vshapeRef.current, t), vBaseRef.current ? transformShape(vBaseRef.current, t) : null)
      } else {
        applyDoc(rotateDoc(docRef.current, rl.deg))
      }
    }
    rotateLiveRef.current = null; setRotateLive(null)
    nodeInteractedRef.current = true // suppress the click that follows so it doesn't re-select-all
  }, [applyDoc, applyVec, docRef, vBaseRef, vshapeRef])

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
        if (vshapeRef.current) {
          const t = (p: Vec2) => ({ x: p.x + ml.dx, y: p.y + ml.dy })
          applyVec(transformShape(vshapeRef.current, t), vBaseRef.current ? transformShape(vBaseRef.current, t) : null)
        } else {
          applyDoc(translateDoc(docRef.current, ml.dx, ml.dy))
        }
        moveLiveRef.current = null; setMoveLive(null)
      }
      return // no move = a tap → onSurfaceClick selects all
    }
    if (drag) {
      const s = dragStartRef.current
      const moved = !s || Math.hypot(drag.pos[0] - s[0], drag.pos[1] - s[1]) > 2
      if (moved) commit({ op: 'MoveNode', ringId: drag.ringId, nodeId: drag.nodeId, to: drag.pos }) // a tap (no move) just selects
      setDrag(null)
      return
    }
  }, [drag, commit, commitRotate, applyDoc, applyVec, docRef, vBaseRef, vshapeRef])

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
      // Run 6 — points on demand: double-tap inserts an anchor exactly there, ON the curve,
      // geometry-preserving (exact de Casteljau split). Anchors are summoned by the act.
      if (vshapeRef.current) {
        const v = vshapeRef.current
        const pt = toViewBox(e.clientX, e.clientY)
        const hit = nearestOnPath(v.paths[0], { x: pt[0], y: pt[1] })
        const t = Math.min(0.98, Math.max(0.02, hit.t)) // avoid degenerate slivers at the ends
        applyVec({ paths: [insertAnchorAt(v.paths[0], hit.seg, t), ...v.paths.slice(1)] }, null)
        setSelVA(hit.seg + 1)
        setShowAnchors(true)
        return
      }
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
    [doc, commit, toViewBox, applyVec, vshapeRef],
  )

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

  // (Hug is PARKED out of core — D4. The engine's fields-once SDF evaluator stays ready in
  // outline-core/prepareSdfBlend for its post-core refinement; no UI tool ships here.)

  // Tap the surface (not a node): inside the cut → SELECT ALL corners (scale/twist them together);
  // outside → deselect. (Node taps stopPropagation, so they never reach here.)
  const onSurfaceClick = useCallback((e: React.MouseEvent) => {
    if (preview) return
    if (nodeInteractedRef.current) { nodeInteractedRef.current = false; return } // a node tap → keep single selection
    if ((e.target as Element)?.tagName === 'circle') return // tapped a node handle, not the surface
    const p = toViewBox(e.clientX, e.clientY)
    const outerIdx = doc.rings.findIndex((r) => r.role === 'outer')
    const ring = outerIdx >= 0 ? resolved.flattenedRingsPx[outerIdx] : null
    if (ring && ring.length >= 3 && pointInPolygon(p, ring)) {
      setSelectedNode(null)
      setSelVA(null)
      setAllSelected(true)
    } else {
      setSelectedNode(null)
      setSelVA(null)
      setAllSelected(false)
    }
  }, [doc, resolved, toViewBox, preview])

  const commitRadius = useCallback((v: number) => {
    setRadius(v)
    const t0 = performance.now()
    // Run 5 — Radius on EVERY corner class: re-fillets the clean base with the curve-aware
    // fillet (line-line exact arcs; heart cusps + Magic-trace corners trim-and-arc). A fitted
    // shape with no pristine base (Magic) adopts its CURRENT geometry as the base on first use.
    if (vshapeRef.current) {
      const cur = vshapeRef.current
      // Run 6 — single-corner Radius: a selected CORNER anchor rounds alone; the result becomes
      // its own base (whole-shape Radius afterwards rounds the remaining corners from here).
      if (selVA !== null && cur.paths[0].anchors[selVA]?.corner) {
        applyVec({ paths: [filletPathSmart(cur.paths[0], v, (ai) => ai === selVA), ...cur.paths.slice(1)] }, null)
        setSelVA(null)
        perfGesture('round-commit', performance.now() - t0)
        return
      }
      if (!vBaseRef.current) vBaseRef.current = cur
      applyVec(filletShapeSmart(vBaseRef.current, v), vBaseRef.current)
      perfGesture('round-commit', performance.now() - t0)
      return
    }
    if (selectedNode) commit({ op: 'SetCorner', ringId: selectedNode.ringId, nodeId: selectedNode.nodeId, corner: { mode: 'manual', outlineCornerRadiusPx: v } })
    else commit({ op: 'SetGlobalCornerRadius', outlineCornerRadiusPx: v })
    perfGesture('round-commit', performance.now() - t0)
  }, [selectedNode, selVA, commit, applyVec, vBaseRef, vshapeRef])
  const commitSmoothing = useCallback((v: number) => {
    if (vshapeRef.current) { setSmoothing(0); return } // pure curves need no styling smooth (Curve op returns later)
    setSmoothing(v)
    const t0 = performance.now()
    commit({ op: 'SetSmoothing', smoothing: v / 100 })
    perfGesture('smooth-commit', performance.now() - t0)
  }, [commit, vshapeRef])
  // Scale: the slider previews live (displayDoc), then bakes the relative factor on release; the −/+
  // buttons bake a fixed ±5% step. Both resize all node positions about the center, preserving corners.
  const vecScale = useCallback((f: number) => {
    const v = vshapeRef.current!
    const [cx, cy] = outerCenter(docRef.current)
    const t = (p: Vec2) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f })
    applyVec(transformShape(v, t), vBaseRef.current ? transformShape(vBaseRef.current, t) : null)
  }, [applyVec, docRef, vBaseRef, vshapeRef])
  const commitScale = useCallback((v: number) => {
    if (v === 100) { setScale(100); return }
    const t0 = performance.now()
    if (vshapeRef.current) vecScale(v / 100) // exact affine on anchors+handles
    else applyDoc(scaleDoc(docRef.current, v / 100))
    setScale(100)
    perfGesture('scale-commit', performance.now() - t0)
  }, [applyDoc, vecScale, docRef, vshapeRef])
  const nudgeScale = useCallback((deltaPct: number) => {
    if (vshapeRef.current) { vecScale((100 + deltaPct) / 100); setScale(100); return }
    applyDoc(scaleDoc(docRef.current, (100 + deltaPct) / 100))
    setScale(100)
  }, [applyDoc, vecScale, docRef, vshapeRef])
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
  }, [docRef])
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
  }, [toViewBox, docRef])
  const endStretch = useCallback(() => {
    const st = stretchRef.current
    if (!st) return
    stretchRef.current = null
    setStretchLive(null)
    if (Math.abs(st.sx - 1) < 0.004 && Math.abs(st.sy - 1) < 0.004) return // a tap, not a pull
    const t0 = performance.now()
    if (vshapeRef.current) {
      // exact anisotropic Bézier transform — a stretched heart is still perfect curves
      const t = (p: Vec2) => ({ x: st.ax + (p.x - st.ax) * st.sx, y: st.ay + (p.y - st.ay) * st.sy })
      applyVec(transformShape(vshapeRef.current, t), vBaseRef.current ? transformShape(vBaseRef.current, t) : null)
    } else {
      applyDoc(stretchDoc(docRef.current, st.sx, st.sy, st.ax, st.ay))
    }
    perfGesture('stretch-commit', performance.now() - t0)
  }, [applyDoc, applyVec, docRef, vBaseRef, vshapeRef])

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
  }, [spec, docRef])
  /** Run 4 — the vectoriser: faired BEN trace → ONE Schneider fit → true vector path.
   *  Corners ≤ the fairing's max-turn guarantee read as tight curves (already softened);
   *  genuinely sharp residuals (>30°) become true corner anchors. */
  const vecFromTrace = useCallback((params: FairTracedRingOpts): VShape | null => {
    const raw = spec?.rawTracePx
    if (!raw || raw.length < 24) return null
    const H = spec.maskHeightPx
    const rawEditorPx = raw.map(([x, y]) => [x, H - y] as Vec2Px) // y-up mask → y-down editor px
    const faired = fairTracedRing(rawEditorPx, params)
    if (faired.length < 3) return null
    const path = ringToVPath(faired.map(([x, y]) => ({ x, y })), 30, 0.35)
    return { paths: [path] }
  }, [spec])

  const onReset = useCallback(() => {
    // Dan meta-QA BUG2 (2026-06-11): Reset restored the base shape as a FLATTENED DOC — faceted
    // corners at zoom. Reset is a geometry entry point like open: it must land TRUE vectors.
    const clearTail = () => {
      setSmoothing(0); setScale(100)
      setDrag(null); setSelectedNode(null); setAllSelected(false)
      setShapeKind(null); setShapePreview(null)
    }
    // Magic cut-out → re-fit the trace at the saved Tune defaults; the BORN truth is the
    // always-valid fallback (REBUILD-PLAN-v2: never a doc, never a polyline)
    if (spec && spec.generator.adapter !== 'standard') {
      const savedF = useOutlineStore.getState().fairing
      const v = vecFromTrace(savedF?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL)) ?? spec.vectorShape
      applyVec(v, null)
      setRadius(0)
      clearTail()
      return
    }
    // standard → the full-image square as a TRUE vector, 8mm-absolute default rounding
    if (spec && spec.generator.adapter === 'standard') {
      const W = spec.maskWidthPx, H = spec.maskHeightPx
      const base: VShape = { paths: [{ anchors: [
        { p: { x: 0, y: 0 }, corner: true }, { p: { x: W, y: 0 }, corner: true },
        { p: { x: W, y: H }, corner: true }, { p: { x: 0, y: H }, corner: true },
      ] }] }
      const r = Math.min(Math.round(8 / (spec.mmPerPx || 1)), Math.floor(Math.min(W, H) / 2)) // 8mm absolute default (KAI-8940)
      applyVec(filletShape(base, r), base)
      setRadius(r)
      clearTail()
      return
    }
    // no spec = no design in the editor (the page gates entry) — nothing to reset
  }, [spec, applyVec, vecFromTrace])
  const previewTune = useCallback((params: FairTracedRingOpts) => {
    const t0 = performance.now()
    const d = buildTunedDoc(params)
    if (d) setTunePreview(d)
    perfGesture('tune-tick', performance.now() - t0)
  }, [buildTunedDoc])
  const commitTune = useCallback((params: FairTracedRingOpts, detailVal?: number) => {
    const t0 = performance.now()
    setTunePreview(null)
    // Run 4: the release FITS the re-faired trace into a true vector path (ticks stay doc-transient)
    const v = vecFromTrace(params)
    if (v) {
      setFairParams(params)
      applyVec(v, null)
      setSelectedNode(null)
      setAllSelected(false)
      useOutlineStore.getState().setFairing({ detail: detailVal ?? detailRef.current, params })
      perfGesture('tune-commit', performance.now() - t0)
      return
    }
    const d = buildTunedDoc(params)
    if (!d) return
    setFairParams(params)
    applyDoc(d)
    setSelectedNode(null)
    setAllSelected(false)
    // #21: tuned settings become the durable defaults — Magic reads them from the store
    useOutlineStore.getState().setFairing({ detail: detailVal ?? detailRef.current, params })
    perfGesture('tune-commit', performance.now() - t0)
  }, [buildTunedDoc, applyDoc, applyVec, vecFromTrace])

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
  }, [docRef])
  /** Run 3: a live generator's output FITTED ONCE into a true vector path (sub-10ms). */
  const vecFromGenerator = useCallback((kind: ShapeKind, overrides: Partial<ShapeParams> = {}): VShape => {
    const img = docRef.current.image
    const ring = resampleClosed(generateShapeRing({ kind, ...shapeParamsRef.current, ...overrides }, img.widthPx, img.heightPx), Math.max(img.widthPx, img.heightPx) / 600)
    const path = ringToVPath(ring.map(([x, y]) => ({ x, y })), 60, Math.max(0.4, Math.min(img.widthPx, img.heightPx) / 1600))
    return { paths: [path] }
  }, [docRef])
  const pickShape = useCallback((kind: ShapeKind) => {
    setShapeKind(kind)
    setShapePreview(null)
    // VECTOR CORE: vector-native kinds spawn as TRUE Bézier shapes from the static library —
    // zero sampling, zero fitting; the doc becomes a derived shadow for interaction math.
    if (hasVectorDef(kind)) {
      const img = docRef.current.image
      const sp = shapeParamsRef.current
      const base = getShape(kind, img.widthPx, img.heightPx, { sides: sp.sides, points: sp.points, spikiness: sp.spikiness })
      applyVec(base, base)
      setRadius(0); setSmoothing(0); setScale(100); setSelectedNode(null); setAllSelected(false)
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
      applyVec(vecFromGenerator(kind, overrides), null)
      setRadius(0); setSmoothing(0); setScale(100); setSelectedNode(null); setAllSelected(false)
      setShowAnchors(false)
      return
    }
    applyDoc(buildShapeDoc(kind, overrides))
    setSmoothing(0); setScale(100); setSelectedNode(null); setAllSelected(false)
    setShowAnchors(false) // rigid shape: vertex anchors off by default (toggle to edit points)
  }, [applyDoc, applyVec, buildShapeDoc, vecFromGenerator, docRef])
  /** stepper: ±delta on an integer param, regenerate immediately (undoable). */
  const nudgeParam = useCallback((key: 'sides' | 'points' | 'lobes' | 'petals' | 'blades', delta: number, min: number, max: number) => {
    if (!shapeKind) return
    const n = Math.max(min, Math.min(max, (shapeParamsRef.current[key] ?? min) + delta))
    const next = { ...shapeParamsRef.current, [key]: n }
    shapeParamsRef.current = next; setShapeParams(next)
    // vector kinds (polygon/star) regenerate their exact construction with the new param
    if (hasVectorDef(shapeKind)) {
      const img = docRef.current.image
      const base = getShape(shapeKind, img.widthPx, img.heightPx, { sides: next.sides, points: next.points, spikiness: next.spikiness })
      applyVec(base, base)
      return
    }
    // generator kinds re-fit their new construction (petals/blades/lobes steppers)
    if (GEN_VECTOR_KINDS.has(shapeKind)) {
      applyVec(vecFromGenerator(shapeKind, { [key]: n }), null)
      return
    }
    applyDoc(buildShapeDoc(shapeKind, { [key]: n }))
  }, [shapeKind, applyDoc, applyVec, buildShapeDoc, vecFromGenerator, docRef])
  /** tick-bar: transient preview per tick (§6.3); commitShape applies on release. */
  const previewParam = useCallback((key: 'spikiness' | 'pinch' | 'depth' | 'swirl' | 'waviness', v: number) => {
    if (!shapeKind) return
    const next = { ...shapeParamsRef.current, [key]: v }
    shapeParamsRef.current = next; setShapeParams(next)
    if (hasVectorDef(shapeKind)) return // vector kinds regenerate exactly on release (commitShape)
    setShapePreview(buildShapeDoc(shapeKind, { [key]: v }))
  }, [shapeKind, buildShapeDoc])
  /** blob dice: reroll the seed, regenerate immediately (undoable). */
  const rerollBlob = useCallback(() => {
    if (shapeKind !== 'blob') return
    const seed = Math.floor(Math.random() * 1e9)
    const next = { ...shapeParamsRef.current, seed }
    shapeParamsRef.current = next; setShapeParams(next)
    applyVec(vecFromGenerator('blob', { seed }), null) // Run 3: the dice rolls a vector
  }, [shapeKind, applyVec, vecFromGenerator])
  /** Land an uploaded shape: fit into the image box, first-class vector. SVG keeps itself as the
   *  pristine base (clean authored corners); a traced image adopts no base (fitted geometry). */
  const landUploadedShape = useCallback((raw: VShape, withBase: boolean) => {
    const img = docRef.current.image
    const v = fitShapeToBox(raw, img.widthPx, img.heightPx)
    applyVec(v, withBase ? v : null)
    setShapeKind(null)
    setShapePreview(null)
    setRadius(0); setSmoothing(0); setScale(100); setSelectedNode(null); setAllSelected(false)
    setShowAnchors(false)
  }, [applyVec, docRef])
  /** Run 10 — image upload: decode → threshold mask → the Magic trace machinery → ONE Schneider
   *  fit. Editor-space ring orientation is normalized to the Magic-trace convention (negative
   *  shoelace in y-down px) so the commit's flip+reverse lands the mesh's expected winding. */
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
      const ring = traceContourRaw(mask, width, height)
      if (!ring || ring.length < 12) throw new Error('No clear shape found — try an image with a stronger silhouette')
      const pts = ring.map(([x, y]) => ({ x, y }))
      let area = 0
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a.x * b.y - b.x * a.y }
      if (area > 0) pts.reverse()
      const faired = fairTracedRing(pts.map((p) => [p.x, p.y] as Vec2Px), useOutlineStore.getState().fairing?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL))
      if (faired.length < 3) throw new Error('No clear shape found — try an image with a stronger silhouette')
      return { paths: [ringToVPath(faired.map(([x, y]) => ({ x, y })), 30, 0.35)] }
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
      const img = docRef.current.image
      const sp = shapeParamsRef.current
      applyVec(getShape(shapeKind, img.widthPx, img.heightPx, { sides: sp.sides, points: sp.points, spikiness: sp.spikiness }), null)
      return
    }
    if (shapeKind && GEN_VECTOR_KINDS.has(shapeKind)) {
      // release bakes the live doc-morph into ONE fitted vector (§6.3: transient ticks, vector commit)
      setShapePreview(null)
      applyVec(vecFromGenerator(shapeKind), null)
      return
    }
    if (shapePreview) { applyDoc(shapePreview); setShapePreview(null) }
  }, [shapeKind, shapePreview, applyDoc, applyVec, vecFromGenerator, docRef])

  // Rotation handlers — desktop handle + two-finger gesture both drive rotatePreview, baked on release.
  const beginRotateHandle = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const [cx, cy] = outerCenter(docRef.current)
    const at = toViewBox(e.clientX, e.clientY)
    rotateRef.current = { cx, cy, start: Math.atan2(at[1] - cy, at[0] - cx) }
  }, [toViewBox, docRef])
  const toggleShape = useCallback(() => {
    setActiveAdjust((a) => (a === 'shape' ? null : 'shape'))
    setShapeKind(null); setShapePreview(null) // open the picker fresh (chips only) — no stale active shape
  }, [])

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

  // ✕ Close = discard this session's edits: restore the pre-open truth through THE one writer
  // (shape + contour revert atomically), revert the blend, exit. (Done keeps; commits were live.)
  const onCancel = useCallback(() => {
    const pe = preEditRef.current
    const st = useOutlineStore.getState()
    st.commitGeometry(pe.committedShape) // null → back to the born truth (spec.vectorShape)
    if (st.bgBlur !== pe.bgBlur) st.setBgBlur(pe.bgBlur != null ? pe.bgBlur : 0.5) // revert blend (null ≈ build default)
    setActiveAdjust(null)
    setSelectedNode(null)
    setAllSelected(false)
    st.setEditorOpen(false) // §6.3 boundary
    onClose()
  }, [onClose])

  if (!open) return null

  const canUndo = histRef.current.past.length > 0
  const canRedo = histRef.current.future.length > 0
  const nodeR = ((doc.image.widthPx / VIEW_W) * 11) / view.scale // constant on-screen size at any zoom (G11)
  // Desktop rotate handle — a grip on a short stem above the outline, shown when all anchors are selected.
  const rotOuterIdx = doc.rings.findIndex((r) => r.role === 'outer')
  const rotOuterRing = rotOuterIdx >= 0 ? resolved.flattenedRingsPx[rotOuterIdx] : null
  let rotHandle: { bx: number; by: number; hy: number } | null = null
  if (allSelected && !preview && rotOuterRing && rotOuterRing.length) {
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
  const cropMode = shapeKind !== null && !preview && !shapePreview && !tunePreview // #32: every preset is reshapeable
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
  // #28: photo pan/zoom preview — mirrors the 3D texture mapping (x = s·X − W(s−1)/2 − ox·W)
  const artXform = art.scale !== 1 || art.offsetX !== 0 || art.offsetY !== 0
    ? `translate(${(-doc.image.widthPx * (art.scale - 1)) / 2 - art.offsetX * doc.image.widthPx} ${(-doc.image.heightPx * (art.scale - 1)) / 2 + art.offsetY * doc.image.heightPx}) scale(${art.scale})`
    : undefined
  const fxFilter = fxDraft.brightness !== 100 || fxDraft.contrast !== 100 || fxDraft.saturate !== 100 || fxDraft.warmth > 0
    ? `brightness(${fxDraft.brightness}%) contrast(${fxDraft.contrast}%) saturate(${fxDraft.saturate}%)${fxDraft.warmth > 0 ? ` sepia(${Math.round(fxDraft.warmth * 0.45)}%)` : ''}`
    : undefined
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
          {(
            <>
              <TopTool icon={<UndoIcon />} label="Undo" onClick={undo} disabled={!canUndo} />
              <TopTool icon={<RedoIcon />} label="Redo" onClick={redo} disabled={!canRedo} />
              <TopTool icon={<ResetIcon />} label="Reset" onClick={onReset} />
              {/* Preview = hide anchors/handles to see the clean result without exiting */}
              <TopTool icon={preview ? <PreviewOffIcon /> : <PreviewIcon />} label={preview ? 'Edit' : 'Preview'} onClick={() => setPreview((v) => !v)} />
              {/* Points = summon/hide anchors (hidden by default — Dan's doctrine). On vector
                  shapes this reveals the minimal intentional skeleton (Run 6 points-on-demand). */}
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
          onDoubleClick={onSurfaceDoubleClick}
          onWheel={(e) => {
            // #28 Image-Position: scroll zooms the PHOTO within the shape (G1 semantics)
            if (activeAdjust === 'image' && imageSub === 'position') {
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
              <image href={imageUrl} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" filter="url(#kaiBgBlur)" />
              <image href={subjMatteUrl!} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" transform={`translate(0 ${doc.image.heightPx}) scale(1 -1)`} />
            </>
          ) : (
            <image href={imageUrl} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" />
          ))}
          </g>
          </g>
          {(
            <>
              {/* scrim dims outside the cut; hidden during a live transform (its hole would lag the move/rotate) */}
              {imageUrl && pathD && !preview && !rotateLive && !moveLive && !stretchLive && (
                <path className={styles.scrim} fillRule="evenodd" d={`M0 0H${doc.image.widthPx}V${doc.image.heightPx}H0Z ${pathD}`} />
              )}
              <g transform={liveXform}>
                {!preview && <path className={`${styles.path} ${hasIssues ? styles.pathError : ''}`} d={pathD} />}
                {/* anchors + rotate handle hidden in Preview (clean result). The doc-node swarm
                    never renders in vector mode — the shadow doc is interaction math, not UI. */}
                {!preview && showAnchors && !vshape && shown.rings.map((ring) =>
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
        {preview
          ? <span className={styles.approved}>Preview — tap Edit to keep editing</span>
          : hasIssues
            ? <span className={styles.warn}>This shape can’t be cut cleanly — fix the crossing</span>
            : allSelected
              ? 'All corners selected — scale or twist them together'
              : selectedNode
                ? 'Drag this point, or add/delete from the bar below'
                : 'Tap inside to select all · drag inside to move · drag points · double-tap to add/remove · pinch/scroll to zoom'}
      </div>

      {/* Run 2 · seam 5: the three tool sheets live in editor/sheets (verbatim moves). */}
      {activeAdjust === 'adjust' && (
        <AdjustSheet
          cornerMode={!!(selectedNode || (vshape && selVA !== null && vshape.paths[0].anchors[selVA]?.corner))}
          adjustSub={adjustSub} setAdjustSub={setAdjustSub} canTune={canTune}
          maxRadius={maxRadius} radius={radius} setRadius={setRadius} commitRadius={commitRadius}
          smoothing={smoothing} setSmoothing={setSmoothing} commitSmoothing={commitSmoothing}
          scale={scale} setScale={setScale} commitScale={commitScale}
          blendOn={blendOn} setBlendOn={setBlendOn} blendBlur={blendBlur} setBlendBlur={setBlendBlur} writeBlend={writeBlend}
          detail={detail} setDetail={setDetail} previewTune={previewTune} commitTune={commitTune} fairParams={fairParams}
        />
      )}
      {activeAdjust === 'image' && (
        <ImageSheet imageSub={imageSub} setImageSub={setImageSub} art={art} fxDraft={fxDraft} setFxDraft={setFxDraft} />
      )}
      {activeAdjust === 'shape' && (
        <ShapeSheet
          shapeKind={shapeKind} pickShape={pickShape} shapeParams={shapeParams}
          nudgeParam={nudgeParam} previewParam={previewParam} commitShape={commitShape}
          rerollBlob={rerollBlob} onUploadShape={onUploadShape}
        />
      )}

      {/* contextual anchor actions — appear when a single point is selected (doc or vector) */}
      {(selectedNode || (vshape && selVA !== null)) && (
        <div className={styles.nodeBar}>
          <button type="button" className={styles.nodeAction} onClick={vshape && selVA !== null ? onVAddAfter : onAddAfterSelected}>
            <AddPointIcon /><span>Add point</span>
          </button>
          <button type="button" className={styles.nodeAction} onClick={vshape && selVA !== null ? onVDelete : onDeleteSelected}>
            <DeleteIcon /><span>Delete point</span>
          </button>
        </div>
      )}

      {/* bottom toolbar — thumb-reachable icon tools; full-width bar, content capped + centered on desktop */}
      <div className={styles.toolbar}>
        <div className={styles.toolInner}>
        {(
          <>
            {/* #35: the MODE pill — Shape · Adjust · Image (Apple bottom-pill pattern; Draw removed — KAI-8962) */}
            <ToolBtn icon={<ShapeIcon />} label="Shape" onClick={toggleShape} active={activeAdjust === 'shape'} />
            <ToolBtn icon={<TuneIcon />} label="Adjust" onClick={() => setActiveAdjust((a) => (a === 'adjust' ? null : 'adjust'))} active={activeAdjust === 'adjust'} />
            <ToolBtn icon={<ImageToolIcon />} label="Image" onClick={() => setActiveAdjust((a) => (a === 'image' ? null : 'image'))} active={activeAdjust === 'image'} />
          </>
        )}
        </div>
      </div>
      </div>
    </div>
  )
}
