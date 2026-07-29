// payload golden fixtures (§8.6) — the ApprovedEffectPayload / LockedPayload, VECTOR-NATIVE (schema 3).
// Encodes WHY: (1) deterministic content hash (int-micron + canonical serialization) so the
// manufacturing record is reproducible; (2) the MANDATORY feasibility gate (§1) rejects an uncuttable
// shape BEFORE any hash/approve — on the SAME truth-derived contour that gets hashed; (3) the payload
// locks the FACE + FINAL-physical-mm (not cut-only) and the size band scales the final geometry;
// (4) build.vector_shape_hash anchors the vector F1 bond. Builder is pure → no canvas needed.

import { describe, it, expect } from 'vitest'
import type { EffectSpecDraft, Contour, Pt } from '../types'
import type { PreparedEffect } from '../prepare-effect'
import { buildApprovedEffectPayload, assertCuttable, EffectNotCuttableError, canonicalHashBody } from '../payload'
import { contourFromShape, vectorShapeHash } from '../geometry-truth'
import { getShape } from '@/lib/shape-library'
import type { VShape } from '@/lib/vector-core'

/** THE truth fixture: a 100×100 kernel square (4 corner anchors, exact lines). */
const squareShape = () => getShape('square', 100, 100)

/** A self-intersecting vector (asymmetric crossing, POSITIVE net area — the F2 lesson: the
 *  symmetric bowtie nets to ZERO area and would mask the self-intersection path behind the
 *  degenerate branch; this crossing keeps |area| large so the rejection is genuinely the
 *  self-intersection verdict). */
const selfIntersectShape = (): VShape => ({
  paths: [{ anchors: [
    { p: { x: 0, y: 0 }, corner: true }, { p: { x: 100, y: 10 }, corner: true },
    { p: { x: 100, y: 0 }, corner: true }, { p: { x: 0, y: 90 }, corner: true },
  ] }],
})

const MM_PER_PX = 0.7

function prepared(v: VShape, geometryMM?: Contour): PreparedEffect {
  const derived = geometryMM ?? contourFromShape(v, { mmPerPx: MM_PER_PX, maskHeightPx: 100 })
  if (!derived) throw new Error('fixture: contour derivation failed')
  const spec: EffectSpecDraft = {
    sourceRef: 'blob:test',
    maskWidthPx: 100,
    maskHeightPx: 100,
    mmPerPx: MM_PER_PX,
    vectorShape: v,
    geometryMM: derived,
    dimensions: { thicknessBodyMM: 1, edgeRadiusMM: 0.15, widthMM: 70, heightMM: 70 },
    generator: { adapter: 'standard', lane: 'kai', version: '0.3.0' },
    diagnostics: { rawContourNodes: 4, simplifiedNodes: derived.outer.pts.length, holes: 0, rdpEpsilonMM: 0.4 },
  }
  // composite/edgeComposite are never read by the pure builder → safe stubs.
  return {
    spec,
    composite: null as unknown as HTMLCanvasElement,
    edgeComposite: null as unknown as HTMLCanvasElement,
    frontSrc: { origCanvas: null as unknown as HTMLCanvasElement, subjCanvas: null as unknown as HTMLCanvasElement, defaultBlurPx: 0 },
    widthMM: 70,
    heightMM: 70,
  }
}

/** Walk an object and collect `path=value` for every numeric leaf that is NOT an integer. [] = float-free. */
function nonIntegerNumbers(obj: unknown, path = ''): string[] {
  if (typeof obj === 'number') return Number.isInteger(obj) ? [] : [`${path}=${obj}`]
  if (Array.isArray(obj)) return obj.flatMap((v, i) => nonIntegerNumbers(v, `${path}[${i}]`))
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => nonIntegerNumbers(v, path ? `${path}.${k}` : k))
  return []
}

describe('assertCuttable — mandatory feasibility gate (§1), on the truth-derived contour', () => {
  it('passes a valid square', () => {
    expect(assertCuttable(prepared(squareShape())).ok).toBe(true)
  })
  it('rejects a self-intersecting outline via the self-intersection path (NOT degenerate)', () => {
    const r = assertCuttable(prepared(selfIntersectShape()))
    expect(r.ok).toBe(false)
    // F2: positive-area fixture clears the degenerate gate — the rejection IS the crossing.
    expect(r.reason).toBe('self-intersection')
  })
  it('rejects a collapsed outline as degenerate', () => {
    const collapsed: Contour = { outer: { pts: [[0, 0], [0.1, 0], [0.2, 0.05]] as Pt[] }, holes: [] }
    const r = assertCuttable(prepared(squareShape(), collapsed))
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('degenerate/collapsed outline')
  })
})

