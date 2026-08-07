// node-override — Dan priority 2: the few-nodes editing system as an OVERRIDE UNIT ("better to
// have a module override unit so we dont overwrite original bridge or engine code"). v1's skeleton
// fit was ADDITIONAL to the engine's dense tracing, and its fallback was the slop Dan caught: when
// the fit failed it returned the RAW dense shape — the million-node edge case. This unit fixes
// exactly that ONE defect: the anchor budget is GUARANTEED — the fit escalates tolerance until it
// lands inside the budget, and the raw dense shape is NEVER what the user edits. All math beneath
// is the engine's own (ringToVPath fitter, resampleClosedUniform) via vector-edit — verbatim v1
// otherwise. Engine and bridge untouched: this wraps presentation of nodes, nothing else.

import { flattenShape, ringToVPath, type VShape } from '@/lib/vector-core'
import { resampleClosedUniform, type Vec2Px } from '@/lib/outline-core'

/** Finger-editable anchor budget (v1's fit typically landed 8–24 anchors on real cutouts). */
export const NODE_BUDGET = { min: 3, max: 48 } as const

/** EDIT-GRADE SKELETON with a GUARANTEED budget (the v1 defect fix): the engine's fitter reduces
 *  any resolved outline to sparse anchors with curve handles. v1 escalation order preserved
 *  (corner-pin 60°, tolerance 1% of short side) — but on a miss the tolerance DOUBLES and the
 *  corner pin relaxes until the fit lands within budget. The dense raw shape is never returned;
 *  the terminal fallback is a uniform decimation to the budget (still edit-grade, never 10⁶ nodes). */
export function skeletonShape(shape: VShape): VShape {
  const flat = (flattenShape(shape, 0.5)[0] ?? []).map((q) => [q.x, q.y] as Vec2Px)
  if (flat.length < 3) return shape // degenerate input — nothing to skeletonize
  let perim = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i], b = flat[(i + 1) % flat.length]
    perim += Math.hypot(b[0] - a[0], b[1] - a[1])
    if (a[0] < minX) minX = a[0]; if (a[0] > maxX) maxX = a[0]
    if (a[1] < minY) minY = a[1]; if (a[1] > maxY) maxY = a[1]
  }
  const dense = resampleClosedUniform(flat, Math.max(2, perim / 500)).map(([x, y]) => ({ x, y }))
  const tol0 = Math.max(2, Math.min(maxX - minX, maxY - minY) * 0.01)
  // v1 first attempt (60° corner pin, 1% tol) → escalate: tol ×2 each round, pin relaxed after 2
  for (let round = 0, tol = tol0; round < 6; round++, tol *= 2) {
    const fitted = ringToVPath(dense, round < 2 ? 60 : 0, tol)
    const n = fitted.anchors.length
    if (n >= NODE_BUDGET.min && n <= NODE_BUDGET.max) return { paths: [fitted] }
  }
  // TERMINAL: uniform decimation to the budget — edit-grade corners, never the raw dense ring
  const step = Math.max(1, Math.floor(dense.length / NODE_BUDGET.max))
  const anchors = dense.filter((_, i) => i % step === 0).slice(0, NODE_BUDGET.max)
    .map((p) => ({ p, hIn: null, hOut: null, corner: true }))
  return anchors.length >= NODE_BUDGET.min ? { paths: [{ anchors }] } : shape
}

/** COMMIT SEMANTICS (v1 editCommit, as data — the adopting driver executes): the first real edit
 *  FOLDS the knob recipe into the edited base (knobs rebase to zero and read from the new shape);
 *  the mask rebuilds from the edited shape (mask ≡ shape by construction — the guard bypass that
 *  is safe by geometry); the matte re-prepares through the engine, last-edit-wins. */
export interface NodeCommitPlan {
  rebaseKnobsToZero: boolean // true when any knob is non-zero at commit time
  ring: { x: number; y: number }[]
}
export function nodeCommitPlan(next: VShape, knobsAreZero: boolean): NodeCommitPlan {
  const ring = (flattenShape(next, 0.5)[0] ?? []).map((p) => ({ x: p.x, y: p.y }))
  return { rebaseKnobsToZero: !knobsAreZero, ring }
}
