/**
 * Create Module — Domain Schemas
 *
 * 10 content model objects derived from the Opus UX chain (11a-content-models-domain).
 * 5 MVP objects with full implementation. 5 deferred objects as type stubs.
 *
 * Ownership boundaries:
 * - Supabase: DesignSession, ImageSource, PersistenceCheckpoint, ShareArtifact, OwnedEffect, Collection
 * - Shopify: ProductVariantContext (read-only)
 * - Next.js client: PreviewRender (transient, session-scoped)
 * - Shopify + Next.js: CartPayload (derived, one-way projection)
 */

// MVP objects (full implementation)
export { DesignSessionSchema, type DesignSession } from "./design-session"
export { ImageSourceSchema, type ImageSource } from "./image-source"
export { PreviewRenderSchema, type PreviewRender } from "./preview-render"
export { PersistenceCheckpointSchema, type PersistenceCheckpoint } from "./persistence-checkpoint"
export { ProductVariantContextSchema, type ProductVariantContext } from "./product-variant-context"

// Deferred objects (type stubs)
export {
  ShareArtifactSchema,
  type ShareArtifact,
  CartPayloadSchema,
  type CartPayload,
  OwnedEffectSchema,
  type OwnedEffect,
  CollectionSchema,
  type Collection,
  PublishedProductSchema,
  type PublishedProduct,
} from "./deferred"
