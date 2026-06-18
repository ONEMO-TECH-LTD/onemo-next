// editor/useCanvasView — the G11 canvas view (Run 2 · G6 decomposition, seam 4): zoom + pan
// expressed AS the viewBox (`vx vy W/scale H/scale`), so getScreenCTM().inverse() keeps every
// gesture's px math correct with zero per-handler changes. scale 1 = fit; vx/vy = view origin.
// Blueprint: v3/blueprint/modules/editor.md (G11 — zoom is viewBox-true, verified as the lens).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vec2Px } from '@/lib/outline-core/math'

export interface CanvasView {
  scale: number
  vx: number
  vy: number
}

export function useCanvasView(
  svgRef: { current: SVGSVGElement | null },
  // content dimensions only (the canvas maps the IMAGE space — no document model involved)
  dimsRef: { current: { widthPx: number; heightPx: number } },
) {
  const [view, setView] = useState<CanvasView>({ scale: 1, vx: 0, vy: 0 })
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])

  // screenToContent mirrors preserveAspectRatio="xMidYMid meet" for an arbitrary scale/origin, so
  // pinch/wheel math can solve for the new origin that pins a content point under the cursor.
  const screenToContent = useCallback((clientX: number, clientY: number, v: CanvasView): Vec2Px => {
    const svg = svgRef.current
    const W = dimsRef.current.widthPx, H = dimsRef.current.heightPx
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    const vbW = W / v.scale, vbH = H / v.scale
    const k = Math.min(rect.width / vbW, rect.height / vbH) // 'meet'
    const padX = (rect.width - vbW * k) / 2, padY = (rect.height - vbH * k) / 2
    return [v.vx + (clientX - rect.left - padX) / k, v.vy + (clientY - rect.top - padY) / k]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Solve the view origin that places content point c under client point (clientX, clientY) at `scale`. */
  const originPinning = useCallback((c: Vec2Px, clientX: number, clientY: number, scale: number): { vx: number; vy: number } => {
    const svg = svgRef.current
    const W = dimsRef.current.widthPx, H = dimsRef.current.heightPx
    if (!svg) return { vx: 0, vy: 0 }
    const rect = svg.getBoundingClientRect()
    const vbW = W / scale, vbH = H / scale
    const k = Math.min(rect.width / vbW, rect.height / vbH)
    const padX = (rect.width - vbW * k) / 2, padY = (rect.height - vbH * k) / 2
    const vx = c[0] - (clientX - rect.left - padX) / k
    const vy = c[1] - (clientY - rect.top - padY) / k
    // v5.3·P5 (KAI-9150): INFINITE background — allow the view to pan/zoom PAST the photo's real edges
    // (the blurred surround fills the gap → no hard edge). A generous margin replaces the hard
    // stay-on-content clamp; the symmetric clamp also handles zoom-OUT (when vbW > W, lo/hi flip).
    const mx = W * 0.75, my = H * 0.75
    const clamp = (v: number, a: number, b: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), v))
    return {
      vx: clamp(vx, -mx, W - vbW + mx),
      vy: clamp(vy, -my, H - vbH + my),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyZoom = useCallback((focusClientX: number, focusClientY: number, newScaleRaw: number, from: CanvasView) => {
    // v5.3·P5 (KAI-9150): allow zoom-OUT below fit (0.45) to reveal the infinite blurred surround — the
    // clamp still stops you "zooming into nothing" (max 6×). Keep the pinned origin at ANY scale so you
    // can pan freely (incl. past the photo edges); the old scale===1 snap-to-centre is retired.
    const newScale = Math.max(0.45, Math.min(6, newScaleRaw))
    const c = screenToContent(focusClientX, focusClientY, from)
    const { vx, vy } = originPinning(c, focusClientX, focusClientY, newScale)
    setView({ scale: newScale, vx, vy })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { view, setView, viewRef, screenToContent, originPinning, applyZoom, toViewBox }
}
