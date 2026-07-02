/**
 * CM-003: PreviewRender
 *
 * The visual 3D rendering of the configured Effect, derived from DesignSession
 * state via React Three Fiber. Never the source of truth for configuration —
 * always re-derivable from DesignSession on restoration.
 *
 * Derived from: Opus UX chain 11a-content-models-domain (CM-003)
 * Owner: Next.js client (transient, session-scoped)
 */
import { z } from "zod"

export const PreviewRenderSchema = z.object({
  /** Session-scoped identifier. Not persisted across sessions. */
  render_id: z.string(),

  /** Reference to the DesignSession whose configuration produced this render. */
  session_id: z.string().uuid(),

  /** Exact configuration state used to produce this render. Enables staleness detection. */
  config_snapshot: z.record(z.string(), z.unknown()),

  /** Current render state. 'failed' triggers calm recovery. */
  render_status: z.enum(["rendering", "rendered", "failed"]),

  /** Available angle presets representing real-world wear perspectives. */
  multi_angle_views: z
    .array(
      z.object({
        angle_id: z.string(),
        label: z.string(),
        rendered: z.boolean(),
      })
    )
    .default([]),

  /** URL of a generated static image capture suitable for sharing. */
  shareable_capture_url: z.string().url().nullable(),

  /** Non-technical description of what went wrong when render_status is 'failed'. */
  error_context: z.string().nullable(),

  /** When the current render completed or failed. */
  rendered_at: z.string().datetime().nullable(),
})

export type PreviewRender = z.infer<typeof PreviewRenderSchema>
