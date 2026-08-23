import { readFileSync } from 'node:fs'
import { Clipper, EndType, FillRule, JoinType } from '@countertype/clipper2-ts'
import { engineOutline, type OutlineUV } from '../src/lib/grid-engine/ui/trace-cutout'
import { normalizeContour } from '../src/lib/grid-engine/compute/normalize'
import { scaleContour } from '../src/lib/grid-engine/compute/grid-core'
import type { Contour, Pt } from '../src/lib/grid-engine/compute/types'

type CanonFixture = { outline: OutlineUV; box: { w: number; h: number } }
const fixtures = JSON.parse(
  readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json', 'utf8'),
) as Record<string, CanonFixture>
const scale = 1000
const arcErrorMM = 0.005

for (const [name, sizeMM] of [['bat', 98], ['pill', 84]] as const) {
  const fixture = fixtures[name]
  const source: Contour = { outer: { pts: engineOutline(fixture.outline).map(([u, v]) => [u * fixture.box.w, v * fixture.box.h] as Pt) }, holes: [] }
  const unit = normalizeContour(source)
  if (!unit) throw new Error(`${name} normalization failed`)
  const points = scaleContour(unit, sizeMM).outer.pts
  const flat = points.flatMap(([x, y]) => [Math.round(x * scale), Math.round(y * scale)])
  const path = Clipper.makePath(flat)
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const bbox = Clipper.makePath([
    Math.round(Math.min(...xs) * scale), Math.round(Math.min(...ys) * scale),
    Math.round(Math.max(...xs) * scale), Math.round(Math.min(...ys) * scale),
    Math.round(Math.max(...xs) * scale), Math.round(Math.max(...ys) * scale),
    Math.round(Math.min(...xs) * scale), Math.round(Math.max(...ys) * scale),
  ])
  console.log(`\n${name}`)
  for (const guard of [0.025, 0.01, 0.006, 0.0058, 0.00571, 0.005, 0.001, 0]) {
    const domain = Clipper.inflatePaths([bbox], -guard * scale, JoinType.Round, EndType.Polygon, 2, arcErrorMM * scale)
    const safe = Clipper.inflatePaths([path], -(24 + guard) * scale, JoinType.Round, EndType.Polygon, 2, arcErrorMM * scale)
    const feasible = domain.length && safe.length ? Clipper.intersect(domain, safe, FillRule.NonZero) : []
    console.log(JSON.stringify({ guard, safe: safe.length, feasible: feasible.length, vertices: feasible.reduce((n, p) => n + p.length, 0), area: feasible.reduce((n, p) => n + Math.abs(Clipper.area(p)), 0) / scale / scale }))
  }
}
