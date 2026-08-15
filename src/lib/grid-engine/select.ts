// Lexicographic judge. Counts emerge from the physics. No blended score.
// Candidate collect is untouched — this file only orders what collect already listed.

import { scaleToSize, type Candidate, type CandidateDocument } from './candidates'
import { discClearanceMM, prepareOutline } from './measure'
import { type BandId, type GridSystemSpec } from './spec'
import type { PointMM } from './engine'

/** Calibrated on the v3.2 bench (Dan 2026-08-14/15). Named constants, never a blend. */
const GRAVITY_GUARD_MM = 28
const VERTICAL_HOLD_MM = 40
const STRIP_LINK_MM = 96
const SPARSE_CAP_MM = 96
const TIGHT_STEP_MM = 12
const EVEN_STEP_MM = 6
const AXIS_STEP_MM = 3
const SYMMETRY_TOL_FRAC = 0.11
const BAND_STEP_MM = 24

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

export interface WrapMeasures {
  left: number
  right: number
  top: number
  bottom: number
  maxSide: number
  total: number
  imbalance: number
  imbalanceSumMM: number
  gridExtentXMM: number
  gridExtentYMM: number
}

/** Per-side overhang of the shape beyond the magnets' padded box. Pure measure. */
export function measureWrap(
  verts: ReadonlyArray<PointMM>,
  sites: ReadonlyArray<{ x: number; y: number }>,
  paddingMM: number,
): WrapMeasures | null {
  if (!sites.length || verts.length < 3) return null
  const shape = bbox(verts)
  const grid = bbox(sites.map((s) => [s.x, s.y] as PointMM))
  const left = Math.max(0, grid.minX - paddingMM - shape.minX)
  const right = Math.max(0, shape.maxX - (grid.maxX + paddingMM))
  const top = Math.max(0, grid.minY - paddingMM - shape.minY)
  const bottom = Math.max(0, shape.maxY - (grid.maxY + paddingMM))
  return {
    left,
    right,
    top,
    bottom,
    maxSide: Math.max(left, right, top, bottom),
    total: left + right + top + bottom,
    imbalance: Math.max(Math.abs(left - right), Math.abs(top - bottom)),
    imbalanceSumMM: Math.abs(left - right) + Math.abs(top - bottom),
    gridExtentXMM: grid.maxX - grid.minX + 2 * paddingMM,
    gridExtentYMM: grid.maxY - grid.minY + 2 * paddingMM,
  }
}

/** bbox-thirds proxy — not real mass coverage. Short-term stand-in only. */
function coversMasses(c: Candidate, shape: ReturnType<typeof bbox>): boolean {
  const span = shape.maxY - shape.minY
  if (span <= 0) return true
  const ys = c.sites.map((s) => s.y)
  return Math.min(...ys) <= shape.minY + span / 3 && Math.max(...ys) >= shape.maxY - span / 3
}

function siteInTopThird(c: Candidate, shape: ReturnType<typeof bbox>): boolean {
  const span = shape.maxY - shape.minY
  if (span <= 0) return true
  const cut = shape.minY + span / 3
  return c.sites.some((s) => s.y <= cut)
}

/** Four magnets on all four corners of their own box, both axes spread. */
function isCorners(c: Candidate): boolean {
  if (c.sites.length < 4) return false
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of c.sites) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.y < minY) minY = s.y
    if (s.y > maxY) maxY = s.y
  }
  if (maxX - minX < 48 - 1e-6 || maxY - minY < 48 - 1e-6) return false
  const at = (x: number, y: number) =>
    c.sites.some((s) => Math.abs(s.x - x) < 1e-6 && Math.abs(s.y - y) < 1e-6)
  return at(minX, minY) && at(maxX, minY) && at(minX, maxY) && at(maxX, maxY)
}

function pairSpan(c: Candidate): number {
  if (c.sites.length < 2) return 0
  let best = 0
  for (let i = 0; i < c.sites.length; i++) {
    for (let j = i + 1; j < c.sites.length; j++) {
      const d = Math.hypot(c.sites[i].x - c.sites[j].x, c.sites[i].y - c.sites[j].y)
      if (d > best) best = d
    }
  }
  return best
}

