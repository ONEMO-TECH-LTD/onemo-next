'use client'

// editor/useEditorGestures.ts — GESTURE TRANSFORMS (R8 — Creator v5 monolith split, seam 3).
//
// Every pointer/touch interaction on the editor canvas: vector anchor/handle drag, double-tap Points
// toggle, surface pan/zoom (pinch + wheel), drag-inside move, crop stretch grips, rotate handle, and
// tap-to-select. All transient drag state lives in REFS (vecDragRef / moveRef / rotateRef / stretchRef
// / pinchRef / ...), so the handlers can be STABLE: they read a "latest ctx" ref at call time rather
// than closing over render values. That deletes the stale-closure bug class the monolith suffered (the
// KAI-8984 activeAdjust-stale-closure): the handler is created once, but always sees fresh state.
// Geometry edits route through the SAME editing API (transformSource / applyVec) and preserve stable
// ids — this hook owns interaction, never the recipe or the geometry math. Swap-test: replace this
// hook, the handler contract (same inputs → same store/recipe writes) is unchanged.

import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useOutlineStore } from '../outlineStore'
import { perfGesture } from '../../dev/PerfHUD'
import { pointInPolygon, type GripId } from './geometry'
import type { CanvasView } from './useCanvasView'
import { nearestOnPath, deleteAnchorRefit, type VShape, type VAnchor, type Vec2 } from '@/lib/vector-core'
import type { Vec2Px } from '@/lib/outline-core/math'

type BBox = { minX: number; minY: number; maxX: number; maxY: number }
type StretchState = { which: GripId; ax: number; ay: number; bbox: BBox; sx: number; sy: number }

// Run 6 — pure: the transient shape for an in-flight anchor/handle drag (moved verbatim from the
// monolith). Anchor drag translates p + both handles together; a SMOOTH anchor's handle drag mirrors
// the opposite handle's DIRECTION while preserving its own length (Figma default); a CORNER anchor's
// handles move independently.
function vecDragShape(d: { kind: 'p' | 'hIn' | 'hOut'; ai: number; orig: VShape }, at: Vec2Px): VShape {
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
}

interface GestureCtx { // KAI-9066: module-internal (the consumer passes a structural object literal; no external import)
  // ── refs (stable identity; read/mutated at call time, never reassigned to defeat the latest-ref) ──
  svgRef: { readonly current: SVGSVGElement | null }
  viewRef: { readonly current: CanvasView }
  vshapeRef: { readonly current: VShape | null }
  nodeRRef: { readonly current: number }
  vecLiveRef: { readonly current: VShape | null }
  pointersRef: { current: Map<number, Vec2Px> }
  clientPtsRef: { current: Map<number, Vec2Px> }
  dragStartRef: { current: Vec2Px | null }
  nodeInteractedRef: { current: boolean }
  lastTapRef: { current: { x: number; y: number; t: number } | null }
  pinchRef: { current: { d0: number; scale0: number; c0: Vec2Px } | null }
  canvasPanRef: { current: { startClient: Vec2Px; vx0: number; vy0: number } | null }
  imgPanRef: { current: { startClient: [number, number]; art0: { offsetX: number; offsetY: number; scale: number } } | null }
  vecDragRef: { current: { kind: 'p' | 'hIn' | 'hOut'; ai: number; orig: VShape; moved: boolean } | null }
  rotateRef: { current: { cx: number; cy: number; start: number } | null }
  rotateLiveRef: { current: { deg: number; cx: number; cy: number } | null }
  moveRef: { current: { start: Vec2Px; bbox: BBox } | null }
  moveLiveRef: { current: { dx: number; dy: number } | null }
  stretchRef: { current: StretchState | null }
  // ── canvas-view API (useCanvasView) ──
  toViewBox: (clientX: number, clientY: number) => Vec2Px
  screenToContent: (clientX: number, clientY: number, v: CanvasView) => Vec2Px
  originPinning: (c: Vec2Px, clientX: number, clientY: number, scale: number) => { vx: number; vy: number }
  applyZoom: (focusClientX: number, focusClientY: number, newScaleRaw: number, from: CanvasView) => void
  setView: (v: CanvasView) => void
  // ── editing API (useOutlineEditing) ──
  transformSource: (fn: (p: Vec2) => Vec2) => void
  applyVec: (v: VShape, base?: VShape | null, lin?: 'trace' | 'vector') => void
  // ── transient-state setters ──
  setVecLive: (v: VShape | null) => void
  setMoveLive: (v: { dx: number; dy: number } | null) => void
  setRotateLive: (v: { deg: number; cx: number; cy: number } | null) => void
  setStretchLive: (v: { sx: number; sy: number; ax: number; ay: number } | null) => void
  setAllSelected: (v: boolean) => void
  setSelVA: (v: number | null) => void
  setSelSeg: (v: number | null) => void
  setShowAnchors: Dispatch<SetStateAction<boolean>>
  // ── volatile values (read FRESH each gesture via the latest-ref) ──
  preview: boolean
  activeAdjust: 'shape' | 'adjust' | 'image' | null
  showAnchors: boolean
  frameLocked: boolean
  imgW: number
  imgH: number
  hitRing: Vec2Px[]
  hitBBox: BBox
}

