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
