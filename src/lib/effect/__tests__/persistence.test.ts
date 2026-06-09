// persistence golden fixtures (§8.7a) — the F1 remix↔manufacturing bond + save-bundle round-trip.
// Encodes WHY: (1) F1 binds the EditableRecipe to the LockedPayload — resolve(recipe) must reproduce the
// manufactured geometry, else a remix edits a design that was never made (fail-closed); (2) a tampered
// recipe (different commands → different shape) is REJECTED; (3) the save-bundle serializes round-trip;
// (4) the designs-row mapping is pure (no DB). Builder is pure → no canvas needed.

import { describe, it, expect } from 'vitest'
import { applyOutlineCommands, type OutlineDocument, type OutlineNode } from '@/lib/outline-core'
import type { EffectSpecDraft, Contour } from '../types'
import type { PreparedEffect } from '../prepare-effect'
import { buildApprovedEffectPayload } from '../payload'
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

function node(id: string, x: number, y: number): OutlineNode {
  return { id, p: [x, y], role: 'corner', corner: { mode: 'inherit' } }
}

const squareBase = () => ({
  rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes: [node('n1', 0, 0), node('n2', 100, 0), node('n3', 100, 100), node('n4', 0, 100)] }],
  style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 },
})
const env = { image: { widthPx: 100, heightPx: 100, sourceHash: 'src', orientation: 'baked' as const }, mode: 'semi_auto' as const }

/** A valid square OutlineDocument (baseSnapshot + commands replay to itself). */
function squareDoc(commands = []): OutlineDocument {
  return applyOutlineCommands(squareBase(), commands, env)
}

const squareGeomMM: Contour = { outer: { pts: [[0, 0], [70, 0], [70, 70], [0, 70]] }, holes: [] }

function prepared(doc: OutlineDocument): PreparedEffect {
  const spec: EffectSpecDraft = {
    sourceRef: 'blob:test',
    maskWidthPx: 100,
    maskHeightPx: 100,
    mmPerPx: 0.7,
    geometryMM: squareGeomMM,
    dimensions: { thicknessBodyMM: 1, edgeRadiusMM: 0.15, widthMM: 70, heightMM: 70 },
    generator: { adapter: 'standard', lane: 'kai', version: '0.3.0' },
    diagnostics: { rawContourNodes: 4, simplifiedNodes: 4, holes: 0, rdpEpsilonMM: 0.4 },
  }
  return {
    spec,
    outlineDocument: doc,
    composite: null as unknown as HTMLCanvasElement,
    edgeComposite: null as unknown as HTMLCanvasElement,
    frontSrc: { origCanvas: null as unknown as HTMLCanvasElement, subjCanvas: null as unknown as HTMLCanvasElement, defaultBlurPx: 0 },
    widthMM: 70,
    heightMM: 70,
  }
}

describe('F1 bond (§1/§11) — bindF1', () => {
  it('PASSES when the recipe resolves to the payload geometry (same doc that was approved)', () => {
    const doc = squareDoc()
    const payload = buildApprovedEffectPayload(prepared(doc), { type: 'standard', size: 's70' })
    const recipe: EditableRecipe = { outlineDocument: doc }
    expect(() => bindF1(recipe, payload)).not.toThrow()
  })

  it('THROWS F1MismatchError when the recipe is tampered (different commands → different shape)', () => {
    // payload approved from the UNEDITED square…
    const payload = buildApprovedEffectPayload(prepared(squareDoc()), { type: 'standard', size: 's70' })
    // …but the recipe carries a MoveNode that changes the shape → replay hash diverges.
    const tampered: EditableRecipe = {
      outlineDocument: squareDoc([{ op: 'MoveNode', ringId: 'r1', nodeId: 'n2', to: [120, -10] }] as never),
    }
    expect(() => bindF1(tampered, payload)).toThrow(F1MismatchError)
  })

  it('makeSavedEffect is fail-closed (asserts F1 before bundling)', () => {
    const payload = buildApprovedEffectPayload(prepared(squareDoc()), { type: 'standard', size: 's70' })
    const bad: EditableRecipe = { outlineDocument: squareDoc([{ op: 'SetGlobalCornerRadius', outlineCornerRadiusPx: 20 }] as never) }
    expect(() => makeSavedEffect(bad, payload, { effectType: 'standard', size: 's70' })).toThrow(F1MismatchError)
  })
})

describe('save-bundle round-trip + designs-row mapping (pure)', () => {
  it('serialize → deserialize round-trips a SavedEffect', () => {
    const doc = squareDoc()
    const payload = buildApprovedEffectPayload(prepared(doc), { type: 'standard', size: 's70' })
    const saved = makeSavedEffect({ outlineDocument: doc }, payload, { effectType: 'standard', size: 's70' })
    const round = deserializeSavedEffect(serializeSavedEffect(saved))
    expect(round).toEqual(saved)
    expect(round.lockedPayload.payload_hash).toBe(saved.lockedPayload.payload_hash)
  })

  it('toDesignRow → fromDesignRow preserves the bundle + shapes the designs columns', () => {
    const doc = squareDoc()
    const payload = buildApprovedEffectPayload(prepared(doc), { type: 'standard', size: 's70' })
    const saved = makeSavedEffect({ outlineDocument: doc }, payload, { effectType: 'standard', size: 's70' })
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
