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

function fitCells(prep: PreparedOutline, spec: GridSystemSpec): PointMM[] {
  const x0 = Math.ceil(Number(prep.minX) / 1000)
  const x1 = Math.floor(Number(prep.maxX) / 1000)
  const y0 = Math.ceil(Number(prep.minY) / 1000)
  const y1 = Math.floor(Number(prep.maxY) / 1000)
  const out: PointMM[] = []
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (discFitsGrid(prep, [x, y], spec.grid)) out.push([x, y])
    }
  }
  return out
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

  for (const band of bands) {
    for (const sizeMM of BAND_SIZES_MM[band]) {
      const scaled = thinForFit(scaleToSize(outline, sizeMM), 1)
      const prep: PreparedOutline = prepareOutline(scaled)
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
          for (const arr of enumerateArrangements(pack.sites, pack.population)) {
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
      if (band === 1) {
        for (const [x, y] of fitCells(prep, spec)) {
          pushSingle(candidates, spec, band, sizeMM, half, x, y)
        }
      }
    }
  }

  // Band 2 is a pair. Same 1mm seats; keep every lattice neighbour that both hold.
  // The duck wrap is 78mm — not on the 12mm ladder, and not on the 12mm pans.
  {
    const pitch = spec.grid.basePitchMM
    const sizes = BAND_SIZES_MM[2]
    const lo = sizes[0]
    const hi = sizes[sizes.length - 1]
    const dirs: PointMM[] = [
      [0, pitch],
      [pitch, 0],
      [pitch, pitch],
      [pitch, -pitch],
    ]
    for (let sizeMM = lo; sizeMM <= hi; sizeMM++) {
      const scaled = thinForFit(scaleToSize(outline, sizeMM), 1)
      const prep = prepareOutline(scaled)
      const cells = fitCells(prep, spec)
      const at = new Set(cells.map(([x, y]) => `${x},${y}`))
      let found = 0
      for (const [x, y] of cells) {
        for (const [dx, dy] of dirs) {
          if (!at.has(`${x + dx},${y + dy}`)) continue
          pushPair(candidates, spec, 2, sizeMM, half, [x, y], [x + dx, y + dy])
          found++
        }
      }
      if (found) break
    }
  }

  // Bands 3–4: first size a corner set holds. Do not stop on a 3 if a 4 still fits tighter later.
  for (const band of [3, 4] as const) {
    const pitch = spec.grid.basePitchMM
    const sizes = BAND_SIZES_MM[band]
    const lo = sizes[0]
    const hi = sizes[sizes.length - 1]
    const spans = band === 4 ? [pitch, pitch * 2, pitch * 3] : [pitch, pitch * 2]
    let pending3: { sizeMM: number; sets: PointMM[][] } | null = null
    for (let sizeMM = lo; sizeMM <= hi; sizeMM++) {
      const scaled = thinForFit(scaleToSize(outline, sizeMM), 1)
      const prep = prepareOutline(scaled)
      const cells = fitCells(prep, spec)
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
            if (held.length === 4) {
              const sc = dx / pitch
              const sr = dy / pitch
              // Band 4 jumps the grid step. 48×96 is band 3; keep 48×144 / 96×96 and up.
              if (band === 4 && sc + sr < 4) continue
              fours.push(held)
            } else if (held.length === 3 && band === 3) threes.push(held)
          }
        }
      }
      if (fours.length) {
        for (const held of fours) {
          pushCorners(candidates, spec, band, sizeMM, half, held, 'rectangle-corners')
        }
        for (const held of threes) {
          pushCorners(candidates, spec, band, sizeMM, half, held, 'corner-triangle')
        }
        pending3 = null
        break
      }
      if (threes.length && !pending3) pending3 = { sizeMM, sets: threes }
    }
    if (pending3) {
      for (const held of pending3.sets) {
        pushCorners(candidates, spec, band, pending3.sizeMM, half, held, 'corner-triangle')
      }
    }
  }

  return { candidates }
}
