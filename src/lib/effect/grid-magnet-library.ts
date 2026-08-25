// grid-magnet-library.ts — THE LAYOUT LIBRARY (DRAFT, awaiting Dan's approval).
//
// Literal data, written out — never generated at solve time. Node coordinates are lattice
// units [ix, iy], iy = 0 at the TOP, canonical tall orientation; wide frames are the
// transpose, mirrors are reflections — the viewer derives those for display.

import type { ShapeFamily } from './grid-magnet-class'

export interface LibraryLayout { name: string; nodes: ReadonlyArray<readonly [number, number]>; note?: string }
export interface LibraryFrame { cols: number; rows: number; layouts: LibraryLayout[] }

/** A display transform over a canonical (tall) layout. Pure; closed over the frame. */
export interface LibraryTransform { transpose: boolean; flipX: boolean; flipY: boolean }

/** Apply a transform. Pure integer geometry — no engine, no React. */
export function transformLayout(
  frame: LibraryFrame, layout: LibraryLayout, t: LibraryTransform,
): { cols: number; rows: number; nodes: Array<[number, number]> } {
  let c = frame.cols, r = frame.rows
  let ns = layout.nodes.map(([x, y]) => [x, y] as [number, number])
  if (t.transpose) { ns = ns.map(([x, y]) => [y, x]); const k = c; c = r; r = k }
  if (t.flipX) ns = ns.map(([x, y]) => [c - 1 - x, y])
  if (t.flipY) ns = ns.map(([x, y]) => [x, r - 1 - y])
  return { cols: c, rows: r, nodes: ns }
}

/** Frame kind, the classifier's taxonomy (square / slim / standard) — pure. */
export function kindOf(cols: number, rows: number): 'square' | 'slim' | 'standard' {
  return cols === rows ? 'square' : Math.min(cols, rows) <= 2 ? 'slim' : 'standard'
}
export function orientationOf(cols: number, rows: number): 'tall' | 'wide' | 'even' {
  return rows > cols ? 'tall' : cols > rows ? 'wide' : 'even'
}

/** The classifier's families, and the DRAFT family -> layout applicability — data for Dan's
 *  review in the authoring panel, never silently applied as engine policy. */
export const LIBRARY_FAMILIES: ShapeFamily[] = ['square', 'round', 'triangle']
export const FAMILY_APPLICABILITY_DRAFT: Record<ShapeFamily, string[]> = {
  square: ['full', 'ring', 'block', 'chain', 'single', 'pair'],
  round: ['full', 'ring', 'corners', 'sides', 'block', 'chain', 'single', 'pair'],
  triangle: ['tee-L', 'tee-R', 'tee', 'double-tee', 'corners', 'ell', 'diagonal', 'stacked-pairs', 'stacked-rows', 'alternating-rows', 'U', 'single', 'pair'],
}

/** Integrity of the canonical data — every violation named; empty list = sound. */
export function libraryIntegrity(): string[] {
  const out: string[] = []
  const seenFrames = new Set<string>()
  for (const f of LAYOUT_LIBRARY) {
    const fk = f.cols + 'x' + f.rows
    if (seenFrames.has(fk)) out.push('duplicate frame ' + fk)
    seenFrames.add(fk)
    const names = new Set<string>()
    for (const l of f.layouts) {
      if (names.has(l.name)) out.push(fk + ': duplicate layout name ' + l.name)
      names.add(l.name)
      const nodes = new Set<string>()
      for (const [x, y] of l.nodes) {
        if (x < 0 || x >= f.cols || y < 0 || y >= f.rows) out.push(fk + ' ' + l.name + ': node out of bounds ' + x + ',' + y)
        const k = x + ',' + y
        if (nodes.has(k)) out.push(fk + ' ' + l.name + ': duplicate node ' + k)
        nodes.add(k)
      }
      if (!l.nodes.length) out.push(fk + ' ' + l.name + ': empty layout')
    }
    if (!f.layouts.length) out.push(fk + ': no layouts')
  }
  return out
}

