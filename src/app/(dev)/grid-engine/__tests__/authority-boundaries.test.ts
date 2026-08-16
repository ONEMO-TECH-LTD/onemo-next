import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createEngineManufacturingSpec,
  createReferenceProfile,
  registerProfile,
  selectedOffer,
  solveOutline,
  sourceGeometryIdentity,
} from '@onemo/magnetic-logic'
import { canonicalHash } from '@onemo/geometry-compute'
import { adaptStudioOutline } from '@onemo/magnetic-next'
import { verifyManufacturingSpecAction } from '../actions'
import { toMagneticStudioOutline } from '../engine-boundary'

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
  it('preserves every within-budget traced vertex as the governed source', () => {
    const pill = fixtures.pill
    const submitted = toMagneticStudioOutline(pill.outline, pill.box)
    const source = sourceGeometryIdentity(adaptStudioOutline(submitted), createReferenceProfile())

    expect(submitted).toHaveLength(3796)
    expect(source.sourceRingInt).toHaveLength(3796)
    expect(source.sourceGeometryHash).toBe('dd7f80b07448f13377ef28429fbe3bb5cabc4f36717e65c443d9665d77f92a08')
  })

  it('preserves over-budget input and lets v3.3 reject it as RESOURCE_LIMIT_EXCEEDED', () => {
    const poke1 = fixtures.poke1
    const submitted = toMagneticStudioOutline(poke1.outline, poke1.box)

    expect(submitted).toHaveLength(6478)
    expect(() => sourceGeometryIdentity(adaptStudioOutline(submitted), createReferenceProfile())).toThrow(
      expect.objectContaining({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        details: { vertexCount: 6478, maxVertices: 4096 },
      }),
    )
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
