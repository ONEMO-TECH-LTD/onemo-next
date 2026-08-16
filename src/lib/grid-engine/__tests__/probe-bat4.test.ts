import { it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'
import { RELEASED, RELEASED_CALIBRATION } from '../spec'
import { engineOutline } from '../ui/trace-cutout'
it('bat under dual registration', { timeout: 900000 }, () => {
  const SHAPES = JSON.parse(readFileSync(join(__dirname, '__fixtures-canon-shapes.json'), 'utf8'))
  const { outline, box } = SHAPES.bat
  const simplified = engineOutline(outline)
  const contour: Contour = { outer: { pts: simplified.map(([u, v]: number[]) => [u * box.w, v * box.h] as Pt) }, holes: [] }
  const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)!
  for (const b of judged.bands) {
    process.stderr.write(`B${b.band.band}: ` + (b.variants.length ? b.variants.map((v) => `${v.layout ?? 'auto'}·${v.sizeMM}·${v.anchors.length}pt L${v.wrap.left.toFixed(0)} R${v.wrap.right.toFixed(0)} T${v.wrap.top.toFixed(0)} B${v.wrap.bottom.toFixed(0)}`).join(' ; ') : 'NONE') + '\n')
  }
})
