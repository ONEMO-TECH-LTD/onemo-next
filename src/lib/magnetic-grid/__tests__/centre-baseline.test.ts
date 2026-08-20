import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  bbox as donorBbox,
  latticeAt as donorLatticeAt,
  makeCircleSeatPredicate,
  makeSeatPredicate,
  pressExcessMM,
  scaleContour as donorScaleContour,
} from '../../effect/grid-origin-compute'
import { normMaskContour } from '../../effect/grid-origin-bridge'
import { applyCoverage, bandOf } from '../../effect/grid-origin-logic'
import { computeGrid } from '../../effect/grid-origin'
import type { Contour, Pt } from '../../effect/types'
import { centreMeasurements, parityPhases } from '../compute'
import { evaluateCentreBaseline } from '../engine'
import { evaluateCentrePolicy } from '../logic'
import type { CentrePolicy, ParityCandidateMeasurement, RegionMeasurement } from '../spec'
import { callableBodiesAreByteEqual } from '../../effect/__tests__/grid-origin-function-text'

const POLICIES: ReadonlyArray<{ policy: CentrePolicy; centreMode: number; governor: number }> = [
  { policy: { mode: 'box' }, centreMode: 0, governor: 0 },
  { policy: { mode: 'core' }, centreMode: 1, governor: 0 },
  { policy: { mode: 'weight' }, centreMode: 3, governor: 0 },
  { policy: { mode: 'deep' }, centreMode: 4, governor: 0 },
  { policy: { mode: 'top' }, centreMode: 5, governor: 0 },
  { policy: { mode: 'masses', governor: 'smallest' }, centreMode: 2, governor: 0 },
  { policy: { mode: 'masses', governor: 'deepest' }, centreMode: 2, governor: 1 },
  { policy: { mode: 'masses', governor: 'top' }, centreMode: 2, governor: 2 },
  { policy: { mode: 'masses', governor: 'top-small' }, centreMode: 2, governor: 3 },
]

const rectangle = (width: number, height: number): Contour => ({
  outer: { pts: [[0, 0], [width, 0], [width, height], [0, height]] },
  holes: [],
})

const circle = (vertices = 192): Contour => ({
  outer: { pts: Array.from({ length: vertices }, (_, index) => {
    const angle = index / vertices * Math.PI * 2
    return [0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5] as Pt
  }) },
  holes: [],
})

const pill = (verticesPerCap = 96): Contour => ({
  outer: { pts: [
    ...Array.from({ length: verticesPerCap }, (_, index) => {
      const angle = Math.PI / 2 + index / (verticesPerCap - 1) * Math.PI
      return [0.25 + Math.cos(angle) * 0.25, 0.25 + Math.sin(angle) * 0.25] as Pt
    }),
    ...Array.from({ length: verticesPerCap }, (_, index) => {
      const angle = -Math.PI / 2 + index / (verticesPerCap - 1) * Math.PI
      return [0.75 + Math.cos(angle) * 0.25, 0.25 + Math.sin(angle) * 0.25] as Pt
    }),
  ] },
  holes: [],
})

async function cutout(name: string): Promise<Contour> {
  const image = sharp(await readFile(join(process.cwd(), 'public/grid-engine/cutouts', name))).ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(info.width * info.height)
  for (let index = 0; index < mask.length; index++) if (data[index * info.channels + 3] > 128) mask[index] = 1
  const contour = normMaskContour(mask, info.width, info.height)
  if (!contour) throw new Error(`${name} produced no contour`)
  return contour
}

