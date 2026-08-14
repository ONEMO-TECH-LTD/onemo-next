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

function pushSingle(
  candidates: Candidate[],
  spec: GridSystemSpec,
  band: BandId,
  sizeMM: number,
  half: number,
  x: number,
  y: number,
) {
  const pitch = spec.grid.basePitchMM
  const [ox, oy] = originOf(x, y, pitch)
  const col = Math.round((x - ox) / pitch)
  const row = Math.round((y - oy) / pitch)
  candidates.push({
    id: [band, sizeMM, ox, oy, 'single', 'base', 0, 0, `${col},${row}`].join(':'),
    band,
    sizeMM,
    anchor: 'bbox',
    registration: { x: namedOrigin(ox, half), y: namedOrigin(oy, half) },
    origin: [ox, oy],
    family: 'single',
    population: 'base',
    stepCol: 0,
    stepRow: 0,
    sites: [{ col, row, x, y }],
  })
}

function pushPair(
  candidates: Candidate[],
  spec: GridSystemSpec,
  band: BandId,
  sizeMM: number,
  half: number,
  a: PointMM,
  b: PointMM,
) {
  const pitch = spec.grid.basePitchMM
  const [ox, oy] = originOf(a[0], a[1], pitch)
  const sites = [a, b].map(([x, y]) => ({
    col: Math.round((x - ox) / pitch),
    row: Math.round((y - oy) / pitch),
    x,
    y,
  }))
  const stepCol = Math.abs(sites[1].col - sites[0].col)
  const stepRow = Math.abs(sites[1].row - sites[0].row)
  candidates.push({
    id: [
      band,
      sizeMM,
      ox,
      oy,
      'run',
      'base',
      stepCol,
      stepRow,
      sites.map((s) => `${s.col},${s.row}`).sort().join('_'),
    ].join(':'),
    band,
    sizeMM,
    anchor: 'bbox',
    registration: { x: namedOrigin(ox, half), y: namedOrigin(oy, half) },
    origin: [ox, oy],
    family: 'run',
    population: 'base',
    stepCol,
    stepRow,
    sites,
  })
}

