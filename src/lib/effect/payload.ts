// payload.ts — the immutable ApprovedEffectPayload / LockedPayload (lean-spec §11).
//
// Built at APPROVE: a content-addressed manufacturing + proof record derived from a PreparedEffect +
// the customer's size band + trim/appearance. GATED by the MANDATORY client-side feasibility check
// (§1) so an uncuttable shape can NEVER be hashed/approved. Pure + deterministic: int-micron geometry
// + canonical (sorted-key) serialization → a stable `payload_hash` (outline-core contentHash). This is
// the LockedPayload half of persistence (§8.7 stores it next to the EditableRecipe, bound by F1).
//
// Raster identity: the artwork hashes are RECIPE hashes — deterministic from the composite's inputs
// (composeFront is deterministic), keeping this builder PURE (no canvas pixel read, node-testable).
// A true pixel-level raster hash + a real image-content hash are production hardenings (see NOTES).

import type { PreparedEffect } from './prepare-effect'
import { EFFECT_BUILD_CONFIG } from './prepare-effect'
import type { EffectType } from './effect-types'
import { EFFECT_SIZES, BASE_LONGEST_SIDE_MM, toFinalPhysicalMm, type EffectSize, type FinalBBox } from './sizes'
import { validateAttachment, type AttachmentSystem } from './attachment'
import type { Contour, Pt } from './types'
import { contentHash, stableStringify, normalizeRing } from '@/lib/outline-core'
// REBUILD-PLAN-v2 §B4: feasibility + identity derive from the SINGLE vector truth — the doc model
// is gone from the save path (no resolve, no outlineDocumentHash).
import { assertContourCuttable, vectorShapeHash } from './geometry-truth'

const VECTOR_CORE_VERSION = '1' // vector-core kernel version (the truth's model version)
// Canonical-hash schema version. Bump INTENTIONALLY whenever the hashed shape changes (and update the
// golden-hash test) — that makes a deliberate change explicit and a SILENT one (a refactor quietly
// altering every saved design's manufacturing identity + the F1 remix↔mfg bond) a caught regression.
// v2 (V3 build): artwork.transform records the G1 pan/zoom as int-micro.
// v3 (REBUILD-PLAN-v2, single geometry truth): the recipe/payload contract is VECTOR-NATIVE —
// `build.vector_shape_hash` (canonical VShape identity) replaces `outline_document_hash`;
// feasibility runs on the truth-derived contour. No OutlineDocument survives in the save path.
const SCHEMA_VERSION = 3
const MICRO = 1_000_000 // quantize residual float ratios to integer micro-units for the canonical hash

// ── inputs ───────────────────────────────────────────────────────────────────
export interface TrimSelection {
  surfaceColor?: string
  edgeColor?: string
  backgroundColor?: string
  material?: string
}
export interface AppearanceSelection {
  material?: string
  edgeProfile?: { radiusMm: number }
}
/** G1: the artwork pan/zoom the user set (page design-state) — recorded in the payload so the
 *  manufactured front is positioned exactly as approved. Quantized to int micro-units at record time
 *  (the canonical hash body is float-free — the float-walk test enforces it). */
export interface ArtworkTransform {
  panX: number // -1..1 (fraction of the shape box)
  panY: number
  zoom: number // 1..4
}

export interface BuildPayloadOptions {
  type: EffectType
  size: EffectSize
  trim?: TrimSelection
  appearance?: AppearanceSelection
  attachment?: AttachmentSystem // §8.5b — magnet | velcro (validated on the final-physical-mm)
  artworkTransform?: ArtworkTransform // G1 — pan/zoom of the photo within the shape
}

// ── feasibility (§1) ───────────────────────────────────────────────────────────
export interface FeasibilityResult {
  ok: boolean
  reason?: string
}

export class EffectNotCuttableError extends Error {
  feasibility: FeasibilityResult
  constructor(feasibility: FeasibilityResult) {
    super(`Effect not cuttable: ${feasibility.reason ?? 'feasibility failed'}`)
    this.name = 'EffectNotCuttableError'
    this.feasibility = feasibility
  }
}

/**
 * MANDATORY client-side feasibility gate (§1). An uncuttable shape (self-intersection / collapse)
 * can never be approved/hashed. Runs ring-math checks on the SAME manufacturing contour that gets
 * hashed (`spec.geometryMM`, derived from the vector truth) — one geometry, one verdict.
 * (Min-neck / no-thin-spike is a production add — NOTE.)
 */
export function assertCuttable(prepared: PreparedEffect): FeasibilityResult {
  const { spec } = prepared
  const verdict = assertContourCuttable(spec.geometryMM, spec.mmPerPx)
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason === 'degenerate' ? 'degenerate/collapsed outline' : 'self-intersection' }
  }
  return { ok: true }
}

// ── int-micron geometry (no float drift in the canonical hash) ─────────────────
type IntRing = Array<[number, number]>
function toMicronRing(pts: ReadonlyArray<Pt>): IntRing {
  return pts.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)] as [number, number])
}

