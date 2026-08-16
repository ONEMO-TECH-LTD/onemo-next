import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'
import { RELEASED, RELEASED_CALIBRATION } from '../spec'
import { engineOutline } from '../ui/trace-cutout'
it('keeps the ruled bat bands 1–3 and adds a genuinely stepped, bottom-heavy band 4', { timeout: 900000 }, () => {
  const SHAPES = JSON.parse(readFileSync(join(__dirname, '__fixtures-canon-shapes.json'), 'utf8'))
  const { outline, box } = SHAPES.bat
  const simplified = engineOutline(outline)
  const contour: Contour = { outer: { pts: simplified.map(([u, v]: number[]) => [u * box.w, v * box.h] as Pt) }, holes: [] }
  const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)!
  const variants = (band: number) => judged.bands.find((b) => b.band.band === band)!.variants

  expect(variants(1)[0]).toMatchObject({ layout: 'single', sizeMM: 60 })
  expect(variants(2)[0]).toMatchObject({ layout: 'pair-v', sizeMM: 88 })
  expect(variants(3)[0]).toMatchObject({ layout: 'tee-96', sizeMM: 146 })

  const stepped = variants(4).find((v) => v.layout === 'trapezoid-144x96')
  expect(stepped, 'band 4 must include the wider bottom-heavy six-magnet step').toBeDefined()
  expect(stepped!.sizeMM).toBeGreaterThanOrEqual(200)
  expect(stepped!.sizeMM).toBeLessThan(216)
  expect(stepped!.anchors).toHaveLength(6)
  const xs = stepped!.anchors.map((a) => a.p[0])
  expect(Math.max(...xs) - Math.min(...xs)).toBe(144)
  expect(stepped!.topHangMM).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapMaxMM)
  expect(stepped!.wrap.bottom).toBeLessThanOrEqual(RELEASED_CALIBRATION.flapLimbMM)
})
