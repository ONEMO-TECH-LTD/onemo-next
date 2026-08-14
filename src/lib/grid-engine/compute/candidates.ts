// compute/candidates.ts — THE SEAM. It calls the two delivered packages and converts units.
//
// It implements no geometry, no grammar and no policy. Every law value is READ from the spec through
// the scaffold's own engine; a literal 48 / 24 / 12 / 9 in this file is a defect.
//
// Dan, 2026-08-14: "Can we not invent anything extra before we actually assembled purely what gpt
// pro coded in our scaffold structure installing it cleanly and modular. After that we test and work
// from practice not theory."
//
// So this calls the modules the way they were BUILT to be called — measure at sizes, enumerate from
// the measurement — and we look at what comes out. Nothing here improves, reorders or second-guesses
// them.

import { measureLattice } from './magnetic-grid-measurement-kernel/dist/index.js'
import { enumerateCandidates } from './enumerator/dist/index.js'
import { cellDiameterMM, registrationOffsetMM, type PointMM } from '../engine'
import type { GridSystemSpec, Registration } from '../spec'

/** The traced silhouette as the tracer produces it: integer pixel coordinates, plus its image box. */
export interface TracedRing {
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly width: number
  readonly height: number
}

/**
 * What one registration produced: **both delivered documents unchanged**, plus an additive
 * millimetre projection for drawing. Part 3 requires the two documents verbatim, so nothing here
 * may discard them.
 */
export interface MeasuredRegistration {
  readonly registration: Registration
  /** The kernel's document, exactly as returned. */
  readonly measurementDocument: unknown
  /** The enumerator's document, exactly as returned. */
  readonly candidateDocument: unknown
  /** Additive, for drawing only. */
  readonly display: ReadonlyArray<RawCandidate>
}

/** One arrangement the delivered enumerator returned, with its positions in millimetres. */
export interface RawCandidate {
  readonly id: string
  readonly family: string
  readonly population: string
  readonly steps: { readonly column: string; readonly row: string }
  /** Millimetres on the scaffold's own lattice, ready to draw. */
  readonly positionsMM: ReadonlyArray<PointMM>
  /** The size occurrence this arrangement was found at. */
  readonly sizeMM: number
  /** Which registration was measured. */
  readonly registration: Registration
}

const int = (n: number): string => Math.round(n).toString()
const rational = (n: number) => ({ numerator: int(n), denominator: '1' })

/** The kernel rejects rather than repairs: drop consecutive duplicates and any repeated close. */
function cleanRing(points: TracedRing['points']): Array<{ x: bigint; y: bigint }> {
  const out: Array<{ x: bigint; y: bigint }> = []
  for (const [x, y] of points) {
    const p = { x: BigInt(Math.round(x)), y: BigInt(Math.round(y)) }
    const last = out[out.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p)
  }
  while (out.length > 1) {
    const first = out[0]!
    const last = out[out.length - 1]!
    if (first.x === last.x && first.y === last.y) out.pop()
    else break
  }
  return out
}

function boundsOf(v: ReadonlyArray<{ x: bigint; y: bigint }>) {
  let minX = v[0]!.x, maxX = v[0]!.x, minY = v[0]!.y, maxY = v[0]!.y
  for (const p of v) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY }
}

export interface EnumerateOptions {
  /** The sizes to measure, in millimetres — supplied by the caller for this first assembly. */
  readonly sizesMM: ReadonlyArray<number>
  /** Where the shape's anchor sits on the field, in millimetres. */
  readonly targetAnchorMM: PointMM
}

/**
 * Measure the delivered kernel over the supplied sizes, enumerate with the delivered enumerator,
 * and return every candidate with its positions in millimetres.
 *
 * One call per registration: the kernel takes one lattice origin, and registration is what moves it.
 */
export function enumerateForRing(
  spec: GridSystemSpec,
  ring: TracedRing,
  options: EnumerateOptions,
): MeasuredRegistration[] {
  const vertices = cleanRing(ring.points)
  if (vertices.length < 3) {
    // Loud, not empty: an unusable ring must not look like a valid no-candidate result.
    throw new Error('grid-engine seam: traced ring has fewer than three distinct points')
  }

  // The shell sizes and draws the whole IMAGE box and maps trace points through image UV, so the
  // seam must measure that same box. Tight-wrapping to the silhouette bbox here would put the
  // engine on a different shape than the screen whenever the picture carries transparent margin.
  const b = {
    minX: BigInt(0),
    maxX: BigInt(Math.round(ring.width)),
    minY: BigInt(0),
    maxY: BigInt(Math.round(ring.height)),
  }
  const spanX = b.maxX - b.minX
  const spanY = b.maxY - b.minY
  const sourceSize = spanX > spanY ? spanX : spanY
  if (sourceSize <= BigInt(0)) {
    throw new Error('grid-engine seam: traced ring has zero extent')
  }

  const discDiameter = cellDiameterMM(spec.grid)
  const half = Math.floor(spec.grid.positionsPerAxis / 2)
  const minIndex = -half
  const maxIndex = minIndex + spec.grid.positionsPerAxis - 1

  const out: MeasuredRegistration[] = []

  for (const registration of ['point', 'gap'] as const) {
    const originMM = registrationOffsetMM(spec.grid, registration)
    const measurement = measureLattice({
      polygon: { vertices },
      parameters: {
        lattice: {
          pitch: int(spec.grid.basePitchMM),
          origin: { x: rational(originMM), y: rational(originMM) },
          fieldExtent: {
            minColumn: int(minIndex),
            maxColumn: int(maxIndex),
            minRow: int(minIndex),
            maxRow: int(maxIndex),
          },
        },
        discDiameter: int(discDiameter),
        sizeTransform: {
          sourceSize: sourceSize.toString(),
          sourceAnchor: {
            x: { numerator: (b.minX + b.maxX).toString(), denominator: '2' },
            y: { numerator: (b.minY + b.maxY).toString(), denominator: '2' },
          },
          targetAnchor: {
            x: rational(options.targetAnchorMM[0]),
            y: rational(options.targetAnchorMM[1]),
          },
        },
      },
      sizes: options.sizesMM.map((s) => int(s)),
    })

    const document = enumerateCandidates({
      measurement,
      grammar: {
        schema: 'magnetic-grid-candidate-enumerator/grammar/v1',
        populations: [
          { id: 'base', origin: { column: '0', row: '0' }, indexStep: '1' },
          // Explicit caller data, per the delivered contract: sparse is every second base point.
          // Never inferred from the shell's selected pitch.
          { id: 'sparse', origin: { column: '0', row: '0' }, indexStep: '2' },
        ],
        families: {
          single: {},
          run: { stepDomain: 'any-positive-whole-population-step' },
          'rectangle-corners': {},
          'corner-triangle': {},
          'full-window': { oneByOne: 'include' },
        },
      },
    })

    const display: RawCandidate[] = []
    for (const candidate of document.candidates) {
      display.push({
        id: candidate.id,
        family: candidate.family,
        population: candidate.population,
        steps: candidate.steps,
        sizeMM: Number(candidate.size.value),
        registration,
        positionsMM: candidate.positions.map((p) => [
          Number(p.center.x.numerator) / Number(p.center.x.denominator),
          Number(p.center.y.numerator) / Number(p.center.y.denominator),
        ] as PointMM),
      })
    }
    // Documents preserved verbatim; the projection is additive, never a replacement.
    out.push({ registration, measurementDocument: measurement, candidateDocument: document, display })
  }

  return out
}
