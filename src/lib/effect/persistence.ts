// persistence.ts — the saved-effect model: an EditableRecipe + a LockedPayload, bound by F1 (§8.7a / §11).
//
// REBUILD-PLAN-v2 §B4 — VECTOR-NATIVE. A saved effect is TWO bound artifacts:
//   • EditableRecipe  — the REMIX substrate: THE vector truth (`vectorShape`) a return-visit /
//                       shared link edits, plus optional re-derivation inputs in uiMeta.
//   • LockedPayload   — the manufacturing + proof truth (the ApprovedEffectPayload from §8.6).
//
// F1 BOND (§1/§11): the recipe's vector truth MUST be the geometry that was manufactured. Asserted
// at save via canonical identity — vectorShapeHash(recipe.vectorShape) must equal the payload's
// recorded `build.vector_shape_hash` — so a remix always edits the design that was ACTUALLY made,
// never a drifted copy. Same fail-closed guarantee as the doc-era replay bond, ONE truth.
//
// NOTE (Dan ruling, plan v2.1): the save UI/flow is ERASED this wave — these modules are pure
// contract code with no surface, kept correct so the future save/library round builds on them.
//
// PURE — no Supabase/Cloudinary at runtime. `toDesignRow` returns a plain object shaped for a
// `designs` INSERT (it does NOT touch the DB); the actual upload/insert + auth + library UI are §8.7b.

import type { VShape } from '@/lib/vector-core'
import { vectorShapeHash } from './geometry-truth'
import type { ApprovedEffectPayload } from './payload'
import type { EffectType } from './effect-types'
import type { EffectSize } from './sizes'

// ── model ─────────────────────────────────────────────────────────────────────
/** The remix substrate — procedural intent, vector-native. */
export interface EditableRecipe {
  /** THE geometry truth a remix edits (mask px, y-down — the editor's space). */
  vectorShape: VShape
  /** optional re-derivation inputs (e.g. {fairing, rawTracePx} so a remix can re-Tune). */
  uiMeta?: Record<string, unknown>
}

/** A saved design: the editable recipe + the locked manufacturing/proof payload + light meta. */
export interface SavedEffect {
  editableRecipe: EditableRecipe
  lockedPayload: ApprovedEffectPayload
  meta: {
    effectType: EffectType
    size: EffectSize
    /** ISO string stamped by the CALLER (this module is pure — no Date.now). */
    createdAtRef?: string
  }
}

// ── F1 bond ─────────────────────────────────────────────────────────────────────
export class F1MismatchError extends Error {
  expectedHash: string
  actualHash: string
  constructor(expectedHash: string, actualHash: string) {
    super(
      `F1 bond broken: the recipe's vector truth does not match the LockedPayload geometry ` +
        `(expected vector_shape_hash ${expectedHash}, recipe hashes to ${actualHash}). The recipe ` +
        `and the manufactured shape have diverged — refusing to save (a remix would edit a design ` +
        `that was never made).`,
    )
    this.name = 'F1MismatchError'
    this.expectedHash = expectedHash
    this.actualHash = actualHash
  }
}

/**
 * THE remix↔manufacturing bond (§1/§11), vector-native: the recipe's canonical vector identity must
 * equal the identity hashed into the LockedPayload (`build.vector_shape_hash`). Throws
 * `F1MismatchError` (fail-closed) on divergence. Call at SAVE time, before persisting.
 */
export function bindF1(recipe: EditableRecipe, lockedPayload: ApprovedEffectPayload): void {
  const expectedHash = lockedPayload.build.vector_shape_hash
  const actualHash = vectorShapeHash(recipe.vectorShape)
  if (actualHash !== expectedHash) throw new F1MismatchError(expectedHash, actualHash)
}

/** Assemble a SavedEffect, asserting the F1 bond first (never bundle a recipe that doesn't match the payload). */
export function makeSavedEffect(
  editableRecipe: EditableRecipe,
  lockedPayload: ApprovedEffectPayload,
  meta: SavedEffect['meta'],
): SavedEffect {
  bindF1(editableRecipe, lockedPayload) // fail-closed
  return { editableRecipe, lockedPayload, meta }
}

// ── serialize / deserialize (deterministic JSON round-trip) ─────────────────────
export function serializeSavedEffect(saved: SavedEffect): string {
  return JSON.stringify(saved)
}
export function deserializeSavedEffect(json: string): SavedEffect {
  return JSON.parse(json) as SavedEffect
}

// ── designs-row mapping (PURE — shapes an INSERT object; does NOT touch the DB) ──
/** A lightweight render projection for library cards (avoids deserializing the full recipe/payload to list). */
export interface EffectSpecProjection {
  effectType: EffectType
  size: EffectSize
  payload_hash: string
  final_bbox: ApprovedEffectPayload['size']['final_bbox']
}

export interface DesignRowInsert {
  user_id: string
  title: string
  cloudinary_asset_id: string | null
  cloudinary_public_preview_url: string | null
  is_public: boolean
  remixed_from_id: string | null
  // §8.7a new jsonb columns (migration 003) — the two bound truths + a card projection:
  editable_recipe: EditableRecipe
  locked_payload: ApprovedEffectPayload
  effect_spec: EffectSpecProjection
}

export interface ToDesignRowOptions {
  userId: string
  title: string
  cloudinaryAssetId?: string | null
  cloudinaryPreviewUrl?: string | null
  isPublic?: boolean
  remixedFromId?: string | null
}

/** Map a SavedEffect → a `designs` INSERT object. Pure: returns the row, performs NO DB write. */
export function toDesignRow(saved: SavedEffect, opts: ToDesignRowOptions): DesignRowInsert {
  return {
    user_id: opts.userId,
    title: opts.title,
    cloudinary_asset_id: opts.cloudinaryAssetId ?? null,
    cloudinary_public_preview_url: opts.cloudinaryPreviewUrl ?? null,
    is_public: opts.isPublic ?? false,
    remixed_from_id: opts.remixedFromId ?? null,
    editable_recipe: saved.editableRecipe,
    locked_payload: saved.lockedPayload,
    effect_spec: {
      effectType: saved.meta.effectType,
      size: saved.meta.size,
      payload_hash: saved.lockedPayload.payload_hash,
      final_bbox: saved.lockedPayload.size.final_bbox,
    },
  }
}

/** A `designs` row as read back (the columns this module reads). */
export interface DesignRowRead {
  editable_recipe: EditableRecipe
  locked_payload: ApprovedEffectPayload
  effect_spec: EffectSpecProjection
  created_at?: string
}

/** Reconstruct a SavedEffect from a stored `designs` row (load / remix). */
export function fromDesignRow(row: DesignRowRead): SavedEffect {
  return {
    editableRecipe: row.editable_recipe,
    lockedPayload: row.locked_payload,
    meta: {
      effectType: row.effect_spec.effectType,
      size: row.effect_spec.size,
      ...(row.created_at !== undefined ? { createdAtRef: row.created_at } : {}),
    },
  }
}
