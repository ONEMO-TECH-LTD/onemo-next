// editor/geometry — pure doc-space helpers (Run 2 · G6 decomposition, seam 1 of the editor
// rebuild). Document construction, whole-outline transforms, and hit math — zero React, zero
// vector-core: this is the OutlineDocument (shadow/interaction) side of the editor only.
// Blueprint: v3/blueprint/modules/editor.md.

import {
  applyOutlineCommands,
  resolveOutlineDocument,
  rdpClosed,
  repairSimplePolygon,
  nodesFromTracedRing,
  type OutlineDocument,
  type Vec2Px,
} from '@/lib/outline-core'
import type { EffectSpecDraft } from '@/lib/effect/types'

/** Seed a rounded-rect OutlineDocument (used only when there's no cut-out yet). */
export function seedDoc(w: number, h: number): OutlineDocument {
  const m = Math.min(w, h) * 0.18
  const corner = { mode: 'inherit' as const }
  const nodes = [
    { id: 'n1', p: [m, m] as Vec2Px, role: 'corner' as const, corner },
    { id: 'n2', p: [w - m, m] as Vec2Px, role: 'corner' as const, corner },
    { id: 'n3', p: [w - m, h - m] as Vec2Px, role: 'corner' as const, corner },
    { id: 'n4', p: [m, h - m] as Vec2Px, role: 'corner' as const, corner },
  ]
  const base = {
    rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }],
    style: { globalOutlineCornerRadiusPx: Math.min(w, h) * 0.06, smoothing: 0 },
  }
  return applyOutlineCommands(base, [], {
    image: { widthPx: w, heightPx: h, sourceHash: 'seed', orientation: 'baked' },
    mode: 'semi_auto',
  })
}

/**
 * Self-correcting default rounding: the largest global corner radius in [0, hi] that resolves WITHOUT a
 * self-intersection. Binary-searches resolve(doc @ r) — so "max rounded" adapts to each shape instead
 * of a blind value that might cross on tight geometry.
 */
export function maxSafeGlobalRadius(doc: OutlineDocument, hi: number): number {
  const clean = (r: number) =>
    resolveOutlineDocument({ ...doc, style: { ...doc.style, globalOutlineCornerRadiusPx: r } }, { flattenTolerancePx: 0.5 }).issues.length === 0
  if (clean(hi)) return hi
  let lo = 0, h = hi
  for (let i = 0; i < 14 && h - lo > 2; i++) { const m = (lo + h) / 2; if (clean(m)) lo = m; else h = m }
  return Math.floor(lo)
}

/**
 * LEGACY DOOR (KAI-8963): the pre-vector doc constructor. Two remaining callers, both in
 * OutlineEditor: (1) the open-effect bootstrap, where its output is REPLACED by the vector shadow
 * whenever vector truth exists and survives only as the loud legacy fallback (old saves with no
 * raw trace — toasted); (2) Reset's equally-loud legacy fallback. It is never authoritative for a
 * vector-capable source. Do not add new call sites.
 *
 * Build an editable OutlineDocument from the REAL BEN2 cut-out contour (A1d). The dense smoothed
 * contour is simplified to a control ring (rdpClosed); the rounding is already baked into the
 * points, so the global corner radius starts at 0 (no double-round). Coordinates: mm → mask px.
 */
export function docFromSpec(spec: EffectSpecDraft): OutlineDocument {
  const W = spec.maskWidthPx, H = spec.maskHeightPx
  const k = spec.mmPerPx || 1
  const organic = spec.generator.adapter !== 'standard'
  // Control-node simplification tolerance — the EDITABLE handle density only. Organic outlines keep
  // the EXACT dense contour as segment rawPolylines (traced ring): the rendered/cut shape is the
  // true trace, not an approximation through the anchors (the clipped-corner/wobble bug).
  const eps = Math.max(2, Math.max(W, H) * 0.022)
  // geometryMM is y-UP (the mask is loaded y-up so the 3D is upright — segment-ml.ts/mask.ts). The
  // editor draws the raw photo y-DOWN via SVG, so flip Y here to overlay the outline right-side-up on
  // the image. The editor→3D feedback re-flips (H − y) back to the engine's y-up space, so they cancel.
  const minSpacing = Math.max(3, Math.max(W, H) * 0.008)
  const toEditorPx = (ptsMM: [number, number][]) => ptsMM.map(([x, y]) => [x / k, H - y / k] as Vec2Px)
  const toRing = (ptsMM: [number, number][], prefix: string) =>
    organic
      ? nodesFromTracedRing(toEditorPx(ptsMM), eps, prefix)
      : repairSimplePolygon(rdpClosed(toEditorPx(ptsMM), eps), minSpacing).map((p, i) => ({
          id: `${prefix}${i}`, p, role: 'corner' as const, corner: { mode: 'inherit' as const },
        }))
  const rings: OutlineDocument['rings'] = [
    { id: 'r1', role: 'outer', closed: true, nodes: toRing(spec.geometryMM.outer.pts, 'o') },
  ]
  spec.geometryMM.holes.forEach((h, hi) => {
    rings.push({ id: `h${hi}`, role: 'hole', parentRingId: 'r1', closed: true, nodes: toRing(h.pts, `h${hi}n`) })
  })
  // Square path: default to MAXIMUM safe corner rounding. Traced organic rings bypass radii — exact.
  const env = { image: { widthPx: W, heightPx: H, sourceHash: spec.sourceRef.slice(0, 40), orientation: 'baked' as const }, mode: 'auto' as const }
  const probe = applyOutlineCommands({ rings, style: { globalOutlineCornerRadiusPx: 0, smoothing: 0 } }, [], env)
  const safe = organic ? 0 : maxSafeGlobalRadius(probe, Math.round(Math.min(W, H) * 0.25))
  const base = { rings, style: { globalOutlineCornerRadiusPx: safe, smoothing: 0 } }
  return applyOutlineCommands(base, [], env)
}

