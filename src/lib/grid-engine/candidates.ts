// One pass: scale form → lattice sites → disc-fit → grammar. No ranking.

import {
  magnetsInRegion,
  registrationOffsetMM,
  type PointMM,
  type RegionMM,
} from './engine'
import { enumerateArrangements, type Arrangement, type IndexedSite } from './enumerate'
import {
  bboxCenter,
  centroidMM,
  discFitsGrid,
  maxClearanceMM,
  prepareOutline,
  type PreparedOutline,
} from './measure'
import {
  ANCHORS,
  BAND_SIZES_MM,
  type AnchorKind,
  type BandId,
  type GridSystemSpec,
} from './spec'

export interface Candidate {
  id: string
  band: BandId
  sizeMM: number
  anchor: AnchorKind
  family: Arrangement['family']
  population: Arrangement['population']
  stepCol: number
  stepRow: number
  sites: Array<{ col: number; row: number; x: number; y: number }>
}

export interface CandidateDocument {
  candidates: Candidate[]
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

/** Scale the locked form so its longest side is sizeMM. Aspect locked. 1mm floor. */
export function scaleToSize(verts: ReadonlyArray<PointMM>, sizeMM: number): PointMM[] {
  const { cx, cy, longest } = formBbox(verts)
  if (longest <= 0) return verts.map(([x, y]) => [x, y])
  const k = sizeMM / longest
  const out: PointMM[] = []
  for (const [x, y] of verts) {
    const p: PointMM = [Math.round((x - cx) * k), Math.round((y - cy) * k)]
    const last = out[out.length - 1]
    if (last && last[0] === p[0] && last[1] === p[1]) continue
    out.push(p)
  }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) {
    out.pop()
  }
  return out.length >= 3 ? out : verts.map(([x, y]) => [(x - cx) * k, (y - cy) * k])
}

function shift(verts: ReadonlyArray<PointMM>, dx: number, dy: number): PointMM[] {
  return verts.map(([x, y]) => [x + dx, y + dy])
}

function placeOnAnchor(scaled: PointMM[], kind: AnchorKind): PointMM[] {
  const prep = prepareOutline(scaled)
  const target: PointMM = [0, 0]
  const src =
    kind === 'bbox' ? bboxCenter(prep) : kind === 'centroid' ? centroidMM(prep) : maxClearanceMM(prep)
  return shift(scaled, target[0] - src[0], target[1] - src[1])
}

function indexSites(points: PointMM[], origin: PointMM, pitch: number): Array<{ col: number; row: number; x: number; y: number }> {
  return points.map(([x, y]) => ({
    col: Math.round((x - origin[0]) / pitch),
    row: Math.round((y - origin[1]) / pitch),
    x,
    y,
  }))
}

function thin(sites: IndexedSite[]): IndexedSite[] {
  return sites.filter((s) => s.col % 2 === 0 && s.row % 2 === 0)
}

function coarsen(verts: ReadonlyArray<PointMM>): PointMM[] {
  if (verts.length <= 400) return verts.map(([x, y]) => [x, y])
  const step = Math.ceil(verts.length / 400)
  const out: PointMM[] = []
  for (let i = 0; i < verts.length; i += step) out.push([verts[i][0], verts[i][1]])
  return out.length >= 3 ? out : verts.map(([x, y]) => [x, y])
}

export function collectCandidates(
  spec: GridSystemSpec,
  outline: ReadonlyArray<PointMM>,
): CandidateDocument {
  if (outline.length < 3) return { candidates: [] }
  outline = coarsen(outline)
  const offset = registrationOffsetMM(spec.grid, spec.registration)
  const origin: PointMM = [offset, offset]
  const dense = { ...spec.grid, pitchMM: spec.grid.basePitchMM }
  const field = fieldOf(spec)
  const candidates: Candidate[] = []
  const bands = [1, 2, 3, 4] as const

  for (const band of bands) {
    for (const sizeMM of BAND_SIZES_MM[band]) {
      const scaled = scaleToSize(outline, sizeMM)
      for (const anchor of ANCHORS) {
        const placed = placeOnAnchor(scaled, anchor)
        const prep: PreparedOutline = prepareOutline(placed)
        const raw = magnetsInRegion(dense, field, offset, [0, 0])
        const indexed = indexSites(raw, origin, spec.grid.basePitchMM)
        const base: IndexedSite[] = indexed.map((s) => ({
          ...s,
          fits: discFitsGrid(prep, [s.x, s.y], spec.grid),
        }))
        const packs: Array<{ population: 'base' | 'sparse'; sites: IndexedSite[] }> = [
          { population: 'base', sites: base },
          { population: 'sparse', sites: thin(base) },
        ]
        for (const pack of packs) {
          for (const arr of enumerateArrangements(pack.sites, pack.population)) {
            const id = [
              band,
              sizeMM,
              anchor,
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
              anchor,
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
