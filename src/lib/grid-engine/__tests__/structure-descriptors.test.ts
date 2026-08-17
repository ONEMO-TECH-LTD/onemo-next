import { describe, expect, it } from 'vitest'
import type { ContinuousFeasibilityResult } from '../compute/continuous-feasibility'
import {
  balanceEvidence,
  buildComponentHierarchy,
  certifiedDominance,
  coverageEvidence,
  distributionEvidence,
  peelLeverageEvidence,
  unsupportedExtentEvidence,
  upperHangingMassEvidence,
  type DescriptorEvidence,
  type DescriptorSubject,
} from '../compute/structure'
import type { Contour, Pt } from '../compute/types'

// These tests exercise the descriptor CONTRACT. Feasible sets are supplied directly wherever the
// contract is about what a descriptor does with a given F, so nothing here pins T4's observed
// output; the hierarchy tests are the exception, because building F is what that function does.

const QUANTUM_MM = 0.001

const rect = (x: number, y: number, w: number, h: number): Contour => ({
  outer: {
    pts: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  },
  holes: [],
})

const ring = (x: number, y: number, w: number, h: number): Pt[] => rect(x, y, w, h).outer.pts

/** Written out locally: the test must not borrow Compute's own bounds helper to check Compute. */
const contourBounds = (pts: ReadonlyArray<Pt>) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

const ENVELOPE: ContinuousFeasibilityResult['envelope'] = {
  quantumMM: QUANTUM_MM,
  arcErrorMM: 0.005,
  projectionErrorMM: 0.0007071067811865476,
  sourceApproximationErrorMM: 0,
  conservativeGuardMM: 0.025,
  omissionBoundMM: 0.05,
  relation: 'F_INSET_BY_EPSILON_SUBSET_APPROX_SUBSET_F',
}

const givenF = (
  components: ReadonlyArray<ReadonlyArray<Pt>>,
  witnesses: ReadonlyArray<Pt> = [],
): ContinuousFeasibilityResult => ({
  status: components.length || witnesses.length ? 'PROVED_FEASIBLE' : 'INDETERMINATE_WITHIN_TOLERANCE',
  components,
  exactWitnessesMM: witnesses,
  envelope: ENVELOPE,
})

const subject = (
  contour: Contour,
  offsetsMM: ReadonlyArray<Pt>,
  effectiveRadiusMM: number,
  feasible: ContinuousFeasibilityResult,
): DescriptorSubject => ({ contour, offsetsMM, effectiveRadiusMM, feasible })

const evidence = (over: Partial<DescriptorEvidence>): DescriptorEvidence => ({
  units: 'mm',
  direction: 'minimize',
  status: 'INTERVAL',
  lo: 0,
  hi: 1,
  argopt: { regions: [], points: [] },
  completenessProof: 'fixture',
  sourceEnvelope: ENVELOPE,
  perComponent: [],
  witnessEvidence: [],
  ...over,
})

/**
 * The only slack a published value may claim over the interval that advertises it: the two ulps of
 * outward rounding the descriptors already apply, one per side. Identical to the bracket predicate
 * in Logic — a test that allowed more would stop being a falsifier.
 */
const slack = (value: number): number => Math.abs(value) * 2 ** -51 + Number.MIN_VALUE

/** Every registration a descriptor hands back: exact points, plus each region's vertices AND its
 *  centroid — a region checked only at its corners can hide a worse value in the middle. */
const returnedRegistrations = (result: DescriptorEvidence): Pt[] => {
  const out: Pt[] = [...(result.argopt?.points ?? []).map(([x, y]) => [x, y] as Pt)]
  for (const cell of result.argopt?.regions ?? []) {
    for (const [x, y] of cell) out.push([x, y])
    out.push([
      cell.reduce((sum, [x]) => sum + x, 0) / cell.length,
      cell.reduce((sum, [, y]) => sum + y, 0) / cell.length,
    ])
  }
  return out
}

// ─── 1 · hierarchy ─────────────────────────────────────────────────────────────────────────────

