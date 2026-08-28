// grid-magnet-logic.ts — LOGIC: policies. Reads what compute measured; weighs with spec's values.

import type { Anchor, MagnetPlan, Pt } from './types'

// Moved to foundation/geometry.ts and units/layout.ts (S2 step 4). Re-exported for now.
export { bandOf } from './foundation/geometry'
export { applyCoverage } from './units/layout'
export type { Anchor, MagnetDia, MagnetPlan } from './types'

// Moved to units/centring.ts and types.ts (S2). Re-exported so no consumer changes in the move.
export { governMass, centeringAnchors, anchorBakeOf, anchorFromBake } from './units/centring'
export type { AnchorBake } from './types'
export type { CentreMode, Governor } from './types'
import {
  MAGNET_DIA_LARGE_MM,
  MAGNET_DIA_SMALL_MM,
} from './grid-magnet-spec'
import { bbox } from './foundation/geometry'

/** Per-anchor magnet size. corners8 → the large body on the extreme corners, small elsewhere. */
export function assignSizes(seated: Pt[], plan: MagnetPlan): Anchor[] {
  if (plan === 'all8') return seated.map((p) => ({ p, dia: MAGNET_DIA_LARGE_MM }))
  if (plan === 'all6') return seated.map((p) => ({ p, dia: MAGNET_DIA_SMALL_MM }))
  const bb = bbox(seated)
  return seated.map((p) => {
    const ex = Math.abs(p[0] - bb.minX) < 0.6 || Math.abs(p[0] - bb.maxX) < 0.6
    const ey = Math.abs(p[1] - bb.minY) < 0.6 || Math.abs(p[1] - bb.maxY) < 0.6
    return { p, dia: ex && ey ? MAGNET_DIA_LARGE_MM : MAGNET_DIA_SMALL_MM }
  })
}


