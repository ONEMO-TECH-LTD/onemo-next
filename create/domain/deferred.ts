/**
 * Deferred domain objects — schema-defined but not implemented for MVP.
 * These exist so the type system knows about them and the architecture
 * can reference them without building the full implementation.
 *
 * CM-006: ShareArtifact
 * CM-007: CartPayload
 * CM-008: OwnedEffect
 * CM-009: Collection
 * CM-010: PublishedProduct
 *
 * Derived from: Opus UX chain 11a-content-models-domain
 */
import { z } from "zod"

// CM-006: ShareArtifact — point-in-time shareable representation of a creation
export const ShareArtifactSchema = z.object({
  share_id: z.string().uuid(),
  session_id: z.string().uuid(),
  preview_capture_url: z.string().url(),
  creation_stage: z.enum(["configured", "previewed", "purchased"]),
  share_status: z.enum(["generating", "ready", "delivered", "failed"]),
  configuration_summary: z.record(z.string(), z.unknown()),
  commerce_link_ref: z.string().nullable(), // post-mvp
  created_at: z.string().datetime(),
})
export type ShareArtifact = z.infer<typeof ShareArtifactSchema>

// CM-007: CartPayload — one-way projection to Shopify commerce
export const CartPayloadSchema = z.object({
  cart_id: z.string().nullable(),
  session_id: z.string().uuid(),
  variant_id: z.string(),
  custom_attributes: z.record(z.string(), z.unknown()),
  checkout_url: z.string().url().nullable(),
  handoff_status: z.enum(["pending", "created", "checkout_started", "failed"]),
  created_at: z.string().datetime(),
})
export type CartPayload = z.infer<typeof CartPayloadSchema>

// CM-008: OwnedEffect — immutable post-purchase record with authorship attribution
export const OwnedEffectSchema = z.object({
  effect_id: z.string().uuid(),
  owner_identity: z.string(),
  source_session_id: z.string().uuid(),
  order_id: z.string().nullable(),
  configuration_snapshot: z.record(z.string(), z.unknown()),
  preview_url: z.string().url(),
  authorship_context: z.object({
    story: z.string().optional(),
    created_at: z.string().datetime(),
    cultural_value: z.string().optional(),
  }),
  acquisition_path: z.enum(["custom_creation", "time_sensitive_acquisition"]),
  acquired_at: z.string().datetime(),
})
export type OwnedEffect = z.infer<typeof OwnedEffectSchema>

// CM-009: Collection — persistent personal collection of owned Effects
export const CollectionSchema = z.object({
  collection_id: z.string().uuid(),
  owner_identity: z.string(),
  curation_state: z.record(z.string(), z.unknown()).nullable(),
  last_updated_at: z.string().datetime(),
})
export type Collection = z.infer<typeof CollectionSchema>

// CM-010: PublishedProduct — Creator-Seller publication (entirely post-mvp)
export const PublishedProductSchema = z.object({
  publication_id: z.string().uuid(),
  source_session_id: z.string().uuid(),
  shopify_product_id: z.string().nullable(),
  creator_identity: z.string(),
  publication_status: z.enum(["publishing", "published", "failed"]),
  iteration_source_ref: z.string().uuid().nullable(),
  published_at: z.string().datetime().nullable(),
})
export type PublishedProduct = z.infer<typeof PublishedProductSchema>