function pushCorners(
  candidates: Candidate[],
  spec: GridSystemSpec,
  band: BandId,
  sizeMM: number,
  half: number,
  corners: PointMM[],
  family: 'rectangle-corners' | 'corner-triangle',
) {
  const pitch = spec.grid.basePitchMM
  const [ox, oy] = originOf(corners[0][0], corners[0][1], pitch)
  const sites = corners.map(([x, y]) => ({
    col: Math.round((x - ox) / pitch),
    row: Math.round((y - oy) / pitch),
    x,
    y,
  }))
  const cols = sites.map((s) => s.col)
  const rows = sites.map((s) => s.row)
  const stepCol = Math.max(...cols) - Math.min(...cols)
  const stepRow = Math.max(...rows) - Math.min(...rows)
  candidates.push({
    id: [
      band,
      sizeMM,
      ox,
      oy,
      family,
      'base',
      stepCol,
      stepRow,
      sites.map((s) => `${s.col},${s.row}`).sort().join('_'),
    ].join(':'),
    band,
    sizeMM,
    anchor: 'bbox',
    registration: { x: namedOrigin(ox, half), y: namedOrigin(oy, half) },
    origin: [ox, oy],
    family,
    population: 'base',
    stepCol,
    stepRow,
    sites,
  })
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

  // Grammar pack stays on the small ladder plus 168 (tests lock those seats).
  // Large-band 12mm enumerations were the 40s — wrap below already finds those holds.
  const packSizes = new Set<number>([...BAND_SIZES_MM[1], 168])
  for (const sizeMM of packSizes) {
    const scaled = thinForFit(scaleToSize(outline, sizeMM), 1)
    const prep: PreparedOutline = prepareOutline(scaled)
    const homeBands = bands.filter((band) => BAND_SIZES_MM[band].includes(sizeMM))
    for (const origin of origins) {
      const registration: AxisRegistration = {
        x: namedOrigin(origin[0], half),
        y: namedOrigin(origin[1], half),
      }
      const raw = magnetsInRegion(dense, field, 0, origin)
      const indexed = indexSites(raw, origin, spec.grid.basePitchMM)
      const measured: SiteInput[] = indexed.map((s) => ({
        ...s,
        fits: discFitsGrid(prep, [s.x, s.y], spec.grid),
      }))
      const sparseSites = measured.filter((s) => s.col % 2 === 0 && s.row % 2 === 0)
      const packs: Array<{ population: 'base' | 'sparse'; sites: SiteInput[] }> = [
        { population: 'base', sites: measured },
        { population: 'sparse', sites: sparseSites },
      ]
      for (const pack of packs) {
        for (const arr of enumerateArrangements(pack.sites, pack.population, { windows: false })) {
          for (const band of homeBands) {
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
  const pairDirs: PointMM[] = [
    [0, pitch],
    [pitch, 0],
    [pitch, pitch],
    [pitch, -pitch],
  ]

  const emitPairs = (sizeMM: number) => {
    const cells = cellsAt(sizeMM)
    const at = new Set(cells.map(([x, y]) => `${x},${y}`))
    let n = 0
    for (const [x, y] of cells) {
      for (const [dx, dy] of pairDirs) {
        if (!at.has(`${x + dx},${y + dy}`)) continue
        pushPair(candidates, spec, 2, sizeMM, half, [x, y], [x + dx, y + dy])
        n++
      }
    }
    return n
  }

  const emitRects = (
    band: 3 | 4,
    sizeMM: number,
    spans: number[],
    accept: (sc: number, sr: number) => boolean,
    seenSteps: Set<string>,
  ) => {
    const cells = cellsAt(sizeMM)
    const at = new Set(cells.map(([x, y]) => `${x},${y}`))
    const fours: PointMM[][] = []
    const threes: PointMM[][] = []
    for (const [x, y] of cells) {
      for (const dx of spans) {
        for (const dy of spans) {
          const corners: PointMM[] = [
            [x, y],
            [x + dx, y],
            [x, y + dy],
            [x + dx, y + dy],
          ]
          const held = corners.filter(([cx, cy]) => at.has(`${cx},${cy}`))
          if (held.length === 4 && accept(dx / pitch, dy / pitch)) fours.push(held)
          else if (held.length === 3 && band === 3) threes.push(held)
        }
      }
    }
    for (const held of fours) {
      const xs = held.map((p) => p[0])
      const ys = held.map((p) => p[1])
      const key = `${Math.round((Math.max(...xs) - Math.min(...xs)) / pitch)}x${Math.round(
        (Math.max(...ys) - Math.min(...ys)) / pitch,
      )}`
      if (seenSteps.has(key)) continue
      seenSteps.add(key)
      pushCorners(candidates, spec, band, sizeMM, half, held, 'rectangle-corners')
    }
    return { fours: fours.length, threes }
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

  const anyPair = (sizeMM: number, spine = false) => {
    const box = bboxOf(sizeMM)
    if (box.w < 24 || box.h < 24) return false
    if (box.w < 72 && box.h < 72) return false
    const cells = cellsAt(sizeMM)
    const at = new Set(cells.map(([x, y]) => `${x},${y}`))
    const { cx, cy } = formBbox(scaleToSize(outline, sizeMM))
    const slop = spec.grid.paddingMM / 2
    for (const [x, y] of cells) {
      for (const [dx, dy] of pairDirs) {
        if (!at.has(`${x + dx},${y + dy}`)) continue
        if (!spine) return true
        const vertical = Math.abs(dx) < Math.abs(dy)
        const mid = vertical ? (x + x + dx) / 2 - cx : (y + y + dy) / 2 - cy
        if (Math.abs(mid) <= slop) return true
      }
    }
    return false
  }

  const anyRect = (
    sizeMM: number,
    spans: number[],
    accept: (sc: number, sr: number) => boolean,
  ) => {
    const box = bboxOf(sizeMM)
    const viable = spans.filter(
      (dx) => spans.some((dy) => accept(dx / pitch, dy / pitch) && box.w >= dx + 24 && box.h >= dy + 24),
    )
    if (!viable.length) return false
    const cells = cellsAt(sizeMM)
    const at = new Set(cells.map(([x, y]) => `${x},${y}`))
    for (const [x, y] of cells) {
      for (const dx of spans) {
        for (const dy of spans) {
          if (!accept(dx / pitch, dy / pitch)) continue
          if (
            at.has(`${x + dx},${y}`) &&
            at.has(`${x},${y + dy}`) &&
            at.has(`${x + dx},${y + dy}`)
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  // Band 1 wrap is the smallest millimetre a disc holds — 43 on the bot, not the 48 ladder step.
  {
    const sizes = BAND_SIZES_MM[1]
    const wrap = smallestWhere(sizes[0], sizes[sizes.length - 1], anyFit)
    if (wrap !== null) {
      for (const [x, y] of cellsAt(wrap)) {
        pushSingle(candidates, spec, 1, wrap, half, x, y)
      }
    }
  }

  // Band 2: first pair, then the 1mm wrap of that pair.
  {
    const sizes = BAND_SIZES_MM[2]
    const wrap =
      smallestWhere(sizes[0], sizes[sizes.length - 1], (s) => anyPair(s, true)) ??
      smallestWhere(sizes[0], sizes[sizes.length - 1], (s) => anyPair(s, false))
    if (wrap !== null) emitPairs(wrap)
  }

  // Band 3: first 4 that reaches both masses (48×96 / 96×48 / 96×96), not a 48×48 belly.
  {
    const sizes = BAND_SIZES_MM[3]
    const spans = [pitch, pitch * 2]
    const mass = (sc: number, sr: number) => sc + sr >= 3
    const wrap = smallestWhere(sizes[0], sizes[sizes.length - 1], (s) => anyRect(s, spans, mass))
    const seen = new Set<string>()
    if (wrap !== null) {
      emitRects(3, wrap, spans, mass, seen)
    } else {
      const any4 = smallestWhere(sizes[0], sizes[sizes.length - 1], (s) =>
        anyRect(s, spans, () => true),
      )
      if (any4 !== null) {
        const { threes } = emitRects(3, any4, spans, () => true, seen)
        for (const held of threes) {
          pushCorners(candidates, spec, 3, any4, half, held, 'corner-triangle')
        }
      }
    }
  }

  // Band 4: jump a lattice step. Keep the first next-step and the first narrow 1×N (inner rectangle).
  {
    const sizes = BAND_SIZES_MM[4]
    const spans = [pitch, pitch * 2, pitch * 3]
    const next = (sc: number, sr: number) => sc + sr >= 4
    const narrow = (sc: number, sr: number) => next(sc, sr) && (sc === 1 || sr === 1)
    const first = smallestWhere(sizes[0], sizes[sizes.length - 1], (s) => anyRect(s, spans, next))
    const tall = smallestWhere(sizes[0], sizes[sizes.length - 1], (s) => anyRect(s, spans, narrow))
    const seen = new Set<string>()
    if (first !== null) emitRects(4, first, spans, next, seen)
    if (tall !== null && tall !== first) emitRects(4, tall, spans, narrow, seen)
  }

  return { candidates }
}