function minPairSpan(c: Candidate): number {
  if (c.sites.length < 2) return 0
  let best = Infinity
  for (let i = 0; i < c.sites.length; i++) {
    for (let j = i + 1; j < c.sites.length; j++) {
      const d = Math.hypot(c.sites[i].x - c.sites[j].x, c.sites[i].y - c.sites[j].y)
      if (d < best) best = d
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

function isOneStrip(sites: ReadonlyArray<{ x: number; y: number }>, cap: number): boolean {
  const n = sites.length
  if (n < 2) return true
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.hypot(sites[i].x - sites[j].x, sites[i].y - sites[j].y) <= cap + 1e-6) {
        parent[find(i)] = find(j)
      }
    }
  }
  const root = find(0)
  for (let i = 1; i < n; i++) if (find(i) !== root) return false
  return true
}

function contourIsMirrorSymmetric(verts: ReadonlyArray<PointMM>, tolFrac: number): boolean {
  if (verts.length < 3) return false
  const shape = bbox(verts)
  const cx = (shape.minX + shape.maxX) / 2
  const width = shape.maxX - shape.minX
  if (width <= 0) return false
  const SAMPLES = 24
  for (let i = 1; i < SAMPLES; i++) {
    const y = shape.minY + ((shape.maxY - shape.minY) * i) / SAMPLES
    let rowMin = Infinity
    let rowMax = -Infinity
    for (let j = 0; j < verts.length; j++) {
      const [x1, y1] = verts[j]
      const [x2, y2] = verts[(j + 1) % verts.length]
      if (y1 === y2) continue
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)
        if (x < rowMin) rowMin = x
        if (x > rowMax) rowMax = x
      }
    }
    if (rowMin > rowMax) continue
    if (Math.abs((rowMin + rowMax) / 2 - cx) > tolFrac * width) return false
  }
  return true
}

function sitesAreMirrorSymmetric(sites: ReadonlyArray<{ x: number; y: number }>): boolean {
  if (sites.length < 2) return true
  let minX = Infinity
  let maxX = -Infinity
  for (const s of sites) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
  }
  const cx = (minX + maxX) / 2
  return sites.every((a) =>
    sites.some((b) => Math.abs(b.x - (2 * cx - a.x)) < 1e-6 && Math.abs(b.y - a.y) < 1e-6),
  )
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
  wrap: WrapMeasures | null
}

export function measureProposal(
  spec: GridSystemSpec,
  c: Candidate,
  outline: ReadonlyArray<PointMM>,
): ProposalMeasure {
  const verts = scaleToSize(outline, c.sizeMM)
  const shape = bbox(verts)
  const wrap = measureWrap(verts, c.sites, spec.grid.paddingMM)
  const offset2 = (() => {
    const xs = c.sites.map((s) => s.x)
    const ys = c.sites.map((s) => s.y)
    const hx = (Math.min(...xs) + Math.max(...xs)) / 2
    const hy = (Math.min(...ys) + Math.max(...ys)) / 2
    const cx = (shape.minX + shape.maxX) / 2
    const cy = (shape.minY + shape.maxY) / 2
    return (hx - cx) ** 2 + (hy - cy) ** 2
  })()
  return {
    n: c.sites.length,
    gravity: wrap
      ? wrap.top <= GRAVITY_GUARD_MM ||
        (wrap.top <= VERTICAL_HOLD_MM && siteInTopThird(c, shape))
      : false,
    masses: coversMasses(c, shape),
    top: wrap ? wrap.top : 0,
    extremes: wrap ? wrap.total : 0,
    clear: clearance(c, verts),
    pair: pairSpan(c),
    step: minPairSpan(c),
    area: spanArea(c),
    balance: offset2,
    size: c.sizeMM,
    score: wrap ? wrap.total : 0,
    wrap,
  }
}

export function decidingKey(_band: BandId, won: ProposalMeasure, lost: ProposalMeasure): string {
  if (won.gravity !== lost.gravity) return won.gravity ? 'gravity' : 'gravity-lost'
  if (won.wrap && lost.wrap) {
    const vb = won.wrap.bottom <= VERTICAL_HOLD_MM
    const lb = lost.wrap.bottom <= VERTICAL_HOLD_MM
    if (vb !== lb) return vb ? 'vertical-hold' : 'vertical-hold-lost'
    if (won.wrap.total !== lost.wrap.total) return 'tightness'
    if (won.wrap.imbalanceSumMM !== lost.wrap.imbalanceSumMM) return 'evenness'
  }
  if (won.n !== lost.n) return won.n < lost.n ? 'fewer' : 'fewer-lost'
  if (won.size !== lost.size) return `size ${won.size} < ${lost.size}`
  return 'tie'
}

