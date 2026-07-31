// KAI-9843 — THE SOLVER: executable acceptance harness.
// Turns grid.test.ts:636's `it.todo` into a measurable RED, and gives the builder
// a finish line it did not author itself.
//
// Run from the onemo-next tree:  npx tsx --tsconfig tsconfig.json <this file>
//
// Three measurements, each mapping to one law:
//   A1  3.1  — every published rung is DERIVED from a lattice population,
//              i.e. its size is reproducible from its own construction's zero-point.
//   A2  9823 — the construction advertised IS the construction delivered.
//   A3  3.2  — no invented sizes: every rung's extent is an exact lattice extent.

import { DEFAULT_LAW, semanticLadder, stdShapeContour, resolveGridPlan } from '@/lib/effect/grid'
import { distanceToPreparedContour, prepareExactContour } from '@/lib/effect/grid-prepared'

type Pt = [number, number]
type Rung = { label: string; sizeMM: number; points: number; gridExtentMM: number; visible?: boolean }

const SHAPES = ['square', 'circle', 'triangle', 'diamondShape'] as const
const INSET = DEFAULT_LAW.paddingMM + DEFAULT_LAW.frameMM // 11 — the zero-point inset (3.5)

const ladder = (shape: string) =>
  semanticLadder((s: number) => stdShapeContour(shape as never, s), DEFAULT_LAW, 'auto' as never) as never as Rung[]

const plan = (shape: string, mm: number) =>
  resolveGridPlan(stdShapeContour(shape as never, mm) as never, {
    mode: 'auto', density: 'light', paddingMM: DEFAULT_LAW.paddingMM, maxGrowMM: 0,
  } as never) as never as { pattern?: string; pitchMM?: number; grid: { anchors: Array<{ p: Pt }> } }

const anchorExtent = (anchors: Array<{ p: Pt }>) => {
  if (!anchors.length) return 0
  const xs = anchors.map((a) => a.p[0]), ys = anchors.map((a) => a.p[1])
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

const seatsOf = (shape: string, mm: number, anchors: Array<{ p: Pt }>) => {
  const prep = prepareExactContour(stdShapeContour(shape as never, mm) as never)
  return anchors.map((a) => distanceToPreparedContour(a.p, prep))
}

let a1 = 0, a2 = 0, a3 = 0, total = 0

console.log('KAI-9843 SOLVER ACCEPTANCE — all three must read 0\n')
console.log('A1 · law 3.1 — the rung size must be reproducible from its own construction')
console.log("     minimality: size-1mm must NOT seat the same population\n")

for (const shape of SHAPES) {
  for (const r of ladder(shape).filter((x) => x.visible !== false)) {
    total++
    const p = plan(shape, r.sizeMM)

    // A1 — 3.1: MINIMALITY. A derived size is the SMALLEST size at which its own
    // population seats. If size-1 still seats the same population, the published size
    // is not the population's wrap — it was found by scanning, and 3.1 is violated.
    // (Shape-agnostic on purpose: the square formula does not describe a circle's wrap,
    //  so testing it would measure the tester's assumption, not the law.)
    // Minimality is judged at the RUNG inset (padding + frame, 3.5's zero-point),
    // NOT at the delivery floor (padding, 2.2). A size one millimetre smaller may
    // still seat legally for delivery while being an invalid rung — those are two
    // different questions and conflating them is what produced 9837.
    const below = plan(shape, r.sizeMM - 1)
    const belowSeats = seatsOf(shape, r.sizeMM - 1, below.grid.anchors)
    const belowIsAValidRung = belowSeats.length > 0 && Math.min(...belowSeats) >= INSET - 1e-6
    const samePopulation =
      belowIsAValidRung &&
      below.grid.anchors.length === p.grid.anchors.length &&
      below.pattern === p.pattern &&
      below.pitchMM === p.pitchMM
    // WITHDRAWN as a pre-condition — see the note below. Population identity is
    // count + pattern + pitch + LATTICE EXTENT, and the rung's own construction is
    // not exposed until 9843 adds it. Measured here through the DELIVERY re-solve,
    // which is the wrong object: two sizes can share a delivered construction while
    // their rung constructions differ. Reported, never counted.
    if (samePopulation && p.grid.anchors.length > 1) {
      const e = anchorExtent(p.grid.anchors)
      console.log(`  A1? ${shape.padEnd(12)} ${r.label.padEnd(4)} ${String(r.sizeMM).padStart(3)}mm  ${r.sizeMM - 1}mm delivers the same ${p.grid.anchors.length}pt ${p.pattern}/${p.pitchMM}, extent ${e} — NOT EVIDENCE until the rung carries its construction`)
    }

    // A2 — 9823: advertised construction == delivered construction
    if (p.grid.anchors.length !== r.points) a2++

    // A3 — 3.2: the grid extent must be an exact lattice extent, (n-1) x pitch
    const pitch = p.pitchMM ?? 48
    const k = r.gridExtentMM - 2 * INSET
    const onLattice = k <= 0 ? true : Math.abs(k % pitch) < 0.5 || Math.abs((k % pitch) - pitch) < 0.5
    if (!onLattice) a3++
  }
}

console.log(`\nA2 · 9823 — advertised count != delivered count : ${a2} of ${total}`)
console.log(`A3 · law 3.2 — rung extent not an exact lattice extent : ${a3} of ${total}`)
console.log(`A1 · law 3.1 — WITHDRAWN as a pre-condition: population identity needs the rung construction, which 9843 itself adds. Becomes a POST-condition. (${a1} counted)`)
console.log(`\nVERDICT: ${a2 === 0 && a3 === 0 ? 'SOLVER ACCEPTANCE MET' : 'RED — solver not delivered'}`)
