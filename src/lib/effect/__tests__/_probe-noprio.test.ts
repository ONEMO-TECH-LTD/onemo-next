import { it } from 'vitest'
import { getShape } from '@/lib/shape-library'
import { vecFromGenerator } from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'
import { normBaseContour, makeSizer } from '../grid-magnet-bridge'
import { BANDS, bandOuterMM, classifyBands, MIN_EFFECT_MM } from '../grid-magnet'
import { bbox } from '../grid-magnet-compute'
import { canonLayoutForFrame } from '../grid-magnet-library-catalogue'
import { canonPriorityOf, positionsAcross } from '../units/classifier'
import { solveCanonExperiment } from '../grid-magnet-canon-experiment'
import type { GridConfig, Pt } from '../types'

const run = (name: string, base: ReturnType<typeof normBaseContour>, circle: boolean, bandIds: number[]) => {
  const sized = makeSizer(base!, 0)
  const cfg: GridConfig = { pitchMM: 48, paddingMM: 12, perimeterOnly: false, centreMode: 0, governor: 0, circle }
  const anchorAt = (mm: number): Pt => { const bb = bbox(sized(mm).outer.pts); return [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2] }
  for (const id of bandIds) {
    const band = BANDS.find((b) => b.id === id)!
    const span = bandOuterMM(band, 12)
    const row = classifyBands(sized, cfg, anchorAt, [band]).find((r) => r.bandId === id)
    if (!row) continue
    const canon = canonLayoutForFrame(48, positionsAcross(row.rulerWidthMM, 48), positionsAcross(row.rulerHeightMM, 48))
    const nodes = canon ? canon.nodesMM.map(([x, y]) => [x, y] as Pt) : []
    const xs = nodes.map((p) => p[0]), ys = nodes.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const prio = canonPriorityOf(nodes.map(([x, y]) => [x - cx, y - cy] as Pt), 48) ?? undefined
    const withP = solveCanonExperiment(sized, cfg, span.minMM, span.maxMM, MIN_EFFECT_MM, anchorAt, nodes, prio)
    const noP = solveCanonExperiment(sized, cfg, span.minMM, span.maxMM, MIN_EFFECT_MM, anchorAt, nodes)
    const pick = (s: typeof withP) => s.offers.filter((o) => o.roles.includes('optimal'))
      .map((o) => `${o.at.sizeMM.toFixed(2)}/${o.at.count}`).join(' ')
    console.log(`${name} B${id}  with priority: ${pick(withP)}   |   count only: ${pick(noP)}`)
  }
}

it('priority versus count', () => {
  run('circle', normBaseContour(getShape('circle', 600, 600), 600), true, [4, 5])
  run('blob  ', normBaseContour(vecFromGenerator('blob', { waviness: 55, seed: 7 }, { widthPx: 600, heightPx: 600 }), 600), false, [4, 5])
}, 300000)