type Row = {
  c: Candidate
  wrap: WrapMeasures
  holdsTop: boolean
  holdsBottom: boolean
  connected: boolean
  arrangementSym: boolean
  masses: boolean
  corners: boolean
  overSparse: boolean
  spread: number
  axisOff: number
  tight: number
  even: number
  n: number
  size: number
}

function rowOf(spec: GridSystemSpec, c: Candidate, outline: ReadonlyArray<PointMM>): Row | null {
  const verts = scaleToSize(outline, c.sizeMM)
  const wrap = measureWrap(verts, c.sites, spec.grid.paddingMM)
  if (!wrap) return null
  const shape = bbox(verts)
  const cx = (shape.minX + shape.maxX) / 2
  const xs = c.sites.map((s) => s.x)
  const hx = (Math.min(...xs) + Math.max(...xs)) / 2
  const nearest = minPairSpan(c) || 0
  return {
    c,
    wrap,
    holdsTop:
      wrap.top <= GRAVITY_GUARD_MM ||
      (wrap.top <= VERTICAL_HOLD_MM && siteInTopThird(c, shape)),
    holdsBottom: wrap.bottom <= VERTICAL_HOLD_MM,
    connected: isOneStrip(c.sites, STRIP_LINK_MM),
    arrangementSym: sitesAreMirrorSymmetric(c.sites),
    masses: coversMasses(c, shape),
    corners: isCorners(c),
    // Cap, not a preference: spacing past 96 is not an advantage.
    overSparse: nearest > SPARSE_CAP_MM + 1e-6,
    spread: Math.min(nearest, SPARSE_CAP_MM),
    axisOff: Math.abs(hx - cx),
    tight: Math.round(wrap.total / TIGHT_STEP_MM),
    even: Math.round(wrap.imbalanceSumMM / EVEN_STEP_MM),
    n: c.sites.length,
    size: c.sizeMM,
  }
}

function better(a: Row, b: Row, shapeSymmetric: boolean): boolean {
  if (a.holdsTop !== b.holdsTop) return a.holdsTop
  if (a.holdsBottom !== b.holdsBottom) return a.holdsBottom
  if (a.connected !== b.connected) return a.connected
  if (shapeSymmetric && a.arrangementSym !== b.arrangementSym) return a.arrangementSym
  if (a.masses !== b.masses) return a.masses
  if (a.corners !== b.corners) return a.corners
  if (a.n >= 2 && b.n >= 2 && a.n === b.n && a.overSparse !== b.overSparse) return !a.overSparse
  const axisA = Math.round(a.axisOff / AXIS_STEP_MM)
  const axisB = Math.round(b.axisOff / AXIS_STEP_MM)
  if (axisA !== axisB) return axisA < axisB
  if (a.tight !== b.tight) return a.tight < b.tight
  if (a.even !== b.even) return a.even < b.even
  if (a.n !== b.n) return a.n < b.n
  if (a.size !== b.size) return a.size < b.size
  return a.c.id < b.c.id
}

function rankBand(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
  outline: ReadonlyArray<PointMM>,
  sizeFloor: number,
): Candidate[] {
  const raw = doc.candidates.filter((c) => c.band === band)
  const unit = scaleToSize(outline, 100)
  const shapeSymmetric = contourIsMirrorSymmetric(unit, SYMMETRY_TOL_FRAC)
  const rows: Row[] = []
  for (const c of raw) {
    const row = rowOf(spec, c, outline)
    if (row) rows.push(row)
  }
  // Bands 1–3 already live in their own size lists. Only band 4 steps ≥24mm above the last answer.
  const above = band === 4 ? rows.filter((r) => r.size >= sizeFloor) : rows
  let pool = above.length ? above : rows
  // Band 1 is the first size a hold exists. Counts emerge there: only a disc fits.
  if (band === 1 && pool.length) {
    const minSize = Math.min(...pool.map((r) => r.size))
    pool = pool.filter((r) => r.size === minSize)
  }
  pool.sort((a, b) => (better(a, b, shapeSymmetric) ? -1 : 1))
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const { c } of pool) {
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

export function propose(
  spec: GridSystemSpec,
  doc: CandidateDocument,
  band: BandId,
  outline: ReadonlyArray<PointMM>,
): Candidate[] {
  let floor = 0
  let ranked: Candidate[] = []
  for (const b of [1, 2, 3, 4] as const) {
    if (b > band) break
    ranked = rankBand(spec, doc, b, outline, b === 1 ? 0 : floor)
    const win = ranked[0]
    if (win) floor = win.sizeMM + BAND_STEP_MM
    if (b === band) return ranked
  }
  return ranked
}
