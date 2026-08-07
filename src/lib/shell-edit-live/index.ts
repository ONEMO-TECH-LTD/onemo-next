// shell-edit-live — v1's LIVE-DRAG EDIT presentation semantics cloned clean: what happens BETWEEN
// node-edit commits. Pure decisions/data for the shell + edit overlay; the commit itself goes
// through bridge-node-override (plan) + bridge-tool-commit (seam). Cloned from v1 flow
// enterEdit/editLive; nothing SAM/wand-era.

import type { VShape } from '@/lib/vector-core'
import { skeletonShape } from '@/lib/bridge-node-override'

/** ENTER EDIT — LAZY BAKE (v1, Dan 17:52): entering node/frame edit shows the edit-grade skeleton,
 *  but the vector recipe stays LIVE (knobs keep true values) until a REAL edit commits. The
 *  skeleton is built once per shape identity — re-entering edit on the same shape reuses it. */
export function enterEditShape(current: VShape, lastEdited: VShape | null): VShape {
  return lastEdited === current ? current : skeletonShape(current)
}

/** LIVE DRAG — GLUED ANCHORS (v1 §: the overlay's anchors must ride the line): every drag frame
 *  updates shape + path TOGETHER so the handles never detach from the outline. Pure data-pairing;
 *  the shell applies both in the same frame. `toPathD` is injected (tool-node-math.shapePathD). */
export function editLiveFrame(next: VShape, toPathD: (s: VShape) => string): { shape: VShape; d: string } {
  return { shape: next, d: toPathD(next) }
}

/** Node modes (v1, Dan: add/delete are SELECTED modes; default = drag — tap-to-insert must never
 *  fire while grabbing a node). Data the shell renders chips from. */
export type NodeMode = 'move' | 'add' | 'delete'
export const NODE_MODE_DEFAULT: NodeMode = 'move'
