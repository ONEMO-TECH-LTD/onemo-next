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
import type { Pt } from '../types'

const key = (p: readonly number[]) => Math.round(p[0]) + ',' + Math.round(p[1])

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
  return new Set(grid.anchors.map((a) => key(a.p)))
}

/** The records this oracle does not yet reproduce, pinned by EXACT ID in a checked-in fixture.
 *  A predicate would have hidden work: "every transformed triangle view" covers 96 records but
 *  only 68 actually disagree, so 28 passing cases would have stopped being checked. The set is
 *  asserted equal, not merely contained — closing one of these fails the test and asks for the
 *  fixture to shrink, so the gap can only ever be paid down, never grown.
 *
 *  Their disks and outlines are correct: the library's own caller-equality gate reproduces every
 *  record independently at 24/48/96. What disagrees is where the ENGINE lays its lattice for a
 *  transformed view. Open engine finding, not a library defect. */
const OPEN: readonly string[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/solver-oracle-open.v1.json'), 'utf8')) as string[]
const isOpen = (entry: CatalogueEntry) => OPEN.includes(entry.id)

describe('the certified catalogue is the oracle the generator answers to', () => {
  it('the engine accepts every certified disk, at every supported pitch', () => {
    const rejected: string[] = []
    let checked = 0
    for (const pitchMM of [24, 48, 96]) for (const entry of catalogue(pitchMM)) {
      if (isOpen(entry)) continue
      checked++
      const seated = seatedAt(entry, pitchMM)
      const missing = [...new Set(entry.nodesMM.map(key))].filter((k) => !seated.has(k))
      if (missing.length) rejected.push(`@${pitchMM} ${decodeURIComponent(entry.id)} missing ${missing.join(' ')}`)
    }
    expect(checked).toBeGreaterThan(200)
    expect(rejected).toEqual([])
  }, 120_000)

  it('the open set is exactly what still disagrees — no more, and no fewer', () => {
    const failing: string[] = []
    for (const pitchMM of [24, 48, 96]) for (const entry of catalogue(pitchMM)) {
      const seated = seatedAt(entry, pitchMM)
      if (![...new Set(entry.nodesMM.map(key))].every((k) => seated.has(k))) failing.push(entry.id)
    }
    expect([...new Set(failing)].sort()).toEqual([...OPEN].sort())
    // every open id is a real record, and every one is a transformed view — the shape of the gap
    for (const id of OPEN) {
      expect(catalogue(48).some((e) => e.id === id), id).toBe(true)
      expect(id.endsWith('/n/n/n'), id).toBe(false)
    }
  }, 120_000)

  it('the oracle can fail: a certified disk moved off the lattice is rejected', () => {
    const entry = catalogue(48).find((e) => e.id === 'square/box/3x3/full/n/n/n')!
    const moved = { ...entry, nodesMM: [[entry.nodesMM[0][0] + 7, entry.nodesMM[0][1]], ...entry.nodesMM.slice(1)] } as CatalogueEntry
    const seated = seatedAt(moved, 48)
    expect([...new Set(moved.nodesMM.map(key))].every((k) => seated.has(k))).toBe(false)
  })
})
