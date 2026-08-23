// v3.5.4 — the biting fixtures for Dan's acceptance authority. Written against the CURRENT engine
// so they FAIL before the cut-over and pass after:
//   "if Dan can produce a lawful layout manually using the same controls, the automatic engine
//    must find and show it. It must never report 'no fit' while such a layout exists inside the
//    configured search."

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import { getShape } from '../../shape-library'
import { makeSizer, normBaseContour, normMaskContour } from '../../effect/magnetic-grid-bridge'
import { computeGrid, solveBands } from '../engine'
import { SOLVER_DEFAULTS, type Contour } from '../spec'
import { configWith } from './config'

/** The real cutout Dan placed by hand: cutout (4), B2, Core, pitch 48, padding 12. */
let cutout4: Contour | null = null
beforeAll(async () => {
  const file = join(process.cwd(), '_WIP/v3.5/cutouts/cutout (4).png')
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(info.width * info.height)
  for (let i = 0; i < mask.length; i++) if (data[i * info.channels + (info.channels - 1)] > 128) mask[i] = 1
  cutout4 = normMaskContour(mask, info.width, info.height, SOLVER_DEFAULTS.contourMaxVertices)
})

// The cap is Dan's dial, so the acceptance fixtures run with it OFF: what must never happen is the
// engine reporting "no fit" while a Centre+Fit-lawful layout exists inside the configured search.
const coreB2 = () => configWith({ centreMode: 1, pitchMM: 48, paddingMM: 12, coverage: 'perimeter', flapEnabled: false })

describe('v3.5.4 — the engine finds what Dan finds by hand', () => {
  it('A1: cutout (4) B2 publishes at least one lawful pair — the layout Dan reached manually at 96 mm', () => {
    expect(cutout4).not.toBeNull()
    const cfg = coreB2()
    const solved = solveBands(makeSizer(cutout4!, cfg), cfg)
    const b2 = solved.bands.find((band) => band.band === 2)!
    const counts = b2.rungs.map((rung) => rung.magnetCount)
    expect(counts.length, 'B2 returns at least one lawful layout').toBeGreaterThan(0)
    expect(Math.min(...counts), 'the lowest published count is the pair floor or better').toBeLessThanOrEqual(2)
    expect(b2.refusal, 'B2 must not report "no fit" while a lawful layout exists').toBeNull()
  })

  it('A7: raising the flap cap can only ADD layouts — the cap never hides a fit it admits', () => {
    expect(cutout4).not.toBeNull()
    const countAt = (flapLimitMM: number) => {
      const cfg = configWith({ centreMode: 1, pitchMM: 48, paddingMM: 12, coverage: 'perimeter', flapEnabled: true, flapLimitMM })
      const solved = solveBands(makeSizer(cutout4!, cfg), cfg)
      return solved.bands.flatMap((band) => band.rungs).length
    }
    const tight = countAt(12), wide = countAt(48)
    expect(wide, 'a wider cap admits at least what the tighter one did').toBeGreaterThanOrEqual(tight)
  })

  it('A2: Free mode at a size reports exactly the layouts the band inspection found there', () => {
    expect(cutout4).not.toBeNull()
    const cfg = coreB2()
    const sized = makeSizer(cutout4!, cfg)
    const solved = solveBands(sized, cfg)
    const b2 = solved.bands.find((band) => band.band === 2)!
    expect(b2.rungs.length).toBeGreaterThan(0)
    const rung = b2.rungs[0]
    const free = computeGrid(sized(rung.sizeMM), rung.sizeMM, cfg)
    const bandCounts = b2.rungs.filter((r) => r.sizeMM === rung.sizeMM).map((r) => r.magnetCount).sort((a, b) => a - b)
    const freeCounts = [...new Set(free.layouts.map((layout) => layout.magnetCount))].sort((a, b) => a - b)
    expect(freeCounts, 'Free mode sees the same lawful counts at that size').toEqual(expect.arrayContaining(bandCounts))
  })

  it('A3: a group that leaves a whole spot of unsupported edge refuses until the scale tightens it', () => {
    const base = normBaseContour(getShape('squircle', 1024, 1024), 1024, SOLVER_DEFAULTS.contourFlattenRefMM)!
    const cfg = configWith({ centreMode: 0, pitchMM: 48, paddingMM: 12, coverage: 'perimeter', flapLimitMM: 12 })
    const sized = makeSizer(base, cfg)
    const solved = solveBands(sized, cfg)
    for (const band of solved.bands) {
      for (const rung of band.rungs) {
        for (const layout of rung.layouts) {
          const worst = Math.max(...layout.overhangsMM)
          expect(worst, `published layout at ${rung.sizeMM}mm exceeds the configured flap limit`).toBeLessThanOrEqual(cfg.flapLimitMM)
        }
      }
    }
  })

  it('A4: every published layout keeps every disc inside the material — no disc crosses the contour', () => {
    const base = normBaseContour(getShape('heart', 1024, 1024), 1024, SOLVER_DEFAULTS.contourFlattenRefMM)!
    const cfg = configWith({ centreMode: 2, pitchMM: 48, paddingMM: 12, coverage: 'perimeter', flapLimitMM: 24 })
    const solved = solveBands(makeSizer(base, cfg), cfg)
    const published = solved.bands.flatMap((band) => band.rungs.flatMap((rung) => rung.layouts))
    expect(published.length).toBeGreaterThan(0)
    for (const layout of published) expect(layout.contained, 'the layout region lies in material').toBe(true)
  })

  it('A5: counts ascend inside a band, bands are independent, and same-count layouts are not collapsed', () => {
    const base = normBaseContour(getShape('square', 1024, 1024), 1024, SOLVER_DEFAULTS.contourFlattenRefMM)!
    const cfg = configWith({ centreMode: 0, pitchMM: 48, paddingMM: 12, coverage: 'perimeter', flapLimitMM: 0 })
    const solved = solveBands(makeSizer(base, cfg), cfg)
    for (const band of solved.bands) {
      const counts = band.rungs.map((rung) => rung.magnetCount)
      expect([...counts].sort((a, b) => a - b), `band ${band.band} counts ascend`).toEqual(counts)
    }
    // a count published in one band may appear again in another — bands are independent ladders
    const perBand = solved.bands.map((band) => new Set(band.rungs.map((rung) => rung.magnetCount)))
    const repeated = perBand.some((set, i) => perBand.some((other, j) => i !== j && [...set].some((count) => other.has(count))))
    expect(repeated, 'no cross-band suppression').toBe(true)
  })

  it('A6: one layout per rung is marked as the recommendation and the others stay visible', () => {
    const base = normBaseContour(getShape('squircle', 1024, 1024), 1024, SOLVER_DEFAULTS.contourFlattenRefMM)!
    const cfg = configWith({ centreMode: 0, pitchMM: 48, paddingMM: 12, coverage: 'perimeter', flapLimitMM: 24 })
    const solved = solveBands(makeSizer(base, cfg), cfg)
    const rungs = solved.bands.flatMap((band) => band.rungs)
    expect(rungs.length).toBeGreaterThan(0)
    for (const rung of rungs) {
      expect(rung.layouts.length, 'every rung keeps its lawful layouts').toBeGreaterThan(0)
      expect(rung.recommendedLayoutIndex, 'exactly one marked recommendation').toBeGreaterThanOrEqual(0)
      expect(rung.recommendedLayoutIndex).toBeLessThan(rung.layouts.length)
    }
  })
})
