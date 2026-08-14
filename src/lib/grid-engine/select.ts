// L20 — any outline. Gravity, wrap, and centre are weights. No shape names.

import { scaleToSize, type Candidate, type CandidateDocument } from './candidates'
import { discClearanceMM, prepareOutline } from './measure'
import { BAND_SIZES_MM, type BandId, type GridSystemSpec } from './spec'
import type { PointMM } from './engine'

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

/** Wrap, centre, gravity — peers. Centre is a law, not a leftover. */
const WEIGHT_WRAP = 1
const WEIGHT_CENTER = 1
const WEIGHT_GRAVITY = 0.25

function bandRange(band: BandId): { lo: number; span: number } {
  const sizes = BAND_SIZES_MM[band]
  const lo = sizes[0]
  const hi = sizes[sizes.length - 1]
  return { lo, span: Math.max(1, hi - lo) }
}

function wrapWeight(sizeMM: number, band: BandId): number {
  const { lo, span } = bandRange(band)
  return (sizeMM - lo) / span
}

function centerWeight(offset2: number, shape: ReturnType<typeof bbox>): number {
  const hw = (shape.maxX - shape.minX) / 2
  const hh = (shape.maxY - shape.minY) / 2
  const reach = Math.hypot(hw, hh) || 1
  return Math.sqrt(offset2) / reach
}

function rankScore(
  sizeMM: number,
  offset2: number,
  gravity: boolean,
  band: BandId,
  shape: ReturnType<typeof bbox>,
): number {
  return (
    WEIGHT_WRAP * wrapWeight(sizeMM, band) +
    WEIGHT_CENTER * centerWeight(offset2, shape) +
    WEIGHT_GRAVITY * (gravity ? 0 : 1)
  )
}

/** How far the hold sits from the shape centre. */
function balance(c: Candidate, shape: ReturnType<typeof bbox>): number {
  const xs = c.sites.map((s) => s.x)
  const ys = c.sites.map((s) => s.y)
  const hx = (Math.min(...xs) + Math.max(...xs)) / 2
  const hy = (Math.min(...ys) + Math.max(...ys)) / 2
  const cx = (shape.minX + shape.maxX) / 2
  const cy = (shape.minY + shape.maxY) / 2
  const dx = hx - cx
  const dy = hy - cy
  return dx * dx + dy * dy
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

/** Top mass and bottom mass both have a disc. A 48×48 in the belly fails this. */
function coversMasses(c: Candidate, shape: ReturnType<typeof bbox>): boolean {
  if (c.sites.length < 2) return true
  const span = shape.maxY - shape.minY
  const ys = c.sites.map((s) => s.y)
  return Math.min(...ys) <= shape.minY + span / 3 && Math.max(...ys) >= shape.maxY - span / 3
}

export interface ProposalMeasure {
  n: number
  gravity: boolean
  masses: boolean
  top: number
  extremes: number
  clear: number
  pair: number
  step: number
  area: number
  balance: number
  size: number
  score: number
}

export function measureProposal(
  spec: GridSystemSpec,
  c: Candidate,
  outline: ReadonlyArray<PointMM>,
): ProposalMeasure {
  const verts = scaleToSize(outline, c.sizeMM)
  const shape = bbox(verts)
  const gravity = holdsTop(c, shape)
  const offset2 = balance(c, shape)
  return {
    n: c.sites.length,
    gravity,
    masses: coversMasses(c, shape),
    top: Math.min(...c.sites.map((s) => s.y)) - shape.minY,
    extremes: extremeFlap(c, verts),
    clear: clearance(c, verts),
    pair: pairSpan(c),
    step: minPairSpan(c),
    area: spanArea(c),
    balance: offset2,
    size: c.sizeMM,
    score: rankScore(c.sizeMM, offset2, gravity, c.band, shape),
  }
}

/** Which sort key put `won` above `lost`. Empty if they compare equal. */
export function decidingKey(_band: BandId, won: ProposalMeasure, lost: ProposalMeasure): string {
  if (won.score !== lost.score) return won.score < lost.score ? 'center+wrap' : 'center+wrap-lost'
  if (won.balance !== lost.balance) return 'center'
  if (won.size !== lost.size) return `size ${won.size} < ${lost.size}`
  return 'placement-at-size'
}

export function propose(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
  outline: ReadonlyArray<PointMM>,
): Candidate[] {
  const raw = doc.candidates.filter((c) => c.band === band)
  const scored = raw.map((c) => {
    const verts = scaleToSize(outline, c.sizeMM)
    const shape = bbox(verts)
    const gravity = holdsTop(c, shape)
    const offset2 = balance(c, shape)
    return {
      c,
      n: c.sites.length,
      gravity,
      balance: offset2,
      size: c.sizeMM,
      score: rankScore(c.sizeMM, offset2, gravity, band, shape),
    }
  })

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    if (a.balance !== b.balance) return a.balance - b.balance
    if (a.size !== b.size) return a.size - b.size
    if (a.n !== b.n) return b.n - a.n
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