function candidates(contour: Contour, regions: readonly RegionMeasurement[], policy: CentrePolicy, analyticCircle: boolean): ParityCandidateMeasurement[] {
  const bounds = donorBbox(contour.outer.pts)
  const measured = centreMeasurements(contour, regions)
  const target = evaluateCentrePolicy(measured, policy).target
  const widthBand = bandOf(bounds.maxX - bounds.minX)?.id ?? 5
  const heightBand = bandOf(bounds.maxY - bounds.minY)?.id ?? 5
  const fits = analyticCircle
    ? makeCircleSeatPredicate(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2,
      12,
    )
    : makeSeatPredicate(contour.outer.pts, 12)
  if (!fits) return []
  return parityPhases(target, bounds, 48, widthBand, heightBand).map((candidate) => {
    const seated = donorLatticeAt(bounds, 48, candidate.phaseMM[0], candidate.phaseMM[1]).filter(fits)
    return {
      ...candidate,
      seated,
      excessMM: pressExcessMM(contour.outer.pts, seated, 12),
    }
  })
}

describe('T1 Centre-rules clone then re-room', () => {
  it('moves every T0-cleared neutral body verbatim', () => {
    const moves = [
      ['bbox', 'src/lib/magnetic-grid/compute/seat.ts'],
      ['axisFrom', 'src/lib/magnetic-grid/compute/seat.ts'],
      ['latticeAt', 'src/lib/magnetic-grid/compute/seat.ts'],
      ['latticeOver', 'src/lib/magnetic-grid/compute/seat.ts'],
      ['centroidOf', 'src/lib/magnetic-grid/compute/centre-evidence.ts'],
      ['scaleContour', 'src/lib/magnetic-grid/compute/seat.ts'],
    ] as const
    for (const [name, destination] of moves) {
      expect(callableBodiesAreByteEqual(
        join(process.cwd(), 'src/lib/effect/grid-origin-compute.ts'),
        name,
        join(process.cwd(), destination),
      ), name).toBe(true)
    }
    expect(callableBodiesAreByteEqual(
      join(process.cwd(), 'src/lib/effect/grid-origin-logic.ts'),
      'governMass',
      join(process.cwd(), 'src/lib/magnetic-grid/logic.ts'),
    )).toBe(true)
  })

  it('preserves governed centre and winning node/gap placement for the full matrix and all nine policies', async () => {
    const shapes = [
      { id: 'square', base: rectangle(1, 1), analyticCircle: false },
      { id: 'circle', base: circle(), analyticCircle: true },
      { id: 'pill', base: pill(), analyticCircle: false },
      { id: 'tall', base: rectangle(0.6, 1), analyticCircle: false },
      { id: 'wide', base: rectangle(1, 0.6), analyticCircle: false },
      { id: 'duck', base: await cutout('DUCK.png'), analyticCircle: false },
      { id: 'bot', base: await cutout('BOT.png'), analyticCircle: false },
      { id: 'bat-woman', base: await cutout('BAT-WOMAN.png'), analyticCircle: false },
    ]
    for (const shape of shapes) for (const scaleMM of [48, 96, 144, 192]) for (const item of POLICIES) {
      const contour = donorScaleContour(shape.base, scaleMM)
      const donor = computeGrid(contour, {
        positioning: 1,
        centreMode: item.centreMode,
        governor: item.governor,
        perimeterOnly: true,
        circle: shape.analyticCircle,
      })
      const centre = evaluateCentrePolicy(centreMeasurements(contour, donor.segments), item.policy)
      expect(centre.target).toEqual(donor.centreMainMM)
      const result = evaluateCentreBaseline({
        contour,
        regions: donor.segments,
        policy: item.policy,
        candidates: candidates(contour, donor.segments, item.policy, shape.analyticCircle),
      })
      if (!donor.anchors.length) {
        expect(result, `${shape.id}/${scaleMM}/${JSON.stringify(item.policy)}`).toBeNull()
        continue
      }
      expect(result, `${shape.id}/${scaleMM}/${JSON.stringify(item.policy)}`).not.toBeNull()
      expect(result!.phaseMM).toEqual(donor.phaseMM)
      expect(applyCoverage([...result!.seated], true, 48).seated).toEqual(donor.anchors.map((anchor) => anchor.p))
    }
  }, 120_000)
})