describe('component hierarchy', () => {
  // Two 40mm lobes joined by a 4mm corridor; the right lobe is only 26mm tall, so it dies first.
  const dumbbell: Contour = {
    outer: {
      pts: [
        [0, 0],
        [40, 0],
        [40, 18],
        [80, 18],
        [80, 7],
        [120, 7],
        [120, 33],
        [80, 33],
        [80, 22],
        [40, 22],
        [40, 40],
        [0, 40],
      ],
    },
    holes: [],
  }

  it('rejects every level list the caller has no right to imply', () => {
    for (const levels of [[], [Number.NaN], [0], [-1], [12, 8], [12, 12], [Infinity]])
      expect(() => buildComponentHierarchy(dumbbell, levels)).toThrow()
  })

  it('keeps both split components and reports the width floor the erosion proves', () => {
    const { levels } = buildComponentHierarchy(dumbbell, [12])

    expect(levels).toHaveLength(1)
    expect(levels[0].nodes.length).toBeGreaterThanOrEqual(2)
    expect(levels[0].collapsed).toBe(false)
    for (const node of levels[0].nodes) {
      expect(node.widthFloorMM).toBe(24)
      expect(node.clearanceLevelMM).toBe(12)
      expect(node.areaMM2Hi).toBeGreaterThan(0)
      expect(node.areaMM2Lo).toBeLessThanOrEqual(node.areaMM2Hi)
    }
  })

  it('tracks persistence when a component dies at a deeper level', () => {
    const { levels } = buildComponentHierarchy(dumbbell, [12, 13])

    expect(levels[0].nodes.length).toBeGreaterThan(levels[1].nodes.length)
    expect([...levels[0].nodes.map((node) => node.persistenceLevels)].sort()).toEqual([1, 2])
    // Never a parent index without a resolved parent: ambiguity is reported, never guessed.
    for (const level of levels)
      for (const node of level.nodes)
        if (node.parentStatus === 'INDETERMINATE') expect(node.parentIndex).toBeNull()
    for (const node of levels[1].nodes) expect(node.parentStatus).toBe('RESOLVED')
  })

  it('carries T4 status, envelope and caller witnesses instead of dropping a collapsed level', () => {
    const withWitness = buildComponentHierarchy(rect(0, 0, 24, 24), [12], [[[12, 12]]])
    expect(withWitness.levels[0].nodes).toHaveLength(0)
    expect(withWitness.levels[0].witnessesMM).toEqual([[12, 12]])
    expect(withWitness.levels[0].collapsed).toBe(false)
    expect(withWitness.levels[0].envelope.relation).toBe('F_INSET_BY_EPSILON_SUBSET_APPROX_SUBSET_F')

    const collapsed = buildComponentHierarchy(rect(0, 0, 24, 60), [12])
    expect(collapsed.levels[0].collapsed).toBe(true)
    expect(collapsed.levels[0].status).not.toBe('PROVED_FEASIBLE')
  })
})

// ─── 2 · balance ───────────────────────────────────────────────────────────────────────────────

describe('balance', () => {
  const material = rect(0, 0, 100, 60) // centroid (50,30)
  const offsets: Pt[] = [
    [0, 0],
    [48, 0],
  ] // mean (24,0) ⇒ t* = (26,30)

  it('finds a strictly interior optimum that every vertex loses to', () => {
    const component = ring(10, 10, 40, 40)
    const result = balanceEvidence(subject(material, offsets, 12, givenF([component])))
    const [point] = result.argopt?.points ?? []

    expect(point[0]).toBeCloseTo(26, 6)
    expect(point[1]).toBeCloseTo(30, 6)
    expect(component.some(([x, y]) => x === point[0] && y === point[1])).toBe(false)
    const worstVertex = Math.min(
      ...component.map(([x, y]) => (x - point[0]) ** 2 + (y - point[1]) ** 2),
    )
    expect(result.hi).toBeLessThan(worstVertex)
    expect(result.units).toBe('mm2')
    expect(result.direction).toBe('minimize')
  })

  it('lets the smaller component hold the optimum', () => {
    const small = ring(24, 28, 4, 4)
    const large = ring(200, 200, 100, 100)
    const result = balanceEvidence(subject(material, offsets, 12, givenF([large, small])))
    const [point] = result.argopt?.points ?? []

    expect(point[0]).toBeGreaterThanOrEqual(24)
    expect(point[0]).toBeLessThanOrEqual(28)
    expect(result.hi).toBeLessThan(1)
  })

  it('lets an exact witness beat every area component', () => {
    const far = ring(200, 200, 10, 10)
    const result = balanceEvidence(subject(material, offsets, 12, givenF([far], [[26, 30]])))

    expect(result.argopt?.points).toContainEqual([26, 30])
    expect(result.hi).toBeLessThan(1)
  })
})