describe('buildApprovedEffectPayload (schema 3, vector-native)', () => {
  it('is DETERMINISTIC: same (prepared, opts) → identical payload_hash', () => {
    const p = prepared(squareShape())
    const a = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    const b = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    expect(a.payload_hash).toBe(b.payload_hash)
    expect(a.payload_hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('locks the FACE + FINAL-physical-mm (not cut-only) — int-microns', () => {
    const out = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    expect(out.artwork.composeFront_recipe_hash).toMatch(/^[0-9a-f]{16}$/)
    expect(out.geometry.final_physical_mm.units).toBe('microns')
    // the kernel square is CENTERED in its 100px box (72% side) — the band scales the LONGEST SIDE
    // to the target, so assert the SPAN, not the max coordinate: 70mm → 70_000 microns at s70
    const xs = out.geometry.final_physical_mm.outer.map((p) => p[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBe(70000)
    expect(out.appearance.thickness_mm).toBe(1) // §9 1mm
  })

  it('THROWS EffectNotCuttableError for an uncuttable shape (never hashes it)', () => {
    expect(() => buildApprovedEffectPayload(prepared(selfIntersectShape()), { type: 'standard', size: 's70' }))
      .toThrow(EffectNotCuttableError)
  })

  it('GOLDEN: pins the manufacturing hash + schema_version so a SILENT schema/serialization drift is caught (F2)', () => {
    const out = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    // If this literal breaks UNEXPECTEDLY, a refactor silently changed every saved design's
    // manufacturing identity (and the cross-deploy F1 remix↔mfg bond). On an INTENDED schema change:
    // bump SCHEMA_VERSION in payload.ts + update this golden in the same commit.
    // (schema v3, REBUILD-PLAN-v2: the contract went VECTOR-NATIVE — build.vector_shape_hash replaced
    // outline_document_hash, feasibility moved to the truth-derived contour, the doc model left the
    // save path entirely. Nothing persisted at v2 — the prototype save feature was erased, Dan ruling.)
    // (re-pinned from 9f0d0b1293193a5e, KAI-8973/P1b: the no-ingest image_hash fallback is now
    // MARKED `ref-fallback:` so it can't impersonate byte identity — fixtures carry no ingest sha,
    // so this fixture's source identity moved. Schema shape unchanged; nothing persisted.)
    expect(out.schema_version).toBe(3)
    // KAI-9837: the released standard-birth corner calibration moved 8→10mm and therefore changes
    // EFFECT_BUILD_CONFIG.config_hash by design. The payload schema is unchanged; save remains erased.
    expect(out.payload_hash).toBe('50be46dc3e00b0f1')
  })

  it('SOURCE IDENTITY (KAI-8973/P1b): the ingest byte-hash IS image_hash; absence is a MARKED fallback', () => {
    const p = prepared(squareShape())
    const noIngest = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    expect(noIngest.source.image_hash).toMatch(/^ref-fallback:[0-9a-f]{16}$/) // self-describing, never byte-identity-shaped
    const sha = 'a'.repeat(64)
    const withIngest = buildApprovedEffectPayload(
      { ...p, spec: { ...p.spec, sourceBytesSha256: sha } },
      { type: 'standard', size: 's70' },
    )
    expect(withIngest.source.image_hash).toBe(sha) // the preserved original's true byte identity
    expect(withIngest.payload_hash).not.toBe(noIngest.payload_hash) // identity participates in the manufacturing hash
  })

  it('G1: records the artwork pan/zoom transform int-micro + it changes the manufacturing hash', () => {
    const p = prepared(squareShape())
    const plain = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    const moved = buildApprovedEffectPayload(p, {
      type: 'standard', size: 's70',
      artworkTransform: { panX: 0.25, panY: -0.1, zoom: 2 },
    })
    expect(plain.artwork.transform.pan).toBeNull()
    expect(plain.artwork.transform.zoom_micro).toBeNull()
    expect(moved.artwork.transform.pan).toEqual({ x_micro: 250_000, y_micro: -100_000 })
    expect(moved.artwork.transform.zoom_micro).toBe(2_000_000)
    expect(moved.payload_hash).not.toBe(plain.payload_hash)
  })

  it('hash carries NO commerce fields (mock pricing removed, Dan s59/P2) + quantizes residual floats to int-micro (F3)', () => {
    const out = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    const body = canonicalHashBody(out)
    expect(JSON.stringify(body)).not.toContain('price_multiplier')
    expect('price_multiplier' in out.size).toBe(false) // the field itself is gone, not just hash-excluded
    expect('scale' in body.size).toBe(false)
    // centered 72%-side square: 72px·0.7 = 50.4mm → band scale 70/50.4 = 1.3888… → int-micro
    expect(body.size.scale_micro).toBe(1_388_889)
    expect(body.artwork.source_px_to_shape_mm_micro).toBe(700_000)
  })

  it('canonical hash body is FULLY FLOAT-FREE — every number is an integer (TD3 test-ENFORCED)', () => {
    const out = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    expect(nonIntegerNumbers(canonicalHashBody(out))).toEqual([])
  })

  it('records the chosen attachment {system, result_hash} + rides in the hash (§8.5b/§11)', () => {
    const p = prepared(squareShape())
    const none = buildApprovedEffectPayload(p, { type: 'standard', size: 's70' })
    const mag = buildApprovedEffectPayload(p, { type: 'standard', size: 's70', attachment: 'magnet' })
    expect(none.attachment.system).toBe(null)
    expect(mag.attachment.system).toBe('magnet')
    expect(mag.payload_hash).not.toBe(none.payload_hash)
    expect(nonIntegerNumbers(canonicalHashBody(mag))).toEqual([])
  })

  it('GOLDEN: pins vectorShapeHash(square) — the vector F1 remix↔mfg bond anchor', () => {
    // build.vector_shape_hash is what the F1 bond compares against (persistence). Pin it
    // INDEPENDENTLY of payload_hash so a silent vectorShapeHash algorithm drift is caught
    // cross-deploy — exactly the role outlineDocumentHash's golden played in the doc era.
    expect(vectorShapeHash(squareShape())).toBe('56d51f18a5e6285e')
    const out = buildApprovedEffectPayload(prepared(squareShape()), { type: 'standard', size: 's70' })
    expect(out.build.vector_shape_hash).toBe(vectorShapeHash(squareShape()))
  })
})
