// THE CANON GATE — Dan's seven cutouts as executable fixtures (Frankenstein Phase 0).
//
// The record shows canon silently broke at least four times in two days without this file: a
// ranking tweak moved a winner and nobody's test noticed. Each shape's traced outline goes
// through the bench's own door (engineOutline → mm scaling → solveCutout) and every band's
// WINNER must stay in its ruled family: the count and the arrangement, with the size inside the
// band. Sizes are not pinned to the millimetre — they lawfully wobble with calibration — the
// FAMILY is the canon. Expected families = Dan's ruled canon (selection-examples/) as reproduced
// and verified frame-by-frame on the bench at commit 541a6f40.
//
// A failure here BLOCKS the merge. Nobody self-clears this gate (collaboration rule 4).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'
import { RELEASED, RELEASED_CALIBRATION } from '../spec'
import { engineOutline } from '../ui/trace-cutout'

const SHAPES: Record<string, { outline: [number, number][]; box: { w: number; h: number } }> =
  JSON.parse(readFileSync(join(__dirname, '__fixtures-canon-shapes.json'), 'utf8'))

/** Per band: the ruled magnet count, the allowed arrangement families ('auto' = the engine's
 *  own population where the canon accepts it), and — where a null is accepted — the GEOMETRY
 *  the auto must still satisfy (Meta Phase-0 gate finding: a wrong arrangement with a right
 *  count must not hide behind the auto). */
type Geometry = 'vertical' | 'horizontal' | 'diagonal' | undefined
const CANON: Record<
  string,
  Record<number, { count: number; layouts: (string | null)[]; geometry?: Geometry }>
> = {
  bat: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-v'] },
    3: { count: 3, layouts: ['tri-96-up'] },
    // Dan 2026-08-15 22:52: band 4 steps UP to the tight full grid ("at least 4 points is
    // easy") — the mass-aware gravity law unlocked the full population; sparse pair is out.
    4: { count: 5, layouts: [null] },
  },
  duck: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-v'] },
    3: { count: 4, layouts: ['rect-48x96'] },
    4: { count: 5, layouts: [null] },
  },
  butterfly: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-h'] },
    3: { count: 4, layouts: ['square-48'] },
    4: { count: 4, layouts: ['square-96'] },
  },
  bot: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-v'] },
    3: { count: 4, layouts: ['rect-48x96'] },
    4: { count: 2, layouts: ['pair-v-96'] },
  },
  pill: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-antidiag', 'pair-diag', null], geometry: 'diagonal' },
    3: { count: 2, layouts: ['pair-antidiag', 'pair-diag', null], geometry: 'diagonal' },
    4: { count: 3, layouts: ['run-antidiag-3', 'run-diag-3', null], geometry: 'diagonal' },
  },
  poke1: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-v', null], geometry: 'vertical' },
    3: { count: 4, layouts: ['square-48'] },
    4: { count: 4, layouts: ['rect-48x96', 'square-96', null] },
  },
  poke2: {
    1: { count: 1, layouts: ['single', null] },
    2: { count: 2, layouts: ['pair-v', null], geometry: 'vertical' },
    3: { count: 2, layouts: ['pair-v-96'] },
    4: { count: 3, layouts: [null, 'tri-96-down', 'rect-48x96', 'square-96'] },
  },
}

function contourFor(name: string): Contour {
  const { outline, box } = SHAPES[name]
  const simplified = engineOutline(outline as [number, number][])
  return {
    outer: { pts: simplified.map(([u, v]) => [u * box.w, v * box.h] as Pt) },
    holes: [],
  }
}

describe('the canon gate — every band winner stays in its ruled family', () => {
  for (const name of Object.keys(CANON)) {
    it(`${name}`, { timeout: 600000 }, () => {
      const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contourFor(name))
      expect(judged, `${name}: solve returned null`).not.toBeNull()
      for (const answer of judged!.bands) {
        const rule = CANON[name][answer.band.band]
        if (!rule) continue
        const best = answer.variants[0]
        expect(best, `${name} B${answer.band.band}: no answer`).toBeDefined()
        expect(
          best.anchors.length,
          `${name} B${answer.band.band}: count ${best.anchors.length}, canon ${rule.count} (layout ${best.layout ?? 'auto'}·${best.sizeMM})`,
        ).toBe(rule.count)
        expect(
          rule.layouts,
          `${name} B${answer.band.band}: layout ${best.layout ?? 'auto'}·${best.sizeMM} outside the canon family`,
        ).toContain(best.layout ?? null)
        expect(best.sizeMM).toBeGreaterThanOrEqual(answer.band.minSizeMM)
        expect(best.sizeMM).toBeLessThan(answer.band.maxSizeMM)
        if (rule.geometry && best.anchors.length >= 2) {
          for (let i = 0; i < best.anchors.length; i++)
            for (let j = i + 1; j < best.anchors.length; j++) {
              const dx = Math.abs(best.anchors[i].p[0] - best.anchors[j].p[0])
              const dy = Math.abs(best.anchors[i].p[1] - best.anchors[j].p[1])
              const label = `${name} B${answer.band.band}: geometry ${rule.geometry} violated (dx ${dx.toFixed(1)}, dy ${dy.toFixed(1)})`
              if (rule.geometry === 'vertical') expect(dx, label).toBeLessThan(1)
              if (rule.geometry === 'horizontal') expect(dy, label).toBeLessThan(1)
              if (rule.geometry === 'diagonal') expect(Math.abs(dx - dy), label).toBeLessThan(1)
            }
        }
      }
    })
  }
})
