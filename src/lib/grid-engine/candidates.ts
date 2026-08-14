// One pass: scale form → lattice sites → disc-fit → grammar. No ranking.

import {
  magnetsInRegion,
  type PointMM,
  type RegionMM,
} from './engine'
import { enumerateArrangements, type Arrangement, type SiteInput } from './enumerate'
import {
  bboxCenter,
  centroidMM,
  discFitsGrid,
  maxClearanceMM,
  prepareOutline,
  type PreparedOutline,
} from './measure'
import {
  BAND_SIZES_MM,
  type AnchorKind,
  type BandId,
  type GridSystemSpec,
  type Registration,
} from './spec'

export type AxisRegistration = { x: Registration; y: Registration }

export interface Candidate {
  id: string
  band: BandId
  sizeMM: number
  anchor: AnchorKind
  registration: AxisRegistration
  origin: PointMM
  family: Arrangement['family']
  population: Arrangement['population']
  stepCol: number
  stepRow: number
  sites: Array<{ col: number; row: number; x: number; y: number }>
}

export interface CandidateDocument {
  candidates: Candidate[]
}

function latticeOrigins(spec: GridSystemSpec): PointMM[] {
  const step = spec.grid.paddingMM
  const pitch = spec.grid.basePitchMM
  const out: PointMM[] = []
  for (let x = 0; x < pitch; x += step) {
    for (let y = 0; y < pitch; y += step) {
      out.push([x, y])
    }
  }
  return out
}

function namedOrigin(v: number, half: number): Registration {
  return v === half ? 'gap' : 'point'
}

function fieldOf(spec: GridSystemSpec): RegionMM {
  const half = ((spec.grid.positionsPerAxis - 1) * spec.grid.basePitchMM) / 2
  return { x: -half, y: -half, w: half * 2, h: half * 2 }
}

function formBbox(verts: ReadonlyArray<PointMM>): { cx: number; cy: number; longest: number } {
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
  const w = maxX - minX
  const h = maxY - minY
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, longest: Math.max(w, h) }
}

/** Uniform scale about the form centre. No rounding, no vertex drop. */
export function scaleToSize(verts: ReadonlyArray<PointMM>, sizeMM: number): PointMM[] {
  const { cx, cy, longest } = formBbox(verts)
  if (longest <= 0) return verts.map(([x, y]) => [x, y])
  const k = sizeMM / longest
  return verts.map(([x, y]) => [(x - cx) * k, (y - cy) * k])
}

/**
 * Pixel traces put a vertex every fraction of a millimetre. Disc-fit is millimetre work;
 * walking thousands of those edges on every lattice point kills the tab. Keep one point
 * per millimetre. The drawn silhouette stays the full trace.
 */
function thinForFit(verts: ReadonlyArray<PointMM>, minMM: number): PointMM[] {
  if (verts.length <= 3) return verts.map(([x, y]) => [x, y] as PointMM)
  const min2 = minMM * minMM
  const out: PointMM[] = []
  for (const p of verts) {
    const last = out[out.length - 1]
    if (last) {
      const dx = p[0] - last[0]
      const dy = p[1] - last[1]
      if (dx * dx + dy * dy < min2) continue
    }
    out.push([p[0], p[1]])
  }
  if (out.length > 3) {
    const a = out[0]
    const b = out[out.length - 1]
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    if (dx * dx + dy * dy < min2) out.pop()
  }
  return out.length >= 3 ? out : verts.map(([x, y]) => [x, y] as PointMM)
}

function originOf(x: number, y: number, pitch: number): PointMM {
  const ox = ((x % pitch) + pitch) % pitch
  const oy = ((y % pitch) + pitch) % pitch
  return [ox, oy]
}

