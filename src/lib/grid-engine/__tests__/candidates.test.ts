// The seam, tested against the evidence bar set before it was written.
//
// The seam is the first file in this installation that can be wrong about GEOMETRY rather than
// about structure — it can produce well-typed, plausible, confidently wrong positions. So the tests
// assert the REQUEST the kernel is handed, not only the answer that comes back: inferring a request
// from its answer is how a wrong transform passes review.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildKernelRequest,
  measureField,
  SeamInputError,
  type MeasureFieldRequest,
} from '../compute/candidates'
import { measureLattice } from '../compute/magnetic-grid-measurement-kernel/dist/index.js'
import { enumerateCandidates } from '../compute/enumerator/dist/index.js'
import { RELEASED, RELEASED_ARRANGEMENT_GRAMMAR, type GridSystemSpec } from '../spec'

const GRAMMAR = RELEASED_ARRANGEMENT_GRAMMAR as unknown as MeasureFieldRequest['grammar']

/** A rectangular ring on half-integer pixel coordinates, exactly as the tracer emits them. */
const ringBox = (
  width: number,
  height: number,
  inset = 0.5,
): MeasureFieldRequest['ring'] => ({
  points: [
    [inset, inset],
    [width - inset, inset],
    [width - inset, height - inset],
    [inset, height - inset],
  ],
  width,
  height,
})

const request = (over: Partial<MeasureFieldRequest> = {}): MeasureFieldRequest => ({
  ring: ringBox(200, 200),
  spec: RELEASED,
  sizeMM: 300,
  grammar: GRAMMAR,
  ...over,
})

const withGrid = (over: Partial<GridSystemSpec['grid']>): GridSystemSpec => ({
  ...RELEASED,
  grid: { ...RELEASED.grid, ...over },
})

describe('1 — the request, asserted exactly rather than inferred from the answer', () => {
  it('states every kernel input the contract requires', () => {
    const built = buildKernelRequest(request({ ring: ringBox(200, 120), sizeMM: 300 }))

    // x2: half-integer midpoints become exact integers, losslessly
    expect(built.polygon.vertices[0]).toEqual({ x: BigInt(1), y: BigInt(1) })
    expect(built.polygon.vertices[1]).toEqual({ x: BigInt(399), y: BigInt(1) })
    expect(built.polygon.vertices[2]).toEqual({ x: BigInt(399), y: BigInt(239) })

    // the one size on screen — never a ladder the scaffold does not publish
    expect(built.sizes).toEqual([BigInt(300)])

    // source measure in the polygon's own doubled units, NOT the millimetre size
    expect(built.parameters.sizeTransform.sourceSize).toBe(BigInt(400))
    // image centre doubled: (W/2, H/2) x 2
    expect(built.parameters.sizeTransform.sourceAnchor).toEqual({
      x: { numerator: BigInt(200), denominator: BigInt(1) },
      y: { numerator: BigInt(120), denominator: BigInt(1) },
    })
    expect(built.parameters.sizeTransform.targetAnchor).toEqual({
      x: { numerator: BigInt(0), denominator: BigInt(1) },
      y: { numerator: BigInt(0), denominator: BigInt(1) },
    })

    // lattice values read from the spec, never restated
    expect(built.parameters.lattice.pitch).toBe(BigInt(RELEASED.grid.basePitchMM))
    expect(built.parameters.discDiameter).toBe(BigInt(2 * RELEASED.grid.paddingMM))
  })

  it('the origin is the bare registration offset — pan is never in the solve input', () => {
    // 'point' puts a magnet on the centre: offset 0.
    const point = buildKernelRequest(request())
    expect(point.parameters.lattice.origin.x).toEqual({ numerator: BigInt(0), denominator: BigInt(2) })

    // 'gap' puts the centre between four: half the BASE lattice, exact as a rational.
    const gap = buildKernelRequest(request({ spec: { ...RELEASED, registration: 'gap' } }))
    expect(gap.parameters.lattice.origin.x).toEqual({
      numerator: BigInt(RELEASED.grid.basePitchMM),
      denominator: BigInt(2),
    })
    expect(gap.parameters.lattice.origin.y).toEqual(gap.parameters.lattice.origin.x)
  })

  it('the field extent yields exactly N positions for odd AND even counts', () => {
    // The symmetric range [-floor(N/2), floor(N/2)] emits N+1 for every even N, and the spec's
    // guard permits 1..99. This is the arithmetic that silently adds a phantom row.
    for (const N of [1, 2, 3, 8, 9, 10, 98, 99]) {
      const { fieldExtent } = buildKernelRequest(
        request({ spec: withGrid({ positionsPerAxis: N }) }),
      ).parameters.lattice
      const columns = Number(fieldExtent.maxColumn - fieldExtent.minColumn) + 1
      const rows = Number(fieldExtent.maxRow - fieldExtent.minRow) + 1
      expect(columns, `N=${N} columns`).toBe(N)
      expect(rows, `N=${N} rows`).toBe(N)
    }
    // released 9 is centred
    const released = buildKernelRequest(request()).parameters.lattice.fieldExtent
    expect([released.minColumn, released.maxColumn]).toEqual([BigInt(-4), BigInt(4)])
  })
})

