import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Clipper, EndType, FillRule, JoinType } from '@countertype/clipper2-ts'
import { describe, expect, it, vi } from 'vitest'
import {
  createEngineManufacturingSpec,
  createReferenceProfile,
  registerProfile,
  selectedOffer,
  solveOutline,
} from '@onemo/magnetic-logic'
import { canonicalHash } from '@onemo/geometry-compute'
import {
  adaptStudioOutline,
  certifyAndBindSelectedBand,
  serializeManufacturingSpec,
} from '@onemo/magnetic-next'
import { verifyManufacturingSpecAction } from '../actions'
import { toMagneticStudioOutline } from '../engine-boundary'
import { engineOutline } from '@/lib/grid-engine/ui/trace-cutout'

type Fixture = {
  outline: Array<[number, number]>
  box: { w: number; h: number }
}

const fixtures = JSON.parse(
  readFileSync(join(process.cwd(), 'src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json'), 'utf8'),
) as Record<string, Fixture>

const singleRungProfile = () => {
  const profile = structuredClone(createReferenceProfile())
  Reflect.deleteProperty(profile, 'profileHash')
  return registerProfile({
    ...profile,
    sizeDomain: {
      minMm: 48,
      maxMm: 49,
      stepMm: 12,
      bands: [{ id: 'B1', class: 1, minMm: 48, maxMm: 49, maxInclusive: true, referenceMm: 48 }],
      primaryOffer: 'SMALLEST_ACCEPTED_PER_BAND',
    },
    permissions: profile.permissions.map((permission) => ({
      ...permission,
      bands: ['B1'] as const,
      allowedAxisClassPairs: [[1, 1] as const],
    })),
    translation: { ...profile.translation, allowX: false, allowY: false },
  })
}

describe('v3.3 host authority boundaries', () => {
  it.each(Object.entries(fixtures))('%s reaches a certified selectable offer through the public host boundary', async (_name, fixture) => {
    const profile = createReferenceProfile()
    const submitted = toMagneticStudioOutline(fixture.outline, fixture.box, profile.numeric)
    const solve = await solveOutline({ outlineMm: adaptStudioOutline(submitted), profile })
    const offer = solve.offers.find((candidate) => candidate.status === 'OFFERED')
    const offerSummary = solve.offers.map(({ band, status, reasons }) => ({ band, status, reasons }))

    expect(submitted.length).toBeLessThanOrEqual(profile.numeric.maxVertices)
    expect(offer, JSON.stringify(offerSummary)).toBeDefined()
    const bound = certifyAndBindSelectedBand(solve, offer!.band, submitted, profile)
    expect(bound.solution.centres.length).toBeGreaterThan(0)
    await expect(verifyManufacturingSpecAction(serializeManufacturingSpec(bound.manufacturingSpec))).resolves.toEqual(
      expect.objectContaining({ valid: true }),
    )
  }, 120_000)

  it('uses the minimum contained PILL engine-copy offset', () => {
    const fixture = fixtures.pill
    const profile = createReferenceProfile()
    const scale = 1 / profile.numeric.coordinateQuantumMm
    const path = (outline: Fixture['outline']) => outline.map(([u, v]) => ({
      x: Math.round(u * fixture.box.w * scale),
      y: Math.round(v * fixture.box.h * scale),
    }))
    const raw = path(fixture.outline)
    const copy = path(engineOutline(fixture.outline))
    const offset27 = Clipper.inflatePaths([copy], -27, JoinType.Round, EndType.Polygon, 2, 0.25)
    const offset28 = Clipper.inflatePaths([copy], -28, JoinType.Round, EndType.Polygon, 2, 0.25)

    expect(offset27).toHaveLength(1)
    expect(Clipper.difference(offset27, [raw], FillRule.NonZero)).not.toHaveLength(0)
    expect(offset28).toHaveLength(1)
    expect(Clipper.difference(offset28, [raw], FillRule.NonZero)).toHaveLength(0)
    expect(toMagneticStudioOutline(fixture.outline, fixture.box, profile.numeric)).toEqual(
      offset28[0]!.map(({ x, y }) => ({
        x: x * profile.numeric.coordinateQuantumMm,
        y: y * profile.numeric.coordinateQuantumMm,
      })),
    )
  })

  it('fails closed when the ruled inward-offset budget is exhausted', () => {
    const fixture = fixtures.pill
    const profile = createReferenceProfile()
    const inflate = vi.spyOn(Clipper, 'inflatePaths').mockReturnValue([])
    try {
      expect(toMagneticStudioOutline(fixture.outline, fixture.box, profile.numeric)).toHaveLength(
        fixture.outline.length,
      )
    } finally {
      inflate.mockRestore()
    }
  })

  it('rejects a non-empty sub-quantum outside difference', () => {
    const outline: Fixture['outline'] = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const box = { w: 100, h: 100 }
    const profile = createReferenceProfile()
    const difference = vi.spyOn(Clipper, 'difference').mockReturnValue([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    ])
    try {
      expect(toMagneticStudioOutline(outline, box, profile.numeric)).toEqual([
        { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
      ])
    } finally {
      difference.mockRestore()
    }
  })

  it('the server action parses, resolves and rejects a rehashed physical-policy tamper', async () => {
    const profile = singleRungProfile()
    const outline = [
      { x: -12, y: -12 },
      { x: 12, y: -12 },
      { x: 12, y: 12 },
      { x: -12, y: 12 },
    ]
    const solve = await solveOutline({ outlineMm: outline, profile })
    const spec = createEngineManufacturingSpec(solve, selectedOffer(solve, 'B1'), profile)
    const tamperedPayload = structuredClone(spec)
    Reflect.deleteProperty(tamperedPayload, 'canonicalHash')
    Object.assign(tamperedPayload, {
      profileHash: createReferenceProfile().profileHash,
      effectiveVerificationRadiusMm: 0,
    })
    const tampered = { ...tamperedPayload, canonicalHash: canonicalHash(tamperedPayload) }

    await expect(verifyManufacturingSpecAction(JSON.stringify(tampered))).rejects.toThrow(
      'PHYSICAL_TOLERANCE_POLICY_MISSING',
    )
  })
})