/** Centre-out so an existence probe on a large shape hits on the first disc. */
function walkFits(
  prep: PreparedOutline,
  spec: GridSystemSpec,
  visit: (x: number, y: number) => boolean,
): void {
  const x0 = Math.ceil(Number(prep.minX) / 1000)
  const x1 = Math.floor(Number(prep.maxX) / 1000)
  const y0 = Math.ceil(Number(prep.minY) / 1000)
  const y1 = Math.floor(Number(prep.maxY) / 1000)
  if (x1 < x0 || y1 < y0) return
  const cx = Math.round((x0 + x1) / 2)
  const cy = Math.round((y0 + y1) / 2)
  const xs: number[] = []
  const ys: number[] = []
  for (let x = x0; x <= x1; x++) xs.push(x)
  for (let y = y0; y <= y1; y++) ys.push(y)
  xs.sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx))
  ys.sort((a, b) => Math.abs(a - cy) - Math.abs(b - cy))
  for (const x of xs) {
    for (const y of ys) {
      if (!discFitsGrid(prep, [x, y], spec.grid)) continue
      if (visit(x, y)) return
    }
  }
}

function fitCells(prep: PreparedOutline, spec: GridSystemSpec): PointMM[] {
  const out: PointMM[] = []
  walkFits(prep, spec, (x, y) => {
    out.push([x, y])
    return false
  })
  return out
}

function makePrepAt(outline: ReadonlyArray<PointMM>) {
  const cache = new Map<number, PreparedOutline>()
  return (sizeMM: number) => {
    const hit = cache.get(sizeMM)
    if (hit) return hit
    const prep = prepareOutline(thinForFit(scaleToSize(outline, sizeMM), 1))
    cache.set(sizeMM, prep)
    return prep
  }
}

/** Smallest millimetre in [lo, hi] that passes. 12mm coarse, then binary refine. */
function smallestWhere(lo: number, hi: number, pred: (sizeMM: number) => boolean): number | null {
  let hit: number | null = null
  for (let sizeMM = lo; sizeMM <= hi; sizeMM += 12) {
    if (pred(sizeMM)) {
      hit = sizeMM
      break
    }
  }
  if (hit === null) {
    const stepped = lo + Math.floor((hi - lo) / 12) * 12
    for (let sizeMM = stepped + 1; sizeMM <= hi; sizeMM++) {
      if (pred(sizeMM)) return sizeMM
    }
    return null
  }
  let a = Math.max(lo, hit - 11)
  let b = hit
  while (a < b) {
    const mid = (a + b) >> 1
    if (pred(mid)) b = mid
    else a = mid + 1
  }
  return a
}

function shift(verts: ReadonlyArray<PointMM>, dx: number, dy: number): PointMM[] {
  return verts.map(([x, y]) => [x + dx, y + dy])
}

function placeOnAnchor(scaled: PointMM[], kind: AnchorKind): PointMM[] {
  const prep = prepareOutline(scaled)
  const src =
    kind === 'bbox' ? bboxCenter(prep) : kind === 'centroid' ? centroidMM(prep) : maxClearanceMM(prep)
  return shift(scaled, -src[0], -src[1])
}

/** Same transform collect uses. The shell draws this so the picture matches the candidate. */
export function placedOutline(
  verts: ReadonlyArray<PointMM>,
  sizeMM: number,
  anchor: AnchorKind,
): PointMM[] {
  return placeOnAnchor(scaleToSize(verts, sizeMM), anchor)
}

/**
 * Picture box under the same uniform scale + anchor as placedOutline.
 * `picture` is the source pixel rectangle (origin top-left). `verts` are in that space.
 */
export function placedPicture(
  verts: ReadonlyArray<PointMM>,
  picture: { w: number; h: number },
  sizeMM: number,
  anchor: AnchorKind,
): { x: number; y: number; w: number; h: number } {
  const { cx, cy, longest } = formBbox(verts)
  const k = longest <= 0 ? 1 : sizeMM / longest
  const placed = placeOnAnchor(scaleToSize(verts, sizeMM), anchor)
  const src = placed[0]
  const scaled0: PointMM = [(verts[0][0] - cx) * k, (verts[0][1] - cy) * k]
  const dx = src[0] - scaled0[0]
  const dy = src[1] - scaled0[1]
  return {
    x: (0 - cx) * k + dx,
    y: (0 - cy) * k + dy,
    w: picture.w * k,
    h: picture.h * k,
  }
}

