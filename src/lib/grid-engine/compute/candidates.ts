// grid-engine/compute/candidates.ts — THE SEAM.
//
// The one file that drives the two accepted measurement packages. It calls them exactly as their
// contracts say to call them, and it owns nothing else: no product policy, no law value of its own,
// no geometry the kernel already does.
//
// WHAT IT OWNS: the transform and field arithmetic needed to state a request — that is calculation,
// and calculation belongs in compute.
// WHAT IT DOES NOT OWN: the arrangement grammar (released policy, it arrives from `spec`), any
// judgement, any ranking, and any repair of a shape the kernel refuses.
//
// EXACTNESS. Nothing on the path INTO the kernel is a JavaScript number: vertices, pitch, disc,
// extents, anchors and sizes are all bigint or canonical decimal strings. `Number()` appears exactly
// once, in the additive display projection at the bottom, after both documents already exist.

import { measureLattice } from './magnetic-grid-measurement-kernel/dist/index.js'
import type {
  LatticeMeasurementDocumentJson,
  RationalPointJson,
} from './magnetic-grid-measurement-kernel/dist/index.js'
import { enumerateCandidates } from './enumerator/dist/index.js'
import type {
  ArrangementGrammarInput,
  CandidateEnumerationDocumentJson,
} from './enumerator/dist/index.js'
import { cellDiameterMM, registrationOffsetMM } from '../engine'
import type { GridSystemSpec } from '../spec'

/**
 * The traced ring as the browser adapter produced it: coordinates in the source image's own pixel
 * space, and the image box they were measured against.
 *
 * DECLARED HERE, NOT IN `ui/`. The bridge orchestrates this call and may not import from `ui/` —
 * it travels with the portable unit. So the type lives with the code that consumes it and the
 * adapter's return value satisfies it structurally; nothing crosses inward from the browser side.
 */
export interface TracedRingInput {
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly width: number
  readonly height: number
}

export interface MeasuredField {
  /** The kernel's document, exactly as returned. Part 3 requires it verbatim. */
  readonly measurement: LatticeMeasurementDocumentJson
  /** The enumerator's document, exactly as returned. Part 3 requires it verbatim. */
  readonly candidates: CandidateEnumerationDocumentJson
  /**
   * ADDITIVE. Millimetre centres per candidate, for drawing only. Derived from the documents above
   * and never substituted for them — a projection is a convenience, not evidence.
   */
  readonly display: ReadonlyArray<{
    readonly candidateId: string
    readonly centresMM: ReadonlyArray<readonly [number, number]>
  }>
}

export interface MeasureFieldRequest {
  readonly ring: TracedRingInput
  readonly spec: GridSystemSpec
  /** The one size currently on screen. The scaffold publishes no legal-size ladder and none is invented. */
  readonly sizeMM: number
  /** Released policy, supplied by the caller. The enumerator ships no grammar and demands one. */
  readonly grammar: ArrangementGrammarInput
}

/** Every exact value the kernel is asked for, in one place, so a test can assert the request itself. */
export interface KernelRequest {
  readonly polygon: { readonly vertices: ReadonlyArray<{ readonly x: bigint; readonly y: bigint }> }
  readonly parameters: {
    readonly lattice: {
      readonly pitch: bigint
      readonly origin: { readonly x: Rational; readonly y: Rational }
      readonly fieldExtent: {
        readonly minColumn: bigint
        readonly maxColumn: bigint
        readonly minRow: bigint
        readonly maxRow: bigint
      }
    }
    readonly discDiameter: bigint
    readonly sizeTransform: {
      readonly sourceSize: bigint
      readonly sourceAnchor: { readonly x: Rational; readonly y: Rational }
      readonly targetAnchor: { readonly x: Rational; readonly y: Rational }
    }
  }
  readonly sizes: readonly bigint[]
}

interface Rational {
  readonly numerator: bigint
  readonly denominator: bigint
}

export class SeamInputError extends Error {
  public readonly path: string
  public constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'SeamInputError'
    this.path = path
  }
}

/**
 * A whole number, or the call fails. Never rounds — a silent round is the approximation the brief
 * forbids, and it hides exactly the defects this seam exists to surface.
 */
function exactInteger(value: number, path: string): bigint {
  if (!Number.isFinite(value)) throw new SeamInputError(path, `expected a finite number, received ${value}`)
  if (!Number.isSafeInteger(value)) {
    throw new SeamInputError(path, `expected a whole number within safe range, received ${value}`)
  }
  return BigInt(value)
}

/**
 * A HALF-INTEGER, doubled. `traceContourRaw` emits marching-squares edge midpoints, so every
 * coordinate sits on a pixel boundary or exactly halfway across one. Doubling is a lossless change
 * of unit — it is the whole reason the kernel can take this ring at all — and anything that is not
 * a half-integer is a defect upstream, reported rather than rounded away.
 */
function exactDoubled(value: number, path: string): bigint {
  if (!Number.isFinite(value)) throw new SeamInputError(path, `expected a finite number, received ${value}`)
  const doubled = value * 2
  if (!Number.isSafeInteger(doubled)) {
    throw new SeamInputError(
      path,
      `expected a half-integer within safe range, received ${value} (x2 = ${doubled})`,
    )
  }
  return BigInt(doubled)
}

