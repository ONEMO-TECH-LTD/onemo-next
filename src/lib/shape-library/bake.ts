// shape-library OFFLINE BAKE TOOL (vector reset Run 2) — run: npx vite-node src/lib/shape-library/bake.ts
//
// Generates the static VShape literals for the organic presets: each source formula is sampled at
// HIGH density (2048 — bake-time only, never shipped), split at true corners, and fitted with the
// kernel's Schneider fitter at tight tolerance. The OUTPUT literals are pasted into defs.ts and
// frozen — runtime never samples, never fits a preset. Not imported by app code (dev tool only).
// (Blueprint: modules/shape-library.md — "fit happens once, offline, visually verified, frozen".)

import { ringToVPath } from '../vector-core'
import type { Vec2, VPath } from '../vector-core'

const N = 2048
const TOL = 0.0015 // unit space ≈ 0.5px at the 648px placement box

function normalize(pts: Vec2[]): Vec2[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const k = 2 / Math.max(maxX - minX, maxY - minY, 1e-9)
  return pts.map((p) => ({ x: (p.x - cx) * k, y: (p.y - cy) * k }))
}
const polar = (f: (t: number) => number): Vec2[] =>
  Array.from({ length: N }, (_, i) => { const t = (2 * Math.PI * i) / N; const r = f(t); return { x: r * Math.cos(t), y: r * Math.sin(t) } })

// ── the source formulas (verbatim math from the retired sampled generators) ──
const SOURCES: Record<string, { ring: Vec2[]; cornerDeg: number }> = {
  // LOEWE pinched square: lobed clover m=4, pinch 0.55, rotated 45°
  pinched: {
    ring: (() => {
      const d = 0.08 + 0.4 * 0.55
      const pts = polar((t) => (1 - d) + d * Math.pow(Math.abs(Math.cos((4 * t) / 2)), 0.8))
      const a = Math.PI / 4, c = Math.cos(a), s = Math.sin(a)
      return normalize(pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c })))
    })(),
    cornerDeg: 60,
  },
  sparkle: { ring: Array.from({ length: N }, (_, i) => { const t = (2 * Math.PI * i) / N; return { x: Math.pow(Math.cos(t), 3), y: Math.pow(Math.sin(t), 3) } }), cornerDeg: 25 },
  teardrop: {
    ring: normalize(Array.from({ length: N }, (_, i) => { const t = (2 * Math.PI * i) / N; return { x: Math.sin(t) * Math.pow(Math.sin(t / 2), 2), y: -Math.cos(t) } })),
    cornerDeg: 30,
  },
  asterisk: { ring: normalize(polar((t) => 0.34 + 0.66 * Math.pow(Math.abs(Math.cos(3 * t)), 1.1))), cornerDeg: 35 },
  bowtie: { ring: normalize(polar((t) => 0.34 + 0.66 * Math.pow(Math.abs(Math.cos(t)), 1.35))).map((p) => ({ x: p.x, y: p.y * 0.9 })), cornerDeg: 45 },
}

const f = (v: number) => Number(v.toFixed(4))
function emit(name: string, path: VPath): string {
  const lines = path.anchors.map((a) => {
    const hIn = a.hIn ? `hIn: { x: ${f(a.hIn.x)}, y: ${f(a.hIn.y)} }, ` : ''
    const hOut = a.hOut ? `hOut: { x: ${f(a.hOut.x)}, y: ${f(a.hOut.y)} }, ` : ''
    return `    { p: { x: ${f(a.p.x)}, y: ${f(a.p.y)} }, ${hIn}${hOut}corner: ${a.corner} },`
  })
  return `const ${name.toUpperCase()}_ANCHORS: VAnchor[] = [\n${lines.join('\n')}\n]`
}

for (const [name, src] of Object.entries(SOURCES)) {
  const path = ringToVPath(src.ring, src.cornerDeg, TOL)
  const corners = path.anchors.filter((x) => x.corner).length
  console.log(`// ${name}: ${path.anchors.length} anchors (${corners} corners), tol ${TOL}`)
  console.log(emit(name, path))
  console.log('')
}
