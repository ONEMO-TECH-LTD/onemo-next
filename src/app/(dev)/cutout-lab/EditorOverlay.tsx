'use client'

// cutout-lab — vector edit overlay (Dan's Figma reference, s62 item 8). Two modes over the
// selection canvas: NODES (drag individual anchors — handles ride along) and FRAME (pull sides/
// corners; aspect lock ⇒ uniform scale). PRESENTATION + gesture wiring only: every edit calls
// back with the mutated VShape — the page owns what it means (source update → re-finish).

import { useRef } from 'react'
import type { VShape } from '@/lib/vector-core'

export type EditMode = 'nodes' | 'frame'

interface Props {
  shape: VShape
  imgW: number
  imgH: number
  dispW: number
  /** working-view extent (image ∪ outline) — the canvas under this overlay renders this box */
  view?: { x: number; y: number; w: number; h: number }
  mode: EditMode
  aspectLocked: boolean
  onEdit: (shape: VShape) => void   // live (during drag)
  onCommit: (shape: VShape) => void // on release
  /** single-node selection (nodes mode): tap an anchor to select; the shell shows its vector knobs */
  selected?: { pi: number; ai: number } | null
  onSelect?: (sel: { pi: number; ai: number } | null) => void
}

const cloneShape = (s: VShape): VShape =>
  ({ paths: s.paths.map((p) => ({ anchors: p.anchors.map((a) => ({ ...a, p: { ...a.p }, hIn: a.hIn ? { ...a.hIn } : a.hIn, hOut: a.hOut ? { ...a.hOut } : a.hOut })) })) })