/** An exact rational from a half-integer millimetre value, so no anchor is ever rounded. */
function halfIntegerRational(value: number, path: string): Rational {
  return { numerator: exactDoubled(value, path), denominator: BigInt(2) }
}

const ZERO: Rational = { numerator: BigInt(0), denominator: BigInt(1) }

/**
 * Build the kernel request. Separated from the call so a test can assert every value the kernel is
 * asked for, rather than inferring the request from its answer.
 */
export function buildKernelRequest(request: MeasureFieldRequest): KernelRequest {
  const { ring, spec, sizeMM } = request
  const { grid } = spec

  if (ring.points.length < 3) {
    throw new SeamInputError('ring.points', `a polygon needs at least three points, received ${ring.points.length}`)
  }
  const width = exactInteger(ring.width, 'ring.width')
  const height = exactInteger(ring.height, 'ring.height')
  if (width <= BigInt(0) || height <= BigInt(0)) {
    throw new SeamInputError('ring', `image dimensions must be positive, received ${ring.width}x${ring.height}`)
  }

  // x2: exact integers out of half-integer midpoints, no rounding anywhere.
  const vertices = ring.points.map(([x, y], index) => ({
    x: exactDoubled(x, `ring.points[${index}].x`),
    y: exactDoubled(y, `ring.points[${index}].y`),
  }))

  // THE SOURCE MEASURE, in the polygon's own (doubled) units. Not the millimetre size — that is the
  // requested size, and equating them is the dimensional error that measures pixels against a
  // millimetre lattice.
  const sourceSize = BigInt(2) * (width > height ? width : height)

  // The image centre, doubled: (W/2, H/2) x 2 = (W, H). Integers, so no rounding.
  const sourceAnchor = {
    x: { numerator: width, denominator: BigInt(1) },
    y: { numerator: height, denominator: BigInt(1) },
  }

  const N = exactInteger(grid.positionsPerAxis, 'spec.grid.positionsPerAxis')
  if (N <= BigInt(0)) throw new SeamInputError('spec.grid.positionsPerAxis', `must be positive, received ${grid.positionsPerAxis}`)
  // Exactly N positions for every value the guard permits. A symmetric range emits N+1 whenever N
  // is even, which the spec allows.
  const minIndex = -(N / BigInt(2))
  const maxIndex = minIndex + N - BigInt(1)

  // Origin: the registration offset, WITHOUT pan. Live pan would make the document depend on every
  // pointer move; the diagnostic freezes pan instead, so measured and drawn still coincide.
  const offsetMM = registrationOffsetMM(grid, spec.registration)
  const origin = halfIntegerRational(offsetMM, 'engine.registrationOffsetMM')

  const size = exactInteger(sizeMM, 'sizeMM')
  if (size <= BigInt(0)) throw new SeamInputError('sizeMM', `must be positive, received ${sizeMM}`)

  return {
    polygon: { vertices },
    parameters: {
      lattice: {
        pitch: exactInteger(grid.basePitchMM, 'spec.grid.basePitchMM'),
        origin: { x: origin, y: origin },
        fieldExtent: {
          minColumn: minIndex,
          maxColumn: maxIndex,
          minRow: minIndex,
          maxRow: maxIndex,
        },
      },
      discDiameter: exactInteger(cellDiameterMM(grid), 'engine.cellDiameterMM'),
      sizeTransform: { sourceSize, sourceAnchor, targetAnchor: { x: ZERO, y: ZERO } },
    },
    sizes: [size],
  }
}

/**
 * Measure the field and enumerate every lawful arrangement on it.
 *
 * ONE kernel call carrying the whole size list: polygon validation is quadratic in edges and runs
 * once per call rather than once per size.
 *
 * NO FALLBACK. If the kernel refuses the polygon it throws, and that throw propagates untouched. An
 * empty result here would be indistinguishable from "this shape holds nothing", and repairing the
 * ring would be re-implementing geometry the kernel deliberately refuses to guess at.
 */
export function measureField(request: MeasureFieldRequest): MeasuredField {
  const kernelRequest = buildKernelRequest(request)
  const measurement = measureLattice(kernelRequest)
  const candidates = enumerateCandidates({ measurement, grammar: request.grammar })
  return { measurement, candidates, display: projectForDisplay(candidates) }
}

/**
 * THE ONLY PLACE `Number()` APPEARS, and it is downstream of both documents.
 *
 * Exact rationals are what the packages publish and what part 3 will consume; a screen needs
 * millimetres it can draw. This reads the documents and adds a view of them — it replaces nothing,
 * and no validity, identity, request or enumeration path passes through here.
 */
function projectForDisplay(
  document: CandidateEnumerationDocumentJson,
): MeasuredField['display'] {
  return document.candidates.map((candidate) => ({
    candidateId: candidate.id,
    centresMM: candidate.positions.map((position) => rationalPointToMM(position.center)),
  }))
}

function rationalPointToMM(point: RationalPointJson): readonly [number, number] {
  return [
    Number(point.x.numerator) / Number(point.x.denominator),
    Number(point.y.numerator) / Number(point.y.denominator),
  ]
}