// ─── 3 · upper hanging mass ────────────────────────────────────────────────────────────────────

describe('upper hanging mass', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]

  it('measures from the padded edge and normalises by the padded block width', () => {
    // r = 12 ⇒ top padded edge at t_y − 12. At t_y = 50 that is y = 38, so 100×38 mm² of material
    // hangs above it, over a padded width of 24mm ⇒ 158.33mm. The centre-line would give 208.33,
    // and an un-normalised measure 3800.
    const result = upperHangingMassEvidence(subject(material, offsets, 12, givenF([], [[50, 50]])))

    expect(result.units).toBe('mm')
    expect(result.direction).toBe('minimize')
    expect(result.lo).toBeLessThanOrEqual((100 * 38) / 24)
    expect(result.hi).toBeGreaterThanOrEqual((100 * 38) / 24)
    expect(result.hi).toBeLessThan(200)
  })

  it('minimises, so the higher seat wins', () => {
    const result = upperHangingMassEvidence(
      subject(material, offsets, 12, givenF([], [[50, 20], [50, 50]])),
    )

    expect(result.argopt?.points).toContainEqual([50, 20])
    expect(result.hi).toBeLessThan((100 * 38) / 24)
  })
})

// ─── 3b · the hanging strip is a COMPLETE, self-consistent equivalent set ──────────────────────

describe('upper hanging mass — argopt composability', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]

  /** Re-price one registration by handing the descriptor a feasible set holding only that point. */
  const valueAt = (point: Pt) =>
    upperHangingMassEvidence(subject(material, offsets, 12, givenF([], [point])))

  it('returns interior registrations, not only the face vertices', () => {
    const component = ring(20, 20, 60, 60)
    const result = upperHangingMassEvidence(subject(material, offsets, 12, givenF([component])))
    const strip = result.argopt?.regions ?? []

    expect(strip.length).toBeGreaterThan(0)
    const stripPoints = strip.flat()
    const vertices = new Set(component.map(([x, y]) => `${x},${y}`))
    // The strip is a region: it carries registrations the component's own vertex list does not.
    expect(stripPoints.some(([x, y]) => !vertices.has(`${x},${y}`))).toBe(true)
  })

  it('reports an interval that contains every registration it returns, interior included', () => {
    const component = ring(20, 20, 60, 60)
    const result = upperHangingMassEvidence(subject(material, offsets, 12, givenF([component])))
    const cells = result.argopt?.regions ?? []
    expect(cells.length).toBeGreaterThan(0)

    for (const cell of cells) {
      // INTERIOR as well as boundary: a strip checked only at its own vertices could hide a worse
      // value in the middle, which is exactly the composability defect this guards.
      const interior: Pt = [
        cell.reduce((sum, [x]) => sum + x, 0) / cell.length,
        cell.reduce((sum, [, y]) => sum + y, 0) / cell.length,
      ]
      for (const point of [...cell.map(([x, y]) => [x, y] as Pt), interior]) {
        const at = valueAt(point)
        // MINIMIZE: only the upper bound can make a chosen registration worse than advertised. Its
        // conservative lo may legitimately sit below the global proven lower bound, and holding
        // that against it would reject lawful registrations.
        expect(at.hi).toBeLessThanOrEqual(result.hi + slack(result.hi))
      }
    }
  })
})

// ─── 5b · peel returns a complete, certified equivalent set ────────────────────────────────────