// ── the payload schema (§11 — full target) ─────────────────────────────────────
export interface ApprovedEffectPayload {
  version: 1
  schema_version: number // canonical-hash schema version (F2) — see SCHEMA_VERSION
  source: { image_hash: string; dims: { widthPx: number; heightPx: number }; color_space: string; exif: 'baked' }
  geometry: {
    base_shape_mm: { outer: IntRing; holes: IntRing[] }
    final_physical_mm: {
      outer: IntRing
      holes: IntRing[]
      units: 'microns'
      winding: 'outer-ccw/holes-cw'
      fill_rule: 'nonzero'
    }
  }
  size: {
    base: string
    band_id: EffectSize
    longest_side_mm: number
    scale: number
    price_multiplier: number
    final_bbox: FinalBBox
  }
  artwork: {
    composeFront_recipe_hash: string
    source_px_to_shape_mm: number
    /** G1 — the approved pan/zoom, already int-micro quantized (the hash body is float-free). */
    transform: { crop: null; pan: { x_micro: number; y_micro: number } | null; zoom_micro: number | null }
    front_raster_hash: string
    edge_raster_hash: string
  }
  appearance: {
    material: string
    thickness_mm: number
    edge_profile: { radiusMm: number }
    trim: TrimSelection
  }
  attachment: { system: string | null; template?: string | null; result_hash?: string } // §8.5b
  gates: { profile_hash: string; result_hash: string; blocking: number }
  build: { vector_core_version: string; vector_shape_hash: string; config_hash: string; generator: EffectSpecGenerator }
  payload_hash: string
}

type EffectSpecGenerator = PreparedEffect['spec']['generator']

/**
 * The canonical MANUFACTURING-identity subset that `payload_hash` is computed over (F3). It deliberately
 * differs from the full record in two ways, both load-bearing:
 *  • EXCLUDES commerce — `size.price_multiplier` is dropped, so the SAME physical effect at a different
 *    price yields the SAME manufacturing hash (price is not a manufacturing fact).
 *  • FULLY FLOAT-FREE — EVERY residual mm / unit-ratio is quantized to integer micro-units (§11
 *    "integer microns, no floats"): `size.{scale, longest_side_mm, final_bbox}`,
 *    `artwork.source_px_to_shape_mm`, `appearance.{thickness_mm, edge_profile.radiusMm}`. Geometry is
 *    already int-micron. So sub-micron float drift (a refactor / a non-JS re-hash / a platform) can't
 *    silently change a saved design's identity or the F1 remix↔mfg bond.
 * The `payload.test.ts` float-walk asserts every number in this body is an integer, so a FUTURE float
 * field (e.g. an SDF-blend `t` in a richer generator) is a CAUGHT regression, not a silent identity drift.
 * `stableStringify` sorts keys, so field order / key names here only need to be STABLE, not pretty.
 */
export function canonicalHashBody(p: ApprovedEffectPayload) {
  const q = (n: number) => Math.round(n * MICRO) // mm / unit-ratio → integer micro-units
  const { price_multiplier, scale, longest_side_mm, final_bbox, ...sizeRest } = p.size
  void price_multiplier // commerce is deliberately EXCLUDED from the manufacturing-identity hash
  const { source_px_to_shape_mm, ...artworkRest } = p.artwork
  const { thickness_mm, edge_profile, ...appearanceRest } = p.appearance
  return {
    schema_version: p.schema_version,
    version: p.version,
    source: p.source,
    geometry: p.geometry, // already int-micron rings
    size: {
      ...sizeRest, // base, band_id (strings)
      longest_side_um: q(longest_side_mm),
      scale_micro: q(scale),
      final_bbox_um: {
        width: q(final_bbox.widthMm), height: q(final_bbox.heightMm),
        minX: q(final_bbox.minXMm), minY: q(final_bbox.minYMm),
      },
    },
    artwork: { ...artworkRest, source_px_to_shape_mm_micro: q(source_px_to_shape_mm) },
    appearance: {
      ...appearanceRest, // material (string) + trim (string fields)
      thickness_um: q(thickness_mm),
      edge_profile_um: { radius: q(edge_profile.radiusMm) },
    },
    attachment: p.attachment,
    gates: p.gates,
    build: p.build,
  }
}

/**
 * Build the immutable ApprovedEffectPayload (= the LockedPayload). Feasibility-gated (§1): throws
 * EffectNotCuttableError for an uncuttable shape, so a beautiful-but-
 * uncuttable effect can never be hashed/approved. Deterministic: identical (prepared, opts) → identical
 * payload_hash (int-micron geometry + canonical sorted-key serialization).
 */
