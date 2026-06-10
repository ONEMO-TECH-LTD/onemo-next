// export/svg-import — SVG shape upload (vector reset Run 8): the reverse door of the mm exporter.
// V1 boundary (blueprint modules/export.md): clean single-outline files in our dialect (absolute
// M/L/C/Z). Anything outside it fails LOUDLY in product language — never a silent mangle. The
// uploaded outline becomes a first-class vector shape: reshapeable, Radius-able, mm-exportable.

import type { VShape, Vec2 } from '@/lib/vector-core'
import { transformShape, shapeBBox } from '@/lib/vector-core'
import { parsePathD } from './svg-mm'

/** Extract THE single <path d> from an SVG document and parse it into a shape (file coordinates). */
export function vshapeFromSVG(svgText: string): VShape {
  if (!/<svg[\s>]/i.test(svgText)) throw new Error('This file is not an SVG')
  const paths = [...svgText.matchAll(/<path\b[^>]*>/gi)]
  if (paths.length === 0) throw new Error('No outline found — the SVG needs one path')
  if (paths.length > 1) throw new Error('This file needs a single outline — one path, no layers')
  if (/\btransform\s*=/i.test(svgText)) throw new Error('Transformed layers are not supported yet — flatten the file to one plain path')
  const dm = paths[0][0].match(/\bd\s*=\s*"([^"]+)"|\bd\s*=\s*'([^']+)'/)
  if (!dm) throw new Error('No outline found — the SVG path has no data')
  let parsed
  try {
    parsed = parsePathD(dm[1] ?? dm[2])
  } catch {
    throw new Error("This SVG uses drawing features we can't import yet — export it as a plain outline (straight lines and curves)")
  }
  if (parsed.length !== 1) throw new Error('This file needs a single outline — no holes or separate pieces')
  if (parsed[0].anchors.length < 3) throw new Error('The outline is too small to use')
  return { paths: parsed }
}

/** Uniform-fit a shape into the image box (0.72 of the short side — the library placement rule). */
export function fitShapeToBox(shape: VShape, imgW: number, imgH: number): VShape {
  const bb = shapeBBox(shape, 0.1)
  const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY
  if (!(w > 0) || !(h > 0)) throw new Error('The outline is too small to use')
  const S = (Math.min(imgW, imgH) * 0.72) / Math.max(w, h)
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2
  return transformShape(shape, (p: Vec2) => ({ x: imgW / 2 + (p.x - cx) * S, y: imgH / 2 + (p.y - cy) * S }))
}
