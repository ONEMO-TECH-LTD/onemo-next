// editor/geometry — RING MATH for the editor's interaction layer (REBUILD-PLAN-v2 §B2.3).
// The editor's geometry truth is a VShape; interaction math (hit-tests, grips) runs on its
// flattened ring. No document model exists here — these are pure point/ring helpers.

import type { Vec2Px } from '@/lib/outline-core'

/** crop-grip identity: 4 corners + 4 mid-edges (iOS-crop pattern). */
export type GripId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** standard even-odd ray cast — is p inside the closed ring? */
export function pointInPolygon(p: Vec2Px, ring: ReadonlyArray<Vec2Px>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const hit = (yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}
