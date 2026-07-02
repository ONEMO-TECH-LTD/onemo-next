/**
 * CM-002: ImageSource
 *
 * The user's uploaded image after intake, validated for printability and stored
 * for rendering. Normalized through a single canonical intake contract that
 * accommodates future source types without pipeline change.
 *
 * Derived from: Opus UX chain 11a-content-models-domain (CM-002)
 * Owner: Supabase (record) + Cloudinary (asset)
 */
import { z } from "zod"

export const ImageSourceSchema = z.object({
  /** Stable identifier for this image source record. */
  image_id: z.string().uuid(),

  /** Reference to the owning DesignSession. One session has one active ImageSource at a time. */
  session_id: z.string().uuid(),

  /** Intake pathway: 'upload' at launch. Future: 'generation', 'connected_import', 'wallet_import'. */
  source_type: z.enum(["upload", "generation", "connected_import", "wallet_import"]),

  /** Cloudinary storage reference. Null while upload is in progress. */
  asset_url: z.string().url().nullable(),

  /** Image file format as validated during intake. */
  file_type: z.string(),

  /** Image width and height in pixels. */
  dimensions: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable(),

  /** Whether the image meets minimum resolution for print production quality. */
  resolution_sufficient: z.boolean().nullable(),

  /** Current validation state. Drives intake mode UI and error guidance. */
  validation_status: z.enum(["uploading", "validating", "valid", "invalid"]),

  /** Human-readable explanation of why the image passed or failed validation. */
  validation_reason: z.string().nullable(),

  /** When the image was successfully uploaded and stored. */
  uploaded_at: z.string().datetime().nullable(),
})

export type ImageSource = z.infer<typeof ImageSourceSchema>
