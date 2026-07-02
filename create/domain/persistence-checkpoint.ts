/**
 * CM-004: PersistenceCheckpoint
 *
 * Restorable save point that captures full DesignSession state for session
 * resilience. Covers both explicit user saves and auto-persist checkpoints
 * at meaningful moments (ungraceful exits, debounced writes).
 *
 * Derived from: Opus UX chain 11a-content-models-domain (CM-004)
 * Owner: Supabase
 */
import { z } from "zod"
import { DesignSessionSchema } from "./design-session"

export const PersistenceCheckpointSchema = z.object({
  /** Identifier for this checkpoint. Multiple checkpoints may exist per session. */
  checkpoint_id: z.string().uuid(),

  /** Reference to the DesignSession this checkpoint captures. */
  session_id: z.string().uuid(),

  /** Whether triggered by explicit user save or system auto-persist. */
  checkpoint_type: z.enum(["explicit", "auto"]),

  /** Complete restorable state — sufficient to rebuild DesignSession without re-doing steps. */
  session_snapshot: DesignSessionSchema,

  /** When this checkpoint was written. */
  checkpointed_at: z.string().datetime(),

  /** When this checkpoint was last used to restore a session. Null if never restored. */
  restored_at: z.string().datetime().nullable(),
})

export type PersistenceCheckpoint = z.infer<typeof PersistenceCheckpointSchema>
