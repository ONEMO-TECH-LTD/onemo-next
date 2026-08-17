// T6 — the Product Base funnel.
//
// THE SUBJECT ENTERS THROUGH solveCutout, always. No Logic helper — templatesForCell, frameCellFor,
// restrictInOrder, decide — is imported, so the selector can never be asked to prove itself.
//
// The neutral Compute imports (computeContinuousFeasibleSet, balanceEvidence,
// upperHangingMassEvidence) are an INDEPENDENT ORACLE and nothing else: they re-measure the answer
// the selector published, from the published registration, to check the selector's arithmetic
// against a second computation. They are never the door the subject arrives through.
//
// Interval comparisons are written out locally so a broken comparator cannot certify itself.
//
// Every fixture asserts its own PRECONDITION before it asserts an outcome. A test that can silently
// do nothing is not a gate, and several here previously could.

import { describe, expect, it } from 'vitest'

import { solveCutout } from '../bridge'
import {
  balanceEvidence,
  upperHangingMassEvidence,
  type DescriptorEvidence,
} from '../compute/structure'
import { computeContinuousFeasibleSet } from '../compute/continuous-feasibility'
import type { Contour, Pt } from '../compute/types'
import { readFileSync } from 'node:fs'
import { engineOutline, type OutlineUV } from '../ui/trace-cutout'
import { contentHash, stableStringify } from '@/lib/outline-core/math'
import {
  RELEASED,
  RELEASED_CALIBRATION,
  selectUnsupportedExtentLimit,
  type CalibrationSpec,
} from '../spec'
import type {
  BandAnswer,
  SelectorResult,
  ShapeJudgement,
  SizeVariant,
} from '../logic/judgement'

const ring = (pts: Array<[number, number]>): Contour => ({ outer: { pts: pts as Pt[] }, holes: [] })

const rect = (widthMM: number, heightMM: number): Contour =>
  ring([
    [0, 0],
    [widthMM, 0],
    [widthMM, heightMM],
    [0, heightMM],
  ])

/** The canon shapes, loaded once. The SAME door page.tsx uses: engineOutline, scaled to the box. */
type CanonFixture = { outline: OutlineUV; box: { w: number; h: number } }
const CANON = JSON.parse(
  readFileSync('src/lib/grid-engine/__tests__/__fixtures-canon-shapes.json', 'utf8'),
) as Record<string, CanonFixture>

const solveCanon = (name: string): ShapeJudgement => {
  const fixture = CANON[name]
  expect(fixture).toBeDefined()
  const contour: Contour = {
    outer: {
      pts: engineOutline(fixture.outline).map(
        ([u, v]) => [u * fixture.box.w, v * fixture.box.h] as Pt,
      ),
    },
    holes: [],
  }
  const judged = solveCutout(RELEASED, RELEASED_CALIBRATION, contour)
  expect(judged).not.toBeNull()
  return judged!
}

/**
 * A SOLID BODY WITH ONE NARROW TERMINAL LIMB — the shape the ruled exemption exists for. The body
 * is 100x100; the limb is a 10mm-wide tab reaching 30mm past one edge. Ten millimetres is far
 * narrower than the 24mm a safe core needs, so the limb carries NO major support region while the
 * body does — which is precisely the case the exemption is meant to cover, and the case a
 * centre-space reading of the body would have swallowed.
 */
const bodyWithLimb = (): Contour =>
  ring([
    [0, 0],
    [100, 0],
    [100, 100],
    [55, 100],
    [55, 130],
    [45, 130],
    [45, 100],
    [0, 100],
  ])

const narrow = (
  band: number,
  minSizeMM: number,
  maxSizeMM: number,
  over: Partial<CalibrationSpec> = {},
): CalibrationSpec => ({
  ...RELEASED_CALIBRATION,
  sizeStepMM: 12,
  bands: [{ band, minSizeMM, maxSizeMM, released: true }],
  ...over,
})

/**
 * A TEST SUBJECT — NOT RELEASED CALIBRATION, AND NOT A PRODUCT RULING.
 *
 * MEASURED, on the released square fixture only: the chain stops at P5, because P3 and P4 restrict
 * the feasible set to a one-quantum sliver and INNER(high) meets it along a positive-length SEGMENT,
 * for which no finite equivalent set can be returned. That outcome is honest and T5/T6 permit it —
 * indeterminate legal candidates survive. Whether other shapes behave the same way is not measured
 * here, and whether real released contours may remain indeterminate is a T7 question this file does
 * not rule on.
 *
 * These values are MEASURED to certify the peel DESCRIPTOR fixture in structure-descriptors.test.ts.
 * They are not yet measured to certify the selector; the tests using them assert that themselves.
 */
/** The selector's own outward-rounding allowance — two ulps, one per side. Nothing wider. */
const slack = (value: number): number => Math.abs(value) * 2 ** -51 + Number.MIN_VALUE

const CERTIFYING_P5: Partial<CalibrationSpec> = {
  peelToleranceMM3: 50,
  peelMaxEvaluations: 20000,
}

const solve = (contour: Contour, calibration: CalibrationSpec): BandAnswer => {
  const judged = solveCutout(RELEASED, calibration, contour)
  expect(judged).not.toBeNull()
  return judged!.bands[0]
}

const selectionOf = (variant: SizeVariant): SelectorResult => {
  expect(variant.selection).toBeDefined()
  return variant.selection as SelectorResult
}

const ORDER = [
  'coverage',
  'upperHangingMass',
  'unsupportedExtent',
  'peelLeverage',
  'distribution',
  'distributionVariance',
  'balance',
] as const

type OrderKey = (typeof ORDER)[number]

/**
 * SELECTION READS THE CHAIN, NEVER THE POINT MEASUREMENT. The top-level descriptor fields are
 * re-measured at the single published registration; they price cleanly even where the sequential
 * restriction stopped, so comparing them would walk straight past a stop the selector honoured.
 * Every comparison below reads selectionTrace.chain, which is the evidence selection actually ran on.
 */
const chainOf = (result: SelectorResult, key: OrderKey): DescriptorEvidence | undefined =>
  result.selectionTrace.chain[key]

/** A priority the chain never reached decides nothing — and neither does an undecided one. */
const decided = (result: SelectorResult, key: OrderKey): boolean => {
  const evidence = chainOf(result, key)
  return evidence !== undefined && evidence.status !== 'DECISION_INDETERMINATE'
}