describe('peel leverage — argopt composability', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]
  const budget = { toleranceMM3: 1e5, maxEvaluations: 4000 }

  it('certifies a REGION for an area fixture, and nothing it returns scores above the interval', () => {
    const component = ring(40, 40, 20, 20)
    const result = peelLeverageEvidence(subject(material, offsets, 12, givenF([component])), budget)

    expect(result.status).toBe('INTERVAL')
    // An area F carries no exact witnesses, so demanding argopt POINTS here could only ever pass by
    // accident. What this fixture is entitled to is a certified region.
    expect(result.argopt?.regions.length).toBeGreaterThan(0)

    for (const probe of returnedRegistrations(result)) {
      const at = peelLeverageEvidence(subject(material, offsets, 12, givenF([], [probe])), budget)
      expect(at.status).not.toBe('DECISION_INDETERMINATE')
      expect(at.hi).toBeLessThanOrEqual(result.hi + slack(result.hi))
    }
  })

  it('refines a contending cell instead of discarding it, and still certifies', () => {
    // A tolerance far below the spread forces refinement. With an ample budget the answer must be
    // CERTIFIED with its equivalent set intact — accepting indeterminate here would let an
    // implementation that simply drops the contending cell pass this gate.
    const component = ring(30, 30, 40, 40)
    const tight = peelLeverageEvidence(subject(material, offsets, 12, givenF([component])), {
      toleranceMM3: 50,
      maxEvaluations: 20000,
    })

    expect(tight.status).toBe('INTERVAL')
    expect(tight.hi - tight.lo).toBeLessThanOrEqual(50 + 1e-6)
    expect(tight.argopt?.regions.length).toBeGreaterThan(0)
    for (const probe of returnedRegistrations(tight)) {
      const at = peelLeverageEvidence(subject(material, offsets, 12, givenF([], [probe])), {
        toleranceMM3: 50,
        maxEvaluations: 20000,
      })
      expect(at.status).not.toBe('DECISION_INDETERMINATE')
      expect(at.hi).toBeLessThanOrEqual(tight.hi + slack(tight.hi))
    }
  })

  it('says indeterminate when the budget cannot certify, never a partial set', () => {
    const component = ring(30, 30, 40, 40)
    const starved = peelLeverageEvidence(subject(material, offsets, 12, givenF([component])), {
      toleranceMM3: 0,
      maxEvaluations: 12,
    })

    expect(starved.status).toBe('DECISION_INDETERMINATE')
    expect(starved.argopt).toBeNull()
  })
})

// ─── 4 · unsupported extent ────────────────────────────────────────────────────────────────────

describe('unsupported extent', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]
  // kL = kT = −12, kR = kB = 88 ⇒ score(t) = max(0, t−12, 88−t) per axis, minimised at 50 ⇒ 38.

  it('certifies a strictly interior optimum inside a one-quantum bracket', () => {
    const component = ring(20, 20, 60, 60)
    const result = unsupportedExtentEvidence(subject(material, offsets, 12, givenF([component])))

    expect(result.lo).toBeLessThanOrEqual(38)
    expect(result.hi).toBeGreaterThanOrEqual(38 - QUANTUM_MM)
    expect(result.hi - result.lo).toBeCloseTo(QUANTUM_MM, 6)
    const vertexScores = component.map(([x, y]) => Math.max(0, x - 12, 88 - x, y - 12, 88 - y))
    expect(result.hi).toBeLessThan(Math.min(...vertexScores))
    expect(result.argopt?.regions.length).toBeGreaterThan(0)
  })

  it('reports every side and every region without applying an exemption', () => {
    const limb = rect(-40, 40, 10, 10) // a thin outlier the ruled exemption might one day excuse
    const body = rect(20, 20, 60, 60)
    const result = unsupportedExtentEvidence(
      subject(material, offsets, 12, givenF([], [[50, 50]])),
      [body, limb],
    )

    expect(Object.values(result.reachMM).every((value) => Number.isFinite(value))).toBe(true)
    expect(result.perRegion).toHaveLength(2)
    const limbReach = result.perRegion[1]
    expect(limbReach.regionIndex).toBe(1)
    // The limb is still reported at its true reach; Compute neither drops nor discounts it.
    expect(limbReach.leftMM).toBeGreaterThan(0)
    expect(result.maxSideScoreMM).toBeCloseTo(38, 6)
  })

  it('reads a major region in MATERIAL space, not centre space', () => {
    // A major support region is a magnet-CENTRE region: the body already eroded by r, so a magnet
    // centred anywhere in it clears the outline. Handing back the ERODED square must therefore
    // reconstruct the BODY's reach, not the core's — otherwise a solid body reads as a thin limb
    // because its own core is always r short of its outline.
    const body = rect(20, 20, 60, 60) // the material region: bounds 20..80
    const core = rect(32, 32, 36, 36) // that body eroded by r = 12: bounds 32..68
    const result = unsupportedExtentEvidence(
      subject(material, offsets, 12, givenF([], [[50, 50]])),
      [core],
    )

    expect(result.perRegion).toHaveLength(1)
    // At (50,50) with r = 12 and a single offset, the padded box is [38,62]². The BODY reaches
    // 38−20 = 18mm past it on every side. Reading the core raw would give 38−32 = 6mm.
    const bodyBounds = contourBounds(body.outer.pts)
    expect(bodyBounds.minX).toBe(20)
    expect(bodyBounds.maxX).toBe(80)
    for (const side of ['leftMM', 'rightMM', 'topMM', 'bottomMM'] as const) {
      expect(result.perRegion[0][side]).toBeCloseTo(18, 9)
      expect(result.perRegion[0][side]).not.toBeCloseTo(6, 6)
    }
  })

  it('lets a true exact witness win over the lattice components', () => {
    const cramped = ring(20, 20, 5, 5)
    const result = unsupportedExtentEvidence(
      subject(material, offsets, 12, givenF([cramped], [[50, 50]])),
    )

    expect(result.argopt?.points).toContainEqual([50, 50])
    expect(result.hi).toBeLessThan(50)
  })

  it('brackets an optimum its sublevel rectangle can only reach by a single-point contact', () => {
    // The sublevel rectangle here is [88−s, s+12]², which collapses to the single point (50,50) at
    // s = 38. A component whose corner sits exactly there attains 38, but no positive-area
    // intersection exists until s passes it — so the one-quantum bracket, with NO witness supplied,
    // is what has to contain the true optimum.
    const corner = ring(50, 50, 30, 30)
    const result = unsupportedExtentEvidence(subject(material, offsets, 12, givenF([corner])))

    expect(result.status).toBe('INTERVAL')
    expect(result.witnessEvidence).toHaveLength(0)
    expect(result.lo).toBeLessThanOrEqual(38)
    expect(result.hi).toBeGreaterThanOrEqual(38)
    expect(result.hi - result.lo).toBeCloseTo(QUANTUM_MM, 6)
  })
})

