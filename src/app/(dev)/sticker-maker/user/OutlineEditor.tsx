// Manual Sticker Maker — 2D outline editor surface (A1b/A1c/A1d/A2a).
// Renders an OutlineDocument over the flat cut-out image: the resolved outline path + draggable
// anchor handles. outline-core is the single source of truth — every edit is a canonical command
// (MoveNode / AddNode / DeleteNode / SetGlobalCornerRadius); the rendered path is DERIVED via
// resolveOutlineDocument. Styling = ONEMO design system tokens (CSS module). No three.js here.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyOutlineCommands,
  resolveOutlineDocument,
  resolveSdfBlend,
  livewirePath,
  outlineDocumentHash,
  rdpClosed,
  repairSimplePolygon,
  type OutlineDocument,
  type OutlineCommand,
  type Vec2Px,
  type ReplayEnv,
  type CostGrid,
} from '@/lib/outline-core'
import type { ShapeSpecDraft } from '../core/shaped/types'
import { buildEdgeCost } from './edgeCost'
import { useOutlineStore } from './outlineStore'
import { UndoIcon, RedoIcon, HugIcon, RoundIcon, SmoothIcon, ScaleIcon, PenIcon, ResetIcon, CheckIcon, CloseIcon, PlusIcon, MinusIcon, AddPointIcon, DeleteIcon } from './icons'
import styles from './outline-editor.module.css'

interface OutlineEditorProps {
  open: boolean
  imageUrl?: string
  onClose: () => void
}

const VIEW_W = 1000
const VIEW_H = 1000

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

function docFromSpec(spec: ShapeSpecDraft): OutlineDocument {
  const W = spec.maskWidthPx, H = spec.maskHeightPx
  const k = spec.mmPerPx || 1
  // Control-node simplification tolerance. Deliberately coarse (RDP is curvature-aware): near-straight
  // edges collapse to clean straight lines (few anchors), while curved regions keep the points they need.
  // This is the EDITABLE handle density only — the manufacturing polygon is re-flattened finer downstream.
  const eps = Math.max(2, Math.max(W, H) * 0.022)
  // geometryMM is y-UP (the mask is loaded y-up so the 3D is upright — segment-ml.ts/mask.ts). The
  // editor draws the raw photo y-DOWN via SVG, so flip Y here to overlay the outline right-side-up on
  // the image. The editor→3D feedback re-flips (H − y) back to the engine's y-up space, so they cancel.
  const minSpacing = Math.max(3, Math.max(W, H) * 0.008) // merge anchors this close (prevents overlapping/crossing)
  const toRing = (ptsMM: [number, number][], prefix: string) =>
    // simplify → REPAIR (merge coincident anchors + remove self-intersections) so the auto outline is clean
    repairSimplePolygon(rdpClosed(ptsMM.map(([x, y]) => [x / k, H - y / k] as Vec2Px), eps), minSpacing).map((p, i) => ({
      id: `${prefix}${i}`, p, role: 'corner' as const, corner: { mode: 'inherit' as const },
    }))
  const rings: OutlineDocument['rings'] = [
    { id: 'r1', role: 'outer', closed: true, nodes: toRing(spec.geometryMM.outer.pts, 'o') },
  ]
  spec.geometryMM.holes.forEach((h, hi) => {
    rings.push({ id: `h${hi}`, role: 'hole', parentRingId: 'r1', closed: true, nodes: toRing(h.pts, `h${hi}n`) })
  })
  // Default to MAXIMUM corner rounding, SELF-CORRECTING: round as far as the shape allows, then auto
  // back off to the largest radius that doesn't self-intersect (per-shape, so it never ships a crossing).
  const env = { image: { widthPx: W, heightPx: H, sourceHash: spec.sourceRef.slice(0, 40), orientation: 'baked' as const }, mode: 'auto' as const }
  const probe = applyOutlineCommands({ rings, style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 } }, [], env)
  const safe = maxSafeGlobalRadius(probe, Math.round(Math.min(W, H) * 0.25))
  const base = { rings, style: { globalOutlineCornerRadiusPx: safe, smoothing: 0 } }
  return applyOutlineCommands(base, [], env)
}

