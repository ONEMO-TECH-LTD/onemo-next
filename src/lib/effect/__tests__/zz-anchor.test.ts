import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { safeSegments, centroidOf, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { centeringAnchors, governMass } from '@/lib/effect/grid-magnet-logic'
import type { Contour, Pt } from '@/lib/effect/types'
const blob = (seed: number): Contour => {
  const pts: Pt[] = []
  for (let i = 0; i < 160; i++) {
    const a = (Math.PI * 2 * i) / 160
    const r = 1 + 0.22 * Math.sin((3 + seed) * a) + 0.11 * Math.cos(5 * a + 0.7 * seed) + 0.07 * Math.sin(7 * a + 2)
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
  for (const [x, y] of pts) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y }
  const L = Math.max(mxx - mnx, mxy - mny)
  return { outer: { pts: pts.map(([x, y]) => [(x - mnx) / L, (y - mny) / L] as Pt) }, holes: [] }
}
const centre = (outer: Pt[], mode: number, detail: 'full' | 'light'): Pt => {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
  for (const [x, y] of outer) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y }
  const boxC: Pt = [(mnx + mxx) / 2, (mny + mxy) / 2]
  const r = spotRadiusOf(12)
  const segs = safeSegments(outer, r, Math.max(r, 16), detail)
  const cands = centeringAnchors(mode as 0, segs, boxC, centroidOf(outer))
  if (mode !== 2) return cands[0] ?? boxC
  const masses = segs.flatMap((sg) => (sg.masses.length ? sg.masses : [sg]))
  return governMass(masses, 0, boxC[1])?.centreMM ?? cands[0] ?? boxC
}
describe('anchor', () => { it('light vs full', () => {
  const rows: string[] = []
  for (const s of [0, 1, 2]) {
    const base = blob(s)
    for (const mm of [90, 130, 216]) {
      const outer = base.outer.pts.map(([x, y]) => [x * mm, y * mm] as Pt)
      for (const mode of [0, 1, 2, 3, 4, 5]) {
        const l = centre(outer, mode, 'light'), f = centre(outer, mode, 'full')
        const d = Math.hypot(l[0] - f[0], l[1] - f[1])
        if (d > 0.001) rows.push(`blob${s} ${mm}mm mode${mode}  Δ=${d.toFixed(2)}mm  light=${l.map(n=>n.toFixed(1))} full=${f.map(n=>n.toFixed(1))}`)
      }
    }
  }
  writeFileSync('/tmp/anchor.txt', rows.length ? rows.join('\n') : 'IDENTICAL in every case')
}, 600000) })