// ─── 5 · peel leverage ─────────────────────────────────────────────────────────────────────────

describe('peel leverage', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]

  it('certifies a constructed case when the budget suffices', () => {
    const result = peelLeverageEvidence(
      subject(material, offsets, 12, givenF([ring(40, 40, 20, 20)])),
      { toleranceMM3: 1e6, maxEvaluations: 500 },
    )

    expect(result.status).toBe('INTERVAL')
    expect(result.units).toBe('mm3')
    expect(result.argopt?.regions.length).toBeGreaterThan(0)
    expect(result.lo).toBeLessThanOrEqual(result.hi)
  })

  it('brackets an optimum reachable only along an edge INTERIOR, with no vertex there', () => {
    // THE EXACT-CONTACT FALSIFIER. The component's left edge runs x=50, y=40..60, and the material's
    // symmetric optimum is (50,50) — on that edge's INTERIOR, not at any of its four vertices. As
    // the sublevel rectangle closes on the optimum it meets the component along a segment with no
    // vertex inside it and, in the limit, no positive Clipper area. A contact test that only looked
    // for component vertices, or trusted Clipper's silence, would call that empty and move the lower
    // bound above a score the component actually attains.
    const budget = { toleranceMM3: 50, maxEvaluations: 20000 }
    const component = ring(50, 40, 30, 20)
    expect(component.some(([x, y]) => x === 50 && y === 50)).toBe(false)

    const result = peelLeverageEvidence(
      subject(material, offsets, 12, givenF([component])),
      budget,
    )
    const atOptimum = peelLeverageEvidence(
      subject(material, offsets, 12, givenF([], [[50, 50]])),
      budget,
    )

    expect(result.status).toBe('INTERVAL')
    expect(atOptimum.status).toBe('INTERVAL')
    expect(result.argopt?.regions.length ?? 0).toBeGreaterThan(0)
    // The certified lower bound must not have climbed past the score the edge point achieves.
    expect(result.lo).toBeLessThanOrEqual(atOptimum.hi + slack(atOptimum.hi))
    for (const probe of returnedRegistrations(result)) {
      const at = peelLeverageEvidence(subject(material, offsets, 12, givenF([], [probe])), budget)
      expect(at.status).not.toBe('DECISION_INDETERMINATE')
      expect(at.hi).toBeLessThanOrEqual(result.hi + slack(result.hi))
    }
  })

  it('never reports a lower bound above a value the component actually achieves', () => {
    // A certified lower bound must not exceed the score at ANY feasible point of that component.
    // Stated plainly: this pins the bound ordering itself. It does not discriminate the earlier
    // cache-one-endpoint defect, whose footprint is the interval bracket, so no such claim is made.
    const component = ring(40, 40, 20, 20)
    const certified = peelLeverageEvidence(
      subject(material, offsets, 12, givenF([component])),
      { toleranceMM3: 1e6, maxEvaluations: 2000 },
    )
    const probes: Pt[] = [
      [45, 45],
      [50, 50],
      [55, 55],
      [42, 58],
      ...(certified.argopt?.points ?? []),
    ]

    for (const probe of probes) {
      const at = peelLeverageEvidence(subject(material, offsets, 12, givenF([], [probe])), {
        toleranceMM3: 1e6,
        maxEvaluations: 2000,
      })
      expect(certified.lo).toBeLessThanOrEqual(at.hi)
    }
  })

  it('returns indeterminate when the budget cannot price a component', () => {
    const result = peelLeverageEvidence(
      subject(material, offsets, 12, givenF([ring(40, 40, 20, 20)])),
      { toleranceMM3: 0, maxEvaluations: 1 },
    )

    expect(result.status).toBe('DECISION_INDETERMINATE')
    expect(result.argopt).toBeNull()
  })

  it('returns indeterminate when a witness goes unpriced, and resolves when all are priced', () => {
    const witnesses: Pt[] = [
      [50, 50],
      [60, 60],
    ]
    // The starved case stays genuinely starved — one evaluation cannot price two witnesses. The
    // funded case is given an AMPLE governed budget rather than a hand-counted one: pinning the
    // exact evaluation cost made this test a hostage to the solver's internal accounting, which is
    // not what it is here to prove.
    const starved = peelLeverageEvidence(subject(material, offsets, 12, givenF([], witnesses)), {
      toleranceMM3: 1e6,
      maxEvaluations: 1,
    })
    const funded = peelLeverageEvidence(subject(material, offsets, 12, givenF([], witnesses)), {
      toleranceMM3: 1e6,
      maxEvaluations: 20000,
    })

    expect(starved.status).toBe('DECISION_INDETERMINATE')
    expect(starved.argopt).toBeNull()
    expect(funded.status).toBe('INTERVAL')
    expect(funded.witnessEvidence).toHaveLength(2)
  })

  it('rejects a budget the caller did not supply honestly', () => {
    const s = subject(material, offsets, 12, givenF([ring(40, 40, 20, 20)]))
    expect(() => peelLeverageEvidence(s, { toleranceMM3: -1, maxEvaluations: 10 })).toThrow()
    expect(() => peelLeverageEvidence(s, { toleranceMM3: 1, maxEvaluations: 0 })).toThrow()
  })
})

