import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { computeGrid } from '../grid-origin'
import { normMaskContour } from '../grid-origin-bridge'
import { scaleContour } from '../grid-origin-compute'
import type { Contour, Pt } from '../types'

const SCALES = [48, 96, 144, 192] as const

const POLICIES = [
  { id: 'box', centreMode: 0, governor: 0 },
  { id: 'core', centreMode: 1, governor: 0 },
  { id: 'weight', centreMode: 3, governor: 0 },
  { id: 'deep', centreMode: 4, governor: 0 },
  { id: 'top', centreMode: 5, governor: 0 },
  { id: 'masses-smallest', centreMode: 2, governor: 0 },
  { id: 'masses-deepest', centreMode: 2, governor: 1 },
  { id: 'masses-top', centreMode: 2, governor: 2 },
  { id: 'masses-top-small', centreMode: 2, governor: 3 },
] as const

const rect = (w: number, h: number): Contour => ({
  outer: { pts: [[0, 0], [w, 0], [w, h], [0, h]] as Pt[] },
  holes: [],
})

const circle = (vertices = 192): Contour => ({
  outer: {
    pts: Array.from({ length: vertices }, (_, index) => {
      const angle = (index / vertices) * Math.PI * 2
      return [0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5] as Pt
    }),
  },
  holes: [],
})

const pill = (verticesPerCap = 96): Contour => ({
  outer: {
    pts: [
      ...Array.from({ length: verticesPerCap }, (_, index) => {
        const angle = Math.PI / 2 + (index / (verticesPerCap - 1)) * Math.PI
        return [0.25 + Math.cos(angle) * 0.25, 0.25 + Math.sin(angle) * 0.25] as Pt
      }),
      ...Array.from({ length: verticesPerCap }, (_, index) => {
        const angle = -Math.PI / 2 + (index / (verticesPerCap - 1)) * Math.PI
        return [0.75 + Math.cos(angle) * 0.25, 0.25 + Math.sin(angle) * 0.25] as Pt
      }),
    ],
  },
  holes: [],
})

async function cutout(name: string): Promise<Contour> {
  const path = join(process.cwd(), 'public/grid-engine/cutouts', name)
  const image = sharp(await readFile(path)).ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(info.width * info.height)
  for (let index = 0; index < mask.length; index++) {
    if (data[index * info.channels + 3] > 128) mask[index] = 1
  }
  const contour = normMaskContour(mask, info.width, info.height)
  if (!contour) throw new Error(`${name} produced no contour`)
  return contour
}

function float64Hex(value: number): string {
  const bytes = new ArrayBuffer(8)
  new DataView(bytes).setFloat64(0, value, false)
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function pointBits(point: Pt): readonly [string, string] {
  return [float64Hex(point[0]), float64Hex(point[1])]
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

describe('v3.5 Centre-rules characterization baseline', () => {
  it('detects coordinate changes far below one micrometre', () => {
    const belowMicrometreMM = 2 ** -40
    expect(belowMicrometreMM).toBeLessThan(0.000001)
    expect(float64Hex(1 + belowMicrometreMM)).not.toBe(float64Hex(1))
    expect(digest(pointBits([1 + belowMicrometreMM, 2]))).not.toBe(digest(pointBits([1, 2])))
  })

  it('pins all nine centre policies across the B1-B4 comparison matrix', async () => {
    const shapes: ReadonlyArray<{ id: string; contour: Contour; circle?: boolean }> = [
      { id: 'square', contour: rect(1, 1) },
      { id: 'circle', contour: circle(), circle: true },
      { id: 'pill', contour: pill() },
      { id: 'tall-rectangle', contour: rect(0.6, 1) },
      { id: 'wide-rectangle', contour: rect(1, 0.6) },
      { id: 'duck', contour: await cutout('DUCK.png') },
      { id: 'bot', contour: await cutout('BOT.png') },
      { id: 'bat-woman', contour: await cutout('BAT-WOMAN.png') },
    ]

    const baseline = shapes.flatMap((shape) => SCALES.flatMap((scaleMM) => POLICIES.map((policy) => {
      const result = computeGrid(scaleContour(shape.contour, scaleMM), {
        positioning: 1,
        centreMode: policy.centreMode,
        governor: policy.governor,
        perimeterOnly: true,
        circle: shape.circle,
      })
      return {
        shape: shape.id,
        scaleMM,
        policy: policy.id,
        centreMainIEEE754: pointBits(result.centreMainMM),
        centreEvidenceCount: result.centresMM.length,
        centreEvidenceSha256: digest(result.centresMM.map(pointBits)),
        phaseIEEE754: pointBits(result.phaseMM),
        anchorCount: result.anchors.length,
        anchorsSha256: digest(result.anchors.map((anchor) => pointBits(anchor.p))),
      }
    })))

    expect(baseline.map((row) => JSON.stringify(row)).join('\n')).toMatchSnapshot()
  }, 120_000)
})
