// persistence.ts — the saved-effect model: an EditableRecipe + a LockedPayload, bound by F1 (§8.7a / §11).
//
// A saved effect is TWO bound artifacts:
//   • EditableRecipe  — the REMIX substrate: the OutlineDocument (baseSnapshot + canonical commands +
//                       generator + style) carries the procedural intent a return-visit / shared link edits.
//   • LockedPayload   — the manufacturing + proof truth (the ApprovedEffectPayload from §8.6).
//
// F1 BOND (§1/§11): resolve(EditableRecipe) MUST equal the manufactured geometry. We assert it at save via
// outline-core `assertReplayMatchesHash` against the payload's recorded `build.outline_document_hash`, so a
// remix always edits the design that was ACTUALLY made — never a drifted copy. You can't store only the
// recipe and derive the payload on demand: that derivation is the re-resolve compiler we deleted. So we
// store BOTH and F1 binds them.
//
// PURE — no Supabase/Cloudinary at runtime. `toDesignRow` returns a plain object shaped for a `designs`
// INSERT (it does NOT touch the DB); the actual upload/insert + auth + library/share UI are §8.7b.

import type { OutlineDocument, OutlineGenerator, ReplayEnv } from '@/lib/outline-core'
import { assertReplayMatchesHash } from '@/lib/outline-core'
import type { ApprovedEffectPayload } from './payload'
import type { EffectType } from './effect-types'
import type { EffectSize } from './sizes'

// ── model ─────────────────────────────────────────────────────────────────────
/** The remix substrate — procedural intent. The OutlineDocument carries baseSnapshot + commands + style. */
export interface EditableRecipe {
  outlineDocument: OutlineDocument
  generator?: OutlineGenerator
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
  cause?: unknown
  constructor(expectedHash: string, cause?: unknown) {
    super(
      `F1 bond broken: resolve(EditableRecipe) does not reproduce the LockedPayload geometry ` +
        `(expected outline_document_hash ${expectedHash}). The recipe and the manufactured shape have ` +
        `diverged — refusing to save (a remix would edit a design that was never made).`,
    )
    this.name = 'F1MismatchError'
    this.expectedHash = expectedHash
    this.cause = cause
  }
}

/**
 * THE remix↔manufacturing bond (§1/§11). Asserts that replaying the recipe's canonical command log over
 * its base snapshot reconstructs exactly the OutlineDocument that was approved/hashed into the
 * LockedPayload (`build.outline_document_hash`). Throws `F1MismatchError` (fail-closed) on divergence.
 * Call at SAVE time, before persisting.
 */
export function bindF1(recipe: EditableRecipe, lockedPayload: ApprovedEffectPayload): void {
  const doc = recipe.outlineDocument
  const env: ReplayEnv = {
    image: doc.image,
    mode: doc.mode,
    ...(doc.readonly !== undefined ? { readonly: doc.readonly } : {}),
  }
  const expectedHash = lockedPayload.build.outline_document_hash
  try {
    assertReplayMatchesHash(doc.baseSnapshot, doc.commands, expectedHash, env)
  } catch (cause) {
    throw new F1MismatchError(expectedHash, cause)
  }
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
