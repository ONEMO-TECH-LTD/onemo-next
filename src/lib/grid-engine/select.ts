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

function holdBox(c: Candidate): { w: number; h: number; area: number } {
  if (c.sites.length < 2) return { w: 0, h: 0, area: 0 }
  const xs = c.sites.map((s) => s.x)
  const ys = c.sites.map((s) => s.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  return { w, h, area: w * h }
}

/** Two discs in the top third — a head pair, not a single apex. */
function hasHeadPair(c: Candidate, shape: ReturnType<typeof bbox>): boolean {
  const cut = shape.minY + (shape.maxY - shape.minY) / 3
  return c.sites.filter((s) => s.y <= cut).length >= 2
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

function isFilledWindow(c: Candidate): boolean {
  if (c.family !== 'full-window' || c.sites.length < 4) return false
  const xs = c.sites.map((s) => s.x)
  const ys = c.sites.map((s) => s.y)
  return Math.max(...xs) - Math.min(...xs) >= 48 && Math.max(...ys) - Math.min(...ys) >= 48
}

function isExtreme(c: Candidate): boolean {
  return (
    c.family === 'corner-triangle' ||
    c.family === 'rectangle-corners' ||
    isFilledWindow(c) ||
    (c.family === 'tee' && c.sites.length >= 4)
  )
}

type Kind = 'single' | 'pair' | 'extreme'

/** L20 per band: 1 disc · pair on two masses · extreme corners. Band is a size label. */
function targetKind(
  all: Candidate[],
  band: BandId,
  outline: ReadonlyArray<PointMM>,
): Kind {
  const sizes = BAND_SIZES_MM[band]
  const lo = sizes[0]
  const hi = sizes[sizes.length - 1]
  const inBand = (c: Candidate) => c.band === band && c.sizeMM >= lo && c.sizeMM <= hi
  if (band === 1) return 'single'
  const hasPair = all.some((c) => inBand(c) && c.sites.length === 2)
  const hasMassExtreme = all.some((c) => {
    if (!inBand(c) || !isExtreme(c)) return false
    return coversMasses(c, bbox(scaleToSize(outline, c.sizeMM)))
  })
  if (band === 2) return hasPair ? 'pair' : 'single'
  if (hasMassExtreme) return 'extreme'
  if (hasPair) return 'pair'
  return 'single'
}

function matchesKind(c: Candidate, kind: Kind): boolean {
  if (kind === 'extreme') return isExtreme(c)
  if (kind === 'pair') return c.sites.length === 2
  return c.sites.length === 1
}

/** Duck's 4-corners cover both head sides; bat's 3 is the utmost set. Class carries. */
function extremeCount(
  all: Candidate[],
  outline: ReadonlyArray<PointMM>,
): number {
  const covering = all.filter((c) => {
    if (c.band !== 3 || !isExtreme(c)) return false
    return coversMasses(c, bbox(scaleToSize(outline, c.sizeMM)))
  })
  const filled = covering.filter((c) => isFilledWindow(c))
  if (filled.length) return Math.max(...filled.map((c) => c.sites.length))
  if (covering.some((c) => c.family === 'tee' && c.sites.length >= 4)) return 4
  if (covering.some((c) => c.family === 'rectangle-corners' || c.sites.length === 4)) return 4
  if (covering.some((c) => c.sites.length === 3)) return 3
  return 0
}

export function propose(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
  outline: ReadonlyArray<PointMM>,
): Candidate[] {
  const raw = doc.candidates.filter((c) => c.band === band)
  const kind = targetKind(doc.candidates, band, outline)
  let classN = kind === 'extreme' ? extremeCount(doc.candidates, outline) : 0
  if (band === 4 && kind === 'extreme') {
    const fills = raw.filter((c) => {
      if (!isFilledWindow(c)) return false
      return coversMasses(c, bbox(scaleToSize(outline, c.sizeMM)))
    })
    if (fills.length) classN = Math.max(...fills.map((c) => c.sites.length))
    else {
      const fourHead = raw.some((c) => {
        if (c.family !== 'rectangle-corners' || c.sites.length !== 4) return false
        const shape = bbox(scaleToSize(outline, c.sizeMM))
        return coversMasses(c, shape) && hasHeadPair(c, shape)
      })
      if (fourHead) classN = 4
    }
  }
  const cell = spec.grid.paddingMM * 2
  let stepFloor = 0
  if (band === 4 && classN === 4) {
    let lo = Infinity
    for (const c of doc.candidates) {
      if (c.band !== 3 || c.family !== 'rectangle-corners' || c.sites.length !== 4) continue
      if (!coversMasses(c, bbox(scaleToSize(outline, c.sizeMM)))) continue
      if (c.sizeMM < lo) lo = c.sizeMM
    }
    if (Number.isFinite(lo)) stepFloor = lo + cell
  }
  const pad = spec.grid.paddingMM
  const pool = raw.filter((c) => matchesKind(c, kind))
  const measure = pool.length > 0 ? pool : raw
  const scored = measure.map((c) => {
    const verts = scaleToSize(outline, c.sizeMM)
    const shape = bbox(verts)
    const gravity = holdsTop(c, shape)
    const offset2 = balance(c, shape)
    const span = shape.maxY - shape.minY || 1
    const top = Math.min(...c.sites.map((s) => s.y)) - shape.minY
    const flap = extremeFlap(c, verts)
    const clear = clearance(c, verts)
    return {
      c,
      n: c.sites.length,
      gravity,
      masses: coversMasses(c, shape),
      balance: offset2,
      size: c.sizeMM,
      step: minPairSpan(c),
      area: holdBox(c).area,
      xOff: Math.abs((Math.min(...c.sites.map((s) => s.x)) + Math.max(...c.sites.map((s) => s.x))) / 2 - (shape.minX + shape.maxX) / 2),
      flap,
      score: rankScore(c.sizeMM, offset2, gravity, band, shape),
      hit: matchesKind(c, kind) && clear >= pad - 0.05,
      top,
      topFrac: top / span,
      flush: Math.abs(clear - pad),
    }
  })

  scored.sort((a, b) => {
    if (a.hit !== b.hit) return a.hit ? -1 : 1
    if (a.hit && b.hit && a.gravity !== b.gravity) return a.gravity ? -1 : 1
    if (a.hit && b.hit && kind === 'single') {
      if (a.size !== b.size) return a.size - b.size
      if (a.flush !== b.flush) return a.flush - b.flush
    }
    if (a.hit && b.hit && kind === 'pair') {
      if (a.masses !== b.masses) return a.masses ? -1 : 1
      const ac = a.xOff <= pad ? 0 : 1
      const bc = b.xOff <= pad ? 0 : 1
      if (ac !== bc) return ac - bc
      if (a.xOff !== b.xOff) return a.xOff - b.xOff
      if (a.size !== b.size) return a.size - b.size
      const head = 1 / 3
      const ad = Math.abs(a.topFrac - head)
      const bd = Math.abs(b.topFrac - head)
      if (ad !== bd) return ad - bd
    }
    if (a.hit && b.hit && kind === 'extreme') {
      if (a.masses !== b.masses) return a.masses ? -1 : 1
      if (classN > 0) {
        const ad = Math.abs(a.n - classN)
        const bd = Math.abs(b.n - classN)
        if (ad !== bd) return ad - bd
      }
      if (band === 4 && stepFloor > 0) {
        const aOk = a.size >= stepFloor ? 0 : 1
        const bOk = b.size >= stepFloor ? 0 : 1
        if (aOk !== bOk) return aOk - bOk
      }
      if (band === 4 && a.area !== b.area) return b.area - a.area
      if (a.size !== b.size) return a.size - b.size
      if (a.flush !== b.flush) return a.flush - b.flush
      if (a.balance !== b.balance) return a.balance - b.balance
      if (a.flap !== b.flap) return a.flap - b.flap
    }
    if (a.hit && b.hit && a.balance !== b.balance) return a.balance - b.balance
    if (a.score !== b.score) return a.score - b.score
    if (a.size !== b.size) return a.size - b.size
    if (a.n !== b.n) return b.n - a.n
    return a.c.id.localeCompare(b.c.id)
  })

  const seen = new Set<string>()
  const out: Candidate[] = []
  const keyOf = (c: Candidate) =>
    `${c.sizeMM}|${c.family}|${c.population}|${c.sites
      .map((s) => `${s.col},${s.row}`)
      .sort()
      .join('|')}`
  for (const { c } of scored) {
    const id = keyOf(c)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(c)
  }
  if (measure !== raw) {
    for (const c of raw) {
      const id = keyOf(c)
      if (seen.has(id)) continue
      seen.add(id)
      out.push(c)
    }
  }
  return out
}
