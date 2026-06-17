// persistence golden fixtures (§8.7a) — the VECTOR F1 remix↔manufacturing bond + save-bundle
// round-trip. Encodes WHY: (1) F1 binds the EditableRecipe's vector truth to the LockedPayload —
// the recipe's canonical identity must equal the hashed manufacturing identity, else a remix edits
// a design that was never made (fail-closed); (2) a tampered recipe (moved anchor → different
// shape) is REJECTED; (3) the save-bundle serializes round-trip; (4) the designs-row mapping is
// pure (no DB). NOTE: the save UI is erased this wave (Dan ruling) — this is contract-only code
// the future save/library round builds on.

import { describe, it, expect } from 'vitest'
import type { EffectSpecDraft, Contour } from '../types'
import type { PreparedEffect } from '../prepare-effect'
import { buildApprovedEffectPayload } from '../payload'
import { contourFromShape } from '../geometry-truth'
import { getShape } from '@/lib/shape-library'
import type { VShape } from '@/lib/vector-core'
import {
  bindF1,
  makeSavedEffect,
  serializeSavedEffect,
  deserializeSavedEffect,
  toDesignRow,
  fromDesignRow,
  F1MismatchError,
  type EditableRecipe,
} from '../persistence'

const squareShape = () => getShape('square', 100, 100)

/** the same square with ONE anchor nudged — a different design (the tamper fixture). */
const tamperedShape = (): VShape => {
  const v = squareShape()
  return { paths: [{ anchors: v.paths[0].anchors.map((a, i) => (i === 1 ? { ...a, p: { x: a.p.x + 20, y: a.p.y - 10 } } : a)) }] }
}

function prepared(v: VShape): PreparedEffect {
  const geometryMM = contourFromShape(v, { mmPerPx: 0.7, maskHeightPx: 100 }) as Contour
  const spec: EffectSpecDraft = {
    sourceRef: 'blob:test',
    maskWidthPx: 100,
    maskHeightPx: 100,
    mmPerPx: 0.7,
    vectorShape: v,
    geometryMM,
    dimensions: { thicknessBodyMM: 1, edgeRadiusMM: 0.15, widthMM: 70, heightMM: 70 },
    generator: { adapter: 'standard', lane: 'kai', version: '0.3.0' },
    diagnostics: { rawContourNodes: 4, simplifiedNodes: geometryMM.outer.pts.length, holes: 0, rdpEpsilonMM: 0.4 },
  }
  return {
    spec,
    composite: null as unknown as HTMLCanvasElement,
    edgeComposite: null as unknown as HTMLCanvasElement,
    frontSrc: { origCanvas: null as unknown as HTMLCanvasElement, subjCanvas: null as unknown as HTMLCanvasElement, defaultBlurPx: 0 },
    widthMM: 70,
    heightMM: 70,
  }
}

describe('vector F1 bond (§1/§11) — bindF1', () => {
  it('PASSES when the recipe carries the vector truth that was approved', () => {
    const v = squareShape()
    const payload = buildApprovedEffectPayload(prepared(v), { type: 'standard', size: 's70' })
    const recipe: EditableRecipe = { vectorShape: v }
    expect(() => bindF1(recipe, payload)).not.toThrow()
  })

  it('THROWS F1MismatchError when the recipe is tampered (moved anchor → different shape)', () => {
    // payload approved from the UNEDITED square…
    const payload = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    // …but the recipe carries a nudged anchor → canonical identity diverges.
    const tampered: EditableRecipe = { vectorShape: tamperedShape() }
    expect(() => bindF1(tampered, payload)).toThrow(F1MismatchError)
  })

  it('makeSavedEffect is fail-closed (asserts F1 before bundling)', () => {
    const payload = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    const bad: EditableRecipe = { vectorShape: tamperedShape() }
    expect(() => makeSavedEffect(bad, payload, { effectType: 'standard', size: 's70' })).toThrow(F1MismatchError)
  })
})

describe('save-bundle round-trip + designs-row mapping (pure)', () => {
  it('serialize → deserialize round-trips a SavedEffect', () => {
    const v = squareShape()
    const payload = buildApprovedEffectPayload(prepared(v), { type: 'standard', size: 's70' })
    const saved = makeSavedEffect({ vectorShape: v }, payload, { effectType: 'standard', size: 's70' })
    const round = deserializeSavedEffect(serializeSavedEffect(saved))
    expect(round).toEqual(saved)
    expect(round.lockedPayload.payload_hash).toBe(saved.lockedPayload.payload_hash)
  })

  it('toDesignRow → fromDesignRow preserves the bundle + shapes the designs columns', () => {
    const v = squareShape()
    const payload = buildApprovedEffectPayload(prepared(v), { type: 'standard', size: 's70' })
    const saved = makeSavedEffect({ vectorShape: v }, payload, { effectType: 'standard', size: 's70' })
    const row = toDesignRow(saved, { userId: 'u1', title: 'My Effect' })
    expect(row.user_id).toBe('u1')
    expect(row.is_public).toBe(false)
    expect(row.effect_spec.payload_hash).toBe(payload.payload_hash)
    const back = fromDesignRow(row)
    expect(back.editableRecipe).toEqual(saved.editableRecipe)
    expect(back.lockedPayload.payload_hash).toBe(payload.payload_hash)
    expect(back.meta.size).toBe('s70')
  })
})
