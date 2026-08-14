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
    }
  }

  return { candidates }
}
