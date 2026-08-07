// bridge-tool-commit — v1's acceptMask CONVERGENCE SEAM cloned clean (Dan 2026-08-07: clone the
// missing pool from v1, stripped of SAM/wand/compositor-clone logic). Every tool's result passes
// ONE gate with v1's device-proven protocol:
//   VALIDATE-BEFORE-COMMIT (E3): the engine prepare runs FIRST; state mutates ONLY on success —
//   a failed prepare (e.g. an erase that emptied the mask) keeps the last good selection live.
//   LAST-EDIT-WINS: async re-prepares carry a generation token; stale results drop.
//   LOUD TRUTH: every outcome is a typed code the shell maps to copy — no silent degradation.
// Cleaned out (v1 had them, they die): preseg-verbatim SAM commentary, hole-guard era branches,
// the lab's own compositor hooks. ONE-HISTORY LAW: the committed state enters the BRIDGE's
// state/history (a second lab-side history is forbidden — ADDONS.md conflict ruling).

import type { Mask } from '@/lib/tool-paint-math/types'

/** Injected engine prepare — engine-matte-input.prepareAI (paint) or the bridge's own preseg path.
 *  MUST throw on failure; the seam converts throws into 'kept' outcomes. */
export type PrepareFn<P> = (mask: Mask) => Promise<P>

export type CommitOutcome<P> =
  | { kind: 'committed'; prepared: P; mask: Mask }         // engine accepted — commit the state
  | { kind: 'kept'; reason: string }                        // prepare failed — LAST GOOD SELECTION stays live
  | { kind: 'stale' }                                       // superseded by a newer commit (gen token)

/** The seam. Owns ONLY the protocol: validate → commit-or-keep → generation fencing. The caller
 *  (the adopting flow driver) owns state application and routes the committed state into the
 *  BRIDGE's session/history. */
export class ToolCommitSeam<P> {
  private gen = 0
  constructor(private prepare: PrepareFn<P>) {}

  /** supersede everything in flight (new upload / clear) */
  invalidate(): void { this.gen++ }

  async commit(mask: Mask): Promise<CommitOutcome<P>> {
    const g = ++this.gen
    let prepared: P
    try {
      prepared = await this.prepare(mask)
    } catch (e) {
      return { kind: 'kept', reason: String((e as Error)?.message ?? e) } // selection kept — v1 E3
    }
    if (g !== this.gen) return { kind: 'stale' } // last-edit-wins
    return { kind: 'committed', prepared, mask }
  }
}

/** WHOLE-STATE SNAPSHOT CONTRACT (v1 meta-B3, the knobs-lost-on-undo fix): whatever history the
 *  bridge keeps, a tool commit must snapshot ALL of this together — undo restores the knobs too.
 *  Exported as a TYPE so the adopting increment cannot forget a field silently. */
export interface ToolSnapshot<Knobs, Blend> {
  mask: Mask | null
  drawnRing: { x: number; y: number }[] | null
  knobs: Knobs
  blend: Blend
}
