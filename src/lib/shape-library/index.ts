// shape-library — public contract: `getShape(kind, imgW, imgH)` → a VShape fitted to the image
// box (aspect-preserving, centered, same 0.72 sizing the chips have always used). Pure data +
// one placement transform. Blueprint: v3/blueprint/modules/shape-library.md

import type { VShape } from '@/lib/vector-core'
import { transformShape } from '@/lib/vector-core'
import { hasVectorDef, unitShape, type VectorShapeKind } from './defs'

export { hasVectorDef, unitShape }
export type { VectorShapeKind }

/** Instantiate a preset into image-px space (y-down), centered, longest side = min(imgW,imgH)·0.72. */
export function getShape(kind: VectorShapeKind, imgW: number, imgH: number): VShape {
  const unit = unitShape(kind)
  const h = (Math.min(imgW, imgH) * 0.72) / 2 // half-extent of the placement box
  const cx = imgW / 2, cy = imgH / 2
  return transformShape(unit, (p) => ({ x: cx + p.x * h, y: cy + p.y * h }))
}