function indexSites(
  points: PointMM[],
  origin: PointMM,
  pitch: number,
): Array<{ col: number; row: number; x: number; y: number }> {
  return points.map(([x, y]) => ({
    col: Math.round((x - origin[0]) / pitch),
    row: Math.round((y - origin[1]) / pitch),
    x,
    y,
  }))
}

export function collectCandidates(
  spec: GridSystemSpec,
  outline: ReadonlyArray<PointMM>,
): CandidateDocument {
  if (outline.length < 3) return { candidates: [] }
  const half = spec.grid.basePitchMM / 2
  const dense = { ...spec.grid, pitchMM: spec.grid.basePitchMM }
  const field = fieldOf(spec)
  const candidates: Candidate[] = []
  const bands = [1, 2, 3, 4] as const
  const origins = latticeOrigins(spec)

  const emitArrangements = (
    band: BandId,
    sizeMM: number,
    origin: PointMM,
    sites: SiteInput[],
    population: 'base' | 'sparse',
  ) => {
    const registration: AxisRegistration = {
      x: namedOrigin(origin[0], half),
      y: namedOrigin(origin[1], half),
    }
    for (const arr of enumerateArrangements(sites, population)) {
      const id = [
        band,
        sizeMM,
        origin[0],
        origin[1],
        arr.family,
        arr.population,
        arr.stepCol,
        arr.stepRow,
        arr.sites.map((s) => `${s.col},${s.row}`).sort().join('_'),
      ].join(':')
      candidates.push({
        id,
        band,
        sizeMM,
        anchor: 'bbox',
        registration,
        origin,
        family: arr.family,
        population: arr.population,
        stepCol: arr.stepCol,
        stepRow: arr.stepRow,
        sites: arr.sites.map((s) => ({ col: s.col, row: s.row, x: s.x, y: s.y })),
      })
    }
  }

  // Every 12mm size in every band — all lawful holds, any count.
  const packSizes = new Set<number>()
  for (const band of bands) {
    for (const sizeMM of BAND_SIZES_MM[band]) packSizes.add(sizeMM)
  }
  for (const sizeMM of packSizes) {
    const scaled = thinForFit(scaleToSize(outline, sizeMM), 1)
    const prep: PreparedOutline = prepareOutline(scaled)
    const homeBands = bands.filter((band) => BAND_SIZES_MM[band].includes(sizeMM))
    for (const origin of origins) {
      const raw = magnetsInRegion(dense, field, 0, origin)
      const indexed = indexSites(raw, origin, spec.grid.basePitchMM)
      const measured: SiteInput[] = indexed.map((s) => ({
        ...s,
        fits: discFitsGrid(prep, [s.x, s.y], spec.grid),
      }))
      const sparseSites = measured.filter((s) => s.col % 2 === 0 && s.row % 2 === 0)
      for (const band of homeBands) {
        emitArrangements(band, sizeMM, origin, measured, 'base')
        emitArrangements(band, sizeMM, origin, sparseSites, 'sparse')
      }
    }
  }

  const pitch = spec.grid.basePitchMM
  const prepAt = makePrepAt(outline)
  const cellCache = new Map<number, PointMM[]>()
  const cellsAt = (sizeMM: number) => {
    const hit = cellCache.get(sizeMM)
    if (hit) return hit
    const cells = fitCells(prepAt(sizeMM), spec)
    cellCache.set(sizeMM, cells)
    return cells
  }
  const bboxOf = (sizeMM: number) => {
    const prep = prepAt(sizeMM)
    return {
      w: Number(prep.maxX - prep.minX) / 1000,
      h: Number(prep.maxY - prep.minY) / 1000,
    }
  }

  const anyFit = (sizeMM: number) => {
    const box = bboxOf(sizeMM)
    if (box.w < 24 || box.h < 24) return false
    const cached = cellCache.get(sizeMM)
    if (cached) return cached.length > 0
    let hit = false
    walkFits(prepAt(sizeMM), spec, () => {
      hit = true
      return true
    })
    return hit
  }

  /** Two discs 48mm apart — ortho or diagonal — on one lattice origin. */
  const hasAdjacentPair = (sizeMM: number) => {
    const cells = cellsAt(sizeMM)
    const set = new Set(cells.map(([x, y]) => `${x},${y}`))
    for (const [x, y] of cells) {
      if (
        set.has(`${x},${y + pitch}`) ||
        set.has(`${x + pitch},${y}`) ||
        set.has(`${x + pitch},${y + pitch}`) ||
        set.has(`${x + pitch},${y - pitch}`)
      )
        return true
    }
    return false
  }

  /** Top row + two base corners on one origin — the L20 utmost triangle. */
  const hasUtmostThree = (sizeMM: number) => {
    const cells = cellsAt(sizeMM)
    const groups = new Map<string, PointMM[]>()
    for (const p of cells) {
      const origin = originOf(p[0], p[1], pitch)
      const key = `${origin[0]},${origin[1]}`
      let g = groups.get(key)
      if (!g) {
        g = []
        groups.set(key, g)
      }
      g.push(p)
    }
    for (const pts of groups.values()) {
      if (pts.length < 3) continue
      const minY = Math.min(...pts.map((p) => p[1]))
      const maxY = Math.max(...pts.map((p) => p[1]))
      if (maxY - minY < pitch) continue
      const bot = pts.filter((p) => p[1] === maxY)
      if (bot.length < 2) continue
      const L = Math.min(...bot.map((p) => p[0]))
      const R = Math.max(...bot.map((p) => p[0]))
      if (R - L < pitch) continue
      if (pts.some((p) => p[1] === minY && p[0] !== L && p[0] !== R)) return true
    }
    return false
  }

  const emitMillimetre = (band: BandId, sizeMM: number) => {
    const cells = cellsAt(sizeMM)
    // Off-ladder wrap only. A ladder size already has the 12mm pack.
    if (BAND_SIZES_MM[band].includes(sizeMM)) return
    const groups = new Map<string, { origin: PointMM; pts: PointMM[] }>()
    for (const p of cells) {
      const origin = originOf(p[0], p[1], pitch)
      const key = `${origin[0]},${origin[1]}`
      let g = groups.get(key)
      if (!g) {
        g = { origin, pts: [] }
        groups.set(key, g)
      }
      g.pts.push(p)
    }
    for (const { origin, pts } of groups.values()) {
      const measured: SiteInput[] = indexSites(pts, origin, pitch).map((s) => ({
        ...s,
        fits: true,
      }))
      const sparseSites = measured.filter((s) => s.col % 2 === 0 && s.row % 2 === 0)
      emitArrangements(band, sizeMM, origin, measured, 'base')
      emitArrangements(band, sizeMM, origin, sparseSites, 'sparse')
    }
  }

  // Tight wrap: first millimetre a disc holds, then a pair, then the utmost 3.
  for (const band of bands) {
    const sizes = BAND_SIZES_MM[band]
    const lo = sizes[0]
    const hi = sizes[sizes.length - 1]
    const wrap = smallestWhere(lo, hi, anyFit)
    if (wrap !== null) emitMillimetre(band, wrap)
    const wrap2 = smallestWhere(lo, hi, hasAdjacentPair)
    if (wrap2 !== null) emitMillimetre(band, wrap2)
    if (band === 3) {
      const wrap3 = smallestWhere(lo, hi, hasUtmostThree)
      if (wrap3 !== null) emitMillimetre(band, wrap3)
    }
  }

  return { candidates }
}