export function buildApprovedEffectPayload(prepared: PreparedEffect, opts: BuildPayloadOptions): ApprovedEffectPayload {
  // 1) MANDATORY feasibility gate FIRST — never hash an uncuttable shape.
  const feasibility = assertCuttable(prepared)
  if (!feasibility.ok) throw new EffectNotCuttableError(feasibility)

  const { spec } = prepared
  const band = EFFECT_SIZES[opts.size]
  const final = toFinalPhysicalMm(spec.geometryMM, opts.size)

  const normalizeContour = (c: Contour): { outer: IntRing; holes: IntRing[] } => ({
    outer: toMicronRing(normalizeRing(c.outer.pts, 'outer')),
    holes: c.holes.map((h) => toMicronRing(normalizeRing(h.pts, 'hole'))),
  })

  const source = {
    image_hash: spec.sourceBytesSha256 ?? contentHash(spec.sourceRef), // true byte identity when ingest succeeded (ref-hash fallback keeps fixtures pure)
    dims: { widthPx: spec.maskWidthPx, heightPx: spec.maskHeightPx },
    color_space: 'srgb',
    exif: 'baked' as const,
  }

  const geometry = {
    base_shape_mm: normalizeContour(spec.geometryMM),
    final_physical_mm: {
      ...normalizeContour(final.geometry),
      units: 'microns' as const,
      winding: 'outer-ccw/holes-cw' as const,
      fill_rule: 'nonzero' as const,
    },
  }

  const size = {
    base: `${BASE_LONGEST_SIDE_MM}mm`,
    band_id: opts.size,
    longest_side_mm: band.longestSideMm,
    scale: final.scale,
    price_multiplier: band.priceMultiplier,
    final_bbox: final.finalBBox,
  }

  // Recipe identity for the magic-blend composite (deterministic from these inputs).
  const artworkRecipe = {
    sourceRef: spec.sourceRef,
    type: opts.type,
    defaultBlurPx: prepared.frontSrc.defaultBlurPx,
    dims: source.dims,
    adapter: spec.generator.adapter,
  }
  // G1: record the approved artwork pan/zoom, quantized to int micro-units AT RECORD TIME so the
  // canonical hash body stays float-free (the float-walk test enforces this).
  const qMicro = (n: number) => Math.round(n * MICRO)
  const t = opts.artworkTransform
  const isIdentity = !t || (t.panX === 0 && t.panY === 0 && t.zoom === 1)
  const artwork = {
    composeFront_recipe_hash: contentHash(stableStringify(artworkRecipe)),
    source_px_to_shape_mm: spec.mmPerPx,
    transform: isIdentity
      ? { crop: null, pan: null, zoom_micro: null }
      : { crop: null, pan: { x_micro: qMicro(t.panX), y_micro: qMicro(t.panY) }, zoom_micro: qMicro(t.zoom) },
    front_raster_hash: contentHash(stableStringify({ ...artworkRecipe, layer: 'front' })),
    edge_raster_hash: contentHash(stableStringify({ ...artworkRecipe, layer: 'edge' })),
  }

  const appearance = {
    material: opts.appearance?.material ?? opts.trim?.material ?? 'suede',
    thickness_mm: spec.dimensions.thicknessBodyMM,
    edge_profile: opts.appearance?.edgeProfile ?? { radiusMm: spec.dimensions.edgeRadiusMM },
    trim: opts.trim ?? {},
  }

  // §8.5b: validate the chosen attachment on the FINAL-physical-mm (size-dependent, §11-A3) and record
  // {system, template, result_hash}. The UI gates approval on validateAttachment(...).ok (§11-A9 failure
  // flow); cuttability stays the separate hard gate. No attachment selected → {system:null} (unchanged).
  const attachmentResult = opts.attachment ? validateAttachment(final.geometry, opts.attachment) : null
  const attachment: ApprovedEffectPayload['attachment'] = attachmentResult
    ? { system: attachmentResult.system, template: null, result_hash: attachmentResult.result_hash }
    : { system: null }

  const gates = {
    profile_hash: contentHash(stableStringify({ feasibility: 'geometry-truth/assertContourCuttable@v1' })),
    result_hash: contentHash(stableStringify({ ok: true, blocking: 0 })),
    blocking: 0,
  }

  const build = {
    vector_core_version: VECTOR_CORE_VERSION,
    // the vector F1 bond key: canonical identity of THE geometry truth (recipe must match it)
    vector_shape_hash: vectorShapeHash(spec.vectorShape),
    config_hash: contentHash(stableStringify(EFFECT_BUILD_CONFIG)),
    generator: spec.generator,
  }

  // The full record (commerce + display included). The manufacturing IDENTITY hash, however, is computed
  // over the CANONICAL subset (canonicalHashBody): commerce excluded + residual floats quantized (F3).
  const record = { version: 1 as const, schema_version: SCHEMA_VERSION, source, geometry, size, artwork, appearance, attachment, gates, build }
  // contentHash = cyrb53 → a 16-hex digest. The 16-hex width is INTENTIONAL (F4): deterministic +
  // cross-platform (no crypto/BigInt), ample space for a per-design identity. An identity/integrity
  // hash, not a security hash.
  const payload_hash = contentHash(stableStringify(canonicalHashBody({ ...record, payload_hash: '' })))
  return { ...record, payload_hash }
}