/** Build an OutlineDocument from a single outer ring of points (used by the SDF blend). */
function docFromRings(outerPts: Vec2Px[], image: OutlineDocument['image']): OutlineDocument {
  const clean = repairSimplePolygon(outerPts, Math.max(3, Math.max(image.widthPx, image.heightPx) * 0.008))
  const nodes = (clean.length >= 3 ? clean : outerPts).map((p, i) => ({ id: `b${i}`, p, role: 'corner' as const, corner: { mode: 'inherit' as const } }))
  const base = { rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }], style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 } }
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

export default function OutlineEditor({ open, imageUrl, onClose }: OutlineEditorProps) {
  const [doc, setDoc] = useState<OutlineDocument>(() => seedDoc(VIEW_W, VIEW_H))
  const [drag, setDrag] = useState<{ ringId: string; nodeId: string; pos: Vec2Px } | null>(null)
  const [radius, setRadius] = useState(0)
  const [maxRadius, setMaxRadius] = useState(120)
  const [approved, setApproved] = useState<string | null>(null)
  const [blend, setBlend] = useState(100)
  const [smoothing, setSmoothing] = useState(0) // 0–100 → style.smoothing 0..1 (A2c Catmull-Rom)
  const [scale, setScale] = useState(100) // 50–150 relative resize of the whole cut-out; bakes on release
  const [drawPts, setDrawPts] = useState<Vec2Px[] | null>(null) // non-null = Manual draw in progress (A3a)
  const [edgeCost, setEdgeCost] = useState<CostGrid | null>(null) // image edge-cost grid for the livewire (A3b)
  const [selectedNode, setSelectedNode] = useState<{ ringId: string; nodeId: string } | null>(null) // per-corner radius target (A1c)
  const [activeAdjust, setActiveAdjust] = useState<'hug' | 'round' | 'smooth' | 'scale' | null>(null) // which adjustment slider is revealed (mobile: one at a time)
  const [allSelected, setAllSelected] = useState(false) // tap inside the cut → select every corner, edit them together
  const [freehandPreview, setFreehandPreview] = useState<Vec2Px[] | null>(null) // live freehand stroke (A3d)
  const freehandRef = useRef<Vec2Px[] | null>(null)
  const freehandMovedRef = useRef(false)
  const nodeInteractedRef = useRef(false) // a node tap just happened → suppress the bubbling surface-click (which would re-select all)
  const dragStartRef = useRef<Vec2Px | null>(null) // pointer-down point → distinguish a tap (select) from a drag (move)
  const blendSrc = useRef<{ square: Vec2Px[]; silhouette: Vec2Px[]; domain: { minX: number; minY: number; width: number; height: number }; image: OutlineDocument['image'] } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const idRef = useRef(0)
  const spec = useOutlineStore((s) => s.spec)
  const setEditedContourMM = useOutlineStore((s) => s.setEditedContourMM)
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
    setApproved(null)
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
    // Restore prior edits if they belong to the current cut-out; else derive a fresh editable contour.
    const stored = useOutlineStore.getState().editedDoc
    const useStored = !!stored && !!spec && stored.image.sourceHash === spec.sourceRef.slice(0, 40)
    const d = useStored ? stored! : spec ? docFromSpec(spec) : seedDoc(VIEW_W, VIEW_H)
    setDoc(d)
    const W = d.image.widthPx, H = d.image.heightPx
    const outer = (d.rings.find((r) => r.role === 'outer')?.nodes ?? []).map((n) => n.p)
    blendSrc.current = { square: [[0, 0], [W, 0], [W, H], [0, H]], silhouette: outer, domain: { minX: 0, minY: 0, width: W, height: H }, image: d.image }
    setBlend(100)
    setRadius(d.style.globalOutlineCornerRadiusPx)
    setSmoothing(Math.round(d.style.smoothing * 100))
    setScale(100)
    setMaxRadius(Math.round(Math.min(d.image.widthPx, d.image.heightPx) * 0.25))
    setApproved(null)
    setDrag(null)
    setDrawPts(null)
    setSelectedNode(null)
    setAllSelected(false)
    setActiveAdjust(null)
    setEdgeCost(null)
    dirtyRef.current = false // opening is not an edit — don't drive the 3D until the user changes something
    docRef.current = d
    histRef.current = { past: [], future: [] } // fresh undo history per editing session
    if (imageUrl) {
      const prior = spec
        ? spec.geometryMM.outer.pts.map(([x, y]) => [(x / (spec.mmPerPx || 1)) / spec.maskWidthPx, (y / (spec.mmPerPx || 1)) / spec.maskHeightPx] as [number, number])
        : undefined
      buildEdgeCost(imageUrl, 600, prior).then(setEdgeCost).catch(() => setEdgeCost(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const env: ReplayEnv = useMemo(() => ({ image: doc.image, mode: doc.mode }), [doc.image, doc.mode])

  const commit = useCallback(
    (cmd: OutlineCommand) => {
      const d = docRef.current
      applyDoc(applyOutlineCommands(d.baseSnapshot, [...d.commands, cmd], { image: d.image, mode: d.mode }))
    },
    [applyDoc],
  )

  // Display doc reflects the in-flight drag + the live radius slider (transient, instant).
  const displayDoc = useMemo(() => {
    let d: OutlineDocument = doc
    if (selectedNode) {
      // live per-corner radius on the selected node (A1c per-node)
      d = { ...doc, rings: doc.rings.map((r) => (r.id !== selectedNode.ringId ? r : { ...r, nodes: r.nodes.map((n) => (n.id === selectedNode.nodeId ? { ...n, corner: { ...n.corner, mode: 'manual' as const, outlineCornerRadiusPx: radius } } : n)) })) }
    } else if (radius !== doc.style.globalOutlineCornerRadiusPx) {
      d = { ...doc, style: { ...doc.style, globalOutlineCornerRadiusPx: radius } }
    }
    // live global smoothing slider (transient, applies on top of the radius branch)
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

  const resolved = useMemo(() => resolveOutlineDocument(displayDoc, { flattenTolerancePx: 0.5 }), [displayDoc])
  const hasIssues = resolved.issues.length > 0 // inline manufacturability guardrail (self-intersection etc.)

  // editor → 3D: push the COMMITTED resolved outline (mm) so the 3D suede object follows real edits
  // (ADDENDUM D step 4 "the 3D follows" / step 8 "what you approve is what's made"). Keyed on the
  // committed `doc` (not the transient drag), so the 3D updates on commit — 2D leads, 3D lags.
  useEffect(() => {
    if (!open || !spec || !dirtyRef.current) return
    const res = resolveOutlineDocument(doc, { flattenTolerancePx: 0.5 })
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

  const pathD = useMemo(
    () =>
      resolved.flattenedRingsPx
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

  // Freehand stroke capture (A3d) — press-drag on the surface in draw mode traces a path.
  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (drawPts === null) return
      freehandRef.current = [toViewBox(e.clientX, e.clientY)]
      freehandMovedRef.current = false
    },
    [drawPts, toViewBox],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drag) { setDrag({ ...drag, pos: toViewBox(e.clientX, e.clientY) }); return }
      if (drawPts !== null && freehandRef.current) {
        const p = toViewBox(e.clientX, e.clientY)
        freehandRef.current.push(p)
        const a = freehandRef.current[0]
        if (Math.hypot(p[0] - a[0], p[1] - a[1]) > Math.max(doc.image.widthPx, doc.image.heightPx) * 0.02) freehandMovedRef.current = true
        setFreehandPreview([...freehandRef.current])
      }
    },
    [drag, drawPts, toViewBox, doc.image],
  )

  const onPointerUp = useCallback(() => {
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
  }, [drag, drawPts, commit, doc.image])

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
    setBlend(100)
    setScale(100)
    setApproved(null)
    setDrag(null)
    setSelectedNode(null)
    setAllSelected(false)
  }, [spec, applyDoc])

  // 0→100% square↔silhouette blend (A2b · SDF morph). 100% = the cut-out silhouette; 0% = the square photo.
  const onBlend = useCallback((value: number) => {
    setBlend(value)
    const src = blendSrc.current
    if (!src) return
    const rings = resolveSdfBlend({ fromRings: [src.square], toRings: [src.silhouette], t: value / 100, domain: src.domain, grid: 120 })
    const outer = rings[0] ?? src.silhouette
    const eps = Math.max(2, Math.max(src.domain.width, src.domain.height) * 0.01)
    applyDoc(docFromRings(rdpClosed(outer, eps), src.image))
    setRadius(0)
    setSmoothing(0)
    setScale(100)
    setApproved(null)
    setSelectedNode(null)
    setAllSelected(false)
  }, [applyDoc])

  // Manual mode (A3a) — draw the outline by hand: click to place anchors, Finish to close the ring.
  const startDraw = useCallback(() => { setDrawPts([]); setDrag(null); setApproved(null) }, [])
  // Tap the surface (not a node): inside the cut → SELECT ALL corners (edit them together, opens Round);
  // outside → deselect. (Node taps stopPropagation, so they never reach here.)
  const onSurfaceClick = useCallback((e: React.MouseEvent) => {
    if (drawPts !== null) return
    if (nodeInteractedRef.current) { nodeInteractedRef.current = false; return } // a node tap → keep single selection
    if ((e.target as Element)?.tagName === 'circle') return // tapped a node handle, not the surface
    const p = toViewBox(e.clientX, e.clientY)
    const outerIdx = doc.rings.findIndex((r) => r.role === 'outer')
    const ring = outerIdx >= 0 ? resolved.flattenedRingsPx[outerIdx] : null
    if (ring && ring.length >= 3 && pointInPolygon(p, ring)) {
      setSelectedNode(null)
      setAllSelected(true)
      setRadius(doc.style.globalOutlineCornerRadiusPx)
      setActiveAdjust('round')
    } else {
      setSelectedNode(null)
      setAllSelected(false)
    }
  }, [drawPts, doc, resolved, toViewBox])

  const commitRadius = useCallback(() => {
    if (selectedNode) commit({ op: 'SetCorner', ringId: selectedNode.ringId, nodeId: selectedNode.nodeId, corner: { mode: 'manual', outlineCornerRadiusPx: radius } })
    else commit({ op: 'SetGlobalCornerRadius', outlineCornerRadiusPx: radius })
  }, [selectedNode, radius, commit])
  const commitSmoothing = useCallback(() => commit({ op: 'SetSmoothing', smoothing: smoothing / 100 }), [smoothing, commit])
  // Scale: the slider previews live (displayDoc), then bakes the relative factor on release; the −/+
  // buttons bake a fixed ±5% step. Both resize all node positions about the center, preserving corners.
  const commitScale = useCallback(() => {
    if (scale === 100) return
    applyDoc(scaleDoc(docRef.current, scale / 100))
    setScale(100)
  }, [scale, applyDoc])
  const nudgeScale = useCallback((deltaPct: number) => {
    applyDoc(scaleDoc(docRef.current, (100 + deltaPct) / 100))
    setScale(100)
  }, [applyDoc])
  const finishDraw = useCallback(() => {
    if (drawPath.length >= 3) {
      const eps = Math.max(2, Math.max(doc.image.widthPx, doc.image.heightPx) * 0.004)
      applyDoc(docFromRings(rdpClosed(drawPath, eps), doc.image))
      setRadius(0); setBlend(100); setSmoothing(0); setScale(100); setApproved(null); setSelectedNode(null); setAllSelected(false)
    }
    setDrawPts(null)
  }, [drawPath, doc.image, applyDoc])
  const cancelDraw = useCallback(() => setDrawPts(null), [])

  // Approve (journey step 8): lock the shape + return to the scene. The edited outline already drives
  // the 3D (editedContourMM), so closing reveals the approved shape on the object. We record the hash
  // as the WYSIWYG provenance anchor (the durable server-side canonical lock is the deferred slice).
  const onApprove = useCallback(() => {
    if (hasIssues) return
    setApproved(outlineDocumentHash(displayDoc))
    onClose()
  }, [hasIssues, displayDoc, onClose])

  if (!open) return null

  const drawing = drawPts !== null
  const canUndo = histRef.current.past.length > 0
  const canRedo = histRef.current.future.length > 0
  const nodeR = (doc.image.widthPx / VIEW_W) * 11
  const drawPathD = drawPath.length ? `M ${drawPath.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')}` : ''

  return (
    <div className={styles.overlay}>
      <div className={styles.topbar}>
        <span className={styles.title}>{drawing ? 'Draw outline' : 'Edit outline'}</span>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Done"><CloseIcon /></button>
      </div>

      <div className={styles.canvas}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${doc.image.widthPx} ${doc.image.heightPx}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onSurfaceClick}
          onDoubleClick={drawing ? undefined : onSurfaceDoubleClick}
        >
          {imageUrl && (
            <image href={imageUrl} x={0} y={0} width={doc.image.widthPx} height={doc.image.heightPx} preserveAspectRatio="xMidYMid slice" />
          )}
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
              {imageUrl && pathD && (
                <path className={styles.scrim} fillRule="evenodd" d={`M0 0H${doc.image.widthPx}V${doc.image.heightPx}H0Z ${pathD}`} />
              )}
              <path className={`${styles.path} ${hasIssues ? styles.pathError : ''}`} d={pathD} />
              {displayDoc.rings.map((ring) =>
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
            </>
          )}
        </svg>
      </div>

      {/* compact status line between canvas and toolbar */}
      <div className={styles.status}>
        {drawing
          ? 'Tap to place points, or drag to draw freehand'
          : hasIssues
            ? <span className={styles.warn}>This shape can’t be cut cleanly — fix the crossing</span>
            : approved
              ? <span className={styles.approved}>Shape locked — exactly what gets made</span>
              : allSelected
                ? 'All corners selected — round or scale them together'
                : selectedNode
                  ? 'Adjust this corner, or drag it'
                  : 'Tap inside to select all corners · drag points · double-tap to add/remove'}
      </div>

      {/* reveal-on-tap adjustment slider (mobile shows one at a time) */}
      {!drawing && activeAdjust && (
        <div className={styles.sheet}>
          {activeAdjust === 'hug' && (
            <input className={styles.slider} type="range" min={0} max={100} value={blend} onChange={(e) => onBlend(Number(e.target.value))} aria-label="Hug" />
          )}
          {activeAdjust === 'round' && (
            <input className={styles.slider} type="range" min={0} max={maxRadius} value={Math.min(radius, maxRadius)} onChange={(e) => setRadius(Number(e.target.value))} onPointerUp={commitRadius} aria-label="Round corners" />
          )}
          {activeAdjust === 'smooth' && (
            <input className={styles.slider} type="range" min={0} max={100} value={smoothing} onChange={(e) => setSmoothing(Number(e.target.value))} onPointerUp={commitSmoothing} aria-label="Smooth" />
          )}
          {activeAdjust === 'scale' && (
            <>
              <button type="button" className={styles.stepBtn} onClick={() => nudgeScale(-5)} aria-label="Scale down"><MinusIcon /></button>
              <input className={styles.slider} type="range" min={50} max={150} value={scale} onChange={(e) => setScale(Number(e.target.value))} onPointerUp={commitScale} aria-label="Scale" />
              <button type="button" className={styles.stepBtn} onClick={() => nudgeScale(5)} aria-label="Scale up"><PlusIcon /></button>
            </>
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
            <ToolBtn icon={<UndoIcon />} label="Undo" onClick={undo} disabled={!canUndo} />
            <ToolBtn icon={<RedoIcon />} label="Redo" onClick={redo} disabled={!canRedo} />
            <ToolBtn icon={<HugIcon />} label="Hug" onClick={() => setActiveAdjust((a) => (a === 'hug' ? null : 'hug'))} active={activeAdjust === 'hug'} />
            <ToolBtn icon={<RoundIcon />} label={selectedNode ? 'Corner' : 'Round'} onClick={() => setActiveAdjust((a) => (a === 'round' ? null : 'round'))} active={activeAdjust === 'round'} />
            <ToolBtn icon={<SmoothIcon />} label="Smooth" onClick={() => setActiveAdjust((a) => (a === 'smooth' ? null : 'smooth'))} active={activeAdjust === 'smooth'} />
            <ToolBtn icon={<ScaleIcon />} label="Scale" onClick={() => setActiveAdjust((a) => (a === 'scale' ? null : 'scale'))} active={activeAdjust === 'scale'} />
            <ToolBtn icon={<PenIcon />} label="Draw" onClick={startDraw} />
            <ToolBtn icon={<ResetIcon />} label="Reset" onClick={onReset} />
            <ToolBtn icon={<CheckIcon />} label="Approve" onClick={onApprove} disabled={hasIssues} primary />
          </>
        )}
        </div>
      </div>
    </div>
  )
}
