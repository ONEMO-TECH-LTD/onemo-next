import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const T1_DIR = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(T1_DIR, '../..')
export const PRESPLIT_ROOT = resolve(REPO_ROOT, '../presplit-399adf')
export const PRESPLIT_COMMIT = '399adf435003f19ee48cde6fd30c17c52727cc74'

const geometryTruthSource = readFileSync(
  resolve(REPO_ROOT, 'src/lib/effect/geometry-truth.ts'),
  'utf8',
)
const toleranceMatch = geometryTruthSource.match(
  /export const MANUFACTURING_TOLERANCE_MM\s*=\s*([0-9.]+)/,
)
if (!toleranceMatch) {
  throw new Error('Could not read MANUFACTURING_TOLERANCE_MM from geometry-truth.ts.')
}
export const MANUFACTURING_TOLERANCE_MM = Number(toleranceMatch[1])

export const SHAPES = ['square', 'rect', 'circle', 'triangle', 'diamondShape'] as const
export const USER_SHAPES = ['square', 'circle', 'triangle', 'diamondShape'] as const
export const ATTACHMENTS = ['magnetic', 'twinfix', 'velcro'] as const
export const GRID_ATTACHMENTS = ['magnetic', 'twinfix'] as const
export const DENSITIES = ['light', 'standard'] as const
export const MODES = ['auto', 'standard', 'diamond', 'quincunx'] as const
export const PARITY_SIZES = [70, 118, 166, 214, 262, 310, 91, 143] as const

export type Shape = (typeof SHAPES)[number]
export type UserShape = (typeof USER_SHAPES)[number]
export type Attachment = (typeof ATTACHMENTS)[number]
export type Density = (typeof DENSITIES)[number]
export type Mode = (typeof MODES)[number]

export interface GridEngineModule {
  resolveGridPlan(
    contour: unknown,
    options?: Record<string, unknown>,
  ): ResolvedPlan
  resolveUserGridPlan?(
    contour: unknown,
    attachment: Attachment,
  ): ResolvedPlan
  stdShapeContour(shape: Shape, widthMM: number, heightMM?: number): unknown
}

export interface ResolvedPlan {
  grid: {
    anchors: Array<{ p: [number, number]; dia: number }>
    rescueAnchors?: Array<[number, number]>
    flaps: Array<[number, number]>
    [key: string]: unknown
  }
  pitchMM: number
  pattern: 'standard' | 'diamond' | 'quincunx' | null
  [key: string]: unknown
}

export interface CorpusCase {
  key: string
  value: string
}

export function rangeInclusive(from: number, to: number, step: number): number[] {
  const values: number[] = []
  for (let value = from; value <= to; value += step) values.push(value)
  return values
}

export function jsonSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function readArtifact<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(T1_DIR, name), 'utf8')) as T
}

export async function loadEngine(modulePath: string): Promise<GridEngineModule> {
  return await import(/* @vite-ignore */ pathToFileURL(modulePath).href) as GridEngineModule
}

export function currentEnginePath(): string {
  return resolve(REPO_ROOT, 'src/lib/effect/grid-core.ts')
}

export function preSplitEnginePath(): string {
  return resolve(PRESPLIT_ROOT, 'src/lib/effect/grid.ts')
}

/**
 * T1's only parity normalisation. Object spread preserves the remaining property order.
 * Nothing is sorted, rounded, resampled, or otherwise rewritten.
 */
export function dropRescueAnchors(plan: ResolvedPlan): ResolvedPlan {
  const grid = { ...plan.grid }
  delete grid.rescueAnchors
  return { ...plan, grid }
}

export function parityCorpus(engine: GridEngineModule): {
  cases: CorpusCase[]
  missingRescueCases: string[]
  nonEmptyRescueCases: string[]
} {
  const cases: CorpusCase[] = []
  const missingRescueCases: string[] = []
  const nonEmptyRescueCases: string[] = []
  for (const shape of SHAPES)
    for (const attachment of ATTACHMENTS)
      for (const density of DENSITIES)
        for (const mode of MODES)
          for (const sizeMM of PARITY_SIZES) {
            const key = [shape, attachment, density, mode, sizeMM].join('|')
            try {
              // `rect` intentionally receives one size argument. At 399adf this defaults
              // height to width; changing it would change the frozen 960-case question.
              const contour = engine.stdShapeContour(shape, sizeMM)
              const plan = engine.resolveGridPlan(contour, { attachment, density, mode })
              const rescueAnchors = plan.grid.rescueAnchors
              if (rescueAnchors === undefined) {
                missingRescueCases.push(key)
              } else if (rescueAnchors.length > 0) {
                nonEmptyRescueCases.push(key)
              }
              cases.push({ key, value: JSON.stringify(dropRescueAnchors(plan)) })
            } catch (error) {
              cases.push({
                key,
                value: `ERR:${String((error as Error)?.message ?? error)}`,
              })
            }
          }
  return { cases, missingRescueCases, nonEmptyRescueCases }
}

