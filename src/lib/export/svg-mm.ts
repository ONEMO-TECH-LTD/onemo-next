// export module — manufacturing-grade mm-true SVG (vector reset Run 7).
//
// The file IS the shape: true Bézier path data at 1 user unit = 1 mm (the single convention that
// kills the 72-vs-96-DPI scale-error class). Nominal dimensions — kerf is NEVER baked into
// geometry (the cutter's software applies it). Winding normalized deterministically: outer ring
// counter-clockwise (negative shoelace area in y-down SVG space), holes clockwise.
// Blueprint: v3/blueprint/modules/export.md.

import type { VShape, VPath, Vec2 } from '@/lib/vector-core'
import { toSVGPathD, transformShape, flattenPath, signedArea } from '@/lib/vector-core'

export interface SVGmmOptions {
  /** px → mm scale (the spec's mmPerPx) */
  mmPerPx: number
  /** canvas size in px (defines the mm document box) */
  widthPx: number
  heightPx: number
  /** laser = stroke-only cut line (default) · cricut = filled silhouette */
  profile?: 'laser' | 'cricut'
  /** cut-stroke colour for the laser profile (stroke colour selects the operation in most RIPs) */
  strokeColor?: string
}

const reversePath = (p: VPath): VPath => ({
  anchors: [...p.anchors].reverse().map((a) => ({ p: a.p, hIn: a.hOut, hOut: a.hIn, corner: a.corner })),
})

/** Outer CCW (negative shoelace in y-down) / holes CW — deterministic, side-aware CAM friendly. */
export function normalizeWinding(shape: VShape): VShape {
  return {
    paths: shape.paths.map((p, i) => {
      const area = signedArea(flattenPath(p, 0.5))
      const isOuter = i === 0
      const wantNegative = isOuter // outer CCW in y-down ⇒ negative area
      return (area < 0) === wantNegative ? p : reversePath(p)
    }),
  }
}

/** Serialize a px-space VShape into an mm-true standalone SVG document. */
export function toManufacturingSVG(shape: VShape, opts: SVGmmOptions): string {
  const { mmPerPx, widthPx, heightPx } = opts
  const W = +(widthPx * mmPerPx).toFixed(3)
  const H = +(heightPx * mmPerPx).toFixed(3)
  const mmShape = normalizeWinding(transformShape(shape, (pt: Vec2) => ({ x: pt.x * mmPerPx, y: pt.y * mmPerPx })))
  const d = mmShape.paths.map((p) => toSVGPathD(p, 4)).join(' ')
  const profile = opts.profile ?? 'laser'
  const body =
    profile === 'laser'
      ? `<path d="${d}" fill="none" stroke="${opts.strokeColor ?? '#FF0000'}" stroke-width="0.1"/>`
      : `<path d="${d}" fill="#000000" fill-rule="evenodd" stroke="none"/>`
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
    `  <!-- ONEMO cutline · nominal dimensions, mm-true (1 unit = 1 mm) · kerf is applied by the cutter -->`,
    `  ${body}`,
    `</svg>`,
  ].join('\n')
}

/**
 * Minimal absolute-path parser for OUR dialect (M / L / C / Z) — the round-trip gate for the
 * exporter and the v1 boundary for SVG shape import (Run 8 extends coverage; anything outside the
 * dialect must fail LOUDLY, never silently mangle).
 */
export function parsePathD(d: string): VPath[] {
  const tokens = d.match(/[MLCZmlcz]|-?[\d.]+(?:e-?\d+)?/g)
  if (!tokens) throw new Error('SVG path: no tokens')
  const paths: VPath[] = []
  let anchors: { p: Vec2; hIn?: Vec2 | null; hOut?: Vec2 | null; corner: boolean }[] = []
  let i = 0
  const num = () => {
    const v = parseFloat(tokens[i++])
    if (Number.isNaN(v)) throw new Error(`SVG path: expected number at token ${i - 1}`)
    return v
  }
  while (i < tokens.length) {
    const cmd = tokens[i++]
    switch (cmd) {
      case 'M': {
        if (anchors.length) { paths.push({ anchors: anchors as VPath['anchors'] }); anchors = [] }
        anchors.push({ p: { x: num(), y: num() }, corner: true })
        break
      }
      case 'L': {
        anchors.push({ p: { x: num(), y: num() }, corner: true })
        break
      }
      case 'C': {
        const c1 = { x: num(), y: num() }
        const c2 = { x: num(), y: num() }
        const to = { x: num(), y: num() }
        const prev = anchors[anchors.length - 1]
        if (!prev) throw new Error('SVG path: C before M')
        prev.hOut = c1
        anchors.push({ p: to, hIn: c2, corner: false })
        break
      }
      case 'Z':
      case 'z': {
        // closing: if the last anchor duplicates the first, merge (carry its hIn home)
        const first = anchors[0], last = anchors[anchors.length - 1]
        if (first && last && first !== last && Math.hypot(first.p.x - last.p.x, first.p.y - last.p.y) < 1e-6) {
          first.hIn = last.hIn
          anchors.pop()
        }
        paths.push({ anchors: anchors as VPath['anchors'] })
        anchors = []
        break
      }
      default:
        throw new Error(`SVG path: unsupported command "${cmd}" — single-outline M/L/C/Z files only`)
    }
  }
  if (anchors.length) paths.push({ anchors: anchors as VPath['anchors'] })
  if (!paths.length) throw new Error('SVG path: empty')
  return paths
}