export const LAYOUT_LIBRARY: LibraryFrame[] = [
  { cols: 1, rows: 1, layouts: [
    { name: 'single', nodes: [[0, 0]] },
  ] },
  { cols: 1, rows: 2, layouts: [
    { name: 'pair', nodes: [[0, 0], [0, 1]] },
  ] },
  { cols: 1, rows: 3, layouts: [
    { name: 'chain', nodes: [[0, 0], [0, 1], [0, 2]] },
    { name: 'ends', nodes: [[0, 0], [0, 2]] },
  ] },
  { cols: 1, rows: 4, layouts: [
    { name: 'chain', nodes: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { name: 'ends', nodes: [[0, 0], [0, 3]] },
    { name: 'end-weighted', nodes: [[0, 0], [0, 1], [0, 3]] },
  ] },
  { cols: 1, rows: 5, layouts: [
    { name: 'chain', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
    { name: 'ends', nodes: [[0, 0], [0, 4]] },
    { name: 'alternating', nodes: [[0, 0], [0, 2], [0, 4]] },
    { name: 'double-ends', nodes: [[0, 0], [0, 1], [0, 3], [0, 4]] },
  ] },
  { cols: 2, rows: 2, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1]] },
    { name: 'column', nodes: [[0, 0], [0, 1]] },
    { name: 'row', nodes: [[0, 0], [1, 0]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [1, 0]] },
  ] },
  { cols: 2, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
    { name: 'corners', nodes: [[0, 0], [0, 2], [1, 0], [1, 2]] },
    { name: 'tee-L', nodes: [[0, 0], [0, 2], [1, 2]] },
    { name: 'tee-R', nodes: [[0, 2], [1, 0], [1, 2]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [1, 2]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [1, 2]] },
    { name: 'mid-pair', nodes: [[0, 1], [1, 1]] },
    { name: 'column', nodes: [[0, 0], [0, 1], [0, 2]] },
  ] },
  { cols: 2, rows: 4, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [1, 0], [1, 3]] },
    { name: 'stacked-pairs', nodes: [[0, 0], [0, 2], [0, 3], [1, 0], [1, 2], [1, 3]] },
    { name: 'tee-L', nodes: [[0, 0], [0, 3], [1, 3]] },
    { name: 'tee-R', nodes: [[0, 3], [1, 0], [1, 3]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [1, 2], [1, 3]] },
  ] },
  { cols: 2, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [1, 0], [1, 4]] },
    { name: 'stacked-pairs', nodes: [[0, 0], [0, 2], [0, 4], [1, 0], [1, 2], [1, 4]] },
    { name: 'tee-L', nodes: [[0, 0], [0, 4], [1, 4]] },
    { name: 'tee-R', nodes: [[0, 4], [1, 0], [1, 4]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
  ] },
  { cols: 3, rows: 3, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], note: 'interior — Full grid only' },
    { name: 'ring', nodes: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]] },
    { name: 'corners', nodes: [[0, 0], [0, 2], [2, 0], [2, 2]] },
    { name: 'sides', nodes: [[0, 1], [1, 0], [1, 2], [2, 1]] },
    { name: 'tee', nodes: [[0, 2], [1, 0], [1, 2], [2, 2]] },
    { name: 'U', nodes: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 0], [2, 1], [2, 2]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [2, 2]] },
    { name: 'X', nodes: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], note: 'interior — Full grid only' },
  ] },
  { cols: 3, rows: 4, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]], note: 'interior — Full grid only' },
    { name: 'ring', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [2, 0], [2, 3]] },
    { name: 'sides', nodes: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 2]] },
    { name: 'stacked-rows', nodes: [[0, 0], [0, 2], [0, 3], [1, 0], [1, 2], [1, 3], [2, 0], [2, 2], [2, 3]] },
    { name: 'tee', nodes: [[0, 3], [1, 0], [1, 3], [2, 3]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3]] },
    { name: 'U', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [2, 2], [2, 3]] },
  ] },
  { cols: 3, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], note: 'interior — Full grid only' },
    { name: 'ring', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [2, 0], [2, 4]] },
    { name: 'sides', nodes: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 4], [2, 1], [2, 2], [2, 3]] },
    { name: 'alternating-rows', nodes: [[0, 0], [0, 2], [0, 4], [1, 0], [1, 2], [1, 4], [2, 0], [2, 2], [2, 4]] },
    { name: 'tee', nodes: [[0, 4], [1, 0], [1, 4], [2, 4]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4]] },
    { name: 'U', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [2, 2], [2, 3], [2, 4]] },
    { name: 'X', nodes: [[0, 0], [0, 2], [0, 3], [0, 4], [1, 1], [2, 0], [2, 2], [2, 3], [2, 4]], note: 'interior — Full grid only' },
  ] },
  { cols: 4, rows: 4, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]], note: 'interior — Full grid only' },
    { name: 'ring', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3], [2, 0], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]] },
    { name: 'corners', nodes: [[0, 0], [0, 3], [3, 0], [3, 3]] },
    { name: 'sides', nodes: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 0], [2, 3], [3, 1], [3, 2]] },
    { name: 'stacked-rows', nodes: [[0, 0], [0, 2], [0, 3], [1, 0], [1, 2], [1, 3], [2, 0], [2, 2], [2, 3], [3, 0], [3, 2], [3, 3]] },
    { name: 'tee-L', nodes: [[0, 3], [1, 0], [1, 3], [2, 3], [3, 3]] },
    { name: 'tee-R', nodes: [[0, 3], [1, 3], [2, 0], [2, 3], [3, 3]] },
    { name: 'double-tee', nodes: [[0, 3], [1, 0], [1, 3], [2, 0], [2, 3], [3, 3]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]] },
    { name: 'U', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [2, 2], [3, 3]] },
    { name: 'X', nodes: [[0, 0], [0, 3], [1, 1], [1, 2], [2, 1], [2, 2], [3, 0], [3, 3]], note: 'interior — Full grid only' },
  ] },
  { cols: 4, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]], note: 'interior — Full grid only' },
    { name: 'ring', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [3, 0], [3, 4]] },
    { name: 'sides', nodes: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 4], [2, 0], [2, 4], [3, 1], [3, 2], [3, 3]] },
    { name: 'alternating-rows', nodes: [[0, 0], [0, 2], [0, 4], [1, 0], [1, 2], [1, 4], [2, 0], [2, 2], [2, 4], [3, 0], [3, 2], [3, 4]] },
    { name: 'tee-L', nodes: [[0, 4], [1, 0], [1, 4], [2, 4], [3, 4]] },
    { name: 'tee-R', nodes: [[0, 4], [1, 4], [2, 0], [2, 4], [3, 4]] },
    { name: 'double-tee', nodes: [[0, 4], [1, 0], [1, 4], [2, 0], [2, 4], [3, 4]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4]] },
    { name: 'U', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [2, 2], [3, 3], [3, 4]] },
    { name: 'X', nodes: [[0, 0], [0, 3], [0, 4], [1, 1], [1, 2], [2, 1], [2, 2], [3, 0], [3, 3], [3, 4]], note: 'interior — Full grid only' },
  ] },
  { cols: 5, rows: 5, layouts: [
    { name: 'full', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]], note: 'interior — Full grid only' },
    { name: 'ring', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 4], [2, 0], [2, 4], [3, 0], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] },
    { name: 'corners', nodes: [[0, 0], [0, 4], [4, 0], [4, 4]] },
    { name: 'sides', nodes: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 4], [2, 0], [2, 4], [3, 0], [3, 4], [4, 1], [4, 2], [4, 3]] },
    { name: 'alternating-rows', nodes: [[0, 0], [0, 2], [0, 4], [1, 0], [1, 2], [1, 4], [2, 0], [2, 2], [2, 4], [3, 0], [3, 2], [3, 4], [4, 0], [4, 2], [4, 4]] },
    { name: 'tee', nodes: [[0, 4], [1, 4], [2, 0], [2, 4], [3, 4], [4, 4]] },
    { name: 'double-tee', nodes: [[0, 4], [1, 0], [1, 4], [2, 4], [3, 0], [3, 4], [4, 4]] },
    { name: 'ell', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
    { name: 'U', nodes: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] },
    { name: 'diagonal', nodes: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] },
    { name: 'X', nodes: [[0, 0], [0, 4], [1, 1], [1, 3], [2, 2], [3, 1], [3, 3], [4, 0], [4, 4]], note: 'interior — Full grid only' },
  ] },
]