function bboxOf(s: VShape) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of s.paths) for (const a of p.anchors) {
    if (a.p.x < minX) minX = a.p.x; if (a.p.x > maxX) maxX = a.p.x
    if (a.p.y < minY) minY = a.p.y; if (a.p.y > maxY) maxY = a.p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Scale every anchor + handle about (ax, ay). */
function scaleShape(s: VShape, ax: number, ay: number, sx: number, sy: number): VShape {
  const m = (v: { x: number; y: number }) => ({ x: ax + (v.x - ax) * sx, y: ay + (v.y - ay) * sy })
  return { paths: s.paths.map((p) => ({ anchors: p.anchors.map((a) => ({ ...a, p: m(a.p), hIn: a.hIn ? m(a.hIn) : a.hIn, hOut: a.hOut ? m(a.hOut) : a.hOut })) })) }
}

export function EditorOverlay({ shape, imgW, imgH, dispW, view, mode, aspectLocked, onEdit, onCommit, selected, onSelect }: Props) {
  const vb = view ?? { x: 0, y: 0, w: imgW, h: imgH }
  const dragRef = useRef<{ kind: 'node'; pi: number; ai: number; base: VShape } | { kind: 'handle'; pi: number; ai: number; which: 'hIn' | 'hOut'; base: VShape } | { kind: 'grip'; grip: string; base: VShape; bb: ReturnType<typeof bboxOf> } | null>(null)
  const liveRef = useRef<VShape>(shape)

  const nodeR = Math.max(6, imgW / 70)
  const toImg = (e: React.PointerEvent<SVGSVGElement | SVGElement>) => {
    const svg = (e.currentTarget as SVGElement).closest('svg')!
    const r = svg.getBoundingClientRect()
    const sc = Math.min(r.width / vb.w, r.height / vb.h)
    const ox = (r.width - vb.w * sc) / 2, oy = (r.height - vb.h * sc) / 2
    return { x: vb.x + (e.clientX - r.left - ox) / sc, y: vb.y + (e.clientY - r.top - oy) / sc }
  }

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d) return
    const p = toImg(e)
    if (d.kind === 'handle') {
      // bezier tangent drag on the SELECTED anchor — moves one handle; the anchor stays
      const next = cloneShape(d.base)
      const a = next.paths[d.pi].anchors[d.ai]
      a[d.which] = { x: p.x, y: p.y }
      a.corner = false
      liveRef.current = next
      onEdit(next)
      return
    }
    if (d.kind === 'node') {
      const next = cloneShape(d.base)
      const a = next.paths[d.pi].anchors[d.ai]
      const dx = p.x - a.p.x, dy = p.y - a.p.y
      a.p = { x: p.x, y: p.y }
      if (a.hIn) a.hIn = { x: a.hIn.x + dx, y: a.hIn.y + dy }
      if (a.hOut) a.hOut = { x: a.hOut.x + dx, y: a.hOut.y + dy }
      liveRef.current = next
      onEdit(next)
      return
    }
    // frame grips
    const { bb } = d
    const w = bb.maxX - bb.minX || 1, h = bb.maxY - bb.minY || 1
    const g = d.grip
    // anchor point = the opposite side/corner; s = pulled dimension ratio
    let ax = bb.minX, ay = bb.minY, sx = 1, sy = 1
    if (g.includes('e')) { ax = bb.minX; sx = (p.x - bb.minX) / w }
    if (g.includes('w')) { ax = bb.maxX; sx = (bb.maxX - p.x) / w }
    if (g.includes('s')) { ay = bb.minY; sy = (p.y - bb.minY) / h }
    if (g.includes('n')) { ay = bb.maxY; sy = (bb.maxY - p.y) / h }
    if (g === 'n' || g === 's') { sx = aspectLocked ? sy : 1; ax = (bb.minX + bb.maxX) / 2 }
    if (g === 'e' || g === 'w') { sy = aspectLocked ? sx : 1; ay = (bb.minY + bb.maxY) / 2 }
    if (g.length === 2 && aspectLocked) { const u = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * u; sy = Math.sign(sy || 1) * u }
    sx = Math.max(0.05, sx); sy = Math.max(0.05, sy)
    const next = scaleShape(d.base, ax, ay, sx, sy)
    liveRef.current = next
    onEdit(next)
  }
  const up = () => {
    if (!dragRef.current) return
    dragRef.current = null
    onCommit(liveRef.current)
  }

  const bb = bboxOf(shape)
  const mx = (bb.minX + bb.maxX) / 2, my = (bb.minY + bb.maxY) / 2
  const grips: { g: string; x: number; y: number }[] = mode === 'frame' ? [
    { g: 'nw', x: bb.minX, y: bb.minY }, { g: 'n', x: mx, y: bb.minY }, { g: 'ne', x: bb.maxX, y: bb.minY },
    { g: 'w', x: bb.minX, y: my }, { g: 'e', x: bb.maxX, y: my },
    { g: 'sw', x: bb.minX, y: bb.maxY }, { g: 's', x: mx, y: bb.maxY }, { g: 'se', x: bb.maxX, y: bb.maxY },
  ] : []

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
      onPointerMove={move} onPointerUp={up} onPointerLeave={up}
    >
      {mode === 'frame' && (
        <rect x={bb.minX} y={bb.minY} width={bb.maxX - bb.minX} height={bb.maxY - bb.minY}
          fill="none" stroke="#7c3aed" strokeWidth={Math.max(1, imgW / 500)} strokeDasharray={`${imgW / 100} ${imgW / 150}`} />
      )}
      {mode === 'nodes' && shape.paths.map((p, pi) => p.anchors.map((a, ai) => {
        const isSel = selected?.pi === pi && selected?.ai === ai
        return (
          <g key={`${pi}-${ai}`}>
            {isSel && a.hIn && (<>
              <line x1={a.p.x} y1={a.p.y} x2={a.hIn.x} y2={a.hIn.y} stroke="#0ea5e9" strokeWidth={Math.max(1, imgW / 600)} />
              <circle cx={a.hIn.x} cy={a.hIn.y} r={nodeR * 0.75} fill="#0ea5e9" stroke="#fff" strokeWidth={Math.max(1, imgW / 600)} style={{ cursor: 'grab' }}
                onPointerDown={(e) => { e.stopPropagation(); (e.target as SVGElement).setPointerCapture?.(e.pointerId); dragRef.current = { kind: 'handle', pi, ai, which: 'hIn', base: cloneShape(shape) }; liveRef.current = shape }} />
            </>)}
            {isSel && a.hOut && (<>
              <line x1={a.p.x} y1={a.p.y} x2={a.hOut.x} y2={a.hOut.y} stroke="#0ea5e9" strokeWidth={Math.max(1, imgW / 600)} />
              <circle cx={a.hOut.x} cy={a.hOut.y} r={nodeR * 0.75} fill="#0ea5e9" stroke="#fff" strokeWidth={Math.max(1, imgW / 600)} style={{ cursor: 'grab' }}
                onPointerDown={(e) => { e.stopPropagation(); (e.target as SVGElement).setPointerCapture?.(e.pointerId); dragRef.current = { kind: 'handle', pi, ai, which: 'hOut', base: cloneShape(shape) }; liveRef.current = shape }} />
            </>)}
            <circle cx={a.p.x} cy={a.p.y} r={isSel ? nodeR * 1.25 : nodeR}
              fill={isSel ? '#7c3aed' : '#fff'} stroke={isSel ? '#fff' : '#7c3aed'} strokeWidth={Math.max(1.5, imgW / 400)}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => { e.stopPropagation(); (e.target as SVGElement).setPointerCapture?.(e.pointerId); onSelect?.({ pi, ai }); dragRef.current = { kind: 'node', pi, ai, base: cloneShape(shape) }; liveRef.current = shape }}
            />
          </g>
        )
      }))}
      {grips.map(({ g, x, y }) => (
        <rect key={g} x={x - nodeR} y={y - nodeR} width={nodeR * 2} height={nodeR * 2} rx={nodeR / 3}
          fill="#7c3aed" stroke="#fff" strokeWidth={Math.max(1, imgW / 500)}
          style={{ cursor: `${g.length === 2 ? (g === 'nw' || g === 'se' ? 'nwse' : 'nesw') : g === 'n' || g === 's' ? 'ns' : 'ew'}-resize` }}
          onPointerDown={(e) => { e.stopPropagation(); (e.target as SVGElement).setPointerCapture?.(e.pointerId); dragRef.current = { kind: 'grip', grip: g, base: cloneShape(shape), bb: bboxOf(shape) }; liveRef.current = shape }}
        />
      ))}
    </svg>
  )
}
