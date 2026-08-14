// L20 — gravity first, then tight wrap. No shape names. Any outline.

import { scaleToSize, type Candidate, type CandidateDocument } from './candidates'
import { discClearanceMM, prepareOutline } from './measure'
import type { BandId, GridSystemSpec } from './spec'
import type { PointMM } from './engine'

/** L20 table: the band is a size range; this is the native hold count, not a shape class. */
function nativeCount(band: BandId, n: number): boolean {
  if (band === 1) return n === 1
  if (band === 2) return n === 2
  if (band === 3) return n === 3 || n === 4
  return n === 4
}

function bbox(verts: ReadonlyArray<PointMM>): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = verts[0][0]
  let maxX = verts[0][0]
  let minY = verts[0][1]
  let maxY = verts[0][1]
  for (const [x, y] of verts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, maxX, minY, maxY }
}

function holdsTop(c: Candidate, shape: ReturnType<typeof bbox>): boolean {
  const mid = (shape.minY + shape.maxY) / 2
  return Math.min(...c.sites.map((s) => s.y)) <= mid
}

function topReach(c: Candidate, shape: ReturnType<typeof bbox>): number {
  return Math.min(...c.sites.map((s) => s.y)) - shape.minY
}

/** How far the farthest outline vertex sits from any held disc. Unheld extremities are flap. */
function coverageFlap(c: Candidate, verts: ReadonlyArray<PointMM>): number {
  let worst = 0
  for (const [x, y] of verts) {
    let best = Infinity
    for (const s of c.sites) {
      const dx = x - s.x
      const dy = y - s.y
      const d = dx * dx + dy * dy
      if (d < best) best = d
    }
    if (best > worst) worst = best
  }
  return worst
}

function localFlap(c: Candidate, verts: ReadonlyArray<PointMM>, radiusMM: number): number {
  const prep = prepareOutline(verts)
  let loosest = 0
  for (const s of c.sites) {
    const left = discClearanceMM(prep, [s.x, s.y]) - radiusMM
    if (left > loosest) loosest = left
  }
  return loosest
}

function spanArea(c: Candidate): number {
  const xs = c.sites.map((s) => s.x)
  const ys = c.sites.map((s) => s.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  return w * h
}

/** Ordered proposals for one band. First is what the engine would mark. */
export function propose(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
  outline: ReadonlyArray<PointMM>,
): Candidate[] {
  const raw = doc.candidates.filter((c) => c.band === band && nativeCount(band, c.sites.length))
  const scored = raw.map((c) => {
    const verts = scaleToSize(outline, c.sizeMM)
    const shape = bbox(verts)
    return {
      c,
      n: c.sites.length,
      gravity: holdsTop(c, shape),
      top: topReach(c, shape),
      cover: coverageFlap(c, verts),
      local: localFlap(c, verts, spec.grid.paddingMM),
      span: spanArea(c),
    }
  })
  scored.sort((a, b) => {
    if (a.gravity !== b.gravity) return a.gravity ? -1 : 1
    if (a.n !== b.n) return b.n - a.n
    if (a.top !== b.top) return a.top - b.top
    if (a.n === 1 && b.n === 1) {
      if (a.local !== b.local) return a.local - b.local
      return a.c.id.localeCompare(b.c.id)
    }
    const ac = a.cover / (a.c.sizeMM * a.c.sizeMM)
    const bc = b.cover / (b.c.sizeMM * b.c.sizeMM)
    if (ac !== bc) return ac - bc
    if (a.local !== b.local) return a.local - b.local
    if (a.span !== b.span) return a.span - b.span
    return a.c.id.localeCompare(b.c.id)
  })
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const { c } of scored) {
    const key = c.sites
      .map((s) => `${s.col},${s.row}`)
      .sort()
      .join('|')
    const id = `${c.sizeMM}|${c.family}|${c.population}|${key}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push(c)
  }
  return out
}