// ─── 6 · coverage ──────────────────────────────────────────────────────────────────────────────

describe('coverage', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]
  // Deliberately OFF-CENTRE: a region containing the canonical bbox centre would let a canonical
  // sampler stumble onto the answer, which is exactly what the partition has to beat.
  const near = rect(70, 20, 10, 10)
  const far = rect(200, 200, 10, 10)

  it('returns the covered fraction, not a count', () => {
    const result = coverageEvidence(subject(material, offsets, 12, givenF([], [[75, 25]])), [
      near,
      far,
    ])

    expect(result.units).toBe('ratio')
    expect(result.direction).toBe('maximize')
    // 0.5 is losslessly representable, so an exact answer would be legitimate here; this
    // implementation simply reserves its exact branch for rationals that divide to an integer and
    // brackets everything else conservatively. The contract is the bracket containing the truth.
    expect(result.lo).toBeLessThanOrEqual(0.5)
    expect(result.hi).toBeGreaterThanOrEqual(0.5)
    expect(result.hi - result.lo).toBeLessThan(1e-8)
  })

  it('rejects an empty caller set rather than inventing a value', () => {
    expect(() =>
      coverageEvidence(subject(material, offsets, 12, givenF([ring(0, 0, 50, 50)])), []),
    ).toThrow()
  })

  it('returns the whole component as the argopt when nothing is reachable', () => {
    const component = ring(0, 0, 50, 50)
    const result = coverageEvidence(subject(material, offsets, 12, givenF([component])), [far])

    expect(result.hi).toBe(0)
    expect(result.argopt?.regions.length).toBeGreaterThan(0)
    expect(result.argopt?.regions[0].length).toBeGreaterThanOrEqual(4)
  })

  it('finds a partition cell that no fixed sample — vertex or canonical — would reach', () => {
    const component = ring(0, 0, 100, 100)
    // Every fixed recipe a sampler might use: the four vertices AND the canonical bbox centre.
    const fixedSamples: Pt[] = [...component.map(([x, y]) => [x, y] as Pt), [50, 50]]
    const cell = coverageEvidence(subject(material, offsets, 12, givenF([component])), [near])
    const atFixedSamples = coverageEvidence(
      subject(material, offsets, 12, givenF([], fixedSamples)),
      [near],
    )

    expect(cell.hi).toBeCloseTo(1, 9)
    expect(atFixedSamples.hi).toBe(0)
    expect(cell.argopt?.regions.length).toBeGreaterThan(0)
  })

  it('lets an exact witness win over the components', () => {
    const result = coverageEvidence(
      subject(material, offsets, 12, givenF([ring(0, 0, 20, 20)], [[75, 25]])),
      [near],
    )

    expect(result.argopt?.points).toContainEqual([75, 25])
    expect(result.hi).toBeCloseTo(1, 9)
  })
})

