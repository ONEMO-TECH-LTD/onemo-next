import { it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'
import { RELEASED, RELEASED_CALIBRATION } from '../spec'
import { engineOutline } from '../ui/trace-cutout'

it('winners under side-hold law', { timeout: 3600000 }, () => {
  const SHAPES = JSON.parse(readFileSync(join(__dirname, '__fixtures-canon-shapes.json'), 'utf8'))
  for (const name of Object.keys(SHAPES)) {
    const { outline, box } = SHAPES[name]
    const simplified = engineOutline(outline)
    const contour: Contour = { outer: { pts: simplified.map(([u, v]: number[]) => [u * box.w, v * box.h] as Pt) }, holes: [] }
    const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)!
    const rows = judged.bands.map((b) => {
      const v = b.variants[0]
      return v
        ? `B${b.band.band}=${v.layout ?? 'auto'}·${v.sizeMM}·${v.anchors.length}pt L${v.wrap.left.toFixed(0)} R${v.wrap.right.toFixed(0)} T${v.wrap.top.toFixed(0)}/h${(v.topHangMM ?? 0).toFixed(0)} B${v.wrap.bottom.toFixed(0)}`
        : `B${b.band.band}=NONE`
    })
    process.stderr.write(`${name}: ${rows.join(' | ')}\n`)
  }
})