/** DERIVED-ONLY (KAI-8963): builds the interaction/preview shadow doc from a point ring — never
 *  committed geometry. Two callers: the vector shadow (useEditorHistory.shadowDoc — hit-tests and
 *  interaction math beside the authoritative VShape) and the transient generator tick-preview
 *  (buildShapeDoc — discarded on release for the fitted vector). Do not add authoritative call
 *  sites. `minSpacingPx` controls anchor merging — dense parametric rings pass a SMALL value so
 *  points merge EVENLY (coarse merge ate points irregularly → "uneven curves", Dan 2026-06-10). */
export function docFromRings(outerPts: Vec2Px[], image: OutlineDocument['image'], defaultRadiusPx = 0, minSpacingPx?: number): OutlineDocument {
  const clean = repairSimplePolygon(outerPts, minSpacingPx ?? Math.max(3, Math.max(image.widthPx, image.heightPx) * 0.008))
  const nodes = (clean.length >= 3 ? clean : outerPts).map((p, i) => ({ id: `b${i}`, p, role: 'corner' as const, corner: { mode: 'inherit' as const } }))
  const base = { rings: [{ id: 'r1', role: 'outer' as const, closed: true as const, nodes }], style: { globalOutlineCornerRadiusPx: defaultRadiusPx, smoothing: 0 } }
  return applyOutlineCommands(base, [], { image, mode: 'semi_auto' })
}

/** Outer-ring bbox center (px). */
export function outerCenter(doc: OutlineDocument): Vec2Px {
  const outer = doc.rings.find((r) => r.role === 'outer')
  const pts = outer?.nodes.map((n) => n.p) ?? []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

/** Scale every node position about the outer-ring center, preserving node ids + corner specs. */
export function scaleDoc(doc: OutlineDocument, factor: number): OutlineDocument {
  const [cx, cy] = outerCenter(doc)
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [cx + (n.p[0] - cx) * factor, cy + (n.p[1] - cy) * factor] as Vec2Px })) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Rotate every node position about the outer-ring center by `deg` (mobile twist / desktop handle). */
export function rotateDoc(doc: OutlineDocument, deg: number): OutlineDocument {
  const [cx, cy] = outerCenter(doc)
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => { const dx = n.p[0] - cx, dy = n.p[1] - cy; return { ...n, p: [cx + dx * c - dy * s, cy + dx * s + dy * c] as Vec2Px } }) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Translate every node by (dx,dy) — drag the whole outline to reposition it within the image. */
export function translateDoc(doc: OutlineDocument, dx: number, dy: number): OutlineDocument {
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [n.p[0] + dx, n.p[1] + dy] as Vec2Px })) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Anisotropic stretch about an anchor point — the crop-grip bake (pull a side: square → rectangle).
 *  Corner radius SPECS are positions-independent, so a rounded square keeps its rounding. */
export function stretchDoc(doc: OutlineDocument, sx: number, sy: number, ax: number, ay: number): OutlineDocument {
  const rings = doc.rings.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, p: [ax + (n.p[0] - ax) * sx, ay + (n.p[1] - ay) * sy] as Vec2Px })) }))
  return applyOutlineCommands({ rings, style: doc.style }, [], { image: doc.image, mode: doc.mode })
}

/** Which crop grip — mid-edges stretch one axis at that edge; corners stretch both adjacent edges. */
export type GripId = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

/** Outer-ring bbox (px). */
export function outerBbox(doc: OutlineDocument): { minX: number; minY: number; maxX: number; maxY: number } {
  const outer = doc.rings.find((r) => r.role === 'outer')
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of outer?.nodes ?? []) { const [x, y] = n.p; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}

/** Ray-cast point-in-polygon — used to detect a tap inside the cut area (→ select all corners). */
export function pointInPolygon(p: Vec2Px, poly: Vec2Px[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
    const hit = (yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

/** Closest point on segment ab to p, with squared distance. */
export function projectToSeg(p: Vec2Px, a: Vec2Px, b: Vec2Px): { pt: Vec2Px; d2: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const pt: Vec2Px = [a[0] + t * dx, a[1] + t * dy]
  const ex = p[0] - pt[0], ey = p[1] - pt[1]
  return { pt, d2: ex * ex + ey * ey }
}