// ─── 7 · distribution ──────────────────────────────────────────────────────────────────────────

describe('distribution', () => {
  const material = rect(0, 0, 140, 100)
  const offsets: Pt[] = [
    [0, 0],
    [48, 0],
  ]
  const massA = rect(20, 40, 60, 20) // holds both anchors at once, but never reaches into B
  const massB = rect(88, 40, 20, 20)
  // A wider first mass overlaps B's reach, so the primary argopt genuinely splits into two
  // count-cells — counts [2,1] and [1,1] — which is what the joint partition has to resolve.
  const overlappingA = rect(20, 40, 80, 20)
  const bandComponent = ring(28, 45, 30, 10)

  it('settles the primary mass count before the variance key can speak', () => {
    // (50,50): anchors at 50 and 98 ⇒ one in each mass, counts [1,1], variance 0, primary 2.
    // (30,50): anchors at 30 and 78 ⇒ both in A, counts [2,0], variance 1, primary 1 — ineligible.
    const result = distributionEvidence(
      subject(material, offsets, 12, givenF([], [[50, 50], [30, 50]])),
      [massA, massB],
      64,
    )

    expect(result.units).toBe('count')
    expect(result.direction).toBe('maximize')
    expect(result.hi).toBe(2)
    expect(result.argopt?.points).toContainEqual([50, 50])
    expect(result.anchorVariance.units).toBe('ratio')
    expect(result.anchorVariance.direction).toBe('minimize')
    // Only the primary-tied witness may price the variance key.
    expect(result.anchorVariance.witnessEvidence).toHaveLength(1)
    expect(result.anchorVariance.witnessEvidence[0].witnessMM).toEqual([50, 50])
    expect(result.anchorVariance.hi).toBeCloseTo(0, 9)
    // The losing witness would have scored 1 on variance; it must not reach the key at all.
    expect(result.anchorVariance.witnessEvidence.map(({ witnessMM }) => witnessMM)).not.toContainEqual([
      30, 50,
    ])
  })

  it('requires a cell budget from the caller', () => {
    const s = subject(material, offsets, 12, givenF([], [[50, 50]]))
    for (const budget of [0, -1, 2.5, Number.NaN])
      expect(() => distributionEvidence(s, [massA, massB], budget)).toThrow()
  })

  it('certifies the variance key over an area component when the budget suffices', () => {
    const result = distributionEvidence(
      subject(material, offsets, 12, givenF([bandComponent])),
      [overlappingA, massB],
      64,
    )

    expect(result.hi).toBe(2)
    expect(result.anchorVariance.status).toBe('INTERVAL')
    expect(result.anchorVariance.units).toBe('ratio')
    expect(result.anchorVariance.perComponent.length).toBeGreaterThan(1)
    // Two count-cells tie on the primary key; the evener one — counts [1,1] — takes the variance.
    expect(result.anchorVariance.hi).toBeCloseTo(0, 9)
    expect(result.anchorVariance.argopt?.regions.length).toBeGreaterThan(0)
  })

  it('reports the variance key indeterminate rather than estimating it on overflow', () => {
    const result = distributionEvidence(
      subject(material, offsets, 12, givenF([bandComponent])),
      [overlappingA, massB],
      1,
    )

    expect(result.anchorVariance.status).toBe('DECISION_INDETERMINATE')
    expect(result.anchorVariance.argopt).toBeNull()
  })

  it('rejects an empty mass set', () => {
    expect(() =>
      distributionEvidence(subject(material, offsets, 12, givenF([], [[50, 50]])), [], 64),
    ).toThrow()
  })
})