/** THE SHAPE LIBRARY — the ruled classification shapes, literal canonical outlines in the unit
 *  box (y down). aspect 'square' keeps a square span; 'frame' stretches to the frame's span.
 *  Pure data — the bridge materialises, never generates. */
export type LibraryShapeId =
  | 'square' | 'rectangle' | 'rounded-square' | 'rounded-rectangle' | 'circle'
  | 'triangle' | 'diamond' | 'tee' | 'ell' | 'waisted'
export interface LibraryShape {
  id: LibraryShapeId
  family: ShapeFamily
  aspect: 'square' | 'frame'
  outline: ReadonlyArray<readonly [number, number]>
}
export const LIBRARY_SHAPES: LibraryShape[] = [
  { id: 'square', family: 'square', aspect: 'square', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'rectangle', family: 'square', aspect: 'frame', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'rounded-square', family: 'round', aspect: 'square', outline: [[0.0000, 0.3200], [0.0157, 0.2211], [0.0611, 0.1319], [0.1319, 0.0611], [0.2211, 0.0157], [0.3200, 0.0000], [0.6800, 0.0000], [0.7789, 0.0157], [0.8681, 0.0611], [0.9389, 0.1319], [0.9843, 0.2211], [1.0000, 0.3200], [1.0000, 0.6800], [0.9843, 0.7789], [0.9389, 0.8681], [0.8681, 0.9389], [0.7789, 0.9843], [0.6800, 1.0000], [0.3200, 1.0000], [0.2211, 0.9843], [0.1319, 0.9389], [0.0611, 0.8681], [0.0157, 0.7789], [0.0000, 0.6800]] },
  { id: 'rounded-rectangle', family: 'round', aspect: 'frame', outline: [[0.0000, 0.3200], [0.0157, 0.2211], [0.0611, 0.1319], [0.1319, 0.0611], [0.2211, 0.0157], [0.3200, 0.0000], [0.6800, 0.0000], [0.7789, 0.0157], [0.8681, 0.0611], [0.9389, 0.1319], [0.9843, 0.2211], [1.0000, 0.3200], [1.0000, 0.6800], [0.9843, 0.7789], [0.9389, 0.8681], [0.8681, 0.9389], [0.7789, 0.9843], [0.6800, 1.0000], [0.3200, 1.0000], [0.2211, 0.9843], [0.1319, 0.9389], [0.0611, 0.8681], [0.0157, 0.7789], [0.0000, 0.6800]] },
  { id: 'circle', family: 'round', aspect: 'square', outline: [[1.0000, 0.5000], [0.9938, 0.5782], [0.9755, 0.6545], [0.9455, 0.7270], [0.9045, 0.7939], [0.8536, 0.8536], [0.7939, 0.9045], [0.7270, 0.9455], [0.6545, 0.9755], [0.5782, 0.9938], [0.5000, 1.0000], [0.4218, 0.9938], [0.3455, 0.9755], [0.2730, 0.9455], [0.2061, 0.9045], [0.1464, 0.8536], [0.0955, 0.7939], [0.0545, 0.7270], [0.0245, 0.6545], [0.0062, 0.5782], [0.0000, 0.5000], [0.0062, 0.4218], [0.0245, 0.3455], [0.0545, 0.2730], [0.0955, 0.2061], [0.1464, 0.1464], [0.2061, 0.0955], [0.2730, 0.0545], [0.3455, 0.0245], [0.4218, 0.0062], [0.5000, 0.0000], [0.5782, 0.0062], [0.6545, 0.0245], [0.7270, 0.0545], [0.7939, 0.0955], [0.8536, 0.1464], [0.9045, 0.2061], [0.9455, 0.2730], [0.9755, 0.3455], [0.9938, 0.4218]] },
  { id: 'triangle', family: 'triangle', aspect: 'frame', outline: [[0.0000, 1.0000], [1.0000, 1.0000], [0.5000, 0.0000]] },
  { id: 'diamond', family: 'triangle', aspect: 'square', outline: [[0.5000, 0.0000], [1.0000, 0.5000], [0.5000, 1.0000], [0.0000, 0.5000]] },
  { id: 'tee', family: 'triangle', aspect: 'frame', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [1.0000, 0.4000], [0.7000, 0.4000], [0.7000, 1.0000], [0.3000, 1.0000], [0.3000, 0.4000], [0.0000, 0.4000]] },
  { id: 'ell', family: 'triangle', aspect: 'frame', outline: [[0.0000, 0.0000], [0.4000, 0.0000], [0.4000, 0.5500], [1.0000, 0.5500], [1.0000, 1.0000], [0.0000, 1.0000]] },
  { id: 'waisted', family: 'triangle', aspect: 'frame', outline: [[0.0000, 0.0000], [1.0000, 0.0000], [0.6200, 0.5000], [1.0000, 1.0000], [0.0000, 1.0000], [0.3800, 0.5000]] },
]

