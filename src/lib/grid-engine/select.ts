// L20 — any outline. Gravity, then wrap the masses. No shape names.

import { scaleToSize, type Candidate, type CandidateDocument } from './candidates'
import { discClearanceMM, prepareOutline } from './measure'
import type { BandId, GridSystemSpec } from './spec'
import type { PointMM } from './engine'

function nativeCount(band: BandId, n: number): boolean {
  if (band === 1) return n === 1
  if (band === 2) return n === 2
  if (band === 3) return n === 3 || n === 4
  return n === 4
}

function bbox(verts: ReadonlyArray<PointMM>) {
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

/** Leftmost, rightmost, topmost, bottommost outline vertices — the masses' extremes. */
function extremes(verts: ReadonlyArray<PointMM>): PointMM[] {
  let L = verts[0]
  let R = verts[0]
  let T = verts[0]
  let B = verts[0]
  for (const p of verts) {
    if (p[0] < L[0]) L = p
    if (p[0] > R[0]) R = p
    if (p[1] < T[1]) T = p
    if (p[1] > B[1]) B = p
  }
  return [L, R, T, B]
}

function nearest2(c: Candidate, p: PointMM): number {
  let best = Infinity
  for (const s of c.sites) {
    const dx = p[0] - s.x
    const dy = p[1] - s.y
    const d = dx * dx + dy * dy
    if (d < best) best = d
  }
  return best
}

/** Flap at the four extremes. Buried discs score badly. */
function extremeFlap(c: Candidate, verts: ReadonlyArray<PointMM>): number {
  let worst = 0
  for (const p of extremes(verts)) {
    const d = nearest2(c, p)
    if (d > worst) worst = d
  }
  return worst
}

function minPairSpan(c: Candidate): number {
  if (c.sites.length < 2) return 0
  let best = Infinity
  for (let i = 0; i < c.sites.length; i++) {
    for (let j = i + 1; j < c.sites.length; j++) {
      const dx = c.sites[i].x - c.sites[j].x
      const dy = c.sites[i].y - c.sites[j].y
      const d = dx * dx + dy * dy
      if (d < best) best = d
    }
  }
  return best
}

function pairSpan(c: Candidate): number {
  if (c.sites.length < 2) return 0
  let best = 0
  for (let i = 0; i < c.sites.length; i++) {
    for (let j = i + 1; j < c.sites.length; j++) {
      const dx = c.sites[i].x - c.sites[j].x
      const dy = c.sites[i].y - c.sites[j].y
      const d = dx * dx + dy * dy
      if (d > best) best = d
    }
  }
  return best
}

function spanArea(c: Candidate): number {
  const xs = c.sites.map((s) => s.x)
  const ys = c.sites.map((s) => s.y)
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
}

function clearance(c: Candidate, verts: ReadonlyArray<PointMM>): number {
  const prep = prepareOutline(verts)
  let worst = Infinity
  for (const s of c.sites) {
    const d = discClearanceMM(prep, [s.x, s.y])
    if (d < worst) worst = d
  }
  return worst
}

function holdsTop(c: Candidate, shape: ReturnType<typeof bbox>): boolean {
  const mid = (shape.minY + shape.maxY) / 2
  return Math.min(...c.sites.map((s) => s.y)) <= mid
}

export interface ProposalMeasure {
  n: number
  gravity: boolean
  top: number
  extremes: number
  clear: number
  pair: number
  step: number
  area: number
  size: number
}

export function measureProposal(
  spec: GridSystemSpec,
  c: Candidate,
  outline: ReadonlyArray<PointMM>,
): ProposalMeasure {
  const verts = scaleToSize(outline, c.sizeMM)
  const shape = bbox(verts)
  return {
    n: c.sites.length,
    gravity: holdsTop(c, shape),
    top: Math.min(...c.sites.map((s) => s.y)) - shape.minY,
    extremes: extremeFlap(c, verts),
    clear: clearance(c, verts),
    pair: pairSpan(c),
    step: minPairSpan(c),
    area: spanArea(c),
    size: c.sizeMM,
  }
}

/** Which sort key put `won` above `lost`. Empty if they compare equal. */
export function decidingKey(band: BandId, won: ProposalMeasure, lost: ProposalMeasure): string {
  if (band === 1) {
    if (won.size !== lost.size) return `size ${won.size} < ${lost.size}`
    return 'placement-at-size'
  }
  if (band === 2) {
    if (won.gravity !== lost.gravity) return won.gravity ? 'gravity' : 'gravity-lost'
    if (won.n !== lost.n) return `count ${won.n} > ${lost.n}`
    if (won.size !== lost.size) return `size ${won.size} < ${lost.size}`
    return 'placement-at-size'
  }
  if (won.gravity !== lost.gravity) return won.gravity ? 'gravity' : 'gravity-lost'
  if (won.n !== lost.n) return `count ${won.n} > ${lost.n}`
  if (band === 4 && won.step !== lost.step) return `step ${Math.sqrt(won.step).toFixed(0)} > ${Math.sqrt(lost.step).toFixed(0)}`
  const ae = won.extremes / (won.size * won.size)
  const be = lost.extremes / (lost.size * lost.size)
  if (ae !== be) return `extremes ${ae.toFixed(3)} < ${be.toFixed(3)}`
  if (band === 2) {
    const ap = won.pair / (won.size * won.size)
    const bp = lost.pair / (lost.size * lost.size)
    if (ap !== bp) return `pair-span`
  }
  if (won.size !== lost.size) return `size ${won.size} < ${lost.size}`
  if (won.area !== lost.area) return `area`
  return 'tie'
}

export function propose(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
  outline: ReadonlyArray<PointMM>,
): Candidate[] {
  const raw = doc.candidates.filter((c) => c.band === band && nativeCount(band, c.sites.length))
  const scored = raw.map((c) => ({ c, ...measureProposal(spec, c, outline) }))

  scored.sort((a, b) => {
    if (band === 1) {
      if (a.size !== b.size) return a.size - b.size
      const atSize = scored.filter((s) => s.size === a.size)
      const maxClear = Math.max(...atSize.map((s) => s.clear))
      const aTopHold = a.gravity && a.clear >= maxClear * 0.85
      const bTopHold = b.gravity && b.clear >= maxClear * 0.85
      if (aTopHold !== bTopHold) return aTopHold ? -1 : 1
      if (!aTopHold && !bTopHold && a.clear !== b.clear) return b.clear - a.clear
      if (a.top !== b.top) return a.top - b.top
      return a.c.id.localeCompare(b.c.id)
    }
    if (band === 2) {
      if (a.gravity !== b.gravity) return a.gravity ? -1 : 1
      if (a.n !== b.n) return b.n - a.n
      if (a.size !== b.size) return a.size - b.size
      if (a.top !== b.top) return a.top - b.top
      if (a.clear !== b.clear) return b.clear - a.clear
      return a.c.id.localeCompare(b.c.id)
    }
    if (a.gravity !== b.gravity) return a.gravity ? -1 : 1
    if (a.n !== b.n) return b.n - a.n
    if (band === 4 && a.step !== b.step) return b.step - a.step
    const ae = a.extremes / (a.size * a.size)
    const be = b.extremes / (b.size * b.size)
    if (ae !== be) return ae - be
    if (band === 2) {
      const ap = a.pair / (a.size * a.size)
      const bp = b.pair / (b.size * b.size)
      if (ap !== bp) return bp - ap
    }
    if (a.size !== b.size) return a.size - b.size
    if (a.area !== b.area) return a.area - b.area
    return a.c.id.localeCompare(b.c.id)
  })

  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const { c } of scored) {
    const id = `${c.sizeMM}|${c.family}|${c.population}|${c.sites
      .map((s) => `${s.col},${s.row}`)
      .sort()
      .join('|')}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push(c)
  }
  return out
}