describe('2 — the transform reproduces the shell drawing exactly, in rationals', () => {
  /**
   * The shell draws `box.x + (px/W)*box.w` with `box.w = W*k`, `box.x = -box.w/2`,
   * `k = sizeMM/max(W,H)` (page.tsx). The kernel computes
   * `targetAnchor + (size/sourceSize)*(p - sourceAnchor)` on the DOUBLED ring.
   *
   * Compared as exact fractions by cross-multiplication — never as floats with a tolerance, because
   * a tolerance is exactly what would hide a wrong transform.
   */
  const equalFractions = (a: [bigint, bigint], b: [bigint, bigint]) => a[0] * b[1] === b[0] * a[1]

  it.each([
    ['odd landscape', 743, 511],
    ['odd portrait', 511, 743],
    ['mixed parity landscape', 744, 511],
    ['mixed parity portrait', 511, 744],
    ['square odd', 337, 337],
  ])('%s (%ix%i)', (_label, W, H) => {
    const sizeMM = 137 // odd, so nothing divides away by luck
    const built = buildKernelRequest(request({ ring: ringBox(W, H), sizeMM }))
    const { sourceSize, sourceAnchor } = built.parameters.sizeTransform
    const size = built.sizes[0]!
    const longest = BigInt(Math.max(W, H))

    // BOTH AXES. The anchors differ per axis — x is W, y is H — so proving x does not prove y, and
    // this is the test guarding the error class that already nearly shipped once.
    for (const [axis, extent, anchor] of [
      ['x', W, sourceAnchor.x.numerator],
      ['y', H, sourceAnchor.y.numerator],
    ] as const) {
      for (const doubled of [BigInt(1), BigInt(extent), BigInt(2 * extent - 1), BigInt(0)]) {
        // kernel, on the doubled ring: (size/sourceSize) * (2px - extent)
        const kernel: [bigint, bigint] = [size * (doubled - anchor), sourceSize]
        // shell: k*(px - extent/2) with k = sizeMM/max(W,H); doubled px keeps it exact
        const shell: [bigint, bigint] = [size * (doubled - BigInt(extent)), BigInt(2) * longest]
        expect(
          equalFractions(kernel, shell),
          `${axis} at doubled ${doubled}: kernel ${kernel} vs shell ${shell}`,
        ).toBe(true)
      }
    }
  })
})

describe('3 — exactness in, or a loud failure. Never a rounded value.', () => {
  it('half-integers convert losslessly', () => {
    const built = buildKernelRequest(
      request({ ring: { points: [[0.5, 1.5], [10.5, 1.5], [10.5, 20.5]], width: 32, height: 32 } }),
    )
    expect(built.polygon.vertices).toEqual([
      { x: BigInt(1), y: BigInt(3) },
      { x: BigInt(21), y: BigInt(3) },
      { x: BigInt(21), y: BigInt(41) },
    ])
  })

  it.each([
    ['a third of a pixel', 0.3333333],
    ['a quarter pixel', 10.25],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['beyond safe integers', 1e300],
  ])('refuses %s rather than rounding it', (_label, bad) => {
    const call = () =>
      buildKernelRequest(request({ ring: { points: [[bad, 0.5], [10.5, 0.5], [10.5, 9.5]], width: 32, height: 32 } }))
    expect(call).toThrow(SeamInputError)
    expect(call).toThrow(/ring\.points\[0\]\.x/)
  })

  it.each([
    ['a fractional size', { sizeMM: 120.5 }],
    ['a zero size', { sizeMM: 0 }],
    ['a negative size', { sizeMM: -120 }],
  ])('refuses %s', (_label, over) => {
    expect(() => buildKernelRequest(request(over))).toThrow(SeamInputError)
  })

  it('refuses a ring with fewer than three points, naming the input', () => {
    expect(() =>
      buildKernelRequest(request({ ring: { points: [[0.5, 0.5], [1.5, 1.5]], width: 32, height: 32 } })),
    ).toThrow(/ring\.points/)
  })
})

describe('4 — a kernel rejection propagates. No fallback, no repair.', () => {
  it('a self-touching ring throws out of the seam rather than returning nothing', () => {
    // A bowtie whose edges genuinely cross AND whose signed area is non-zero. A symmetric bowtie is
    // rejected for ZERO_AREA first, so it never exercises the self-intersection check at all — the
    // fixture would have passed while testing something else.
    const bowtie = request({
      ring: {
        points: [[0.5, 0.5], [10.5, 10.5], [10.5, 0.5], [0.5, 20.5]],
        width: 32,
        height: 32,
      },
    })
    let thrown: unknown
    try {
      measureField(bowtie)
    } catch (error) {
      thrown = error
    }
    expect(thrown, 'an unusable ring must fail loudly, not come back empty').toBeDefined()
    expect((thrown as Error).message).toMatch(/POLYGON_NOT_SIMPLE/)
    // and it is the KERNEL's rejection, surfaced untouched — not re-thrown as a seam error
    expect(thrown).not.toBeInstanceOf(SeamInputError)
  })

  it('a duplicated vertex is refused, not silently deduplicated', () => {
    const duplicate = request({
      ring: {
        points: [[0.5, 0.5], [10.5, 0.5], [10.5, 0.5], [10.5, 10.5]],
        width: 32,
        height: 32,
      },
    })
    expect(() => measureField(duplicate)).toThrow(/ZERO_LENGTH_EDGE|DUPLICATE_VERTEX/)
  })
})