// ─── 8 · dominance ─────────────────────────────────────────────────────────────────────────────

describe('certified dominance', () => {
  it('resolves only a genuine separation, in the descriptor’s own direction', () => {
    const lowMin = evidence({ direction: 'minimize', lo: 1, hi: 2 })
    const highMin = evidence({ direction: 'minimize', lo: 5, hi: 6 })
    expect(certifiedDominance(lowMin, highMin, 0)).toBe(true)
    expect(certifiedDominance(highMin, lowMin, 0)).toBe(false)

    const lowMax = evidence({ direction: 'maximize', lo: 1, hi: 2 })
    const highMax = evidence({ direction: 'maximize', lo: 5, hi: 6 })
    expect(certifiedDominance(highMax, lowMax, 0)).toBe(true)
    expect(certifiedDominance(lowMax, highMax, 0)).toBe(false)
  })

  it('preserves both candidates on overlap or tolerance', () => {
    const a = evidence({ lo: 1, hi: 4 })
    const b = evidence({ lo: 3, hi: 6 })
    expect(certifiedDominance(a, b, 0)).toBe(false)

    const clear = evidence({ lo: 1, hi: 2 })
    const other = evidence({ lo: 3, hi: 4 })
    expect(certifiedDominance(clear, other, 0)).toBe(true)
    expect(certifiedDominance(clear, other, 5)).toBe(false)
  })

  it('never resolves against undecided evidence', () => {
    const decided = evidence({ lo: 1, hi: 2 })
    const undecided = evidence({ status: 'DECISION_INDETERMINATE', lo: Number.NaN, hi: Number.NaN })
    expect(certifiedDominance(decided, undecided, 0)).toBe(false)
    expect(certifiedDominance(undecided, decided, 0)).toBe(false)
  })

  it('refuses a unit or direction mismatch, and a tolerance that is not one', () => {
    expect(() => certifiedDominance(evidence({ units: 'mm' }), evidence({ units: 'mm2' }), 0)).toThrow()
    expect(() =>
      certifiedDominance(evidence({ direction: 'minimize' }), evidence({ direction: 'maximize' }), 0),
    ).toThrow()
    expect(() => certifiedDominance(evidence({}), evidence({}), -1)).toThrow()
    expect(() => certifiedDominance(evidence({}), evidence({}), Number.NaN)).toThrow()
  })
})

// ─── 9 · determinism, units and carried envelope ───────────────────────────────────────────────

describe('evidence hygiene', () => {
  const material = rect(0, 0, 100, 100)
  const offsets: Pt[] = [[0, 0]]

  it('returns identical evidence for identical inputs', () => {
    const build = () =>
      coverageEvidence(subject(material, offsets, 12, givenF([ring(20, 20, 60, 60)])), [
        rect(45, 45, 10, 10),
      ])

    expect(build()).toEqual(build())
  })

  it('states its unit and carries T4’s envelope rather than restating one', () => {
    const feasible = givenF([ring(20, 20, 60, 60)], [[50, 50]])
    const s = subject(material, offsets, 12, feasible)
    const distribution = distributionEvidence(s, [rect(45, 45, 10, 10)], 64)
    const units = [
      [balanceEvidence(s), 'mm2'],
      [upperHangingMassEvidence(s), 'mm'],
      [unsupportedExtentEvidence(s), 'mm'],
      [coverageEvidence(s, [rect(45, 45, 10, 10)]), 'ratio'],
      [peelLeverageEvidence(s, { toleranceMM3: 1e6, maxEvaluations: 2000 }), 'mm3'],
      [distribution, 'count'],
      [distribution.anchorVariance, 'ratio'],
    ] as const

    for (const [result, unit] of units) {
      expect(result.units).toBe(unit)
      expect(result.sourceEnvelope).toBe(ENVELOPE)
      expect(result.completenessProof.length).toBeGreaterThan(0)
    }
  })
})
