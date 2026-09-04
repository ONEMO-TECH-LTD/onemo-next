// catalogue-solver-oracle.test.ts — THE CERTIFIED SET CHECKS THE GENERATOR.
//
// Dan, 2026-08-28: "we can make classifier automatic for any shape - beyond L and H there could
// be others we do not know about and basic shapes must automatically adapt to them." Enumeration
// cannot answer for shapes nobody listed; the solver already places magnets into any real
// outline. That makes the catalogue's job the ORACLE — the cases where the right answer is known
// exactly — not a lookup table. A generator with nothing to check against is guesswork.
//
// The invariant: hand the solver a certified outline at the registration that outline was built
// from, and every disk the library certifies must be accepted. The solver may seat MORE (a
// `corners` entry is a deliberately sparse choice, not the maximum that fits); it may never
// reject one the library says is there.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { catalogue, type CatalogueEntry } from '../library/catalogue'
import { computeGrid } from '../grid-magnet'
import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import type { Pt } from '../types'

/** Agreement is judged at the MANUFACTURING tolerance, not the nearest millimetre. Rounding to
 *  whole mm let a solver anchor sit 0.4mm off and still read as a match — the same class of
 *  error as hand-rounding a diamond corner from 16.971 to 17, which is exactly what this oracle
 *  exists to catch. */
const agrees = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) <= MANUFACTURING_TOLERANCE_MM
const missingFrom = (
  seated: readonly Pt[], certified: readonly (readonly [number, number])[],
): string[] => certified
  .filter((want) => !seated.some((got) => agrees(got, want)))
  .map(([x, y]) => x.toFixed(3) + ',' + y.toFixed(3))

/** One case is one record AT one pitch. Keying the open set by bare id made a record that fails
 *  at 24 only indistinguishable from one failing at all three, so closing two pitches changed
 *  nothing. */
const caseId = (id: string, pitchMM: number) => id + '@' + pitchMM

/** The lattice is laid over the outline's bounding box, so the registration that reproduces a
 *  certified layout is that layout's own offset from the box corner — exactly, never rounded:
 *  a diamond's corner sits at 12*sqrt2 = 16.971mm, and rounding it to 17 moves two disks out. */
const seatedAt = (entry: CatalogueEntry, pitchMM: number, paddingMM = RELEASED_PADDING_MM) => {
  const pts = entry.outlineMM.map(([x, y]) => [x, y] as Pt)
  const minX = Math.min(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1]))
  const phase = (v: number) => ((v % pitchMM) + pitchMM) % pitchMM
  const grid = computeGrid({ outer: { pts }, holes: [] }, {
    pitchMM, paddingMM, perimeterOnly: false,
    forcePhaseMM: [phase(entry.nodesMM[0][0] - minX), phase(entry.nodesMM[0][1] - minY)] as Pt,
  })
  return grid.anchors.map((a) => a.p)
}

/** The records this oracle does not yet reproduce, pinned by EXACT ID in a checked-in fixture.
 *  A predicate would have hidden work: "every transformed triangle view" covers 96 records but
 *  only 68 actually disagree, so 28 passing cases would have stopped being checked. The set is
 *  asserted equal, not merely contained — closing one of these fails the test and asks for the
 *  fixture to shrink, so the gap can only ever be paid down, never grown.
 *
 *  Their disks and outlines are correct: the library's own caller-equality gate reproduces every
 *  record independently at 24/48/96. Two open ENGINE findings, neither a library defect:
 *
 *  1. Transformed views — where the engine lays its lattice for a y-flipped view.
 *  2. One-wide pills (2026-09-04) — the end magnets of a slim pill. The engine's own measurement
 *     calls them legal: `pointInPreparedContour` is true and `distanceToPreparedContour` is exactly
 *     12.000000000mm, the released rim. The solver seats them anyway only once the padding is asked
 *     for at 11.9 rather than 12, so the loss is in how a curved cap is planned, not in clearance —
 *     the same population inside a sharp rectangle of identical size seats 3 of 3. */