/** Written out here on purpose: the test must not borrow the comparator it is checking. */
const dominates = (a: SelectorResult, b: SelectorResult, key: OrderKey): boolean => {
  if (!decided(a, key) || !decided(b, key)) return false
  const left = chainOf(a, key)!
  const right = chainOf(b, key)!
  return left.direction === 'minimize' ? left.hi < right.lo : left.lo > right.hi
}

const identical = (a: SelectorResult, b: SelectorResult, key: OrderKey): boolean => {
  const left = chainOf(a, key)
  const right = chainOf(b, key)
  if (!left || !right) return false
  return left.status === right.status && left.lo === right.lo && left.hi === right.hi
}

/**
 * THE APPROVED ORDER, WALKED IN ORDER — the only sound way to ask who wins.
 *
 * Scanning for "the first priority where someone dominates" is not the same thing and is wrong: it
 * skips past a higher priority where the two merely OVERLAP without being equal, and then credits a
 * lower priority with a win the higher one never conceded. An overlap that is not exact equality
 * stops the walk undecided, exactly as the selector's own rule does.
 */
const compareMechanics = (
  a: SelectorResult,
  b: SelectorResult,
): { verdict: 'a' | 'b' | 'undecided' | 'tied'; key: OrderKey | null } => {
  for (const key of ORDER) {
    if (!decided(a, key) || !decided(b, key)) return { verdict: 'undecided', key }
    if (dominates(a, b, key)) return { verdict: 'a', key }
    if (dominates(b, a, key)) return { verdict: 'b', key }
    // Overlapping but not identical: neither is proven better, and no LOWER priority may speak.
    if (!identical(a, b, key)) return { verdict: 'undecided', key }
  }
  const countA = a.magnetCentresMM.length
  const countB = b.magnetCentresMM.length
  if (countA !== countB) return { verdict: countA < countB ? 'a' : 'b', key: null }
  return { verdict: 'tied', key: null }
}

const arrangementKey = (result: SelectorResult): string =>
  [
    result.identity.patternVariant,
    result.identity.frame,
    result.identity.population,
    `${result.identity.originParity.across}/${result.identity.originParity.down}`,
    result.nodeAddresses.map((node) => `${node.across},${node.down}`).join(';'),
  ].join('|')

const SQUARE_BAND2 = () => solve(rect(100, 100), narrow(2, 84, 108, CERTIFYING_P5))

// ─── permissions, from the authored source table ───────────────────────────────────────────────

describe('class × band permission', () => {
  it('offers only frames the source cell names', () => {
    const cell = RELEASED_CALIBRATION.patternPolicy.cells.find(
      (entry) => entry.band === 2 && entry.axisClassX === 2 && entry.axisClassY === 2,
    )
    expect(cell?.frames).toEqual(['2x2'])

    const band = SQUARE_BAND2()
    expect(band.variants.length).toBeGreaterThan(0)
    for (const variant of band.variants) expect(selectionOf(variant).identity.frame).toBe('2x2')
  })

  it('refuses a deferred class pair on policy, never on geometry', () => {
    const deferred = RELEASED_CALIBRATION.patternPolicy.cells.find(
      (entry) => entry.band === 4 && entry.axisClassX === 1 && entry.axisClassY === 4,
    )
    expect(deferred?.status).toBe('deferred')

    // PRECONDITION: this shape really does land in that cell — class 1 across, class 4 down.
    const band = solve(rect(60, 190), narrow(4, 180, 192))
    const reasons = band.rejections.flatMap((rejection) => rejection.reasons)
    expect(reasons).not.toContain('AXIS_CLASS_UNRESOLVED')
    expect(reasons).toContain('PATTERN_POLICY_DEFERRED')
    expect(reasons).not.toContain('SAFE_CORE_EMPTY')
    expect(band.variants).toHaveLength(0)
    expect(band.decisionState).toBe('NONE')
  })

  it('computes B5 and refuses it for want of a released 5x5 template', () => {
    expect(RELEASED_CALIBRATION.bands.find((entry) => entry.band === 5)).toMatchObject({
      minSizeMM: 216,
      maxSizeMM: 264,
    })
    const cell = RELEASED_CALIBRATION.patternPolicy.cells.find(
      (entry) => entry.band === 5 && entry.axisClassX === 5 && entry.axisClassY === 5,
    )
    expect(cell?.frames).toEqual(['5x5'])
    expect(RELEASED_CALIBRATION.templates.some((template) => template.steps.length === 25)).toBe(false)

    const band = solve(rect(240, 240), narrow(5, 228, 240))
    expect(band.variants).toHaveLength(0)
    expect(band.rejections.flatMap((rejection) => rejection.reasons)).toContain(
      'NO_TEMPLATE_FOR_PERMITTED_FRAME',
    )
  })
})

// ─── the funnel ────────────────────────────────────────────────────────────────────────────────

