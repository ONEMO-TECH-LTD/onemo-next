/**
 * CM-001: DesignSession
 *
 * The central working design artifact for the Create module. Anchors session
 * lifecycle, image reference, all configuration selections, and progress position.
 * Every other Create object references or derives from it.
 *
 * Derived from: Opus UX chain 11a-content-models-domain (CM-001)
 * Owner: Supabase
 */
import { z } from "zod"

export const DesignSessionSchema = z.object({
  /** Stable unique identifier. Used as :designId URL parameter for resume/share/bookmark. */
  session_id: z.string().uuid(),

  /** Anonymous session identity or authenticated account identity. Anonymous merges on account creation. */
  owner_identity: z.string(),

  /** Reference to the active ImageSource (CM-002). Null before intake completes. */
  image_source_ref: z.string().uuid().nullable(),

  /** Image position, scale, orientation on the Effect's 3D surface. */
  placement_transform: z
    .object({
      offset_x_pct: z.number(),
      offset_y_pct: z.number(),
      scale_pct: z.number(),
      rotation_deg: z.number(),
      surface_id: z.string(),
      reconciled_at: z.string().datetime().optional(),
    })
    .nullable(),

  /** Current material selection from face_material variant axis. */
  selected_face_material: z.string().nullable(),

  /** Current trim/back colour selection. */
  selected_trim_back_colour: z.string().nullable(),

  /** Current finish selection. */
  selected_finish: z.string().nullable(),

  /** Current size selection — a commitment parameter. */
  selected_size: z.string().nullable(),

  /** Resolved Shopify variant ID for the current combination. Null when incomplete. */
  resolved_variant_id: z.string().nullable(),

  /** Flow step the user last reached. Determines active mode on entry/restoration. */
  progress_position: z.string(),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type DesignSession = z.infer<typeof DesignSessionSchema>