export function userVsGenericCorpus(engine: GridEngineModule): {
  cases: Array<{ key: string; identical: boolean; generic: string; user: string }>
  identical: number
  different: number
  differentWithoutRescue: string[]
} {
  if (!engine.resolveUserGridPlan) {
    throw new Error('Current engine does not expose resolveUserGridPlan.')
  }
  const cases: Array<{ key: string; identical: boolean; generic: string; user: string }> = []
  const differentWithoutRescue: string[] = []
  let identical = 0
  let different = 0
  for (const shape of USER_SHAPES)
    for (const attachment of ATTACHMENTS)
      for (const sizeMM of rangeInclusive(40, 310, 6)) {
        const key = [shape, attachment, sizeMM].join('|')
        const contour = engine.stdShapeContour(shape, sizeMM)
        // Deliberately attachment-only: the User resolver has no density/mode inputs.
        const genericPlan = engine.resolveGridPlan(contour, { attachment })
        const userPlan = engine.resolveUserGridPlan(contour, attachment)
        const generic = JSON.stringify(dropRescueAnchors(genericPlan))
        const user = JSON.stringify(dropRescueAnchors(userPlan))
        const same = generic === user
        if (same) identical++
        else {
          different++
          if ((userPlan.grid.rescueAnchors?.length ?? 0) === 0) {
            differentWithoutRescue.push(key)
          }
        }
        cases.push({ key, identical: same, generic, user })
      }
  return { cases, identical, different, differentWithoutRescue }
}

function modulo(value: number, period: number): number {
  const result = ((value % period) + period) % period
  return Math.abs(result - period) <= MANUFACTURING_TOLERANCE_MM ? 0 : result
}

export interface LatticeProjection {
  originMM: [number, number]
  basisMM: number
  indices: Array<[number, number]>
  maxRoundTripErrorMM: number
}

export function projectOneLegalLattice(plan: ResolvedPlan): LatticeProjection | null {
  const points = plan.grid.anchors.map((anchor) => anchor.p)
  if (points.length < 2 || plan.pattern === null) return null
  if (plan.pitchMM !== 48 && plan.pitchMM !== 96) return null

  // Derive candidate phases from EVERY anchor, then validate each candidate
  // against EVERY anchor. Dice points may belong to either the integer or the
  // paired half-step sub-lattice, so each point contributes both hypotheses.
  const candidates: Array<[number, number]> = []
  for (const [x, y] of points) {
    candidates.push([modulo(x, plan.pitchMM), modulo(y, plan.pitchMM)])
    if (plan.pattern === 'quincunx') {
      const half = plan.pitchMM / 2
      candidates.push([
        modulo(x - half, plan.pitchMM),
        modulo(y - half, plan.pitchMM),
      ])
    }
  }

  const uniqueCandidates = [...new Map(
    candidates.map((origin) => [`${origin[0].toFixed(9)}|${origin[1].toFixed(9)}`, origin]),
  ).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])

  for (const originMM of uniqueCandidates) {
    const indices: Array<[number, number]> = []
    let maxRoundTripErrorMM = 0
    for (const [x, y] of points) {
      const rawX = (x - originMM[0]) / plan.pitchMM
      const rawY = (y - originMM[1]) / plan.pitchMM
      const ix = plan.pattern === 'quincunx' ? Math.round(rawX * 2) / 2 : Math.round(rawX)
      const iy = plan.pattern === 'quincunx' ? Math.round(rawY * 2) / 2 : Math.round(rawY)
      const rx = originMM[0] + ix * plan.pitchMM
      const ry = originMM[1] + iy * plan.pitchMM
      maxRoundTripErrorMM = Math.max(maxRoundTripErrorMM, Math.hypot(x - rx, y - ry))
      indices.push([ix, iy])
    }
    if (maxRoundTripErrorMM > MANUFACTURING_TOLERANCE_MM) continue

    if (plan.pattern === 'diamond') {
      const parities = new Set(indices.map(([x, y]) => Math.abs((x + y) % 2)))
      if (parities.size !== 1) continue
    }
    if (plan.pattern === 'quincunx') {
      const legal = indices.every(([x, y]) => {
        const xHalf = Math.abs(x * 2 - Math.round(x * 2)) <= 1e-9
        const yHalf = Math.abs(y * 2 - Math.round(y * 2)) <= 1e-9
        const xParity = Math.abs(Math.round(x * 2) % 2)
        const yParity = Math.abs(Math.round(y * 2) % 2)
        return xHalf && yHalf && xParity === yParity
      })
      if (!legal) continue
    }
    return { originMM, basisMM: plan.pitchMM, indices, maxRoundTripErrorMM }
  }
  return null
}

/** Exact reproduction of the original bounded measurement, including its known first-point origin. */
export function legacyOnOneLattice(points: ReadonlyArray<[number, number]>): boolean {
  if (points.length < 2) return true
  for (const pitch of [48, 96])
    for (const half of [false, true]) {
      const step = half ? pitch / 2 : pitch
      const [originX, originY] = points[0]
      if (points.every(([x, y]) => {
        const dx = (x - originX) / step
        const dy = (y - originY) / step
        return (
          Math.abs(dx - Math.round(dx)) < 0.01
          && Math.abs(dy - Math.round(dy)) < 0.01
        )
      })) return true
    }
  return false
}

export function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`)
  }
}

export function finish(label: string, body: unknown): never {
  console.log(JSON.stringify({ status: 'PASS', proof: label, ...body as object }, null, 2))
  process.exit(0)
}

export function fail(label: string, error: unknown): never {
  console.error(JSON.stringify({
    status: 'FAIL',
    proof: label,
    error: String((error as Error)?.message ?? error),
  }, null, 2))
  process.exit(1)
}