describe('the funnel', () => {
  it('records the whole trace and classifies every node through the construction door', () => {
    const band = SQUARE_BAND2()
    expect(band.variants.length).toBeGreaterThan(0)

    for (const variant of band.variants) {
      const selection = selectionOf(variant)
      expect(selection.decisionReasons[0]).toMatch(
        /axis classes 2\/2 → band 2 → cell .+ → frame 2x2 → permitted pattern /,
      )
      expect(selection.axisClassX).toBe(2)
      expect(selection.axisClassY).toBe(2)
      expect(selection.nodes.length).toBe(selection.magnetCentresMM.length)
      expect(selection.nodes.length).toBeGreaterThan(0)
      for (const node of selection.nodes) {
        expect(node.legality).toBe('legal')
        expect(['strong', 'marginal', 'indeterminate']).toContain(node.structuralClass)
        expect(node.edgeClearanceMM).toBeGreaterThanOrEqual(RELEASED.grid.paddingMM)
      }
    }
  })

  it('reports canonical proximity as the true distance to the canonical origin', () => {
    const band = SQUARE_BAND2()
    // PRECONDITION: a full chain, so canonical was entitled to speak at all.
    const certified = band.variants
      .map(selectionOf)
      .filter((selection) => selection.proofStatus === 'CERTIFIED')
    expect(certified.length).toBeGreaterThan(0)
    for (const selection of certified) expect(selection.selectionTrace.stoppedAt).toBeNull()

    // The canonical origin, recomputed here from the EXACT bbox and frame rather than borrowed:
    // the frame's centre laid on the shape's centre. Nothing requires a survivor to sit on it —
    // canonical is the final tie-break INSIDE an equivalent set, not a preference for the middle.
    // What must hold is that the published number is the real distance and not a placeholder.
    for (const selection of certified) {
      const pitch = RELEASED.grid.basePitchMM
      const canonical: Pt = [
        (0 + selection.exactWidthMM) / 2 - ((selection.nodeFrame.across - 1) * pitch) / 2,
        (0 + selection.exactHeightMM) / 2 - ((selection.nodeFrame.down - 1) * pitch) / 2,
      ]
      const distance = Math.hypot(
        selection.registrationOffsetMM[0] - canonical[0],
        selection.registrationOffsetMM[1] - canonical[1],
      )
      expect(selection.canonicalProximityMM).toBeCloseTo(distance, 6)
    }
  })

  it('stops at P5 on the RELEASED budget, and canonical certifies nothing there', () => {
    // THE REAL DEFAULT, not a starved contrivance: on released calibration the restricted feasible
    // set is a one-quantum sliver and INNER(high) meets it along a SEGMENT, which has no finite
    // equivalent set. The selector must say so and must not let canonical rescue it.
    const band = solve(rect(100, 100), narrow(2, 84, 108))
    // PRECONDITION: the chain really did stop, at peel.
    expect(band.variants.length).toBeGreaterThan(0)
    for (const variant of band.variants) {
      const selection = selectionOf(variant)
      expect(selection.selectionTrace.stoppedAt).toContain('peel leverage')
      const chainPeel = selection.selectionTrace.chain.peelLeverage
      expect(chainPeel).toBeDefined()
      expect(chainPeel!.status).toBe('DECISION_INDETERMINATE')
      // The REASON is the representation gap, never the contradictory-empty claim it replaced.
      expect(chainPeel!.completenessProof).toContain('along a segment')
      expect(chainPeel!.completenessProof).not.toContain('which the bracket contradicts')
      expect(selection.decisionReasons.join(' ')).toContain('restriction stopped at')
      // Canonical proximity is still reported as evidence, but it certified nothing.
      expect(Number.isFinite(selection.canonicalProximityMM)).toBe(true)
      expect(selection.proofStatus).toBe('INDETERMINATE')
    }
    expect(band.decisionState).toBe('UNRESOLVED_SET')

    // THE OUTCOME CANONICAL CANNOT BE CREDITED WITH. Had canonical been allowed to resolve the
    // stopped chain it would have collapsed the survivors to one. Several remain, every one of them
    // carrying a machine-readable stop point and an uncertified verdict.
    const survivors = band.variants.map(selectionOf)
    expect(survivors.length).toBeGreaterThan(1)
    for (const selection of survivors) {
      expect(selection.selectionTrace.stoppedAt).not.toBeNull()
      expect(selection.proofStatus).toBe('INDETERMINATE')
      // Each survivor records WHY it could not be separated from its rivals, naming them. An
      // unresolved set that does not say what was unresolved is not re-walkable.
      expect(selection.decisionReasons.join(' | ')).toContain('unresolved against ')
    }
  })

  it('publishes values the registration OWNS: every emitted number sits inside its chain bracket', () => {
    // WHAT THIS PROVES, EXACTLY: that the numbers published for the answer are the numbers measured
    // AT the answer, and that each lies inside the interval its own restriction step certified. It
    // does NOT prove a strict sequential conflict — no shape has been found whose chain completes
    // AND whose balance optimum is strictly outside the restricted answer, so that gate is absent
    // rather than faked. See the probes recorded against the trapezoid and the three stepped
    // contours: all five stop at P5 on the segment-representation gap.
    const band = SQUARE_BAND2()
    const offers = band.variants.map(selectionOf)
    expect(offers.length).toBeGreaterThan(0)
    const winner = offers[0]
    expect(winner.selectionTrace.stoppedAt).toBeNull()

    // DIRECTION-RELEVANT CONTAINMENT, every priority, on the same two-ulp outward-rounding slack the
    // selector itself allows. Minimising, only the upper bound can make the point worse; maximising,
    // only the lower one. The opposite side is harmless measurement slack.
    for (const key of ORDER) {
      const promised = chainOf(winner, key)
      expect(promised).toBeDefined()
      const published = winner[key]
      expect(published.status).not.toBe('DECISION_INDETERMINATE')
      if (promised!.direction === 'minimize')
        expect(published.hi).toBeLessThanOrEqual(promised!.hi + slack(promised!.hi))
      else expect(published.lo).toBeGreaterThanOrEqual(promised!.lo - slack(promised!.lo))
    }

    // INDEPENDENT RE-MEASUREMENT at the published registration, through neutral Compute. Both of
    // these are MINIMISING descriptors — they are chosen because each is measurable from a single
    // point. If the selector had published a value from a point it did not choose, they disagree.
    const contour = squareAtScale(winner)
    const offsetsMM: Pt[] = winner.nodeAddresses.map(
      (node) => [node.across * RELEASED.grid.basePitchMM, node.down * RELEASED.grid.basePitchMM] as Pt,
    )
    const full = computeContinuousFeasibleSet({
      contour,
      permittedDomain: boundsOf(contour),
      effectiveRadiusMM: RELEASED.grid.paddingMM,
      offsetsMM,
    })
    expect(full.components.length + full.exactWitnessesMM.length).toBeGreaterThan(0)
    const atRegistration = (measure: typeof balanceEvidence): DescriptorEvidence =>
      measure({
        contour,
        offsetsMM,
        effectiveRadiusMM: RELEASED.grid.paddingMM,
        feasible: {
          status: full.status,
          components: [],
          exactWitnessesMM: [winner.registrationOffsetMM],
          envelope: full.envelope,
        },
      })

    const hanging = atRegistration(upperHangingMassEvidence)
    expect(hanging.lo).toBeGreaterThanOrEqual(winner.upperHangingMass.lo - 1e-6)
    expect(hanging.hi).toBeLessThanOrEqual(winner.upperHangingMass.hi + 1e-6)

    const balance = atRegistration(balanceEvidence)
    expect(balance.lo).toBeGreaterThanOrEqual(winner.balance.lo - 1e-6)
    expect(balance.hi).toBeLessThanOrEqual(winner.balance.hi + 1e-6)
  })

  it('carries reproducible structural evidence, not bare counts', () => {
    const band = SQUARE_BAND2()
    expect(band.variants.length).toBeGreaterThan(0)
    for (const variant of band.variants) {
      const evidence = selectionOf(variant).structuralEvidence
      expect(evidence.clearanceLevelsMM).toEqual(
        RELEASED_CALIBRATION.nodeClassification.clearanceLevelsMM,
      )
      expect(evidence.levels.length).toBe(evidence.clearanceLevelsMM.length)
      expect(evidence.regions.length).toBeGreaterThan(0)
      for (const region of evidence.regions) {
        expect(region.regionId).toHaveLength(16)
        expect(region.widthFloorMM).toBe(2 * evidence.clearanceLevelsMM[region.levelIndex])
        expect(region.areaMM2Lo).toBeLessThanOrEqual(region.areaMM2Hi)
        expect(region.persistenceLevels).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('changes the result hash when any emitted field changes', () => {
    const band = SQUARE_BAND2()
    expect(band.variants.length).toBeGreaterThan(0)
    const selection = selectionOf(band.variants[0])

    // Recompute the canonical self-excluding digest independently, and prove it matches.
    const recompute = (result: SelectorResult): string =>
      contentHash(
        stableStringify({ ...result, identity: { ...result.identity, resultHash: undefined } }),
      )
    expect(recompute(selection)).toBe(selection.identity.resultHash)

    // Mutating ONE emitted output field must move the digest.
    const mutatedOutput: SelectorResult = {
      ...selection,
      minimumEdgeClearanceMM: selection.minimumEdgeClearanceMM + 1,
    }
    expect(recompute(mutatedOutput)).not.toBe(selection.identity.resultHash)

    // So must mutating one emitted piece of EVIDENCE.
    const mutatedEvidence: SelectorResult = {
      ...selection,
      balance: { ...selection.balance, hi: selection.balance.hi + 1 },
    }
    expect(recompute(mutatedEvidence)).not.toBe(selection.identity.resultHash)
  })

  it('binds a governing budget into the profile identity, and geometry identity to geometry', () => {
    const base = selectionOf(SQUARE_BAND2().variants[0])
    // ONE governing budget moved, everything else identical, same contour.
    const shifted = selectionOf(
      solve(
        rect(100, 100),
        narrow(2, 84, 108, { ...CERTIFYING_P5, peelToleranceMM3: 51 }),
      ).variants[0],
    )

    // ONE governing budget, shown to participate in profileHash. This does not prove every field
    // participates — it falsifies the hand-picked-subset hash, which would let this shift through
    // as the same profile.
    expect(shifted.identity.profileHash).not.toBe(base.identity.profileHash)
    // And geometry identity answers to geometry ALONE — the contour did not move.
    expect(shifted.identity.sourceGeometryHash).toBe(base.identity.sourceGeometryHash)
  })

  it('emits the COMPLETE T6 output contract — exactly these keys, no more and no fewer', () => {
    const band = SQUARE_BAND2()
    expect(band.variants.length).toBeGreaterThan(0)
    const selection = selectionOf(band.variants[0])

    // THE CONTRACT ITSELF, written out here so it is falsifiable in both directions: a dropped
    // field fails, and a field quietly added without governance fails too. Semantic checks follow.
    expect([...Object.keys(selection)].sort()).toEqual(
      [
        'axisClassX', 'axisClassY', 'balance', 'band', 'canonicalProximityMM', 'coverage',
        'decisionReasons', 'distinctMassCount', 'distribution', 'distributionVariance',
        'exactHeightMM', 'exactWidthMM', 'feasibility', 'hierarchyCertain', 'identity',
        'magnetCentresMM', 'minimumEdgeClearanceMM', 'nodeAddresses', 'nodeFrame', 'nodes',
        'patternId', 'peelLeverage', 'proofStatus', 'registrationOffsetMM', 'rejectionReasons',
        'scaleFactor', 'selectionTrace', 'structuralEvidence', 'supportedRegionCount',
        'unsupportedExtent', 'unsupportedExtentPolicy', 'upperHangingMass',
      ].sort(),
    )
    expect([...Object.keys(selection.identity)].sort()).toEqual(
      [
        'evidenceHash', 'frame', 'originParity', 'patternVariant', 'population', 'profileHash',
        'registrationMM', 'resultHash', 'sizeMM', 'sourceGeometryHash',
      ].sort(),
    )

    // dimensions and scale
    expect(selection.exactWidthMM).toBeGreaterThan(0)
    expect(selection.exactHeightMM).toBeGreaterThan(0)
    expect(selection.exactWidthMM).toBeCloseTo(selection.exactHeightMM, 6)
    expect(selection.scaleFactor).toBeGreaterThan(0)

    // classes, band, frame, registration
    expect(selection.axisClassX).toBe(2)
    expect(selection.axisClassY).toBe(2)
    expect(selection.band).toBe(2)
    expect(selection.nodeFrame).toEqual({ across: 2, down: 2 })
    expect(selection.registrationOffsetMM).toHaveLength(2)
    for (const coordinate of selection.registrationOffsetMM)
      expect(Number.isFinite(coordinate)).toBe(true)

    // pattern, ordered addresses, centres — one centre per address, none repeated
    expect(selection.patternId.length).toBeGreaterThan(0)
    expect(selection.nodeAddresses.length).toBeGreaterThan(0)
    expect(selection.magnetCentresMM).toHaveLength(selection.nodeAddresses.length)
    expect(selection.nodes).toHaveLength(selection.magnetCentresMM.length)
    expect(selection.identity.population).toBe(selection.magnetCentresMM.length)
    const centreKeys = selection.magnetCentresMM.map(([x, y]) => `${x},${y}`)
    expect(new Set(centreKeys).size).toBe(centreKeys.length)
    // ORDER IS MEANING: nodes[i] must be the node at nodeAddresses[i], seated at magnetCentresMM[i].
    // Three parallel arrays that drifted out of step would still pass every count check above.
    for (let index = 0; index < selection.nodes.length; index += 1) {
      expect(selection.nodes[index].address).toEqual(selection.nodeAddresses[index])
      expect(selection.nodes[index].centreMM).toEqual(selection.magnetCentresMM[index])
    }

    // clearance — the published minimum IS the minimum of what the nodes report, and it clears
    expect(selection.minimumEdgeClearanceMM).toBe(
      Math.min(...selection.nodes.map((node) => node.edgeClearanceMM)),
    )
    expect(selection.minimumEdgeClearanceMM).toBeGreaterThanOrEqual(RELEASED.grid.paddingMM)

    // structural evidence
    expect(selection.structuralEvidence.levels).toHaveLength(
      selection.structuralEvidence.clearanceLevelsMM.length,
    )
    expect(selection.structuralEvidence.regions.length).toBeGreaterThan(0)
    expect(selection.supportedRegionCount).toBeGreaterThan(0)
    expect(typeof selection.hierarchyCertain).toBe('boolean')

    // ALL descriptor evidence, emitted whole rather than as scalars
    for (const key of ORDER) {
      const emitted = selection[key]
      expect(emitted).toBeDefined()
      expect(emitted.units.length).toBeGreaterThan(0)
      expect(['minimize', 'maximize']).toContain(emitted.direction)
      expect(emitted.completenessProof.length).toBeGreaterThan(0)
    }

    // selectionTrace — a completed chain carries every priority and no stop
    expect(selection.selectionTrace.stoppedAt).toBeNull()
    for (const key of ORDER) expect(decided(selection, key)).toBe(true)

    // proof, decision and rejection evidence
    expect(selection.proofStatus).toBe('CERTIFIED')
    expect(selection.feasibility).toBe('PROVED_FEASIBLE')
    expect(selection.decisionReasons.length).toBeGreaterThanOrEqual(4)
    expect(selection.decisionReasons[0]).toMatch(/^funnel: axis classes /)
    expect(selection.decisionReasons.join(' ')).toContain('restriction ran the whole order')
    expect(selection.rejectionReasons).toHaveLength(0)
    expect(Number.isFinite(selection.canonicalProximityMM)).toBe(true)

    // every identity hash present, sized, and distinct from the others
    const hashes = [
      selection.identity.sourceGeometryHash,
      selection.identity.profileHash,
      selection.identity.evidenceHash,
      selection.identity.resultHash,
    ]
    for (const hash of hashes) expect(hash).toHaveLength(16)
    expect(new Set(hashes).size).toBe(hashes.length)
    expect(selection.identity.sizeMM).toBeGreaterThan(0)
    expect(selection.identity.frame).toBe('2x2')
    expect(selection.identity.registrationMM).toEqual(selection.registrationOffsetMM)
  })
})

// ─── the approved order ────────────────────────────────────────────────────────────────────────

describe('the approved order', () => {
  it('excludes a candidate another offer certifiably beats, on a pair solved together', () => {
    // Every permitted 2x2 template, identified from its own steps rather than by asking Logic.
    const twoByTwo = RELEASED_CALIBRATION.templates.filter(
      (template) =>
        Math.max(...template.steps.map(([across]) => across)) === 1 &&
        Math.max(...template.steps.map(([, down]) => down)) === 1,
    )
    expect(twoByTwo.length).toBeGreaterThan(1)

    /** One template, alone on the ladder — so nothing else can have eliminated it. */
    const alone = (name: string): SelectorResult | undefined => {
      const only = RELEASED_CALIBRATION.templates.filter((template) => template.name === name)
      const band = solve(rect(100, 100), narrow(2, 84, 96, { ...CERTIFYING_P5, templates: only }))
      return band.variants.length ? selectionOf(band.variants[0]) : undefined
    }
    const solo = twoByTwo
      .map((template) => alone(template.name))
      .filter((result): result is SelectorResult => result !== undefined)
    expect(solo.length).toBeGreaterThan(1)

    // PRECONDITION: the test's OWN comparator finds a pair separated at some priority — a certified
    // earlier winner, not a preference. Without such a pair this proves nothing and must fail.
    let beaten: { winner: SelectorResult; loser: SelectorResult; key: OrderKey } | null = null
    for (const candidate of solo)
      for (const rival of solo) {
        if (beaten || rival === candidate) continue
        const verdict = compareMechanics(candidate, rival)
        if (verdict.verdict === 'a' && verdict.key)
          beaten = { winner: candidate, loser: rival, key: verdict.key }
      }
    expect(beaten).not.toBeNull()
    // The win must be a CERTIFIED dominance at the priority the ordered walk actually stopped on.
    expect(dominates(beaten!.winner, beaten!.loser, beaten!.key)).toBe(true)
    expect(compareMechanics(beaten!.winner, beaten!.loser).verdict).toBe('a')

    // Now solve EXACTLY that pair together. The beaten arrangement must not survive, and the
    // winner must — a real elimination, not a pinned expected output.
    const pair = RELEASED_CALIBRATION.templates.filter(
      (template) =>
        template.name === beaten!.winner.identity.patternVariant ||
        template.name === beaten!.loser.identity.patternVariant,
    )
    expect(pair).toHaveLength(2)
    const band = solve(rect(100, 100), narrow(2, 84, 96, { ...CERTIFYING_P5, templates: pair }))
    const together = band.variants.map(selectionOf)
    const names = together.map((offer) => offer.identity.patternVariant)
    expect(names).toContain(beaten!.winner.identity.patternVariant)
    expect(names).not.toContain(beaten!.loser.identity.patternVariant)

    // THE DECISION IS RECORDED, not just enacted. The winner names who it defeated and under which
    // rule; a decision that leaves no trace cannot be re-walked by anyone reading the offer.
    const winner = together.find(
      (offer) => offer.identity.patternVariant === beaten!.winner.identity.patternVariant,
    )!
    expect(winner.decisionReasons.join(' | ')).toContain(
      `defeated ${beaten!.loser.identity.patternVariant}@`,
    )

    // And the loser leaves a MACHINE-READABLE rejection, not silence.
    const dominated = band.rejections.filter((rejection) =>
      rejection.reasons.includes('CERTIFIED_DOMINATED'),
    )
    expect(dominated.length).toBeGreaterThan(0)
    const forLoser = dominated.find(
      (rejection) => rejection.patternId === beaten!.loser.identity.patternVariant,
    )
    expect(forLoser).toBeDefined()
    expect(forLoser!.dominatedBy).toBeDefined()
    expect(forLoser!.dominatedBy!.patternId).toBe(beaten!.winner.identity.patternVariant)
    expect(forLoser!.dominatedBy!.rule.length).toBeGreaterThan(0)
  })

  it('keeps two mechanically equivalent but distinct arrangements as certified co-optima', () => {
    // Two DIFFERENTLY NAMED templates with IDENTICAL steps: mechanically indistinguishable by
    // construction, governed identities distinct. Neither may delete the other.
    const twins: ReadonlyArray<{ name: string; steps: ReadonlyArray<readonly [number, number]> }> = [
      { name: 'twin-a', steps: [[0, 0], [1, 1]] },
      { name: 'twin-b', steps: [[0, 0], [1, 1]] },
    ]
    const band = solve(rect(100, 100), narrow(2, 84, 96, { ...CERTIFYING_P5, templates: twins }))
    const offers = band.variants.map(selectionOf)

    expect(offers).toHaveLength(2)
    const [a, b] = offers
    expect(a.proofStatus).toBe('CERTIFIED')
    expect(b.proofStatus).toBe('CERTIFIED')
    for (const key of ORDER) {
      expect(decided(a, key)).toBe(true)
      expect(decided(b, key)).toBe(true)
      expect(identical(a, b, key)).toBe(true)
    }
    expect(a.identity.patternVariant).not.toBe(b.identity.patternVariant)
    expect(arrangementKey(a)).not.toBe(arrangementKey(b))
    expect(a.identity.resultHash).not.toBe(b.identity.resultHash)
    // THE HONEST STATE: certified co-optima, not a winner and not uncertainty — and each result
    // SAYS SO, naming the other as its co-optimum rather than leaving the relation implicit.
    expect(band.decisionState).toBe('CERTIFIED_SET')
    expect(a.decisionReasons.join(' | ')).toContain(`co-optimum with ${b.identity.patternVariant}@`)
    expect(b.decisionReasons.join(' | ')).toContain(`co-optimum with ${a.identity.patternVariant}@`)
    expect(band.rejections.some((rejection) => rejection.reasons.includes('CERTIFIED_DOMINATED'))).toBe(
      false,
    )
  })

  it('lets size seat an arrangement only after the mechanics have tied', () => {
    // PRECONDITION: the same arrangement exists and CERTIFIES at two sizes, each solved on its own
    // single-size ladder. Their evidence is NOT compared for equality — the contour is scaled per
    // size, so 72mm and 84mm are different geometry and identical intervals are impossible.
    // The seats are 72 and 84 because the square's bulk at 96 reaches past the active P4 limit and
    // is rejected on policy, which the major-region test in this file demands.
    // ONE AUTHORED ARRANGEMENT, selected by its own steps rather than by asking Logic: the released
    // 2x2 template that populates all four nodes. Snug is defined WITHIN an arrangement, and with
    // the whole pool competing the square's preferred arrangement changes between seats — so the
    // subject is pinned to one template by construction. No output winner is pinned; which size
    // seats it, and under which rule, is still decided entirely by the comparator below.
    const fourNode2x2 = RELEASED_CALIBRATION.templates.filter(
      (template) =>
        template.steps.length === 4 &&
        Math.max(...template.steps.map(([across]) => across)) === 1 &&
        Math.max(...template.steps.map(([, down]) => down)) === 1,
    )
    expect(fourNode2x2).toHaveLength(1)
    const only = fourNode2x2

    const atSize = (sizeMM: number): SelectorResult[] =>
      solve(
        rect(100, 100),
        narrow(2, sizeMM, sizeMM + 12, { ...CERTIFYING_P5, templates: only }),
      ).variants.map(selectionOf)
    const smaller = atSize(72)
    const larger = atSize(84)
    expect(smaller.length).toBeGreaterThan(0)
    expect(larger.length).toBeGreaterThan(0)

    const shared = smaller
      .map((small) => [small, larger.find((big) => arrangementKey(big) === arrangementKey(small))] as const)
      .find((pair): pair is readonly [SelectorResult, SelectorResult] => pair[1] !== undefined)
    expect(shared).toBeDefined()
    const [small, big] = shared!
    expect(small.proofStatus).toBe('CERTIFIED')
    expect(big.proofStatus).toBe('CERTIFIED')
    expect(small.identity.sizeMM).toBeLessThan(big.identity.sizeMM)

    // The test's OWN ordered walk decides which rule governs, and the ladder must obey THAT one.
    const verdict = compareMechanics(small, big)
    const combined = solve(
      rect(100, 100),
      narrow(2, 72, 96, { ...CERTIFYING_P5, templates: only }),
    ).variants.map(selectionOf)
    const seats = combined.filter((offer) => arrangementKey(offer) === arrangementKey(small))

    if (verdict.verdict === 'a') {
      // Mechanics chose the smaller size on its merits, not on its size.
      expect(seats).toHaveLength(1)
      expect(seats[0].identity.sizeMM).toBe(small.identity.sizeMM)
    } else if (verdict.verdict === 'b') {
      // Mechanics chose the LARGER size. Size must not overrule that.
      expect(seats).toHaveLength(1)
      expect(seats[0].identity.sizeMM).toBe(big.identity.sizeMM)
    } else if (verdict.verdict === 'tied') {
      // Only an exact mechanical tie lets size speak, and then it takes the snug seat.
      expect(seats).toHaveLength(1)
      expect(seats[0].identity.sizeMM).toBe(small.identity.sizeMM)
    } else {
      // UNDECIDED: neither is proven better, so BOTH seats must survive. Collapsing them to one
      // would be size — or anything else — resolving what the mechanics never did.
      expect(seats).toHaveLength(2)
      expect(seats.map((seat) => seat.identity.sizeMM).sort((x, y) => x - y)).toEqual([
        small.identity.sizeMM,
        big.identity.sizeMM,
      ])
    }
  })

  it('applies P4 at the active limit and reports the verdict, not just the measurement', () => {
    const band = SQUARE_BAND2()
    const offers = band.variants.map(selectionOf)
    expect(offers.length).toBeGreaterThan(0)

    for (const offer of offers) {
      const policy = offer.unsupportedExtentPolicy
      // The RELEASED position, not a tuned number.
      expect(policy.activeLimitMM).toBe(RELEASED_CALIBRATION.unsupportedExtent.activeLimitMM)
      expect([12, 24]).toContain(policy.activeLimitMM)
      // Every side reported, whether or not it exceeded — Compute measures, Logic rules.
      expect(Object.keys(policy.perSideMM).sort()).toEqual(['bottom', 'left', 'right', 'top'])
      if (policy.outcome === 'WITHIN_LIMIT') {
        for (const reach of Object.values(policy.perSideMM))
          expect(reach).toBeLessThanOrEqual(policy.activeLimitMM)
        expect(policy.exemptedSides).toHaveLength(0)
      } else {
        // An exemption is never silent: every exempted side is named with the reach that earned it.
        expect(policy.exemptedSides.length).toBeGreaterThan(0)
        for (const exempt of policy.exemptedSides)
          expect(exempt.reachMM).toBeGreaterThan(policy.activeLimitMM)
        expect(offer.decisionReasons.join(' | ')).toContain('trivial-limb exemption reported for')
      }
      // The verdict is part of the answer's identity, so it cannot drift unnoticed.
      expect(offer.decisionReasons.join(' | ')).toContain(`P4 at ${policy.activeLimitMM}mm`)
    }
  })

  it('reports a trivial-limb exemption explicitly when only the outline exceeds the limit', () => {
    // MEASURED SUBJECT: a solid body with one 10mm-wide terminal limb. The limb reaches ~23.975mm
    // past the padded box — well beyond the 12mm limit — but is far too narrow to carry a safe core,
    // so no MAJOR support region reaches that far. That is the ruled exemption's actual case. The
    // point is that it is ANNOUNCED, side and reach, not granted in silence. The winner is not
    // pinned; any offer that exempts must account for it.
    const band = solve(bodyWithLimb(), narrow(2, 84, 108, CERTIFYING_P5))
    const offers = band.variants.map(selectionOf)
    expect(offers.length).toBeGreaterThan(0)

    // HARD PRECONDITION: this fixture must actually exercise the exemption branch.
    const exempt = offers.filter(
      (offer) => offer.unsupportedExtentPolicy.outcome === 'TRIVIAL_LIMB_EXEMPT',
    )
    expect(exempt.length).toBeGreaterThan(0)

    for (const offer of exempt) {
      const policy = offer.unsupportedExtentPolicy
      expect(policy.exemptedSides.length).toBeGreaterThan(0)
      const reasons = offer.decisionReasons.join(' | ')
      expect(reasons).toContain('trivial-limb exemption reported for')
      expect(reasons).toContain('no major support region reaches past the limit')
      for (const exemptSide of policy.exemptedSides) {
        // Every exempted side genuinely exceeded the limit...
        expect(exemptSide.reachMM).toBeGreaterThan(policy.activeLimitMM)
        expect(exemptSide.reachMM).toBe(policy.perSideMM[exemptSide.side])
        // ...and both the side AND its reach appear in the published reason, to 3dp.
        expect(reasons).toContain(`${exemptSide.side} ${exemptSide.reachMM.toFixed(3)}mm`)
      }
      // A side within the limit must never be reported as exempted.
      const exemptedNames = policy.exemptedSides.map((entry) => entry.side)
      for (const side of ['left', 'right', 'top', 'bottom'] as const)
        if (policy.perSideMM[side] <= policy.activeLimitMM)
          expect(exemptedNames).not.toContain(side)
    }
  })

  it('rejects a candidate whose MAJOR support region reaches past the active limit', () => {
    // A SOLID square one size up: its bulk — not a limb — reaches past the limit, and the major
    // support region underlying that bulk reaches just as far once read in material space. It must
    // be refused on POLICY: not silently published, not exempted as though it were a thin limb, and
    // not confused with a geometric failure.
    const band = solve(rect(100, 100), narrow(2, 96, 108, CERTIFYING_P5))
    const excessive = band.rejections.filter((rejection) =>
      rejection.reasons.includes('EXCESSIVE_UNSUPPORTED_EXTENT'),
    )
    expect(excessive.length).toBeGreaterThan(0)
    // A policy refusal must not masquerade as geometry.
    for (const rejection of excessive) {
      expect(rejection.reasons).not.toContain('SAFE_CORE_EMPTY')
      expect(rejection.reasons).not.toContain('NO_LAWFUL_REGISTRATION')
    }
    // And nothing published may exceed the limit at its major regions.
    for (const offer of band.variants.map(selectionOf))
      expect(offer.unsupportedExtentPolicy.outcome).not.toBe('EXCESSIVE_UNSUPPORTED_EXTENT')
  })

  it('refuses an out-of-range P4 limit rather than clamping it', () => {
    const { min, max } = RELEASED_CALIBRATION.unsupportedExtent.limitRangeMM
    for (const bad of [min - 1, max + 1, -12, Number.NaN, Infinity]) {
      const { calibration, refused } = selectUnsupportedExtentLimit(RELEASED_CALIBRATION, bad)
      expect(refused).toBeDefined()
      // Refused means UNCHANGED. A rejected value is never silently corrected into an acceptable one.
      expect(calibration.unsupportedExtent.activeLimitMM).toBe(
        RELEASED_CALIBRATION.unsupportedExtent.activeLimitMM,
      )
    }
    for (const good of [min, 12, 24, max]) {
      const { calibration, refused } = selectUnsupportedExtentLimit(RELEASED_CALIBRATION, good)
      expect(refused).toBeUndefined()
      expect(calibration.unsupportedExtent.activeLimitMM).toBe(good)
    }
    // DAN 2026-08-17: zero by default. No overhang tolerance is granted until one is calibrated in.
    expect(RELEASED_CALIBRATION.unsupportedExtent.activeLimitMM).toBe(0)
    expect(min).toBe(0)
  })

  it('carries the shape\u2019s material masses into P7 from the CERTIFIED safe core', () => {
    // THE REAL CONTOURS, not stand-ins. Both of these stopped at "P7 distribution across distinct
    // masses" with distinctMassCount 0, because the mass graph was taken from the deeper authored
    // level and that level is INDETERMINATE_WITHIN_TOLERANCE and collapsed on these shapes. No
    // governing source equates a distinct MATERIAL mass with a component surviving 24mm; the masses
    // are the certified safe core, and P7 must receive them.
    for (const name of ['pill', 'bat'] as const) {
      const b2 = solveCanon(name).bands.find((band) => band.band.band === 2)
      expect(b2).toBeDefined()
      expect(b2!.variants.length).toBeGreaterThan(0)

      for (const offer of b2!.variants.map(selectionOf)) {
        // The mass graph reached the selector at all...
        expect(offer.distinctMassCount).toBeGreaterThan(0)
        // ...and the chain no longer halts at P7 for want of it.
        expect(offer.selectionTrace.stoppedAt ?? '').not.toContain('P7')
        expect(decided(offer, 'distribution')).toBe(true)
      }
    }
  })

  it('classifies each node strong or marginal from its OWN exact clearance, both sides exercised', () => {
    const deepMM =
      RELEASED_CALIBRATION.nodeClassification.clearanceLevelsMM[
        RELEASED_CALIBRATION.nodeClassification.strongLevelIndex
      ]
    expect(deepMM).toBe(24)

    // Two released bands on the same square, so the SAME rule is checked on nodes that fall either
    // side of the threshold. Band 2 seats every node near the boundary; band 3 seats a centre node
    // deep inside the material. Nothing here manufactures a threshold — deepMM is read from the
    // released calibration, and every clearance compared against it is the engine's own emitted
    // measurement.
    const nodes = [
      ...SQUARE_BAND2().variants.map(selectionOf),
      ...solve(rect(100, 100), narrow(3, 120, 168, CERTIFYING_P5)).variants.map(selectionOf),
    ].flatMap((offer) => offer.nodes)
    expect(nodes.length).toBeGreaterThan(0)

    // HARD PRECONDITION, BOTH SIDES: the run must actually contain a node under the threshold and a
    // node at or over it. Without this the formula below could hold vacuously on one branch.
    expect(nodes.some((node) => node.edgeClearanceMM < deepMM)).toBe(true)
    expect(nodes.some((node) => node.edgeClearanceMM >= deepMM)).toBe(true)
    expect(nodes.some((node) => node.structuralClass === 'marginal')).toBe(true)
    expect(nodes.some((node) => node.structuralClass === 'strong')).toBe(true)

    for (const node of nodes) {
      // The rule, stated against the node's own emitted measurement — not membership in a
      // conservative polygon that answers a different question and takes every node down with it
      // when it cannot be certified.
      expect(node.structuralClass).toBe(node.edgeClearanceMM >= deepMM ? 'strong' : 'marginal')
      expect(node.structuralClass).not.toBe('indeterminate')
    }
  })

  it('refines an exact witness when the first quantised answer misses its own bracket', () => {
    // PILL B2 published origin [12.95, 12.167] and then failed its own P2 coverage bracket — the
    // chain certified full coverage and the re-price at that point returned zero. The bounded
    // one-quantum refinement retries the same chain with the neighbouring lattice points admitted
    // as exact witnesses; only a retry that clears EVERY bracket may publish.
    const pill = solveCanon('pill').bands.find((band) => band.band.band === 2)!
    expect(pill.variants.length).toBeGreaterThan(0)
    const pillOffer = selectionOf(pill.variants[0])

    // The answer now CERTIFIES, with the whole order run and no bracket violation reported.
    expect(pillOffer.proofStatus).toBe('CERTIFIED')
    expect(pillOffer.selectionTrace.stoppedAt).toBeNull()
    expect(pillOffer.decisionReasons.join(' | ')).not.toContain('bracket violation')
    expect(pillOffer.rejectionReasons).toHaveLength(0)
    expect(pill.decisionState).toBe('CERTIFIED_WINNER')

    // PRECONDITION THAT MAKES IT NON-VACUOUS: the published origin is no longer the point that
    // failed. If the retry had not moved it, this would still be [12.95, 12.167].
    const moved =
      pillOffer.registrationOffsetMM[0] !== 12.95 || pillOffer.registrationOffsetMM[1] !== 12.167
    expect(moved).toBe(true)
    // And every published value still sits inside the bracket its own restriction certified.
    for (const key of ORDER) {
      const promised = chainOf(pillOffer, key)
      expect(promised).toBeDefined()
      const published = pillOffer[key]
      if (promised!.direction === 'minimize')
        expect(published.hi).toBeLessThanOrEqual(promised!.hi + slack(promised!.hi))
      else expect(published.lo).toBeGreaterThanOrEqual(promised!.lo - slack(promised!.lo))
    }

    // BAT B2 must still certify, and the whole answer must be reproducible byte for byte.
    const batBand = solveCanon('bat').bands.find((band) => band.band.band === 2)!
    expect(batBand.decisionState).toBe('CERTIFIED_WINNER')
    expect(selectionOf(batBand.variants[0]).proofStatus).toBe('CERTIFIED')
    expect(JSON.stringify(solveCanon('bat'))).toBe(JSON.stringify(solveCanon('bat')))
  })

  it('says undecided, not empty, when the structure cannot certify', () => {
    // A source-valid class-1 edge exactly 24mm wide once scaled: the safe core collapses, but the
    // bbox is not narrower than the disc, so nothing certifies emptiness.
    const band = solve(rect(24, 84), narrow(2, 84, 96))
    const reasons = band.rejections.flatMap((rejection) => rejection.reasons)

    expect(reasons).not.toContain('AXIS_CLASS_UNRESOLVED')
    expect(reasons).toContain('DECISION_INDETERMINATE')
    expect(reasons).not.toContain('SAFE_CORE_EMPTY')
    expect(band.variants).toHaveLength(0)
    expect(band.decisionState).toBe('NONE')
  })

  it('answers the same shape identically twice', () => {
    const calibration = narrow(2, 84, 108)
    expect(JSON.stringify(solve(rect(100, 100), calibration))).toBe(
      JSON.stringify(solve(rect(100, 100), calibration)),
    )
  })

  it('rejects a degenerate contour instead of guessing', () => {
    expect(solveCutout(RELEASED, narrow(2, 84, 108), ring([[0, 0]]))).toBeNull()
  })
})

/** The square at the scale the winning answer was seated at — rebuilt from its published size. */
function squareAtScale(result: SelectorResult): Contour {
  const source = rect(100, 100)
  const scale = result.identity.sizeMM / 100
  return { outer: { pts: source.outer.pts.map(([x, y]) => [x * scale, y * scale] as Pt) }, holes: [] }
}

function boundsOf(contour: Contour): Contour {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of contour.outer.pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return ring([
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ])
}