const OPEN: readonly string[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/solver-oracle-open.v1.json'), 'utf8')) as string[]
const isOpen = (entry: CatalogueEntry, pitchMM: number) => OPEN.includes(caseId(entry.id, pitchMM))

describe('the certified catalogue is the oracle the generator answers to', () => {
  // TARGET INVARIANT: the engine accepts every certified disk at every supported pitch.
  // CURRENT CONFORMANCE: everywhere except the exact open pitch-cases below. The two are stated
  // separately on purpose — a title that claims the target while the body skips 68 records is
  // the overclaim this whole oracle exists to stop.
  it('the engine accepts every certified disk outside the exact open pitch-cases', () => {
    const rejected: string[] = []
    for (const pitchMM of [24, 48, 96]) for (const entry of catalogue(pitchMM)) {
      if (isOpen(entry, pitchMM)) continue
      const missing = missingFrom(seatedAt(entry, pitchMM), entry.nodesMM)
      if (missing.length) rejected.push(`@${pitchMM} ${decodeURIComponent(entry.id)} missing ${missing.join(' ')}`)
    }
    // coverage needs no separate count: the next test asserts the open set EXACTLY, so every
    // record at every pitch is either checked here or named there
    expect(rejected).toEqual([])
  }, 120_000)

  it('the open set is exactly what still disagrees — no more, and no fewer', () => {
    const failing: string[] = []
    for (const pitchMM of [24, 48, 96]) for (const entry of catalogue(pitchMM))
      if (missingFrom(seatedAt(entry, pitchMM), entry.nodesMM).length)
        failing.push(caseId(entry.id, pitchMM))
    expect(failing.sort()).toEqual([...OPEN].sort())
    // every open case is a real record at a supported pitch, and belongs to one of the two named
    // findings — a y-flipped view, or a one-wide pill. Anything else has to be argued for, not added
    for (const open of OPEN) {
      const at = open.lastIndexOf('@')
      const id = open.slice(0, at), pitchMM = Number(open.slice(at + 1))
      expect([24, 48, 96]).toContain(pitchMM)
      expect(catalogue(pitchMM).some((e) => e.id === id), open).toBe(true)
      expect(id.endsWith('y') || /^pill\/slim\//.test(id), open).toBe(true)
    }
  }, 120_000)

  it('the oracle can fail: a certified disk moved off the lattice is rejected', () => {
    const entry = catalogue(48).find((e) => e.id === 'square/box/3x3/full/n/n/n')!
    const moved = { ...entry, nodesMM: [[entry.nodesMM[0][0] + 7, entry.nodesMM[0][1]], ...entry.nodesMM.slice(1)] } as CatalogueEntry
    expect(missingFrom(seatedAt(moved, 48), moved.nodesMM)).not.toEqual([])
    // and a sub-millimetre drift is caught too — whole-mm rounding hid 0.4mm
    const drifted = { ...entry, nodesMM: [[entry.nodesMM[0][0] + 0.4, entry.nodesMM[0][1]], ...entry.nodesMM.slice(1)] } as CatalogueEntry
    expect(missingFrom(seatedAt(entry, 48), drifted.nodesMM)).not.toEqual([])
    // tolerance is a DISTANCE, not a per-axis budget: 0.049 on each axis is 0.0693mm away,
    // outside tolerance, and a per-axis comparator let it pass. grid-core.ts:499 is the
    // repo's precedent — it measures the same way.
    const diagonal = { ...entry, nodesMM: [[entry.nodesMM[0][0] + 0.049, entry.nodesMM[0][1] + 0.049], ...entry.nodesMM.slice(1)] } as CatalogueEntry
    expect(missingFrom(seatedAt(entry, 48), diagonal.nodesMM)).not.toEqual([])
  })
})
