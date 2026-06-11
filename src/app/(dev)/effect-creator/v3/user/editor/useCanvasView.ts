// editor/useCanvasView — the G11 canvas view (Run 2 · G6 decomposition, seam 4): zoom + pan
// expressed AS the viewBox (`vx vy W/scale H/scale`), so getScreenCTM().inverse() keeps every
// gesture's px math correct with zero per-handler changes. scale 1 = fit; vx/vy = view origin.
// Blueprint: v3/blueprint/modules/editor.md (G11 — zoom is viewBox-true, verified as the lens).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vec2Px } from '@/lib/outline-core'

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
    // clamp so the view window stays on the content
    return {
      vx: Math.max(0, Math.min(W - vbW, vx)),
      vy: Math.max(0, Math.min(H - vbH, vy)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyZoom = useCallback((focusClientX: number, focusClientY: number, newScaleRaw: number, from: CanvasView) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { view, setView, viewRef, screenToContent, originPinning, applyZoom, toViewBox }
}
