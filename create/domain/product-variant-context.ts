/**
 * CM-005: ProductVariantContext
 *
 * Commerce product and variant truth from Shopify. Provides the variant grammar
 * axes that configuration selections must map to, plus pricing and availability.
 * The application reads this data but never authors it — Shopify is the system
 * of record for commerce truth.
 *
 * Derived from: Opus UX chain 11a-content-models-domain (CM-005)
 * Owner: Shopify (read-only from Create's perspective)
 */
import { z } from "zod"

export const ProductVariantContextSchema = z.object({
  /** Shopify product identifier. */
  product_id: z.string(),

  /** Shopify variant identifier for the currently selected combination. Null when incomplete. */
  variant_id: z.string().nullable(),

  /** Available options across size, face_material, trim_back_colour, attachment_system axes. */
  variant_axes: z.object({
    size: z.array(z.object({ id: z.string(), label: z.string(), available: z.boolean() })),
    face_material: z.array(z.object({ id: z.string(), label: z.string(), available: z.boolean() })),
    trim_back_colour: z.array(z.object({ id: z.string(), label: z.string(), available: z.boolean() })),
    attachment_system: z.array(z.object({ id: z.string(), label: z.string(), available: z.boolean() })).optional(),
  }),

  /** Current availability for the selected or browsed variant. */
  availability_state: z.enum(["available", "limited", "unavailable"]).nullable(),

  /** Current price for the resolved variant. Always read from Shopify at the moment of use. */
  price: z
    .object({
      amount: z.string(),
      currency_code: z.string(),
    })
    .nullable(),

  /** When availability and price were last fetched from Shopify. */
  last_checked_at: z.string().datetime().nullable(),
})

export type ProductVariantContext = z.infer<typeof ProductVariantContextSchema>