/**
 * The packages here are real; THE RING IS SYNTHETIC — a rectangle, not a traced silhouette. Calling
 * this "a real run" without that qualifier overstated it. A real trace needs a browser (canvas,
 * createImageBitmap), so it belongs to the on-screen gate, and it has been run independently
 * end-to-end against DUCK.png through `traceContourRaw` into `measureField`.
 */
describe('5 — a run through both delivered packages, on a synthetic ring', () => {
  const input = request()
  const result = measureField(input)

  it('returns the kernel document EXACTLY as the package produced it', () => {
    const direct = measureLattice(buildKernelRequest(input))
    expect(result.measurement).toEqual(direct)
    expect(result.measurement.schema).toBe('magnetic-grid-measurement-kernel/lattice/v1')
    expect(result.measurement.sizes).toHaveLength(1)
    expect(result.measurement.sizes[0]!.positions).toHaveLength(81) // 9x9
  })

  it('returns the enumerator document EXACTLY as the package produced it', () => {
    const direct = enumerateCandidates({
      measurement: measureLattice(buildKernelRequest(input)),
      grammar: input.grammar,
    })
    expect(result.candidates).toEqual(direct)
    expect(result.candidates.schema).toBe('magnetic-grid-candidate-enumerator/candidates/v1')
  })

  it('actually measures geometry — the shape holds positions and yields candidates', () => {
    const held = result.measurement.sizes[0]!.positions.filter((p) => p.fits)
    expect(held.length, 'a 300mm square should hold a block of positions').toBeGreaterThan(1)
    expect(result.candidates.candidates.length).toBeGreaterThan(0)
    // every candidate position is a HELD kernel position — the enumerator invents nothing
    const heldKeys = new Set(held.map((p) => `${p.column},${p.row}`))
    for (const candidate of result.candidates.candidates) {
      for (const position of candidate.positions) {
        expect(heldKeys.has(`${position.column},${position.row}`)).toBe(true)
      }
    }
  })

  it('the display projection is additive only — one entry per candidate, nothing replaced', () => {
    expect(result.display).toHaveLength(result.candidates.candidates.length)
    result.display.forEach((entry, index) => {
      const candidate = result.candidates.candidates[index]!
      expect(entry.candidateId).toBe(candidate.id)
      expect(entry.centresMM).toHaveLength(candidate.positions.length)
      entry.centresMM.forEach(([x, y], positionIndex) => {
        const centre = candidate.positions[positionIndex]!.center
        expect(x).toBe(Number(centre.x.numerator) / Number(centre.x.denominator))
        expect(y).toBe(Number(centre.y.numerator) / Number(centre.y.denominator))
      })
    })
  })
})

describe('6 — inputs are not mutated, and the same call gives the same answer', () => {
  it('a deeply frozen request is accepted and comes back unchanged', () => {
    const ring = ringBox(200, 200)
    const frozen: MeasureFieldRequest = Object.freeze({
      ring: Object.freeze({
        points: Object.freeze(ring.points.map((p) => Object.freeze([...p]) as readonly [number, number])),
        width: ring.width,
        height: ring.height,
      }),
      spec: RELEASED,
      sizeMM: 300,
      grammar: GRAMMAR,
    })
    const snapshot = JSON.stringify(frozen.ring.points)
    expect(() => measureField(frozen)).not.toThrow()
    expect(JSON.stringify(frozen.ring.points)).toBe(snapshot)
  })

  it('repeated calls are byte-identical', () => {
    const first = measureField(request())
    const second = measureField(request())
    expect(JSON.stringify(first.measurement)).toBe(JSON.stringify(second.measurement))
    expect(JSON.stringify(first.candidates)).toBe(JSON.stringify(second.candidates))
    expect(JSON.stringify(first.display)).toBe(JSON.stringify(second.display))
  })
})

describe('7 — Number() exists only in the display projection', () => {
  it('no numeric conversion sits on any request, validity or enumeration path', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/grid-engine/compute/candidates.ts'), 'utf8')
    const lines = source.split('\n')
    const conversions = lines
      .map((line, index) => ({ line: line.trim(), n: index + 1 }))
      .filter(({ line }) => /\bNumber\(/.test(line) && !line.startsWith('*') && !line.startsWith('//'))

    expect(conversions.length, 'expected the projection to convert — otherwise this passes vacuously')
      .toBeGreaterThan(0)

    // every conversion must sit inside rationalPointToMM, the last function in the file
    const projectionStart = lines.findIndex((l) => l.includes('function rationalPointToMM'))
    expect(projectionStart).toBeGreaterThan(0)
    for (const { line, n } of conversions) {
      expect(n, `Number() outside the display projection at line ${n}: ${line}`).toBeGreaterThan(projectionStart)
    }
  })
})