/** THE UNIVERSAL PRIMITIVES (ruled: "the pair and single magnet must be tried no matter the
 *  class") — tagged templates available for review in EVERY band/frame; the engine's judge
 *  decides where they hold, the library never omits them. Lattice units. */
export const UNIVERSAL_PRIMITIVES: LibraryLayout[] = [
  { name: 'single', nodes: [[0, 0]] },
  { name: 'pair-h', nodes: [[0, 0], [1, 0]] },
  { name: 'pair-v', nodes: [[0, 0], [0, 1]] },
  { name: 'pair-diag', nodes: [[0, 0], [1, 1]] },
  { name: 'pair-anti', nodes: [[0, 1], [1, 0]] },
]

/** Stable-ID selection — indices are forbidden identity (pruning the draft must never silently
 *  retarget a saved selection). Owned by the pure module. */
export interface LibrarySelection {
  shapeId: LibraryShapeId
  frameKey: string          // 'colsxrows', e.g. '2x3'
  layoutId: string          // layout name, or 'prim:<name>' for a universal primitive
  view: LibraryTransform
}
export function frameKeyOf(f: LibraryFrame): string { return f.cols + 'x' + f.rows }
export function selectedRecords(sel: LibrarySelection): {
  shape: LibraryShape
  frame: LibraryFrame
  layout: LibraryLayout
  isPrimitive: boolean
} {
  // FAIL LOUD (QA F3): stable IDs exist so a stale or mistyped identity can never silently
  // retarget to unrelated data — an unknown ID is an error, never a 1x1 fallback.
  const shape = LIBRARY_SHAPES.find((x) => x.id === sel.shapeId)
  if (!shape) throw new Error('library: unknown shapeId ' + sel.shapeId)
  const frame = LAYOUT_LIBRARY.find((f) => frameKeyOf(f) === sel.frameKey)
  if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
  if (sel.layoutId.startsWith('prim:')) {
    const nm = sel.layoutId.slice(5)
    const prim = UNIVERSAL_PRIMITIVES.find((l) => l.name === nm)
    if (!prim) throw new Error('library: unknown primitive ' + sel.layoutId)
    return { shape, frame, layout: prim, isPrimitive: true }
  }
  const layout = frame.layouts.find((l) => l.name === sel.layoutId)
  if (!layout) throw new Error('library: unknown layoutId ' + sel.layoutId + ' in ' + sel.frameKey)
  return { shape, frame, layout, isPrimitive: false }
}
