// payload golden fixtures (§8.6) — the ApprovedEffectPayload / LockedPayload.
// Encodes WHY: (1) deterministic content hash (int-micron + canonical serialization) so the
// manufacturing record is reproducible; (2) the MANDATORY feasibility gate (§1) rejects an uncuttable
// shape BEFORE any hash/approve; (3) the payload locks the FACE + FINAL-physical-mm (not cut-only),
// and the size band scales the final geometry. Builder is pure → no canvas needed.

import { describe, it, expect } from 'vitest'
import { applyOutlineCommands, type OutlineDocument, type OutlineNode } from '@/lib/outline-core'
import type { EffectSpecDraft, Contour } from '../types'
import type { PreparedEffect } from '../prepare-effect'
import { buildApprovedEffectPayload, assertCuttable, EffectNotCuttableError } from '../payload'

function node(id: string, x: number, y: number): OutlineNode {
  return { id, p: [x, y], role: 'corner', corner: { mode: 'inherit' } }
}

/** A valid square OutlineDocument (4 corners) — cuttable. */
function squareDoc(): OutlineDocument {
  return applyOutlineCommands(
    {
      rings: [{ id: 'r1', role: 'outer', closed: true, nodes: [node('n1', 0, 0), node('n2', 100, 0), node('n3', 100, 100), node('n4', 0, 100)] }],
      style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 },
    },
    [],
    { image: { widthPx: 100, heightPx: 100, sourceHash: 'src', orientation: 'baked' }, mode: 'semi_auto' },
  )
}

/** A self-intersecting (bowtie) OutlineDocument — NOT cuttable. */
function bowtieDoc(): OutlineDocument {
  return applyOutlineCommands(
    {
      rings: [{ id: 'r1', role: 'outer', closed: true, nodes: [node('n1', 0, 0), node('n2', 100, 100), node('n3', 100, 0), node('n4', 0, 100)] }],
      style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 },
    },
    [],
    { image: { widthPx: 100, heightPx: 100, sourceHash: 'src', orientation: 'baked' }, mode: 'semi_auto' },
  )
}

const squareGeomMM: Contour = { outer: { pts: [[0, 0], [70, 0], [70, 70], [0, 70]] }, holes: [] }

function prepared(doc: OutlineDocument, geometryMM: Contour): PreparedEffect {
  const spec: EffectSpecDraft = {
    sourceRef: 'blob:test',
    maskWidthPx: 100,
    maskHeightPx: 100,
    mmPerPx: 0.7,
    geometryMM,
    dimensions: { thicknessBodyMM: 1, edgeRadiusMM: 0.15, widthMM: 70, heightMM: 70 },
    generator: { adapter: 'standard', lane: 'kai', version: '0.3.0' },
    diagnostics: { rawContourNodes: 4, simplifiedNodes: 4, holes: 0, rdpEpsilonMM: 0.4 },
  }
  // composite/edgeComposite are never read by the pure builder → safe stubs.
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

describe('assertCuttable — mandatory feasibility gate (§1)', () => {
  it('passes a valid square outline', () => {
    expect(assertCuttable(prepared(squareDoc(), squareGeomMM)).ok).toBe(true)
  })
  it('rejects a self-intersecting (bowtie) outline with locators', () => {
    const r = assertCuttable(prepared(bowtieDoc(), squareGeomMM))
    expect(r.ok).toBe(false)
    expect(r.locators.length).toBeGreaterThan(0)
  })
})

describe('buildApprovedEffectPayload', () => {
  it('is DETERMINISTIC: same (prepared, opts) → identical payload_hash', () => {
    const p = prepared(squareDoc(), squareGeomMM)
    const a = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    const b = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    expect(a.payload_hash).toBe(b.payload_hash)
    expect(a.payload_hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('locks the FACE + FINAL-physical-mm (not cut-only) — int-microns', () => {
    const out = buildApprovedEffectPayload(prepared(squareDoc(), squareGeomMM), { type: 'standard', size: 's70' })
    // face (composite recipe), not just the cut:
    expect(out.artwork.composeFront_recipe_hash).toMatch(/^[0-9a-f]{16}$/)
    // final-physical-mm in int-microns: 70mm → 70_000 microns at s70 (scale 1)
    expect(out.geometry.final_physical_mm.units).toBe('microns')
    const xs = out.geometry.final_physical_mm.outer.map((p) => p[0])
    expect(Math.max(...xs)).toBe(70000)
    expect(out.appearance.thickness_mm).toBe(1) // §9 1mm
  })

  it('size band scales the final geometry + changes the hash (s140 ≠ s70)', () => {
    const p = prepared(squareDoc(), squareGeomMM)
    const s70 = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    const s140 = buildApprovedEffectPayload(p, { type: 'standard', size: 's140' })
    expect(s140.payload_hash).not.toBe(s70.payload_hash)
    const max70 = Math.max(...s70.geometry.final_physical_mm.outer.map((q) => q[0]))
    const max140 = Math.max(...s140.geometry.final_physical_mm.outer.map((q) => q[0]))
    expect(max140).toBe(140000) // 140mm longest side
    expect(max140).toBeGreaterThan(max70)
  })

  it('THROWS EffectNotCuttableError for an uncuttable shape (never hashes it)', () => {
    expect(() => buildApprovedEffectPayload(prepared(bowtieDoc(), squareGeomMM), { type: 'standard', size: 's70' }))
      .toThrow(EffectNotCuttableError)
  })
})