export function useEditorGestures(ctx: GestureCtx) {
  // latest-ref: handlers are created once (stable) but always read the freshest ctx — no stale closures.
  const ctxRef = useRef(ctx)
  // Write the latest ctx in an effect (NOT during render) — gesture handlers fire after commit, so they
  // always read the freshest ctx; satisfies the react-compiler "no ref access during render" rule with
  // identical behaviour (the ref is never read during render — every read is inside a pointer handler).
  useEffect(() => { ctxRef.current = ctx })

  // ── vector anchor / handle pointer-down (Points mode) ──
  const onVAnchorDown = useCallback(
    (i: number) => (e: ReactPointerEvent) => {
      const { vshapeRef, toViewBox, dragStartRef, vecDragRef, nodeInteractedRef, setAllSelected, setSelVA } = ctxRef.current
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      nodeInteractedRef.current = true
      setAllSelected(false)
      setSelVA(i)
      dragStartRef.current = toViewBox(e.clientX, e.clientY)
      if (vshapeRef.current) vecDragRef.current = { kind: 'p', ai: i, orig: vshapeRef.current, moved: false }
    },
    [],
  )
  const onVHandleDown = useCallback(
    (i: number, kind: 'hIn' | 'hOut') => (e: ReactPointerEvent) => {
      const { vshapeRef, toViewBox, dragStartRef, vecDragRef, nodeInteractedRef } = ctxRef.current
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      nodeInteractedRef.current = true
      dragStartRef.current = toViewBox(e.clientX, e.clientY)
      if (vshapeRef.current) vecDragRef.current = { kind, ai: i, orig: vshapeRef.current, moved: false }
    },
    [],
  )
  // double-tap a vector anchor → delete with re-fit (ring stays valid, ≥3 anchors)
  const onVAnchorDouble = useCallback(
    (i: number) => (e: ReactMouseEvent) => {
      const { vshapeRef, applyVec, setSelVA } = ctxRef.current
      e.stopPropagation()
      const v = vshapeRef.current
      if (!v || v.paths[0].anchors.length <= 3) return
      applyVec({ paths: [deleteAnchorRefit(v.paths[0], i), ...v.paths.slice(1)] }, null)
      setSelVA(null)
    },
    [],
  )

  // ── surface pointer-down: double-tap Points toggle · image-pan · pinch · move-inside · canvas-pan ──
  const onSurfacePointerDown = useCallback((e: ReactPointerEvent) => {
    const { preview, activeAdjust, lastTapRef, setShowAnchors, setSelVA, setAllSelected, toViewBox, pointersRef, clientPtsRef, imgPanRef, moveRef, setMoveLive, moveLiveRef, canvasPanRef, viewRef, screenToContent, pinchRef, hitRing, hitBBox } = ctxRef.current
    if (preview) return // view-only
    // KAI-9013: two primary downs within 350ms/24px ANYWHERE on the surface = Frame ⇄ Points (no fill
    // gate — on a Magic cut most of the canvas is outside the outline). Image mode keeps its pan gesture.
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
    // Image mode: a single finger inside pans the PHOTO under the cutline (plan A2)
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
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const { pointersRef, clientPtsRef, toViewBox, vecDragRef, dragStartRef, setVecLive, imgPanRef, svgRef, pinchRef, originPinning, setView, canvasPanRef, imgW, imgH, viewRef, rotateRef, rotateLiveRef, setRotateLive, moveRef, moveLiveRef, setMoveLive, nodeInteractedRef } = ctxRef.current
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
  }, [])

  const commitRotate = useCallback(() => {
    const { rotateLiveRef, transformSource, setRotateLive, nodeInteractedRef } = ctxRef.current
    const rl = rotateLiveRef.current
    if (rl && Math.abs(rl.deg) > 0.01) {
      // exact rotation on the SOURCE (ids preserved → per-anchor adjustments survive the transform)
      const rad = (rl.deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad)
      const t = (p: Vec2) => ({ x: rl.cx + (p.x - rl.cx) * c - (p.y - rl.cy) * s, y: rl.cy + (p.x - rl.cx) * s + (p.y - rl.cy) * c })
      transformSource(t)
    }
    rotateLiveRef.current = null; setRotateLive(null)
    nodeInteractedRef.current = true // suppress the click that follows so it doesn't re-select-all
  }, [])

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    const { pointersRef, clientPtsRef, vecDragRef, vecLiveRef, setVecLive, applyVec, imgPanRef, nodeInteractedRef, pinchRef, canvasPanRef, rotateRef, moveRef, moveLiveRef, transformSource, setMoveLive } = ctxRef.current
    pointersRef.current.delete(e.pointerId)
    clientPtsRef.current.delete(e.pointerId)
    // Run 6: release an anchor/handle drag → ONE history entry; a manual point edit invalidates the
    // pristine fillet base (Radius adopts the current geometry on next use).
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
  }, [commitRotate])

  // Tap the surface (not a node): inside the cut → SELECT ALL corners (scale/twist them together);
  // outside → deselect. (Node taps stopPropagation, so they never reach here.)
  const onSurfaceClick = useCallback((e: ReactMouseEvent) => {
    const { preview, nodeInteractedRef, toViewBox, showAnchors, vshapeRef, nodeRRef, setSelSeg, setSelVA, setAllSelected, hitRing } = ctxRef.current
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
  }, [])

  // ── crop stretch grips (pointer-captured on the grip element; never thread the surface handlers) ──
  const beginStretch = useCallback((which: GripId) => (e: ReactPointerEvent) => {
    const { hitBBox, nodeInteractedRef, stretchRef } = ctxRef.current
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    nodeInteractedRef.current = true
    const b = hitBBox
    if (!(b.maxX > b.minX) || !(b.maxY > b.minY)) return
    const ax = which.includes('w') ? b.maxX : which.includes('e') ? b.minX : (b.minX + b.maxX) / 2
    const ay = which.includes('n') ? b.maxY : which.includes('s') ? b.minY : (b.minY + b.maxY) / 2
    stretchRef.current = { which, ax, ay, bbox: b, sx: 1, sy: 1 }
  }, [])
  const moveStretch = useCallback((e: ReactPointerEvent) => {
    const { stretchRef, toViewBox, imgW, imgH, frameLocked, setStretchLive } = ctxRef.current
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
    // 6.2 (Dan 2026-06-17): a LOCKED frame SCALES uniformly on ANY grip — corners use the dominant axis,
    // edges use their single active axis — so a locked shape scales (aspect preserved), never deforms.
    if (frameLocked) {
      const u = st.which.length === 2 ? Math.max(sx, sy) : (st.which === 'n' || st.which === 's') ? sy : sx
      sx = u; sy = u
    }
    stretchRef.current = { ...st, sx, sy }
    setStretchLive({ sx, sy, ax: st.ax, ay: st.ay })
  }, [])
  const endStretch = useCallback(() => {
    const { stretchRef, setStretchLive, transformSource, nodeInteractedRef } = ctxRef.current
    const st = stretchRef.current
    if (!st) return
    stretchRef.current = null
    setStretchLive(null)
    // KAI-9067: a completed stretch must NOT poison the next surface tap. beginStretch sets
    // nodeInteractedRef=true and onSurfaceClick swallows one click while it's true — so the user's
    // re-select-frame tap got eaten and the rotate handle never mounted. Clear it on stretch-end.
    nodeInteractedRef.current = false
    if (Math.abs(st.sx - 1) < 0.004 && Math.abs(st.sy - 1) < 0.004) return // a tap, not a pull
    const t0 = performance.now()
    {
      // exact anisotropic transform on the SOURCE (ids preserved → per-anchor adjustments survive)
      const t = (p: Vec2) => ({ x: st.ax + (p.x - st.ax) * st.sx, y: st.ay + (p.y - st.ay) * st.sy })
      transformSource(t)
    }
    perfGesture('stretch-commit', performance.now() - t0)
  }, [])

  // Rotation handle (desktop) — drives rotateLive, baked on release (commitRotate via pointer-up).
  const beginRotateHandle = useCallback((e: ReactPointerEvent) => {
    const { hitBBox, toViewBox, rotateRef } = ctxRef.current
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const cx = (hitBBox.minX + hitBBox.maxX) / 2, cy = (hitBBox.minY + hitBBox.maxY) / 2
    const at = toViewBox(e.clientX, e.clientY)
    rotateRef.current = { cx, cy, start: Math.atan2(at[1] - cy, at[0] - cx) }
  }, [])

  // Canvas wheel: Image mode scrolls the PHOTO zoom; otherwise zoom the canvas about the cursor (G11).
  const onSurfaceWheel = useCallback((e: ReactWheelEvent) => {
    const { activeAdjust, applyZoom, viewRef } = ctxRef.current
    if (activeAdjust === 'image') {
      const st = useOutlineStore.getState()
      const a = st.artwork
      st.setArtwork({ ...a, scale: Math.max(1, Math.min(4, a.scale * Math.exp(-e.deltaY * 0.0022))) })
      return
    }
    applyZoom(e.clientX, e.clientY, viewRef.current.scale * Math.exp(-e.deltaY * 0.0022), viewRef.current)
  }, [])

  return {
    onVAnchorDown, onVHandleDown, onVAnchorDouble,
    onSurfacePointerDown, onPointerMove, onPointerUp, onSurfaceClick, onSurfaceWheel,
    beginStretch, moveStretch, endStretch, beginRotateHandle,
  }
}
