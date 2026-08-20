// The real-cutout gate (Dan's directive): the exact construction must work on the contours the
// bench actually supplies, not on synthetic shapes chosen because they are easy. These are the
// traced cutouts — ~570-600 segments each, half a millimetre per edge, full of reflex corners and
// notches narrower than two magnet radii. Every structural defect this engine has had was invisible
// on rectangles and obvious here: severed convex corners, a torn boundary across a swallowed
// element, and comparisons at three-line concurrencies that no enclosure can settle.
//
// The assertion that matters is `unresolved: false` with no refusal reasons. A region set that
// merely looks plausible while the construction refused something is exactly the false completeness
// this whole build exists to prevent.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { normMaskContour } from '../../effect/grid-origin-bridge'
import { scaleContour } from '../../effect/grid-origin-compute'
import { exactContour, toUnits } from '../compute/clearance'
import { exactRegions } from '../compute/region'
import { ratToNumber } from '../compute/exact-real'

async function supplied(name: string) {
  const image = sharp(await readFile(join(process.cwd(), 'public/grid-engine/cutouts', name))).ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(info.width * info.height)
  for (let index = 0; index < mask.length; index++) if (data[index * info.channels + 3] > 128) mask[index] = 1
  const contour = normMaskContour(mask, info.width, info.height)
  if (!contour) throw new Error(`${name} produced no contour`)
  return contour
}

const CUTOUTS = [
  { file: 'DUCK.png', islands: 2, areas: [349.72, 332.21] },
  { file: 'BOT.png', islands: 1, areas: [1360.84] },
  { file: 'BAT-WOMAN.png', islands: 1, areas: [840.43] },
] as const

describe('real supplied cutouts resolve exactly', () => {
  for (const cutout of CUTOUTS) {
    it(`${cutout.file}: every legal island certified, nothing refused`, async () => {
      const contour = scaleContour(await supplied(cutout.file), 96)
      const c = exactContour(contour)
      expect(c.segments.length, 'a real traced outline, not a simplified stand-in').toBeGreaterThan(500)

      const { regions, unresolved, reasons } = exactRegions(c, toUnits(12, c))
      expect(reasons, `${cutout.file} refusals`).toEqual([])
      expect(unresolved, `${cutout.file} unresolved`).toBe(false)
      expect(regions).toHaveLength(cutout.islands)

      const measured = regions.map((r) => r.areaApproxMM2).sort((a, b) => b - a)
      const expected = [...cutout.areas].sort((a, b) => b - a)
      for (let index = 0; index < expected.length; index++) {
        // areas are report decimals of certified enclosures; pin them tightly enough that any
        // change in the construction has to be looked at rather than absorbed
        expect(measured[index], `${cutout.file} island ${index}`).toBeCloseTo(expected[index], 1)
      }
      for (const region of regions) {
        // every certificate is a genuine enclosure — narrower than a micron — around a positive
        // area. Whether a 24mm disc actually seats in each island is a SEAT question, and it is
        // asserted where that predicate lives, not implied from area here.
        expect(ratToNumber(region.areaMM2.hi) - ratToNumber(region.areaMM2.lo)).toBeLessThan(1e-6)
        expect(region.areaApproxMM2).toBeGreaterThan(0)
      }
    }, 900_000)
  }
})
