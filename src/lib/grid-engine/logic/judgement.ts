// logic/judgement.ts — THE SELECTOR. It runs the Product Base funnel over the released values and
// states, per band, the sizes a shape can manufacture and the exact magnet layout each size seats.
//
// Separation, per the scaffold law:
//   • compute/ holds ALL the mathematics — the lifted v1 engine, the continuous feasible set (T4)
//     and the certified neutral descriptors (T5).
//   • spec.ts holds ALL the values — grid, magnets, calibration, bands, templates, permission cells.
//   • THIS file classifies, applies permissions, drives Compute and orders the answers. It computes
//     no geometry and holds no numbers.
//
// THE FUNNEL (Product Base §18, Logic Spec §4): classify each axis independently → assign the band
// → take the frames the permission cell allows → offer the canonical parity registration as a
// tested starting frame → instantiate only approved patterns → restrict the feasible set through
// the approved order, one priority at a time → publish the registration that survived, with the
// evidence measured AT that registration.
//
// There is no sweep and no fallback. A band that cannot place anything says so, with reasons.

import { contentHash, stableStringify } from '@/lib/outline-core/math'
import {
  nearestAnchorPair,
  scaleContour,
  type Anchor,
  type GridResult,
} from '../compute/grid-core'
import {
  computeContinuousFeasibleSet,
  quantiseAndValidateRegistration,
  type ContinuousFeasibilityResult,
} from '../compute/continuous-feasibility'
import {
  prepareExactContour,
  distanceToPreparedContour,
} from '../compute/grid-prepared'
import { normalizeContour } from '../compute/normalize'
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
  type DistributionEvidence,
  type UnsupportedExtentEvidence,
} from '../compute/structure'
import { measureWrap, type WrapMeasures } from '../compute/wrap'
import type { Contour, Pt } from '../compute/types'
import {
  frameCellFor,
  type BandSpec,
  type CalibrationSpec,
  type FramePermissionCell,
  type GridSystemSpec,
  type LayoutTemplate,
} from '../spec'

/** One manufacturable variant: a grid-dictated size and the exact layout that seats it. */
export interface SizeVariant {
  /** Published longest side, millimetres, even. */
  sizeMM: number
  /** Seated magnets: centre coordinates (mm, this variant's frame) and diameter each. */
  anchors: Anchor[]
  /** Interior spots dropped by the belt. */
  candidates: Pt[]
  /** Hold-oracle report at this size: unheld outline length and its markers. Report, not a gate. */
  flaps: Pt[]
  uncoveredMM: number
  pitchMM: number
  pattern: string
  nearestAnchorMM: number | null
  /** The flap-law measures this variant was judged on. */
  wrap: WrapMeasures
  /** MASS-AWARE GRAVITY (Dan, 2026-08-15 22:52: band 4 must step UP to the full grid — the
   *  raw top extent let a thin ear tip veto every 4-point arrangement): material area above
   *  the padded block top, divided by the block width — the equivalent height of the hanging
   *  mass, judged against the same flap bound. A thin tip is light; a hanging body is not. */
  topHangMM?: number
  /** Horizontal distance from the assembly's centre to the shape's MASS AXIS (the deepest-material
   *  point) — the figure's own axis, which on a winged shape is not the bounding box's centre. */
  massAxisOffMM?: number
  /** The shallowest anchor's true distance to the outline — the STRONG-REGION measure (Dan's
   *  canon walkthrough: magnets belong in the mass; "limbs carry the hold" only where the limb
   *  is itself a full mass region). */
  minDepthMM?: number
  /** 'tight' within the tight bound; 'allowed' within the outer bound; 'limb' rides the limb
   *  exception (some side hangs beyond the outer bound but within the limb allowance). */
  tier: 'tight' | 'allowed' | 'limb'
  /** The released template that produced this layout, when one did (the auto search sets none). */
  layout?: string
  /** The exact contour at this size and placement — for drawing and manufacture. */
  effectContourMM: Contour
  /**
   * THE COMPLETE T6 RESULT for this variant. The fields above are the pre-T6 projection every
   * existing consumer still reads; this is the Product Base §19 answer they will move onto at T9.
   */
  selection?: SelectorResult
}

export interface BandAnswer {
  band: BandSpec
  /**
   * The band's certified optimal set, in a deterministic order. The first entry is the band's
   * answer ONLY when `decisionState` is CERTIFIED_WINNER. Under CERTIFIED_SET the entries are
   * certified CO-OPTIMA — all of them are answers — and under UNRESOLVED_SET they are contenders
   * the evidence could not separate. Reading the first as the winner overstates the last two.
   */
  variants: SizeVariant[]
  /** Why sizes/patterns produced nothing. Surfaced, because no fallback invents an answer. */
  rejections: SelectorRejection[]
  /**
   * What the evidence actually reached:
   *   NONE              nothing survived.
   *   CERTIFIED_WINNER  exactly one certified answer.
   *   CERTIFIED_SET     more than one certified CO-OPTIMUM, with no undecided pair among them —
   *                     the brief's "show every genuinely distinct good layout", stated honestly
   *                     rather than flattened into uncertainty it does not have.
   *   UNRESOLVED_SET    some surviving pair the evidence could not separate.
   */
  decisionState: 'CERTIFIED_WINNER' | 'CERTIFIED_SET' | 'UNRESOLVED_SET' | 'NONE'
}

export interface ShapeJudgement {
  bands: BandAnswer[]
}

/** Judge one delivered grid against the flap law. Returns null when the law refuses it. */
function variantFrom(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  band: BandSpec,
  contour: Contour,
  sizeMM: number,
  pitchMM: number,
  pattern: string,
  grid: GridResult,
  layout?: string,
): SizeVariant | null {
  // NO COUNT GATE (Dan 2026-08-14): any count that fits stays an option.
  if (grid.anchors.length < 1) return null
  const wrap = measureWrap(
    contour,
    grid.anchors.map((anchor) => anchor.p),
    spec.grid.paddingMM,
  )
  if (!wrap) return null
  // COMPATIBILITY PROJECTION ONLY. This adapter fills the pre-T6 fields the existing surfaces
  // still read; it may NOT veto a candidate the certified funnel accepted. The legacy centering
  // refusal that used to sit here was condemned policy re-entering through the adapter.
  const sideMax = Math.max(wrap.left, wrap.right)
  const verticalMax = Math.max(wrap.top, wrap.bottom)
  const tier: SizeVariant['tier'] =
    sideMax <= calibration.flapTightMM && verticalMax <= calibration.flapMaxMM
      ? 'tight'
      : verticalMax <= calibration.flapMaxMM
        ? 'allowed'
        : 'limb'
  return {
    sizeMM,
    anchors: grid.anchors,
    candidates: grid.candidates,
    flaps: grid.flaps,
    uncoveredMM: grid.uncoveredMM,
    pitchMM,
    pattern,
    nearestAnchorMM: nearestAnchorPair(grid.anchors)?.distanceMM ?? null,
    wrap,
    tier,
    layout,
    effectContourMM: contour,
  }
}

// ─── T6 · the Product Base funnel ──────────────────────────────────────────────────────────────
//
// classify axes → assign band → enumerate permitted frames → canonical parity registration →
// apply authored pattern permissions → classify nodes from T5 evidence → instantiate approved
// patterns only → certified placement → the approved lexicographic order.
//
// Logic holds no geometry: every measurement comes from Compute (T4 feasibility, T5 descriptors)
// and every legality proof from the verbatim catalogue door. Canonical registration is the
// deterministic STARTING frame and the final tie-break only; it never outranks mechanics.

/**
 * PB §4: each bounding-box axis is classified independently, against the AXIS-CLASS table — never
 * against the offered-band list, which would make classification depend on which products a caller
 * has enabled rather than on the axis itself.
 */
function axisClassOf(calibration: CalibrationSpec, sideMM: number): number | null {
  const entry = calibration.axisClasses.find(
    (row) => sideMM >= row.minMM && sideMM < row.maxMM,
  )
  return entry ? entry.axisClass : null
}

/** PB §5: a frame carrying n magnet lines on an axis spans n−1 lattice steps. */
function templateFrame(template: LayoutTemplate): { across: number; down: number } {
  let across = 0
  let down = 0
  for (const [x, y] of template.steps) {
    if (x > across) across = x
    if (y > down) down = y
  }
  return { across: across + 1, down: down + 1 }
}

/**
 * PB §6: the canonical frame centre is aligned with the cutout bounding-box centre. Placing the
 * frame's own centre there yields the ruled parity for free — an odd line count puts the centre
 * axis through a node line, an even count puts it on the middle spacer — so no parity branch
 * exists to disagree with the rule.
 */
function canonicalOrigin(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  frame: { across: number; down: number },
  pitchMM: number,
): Pt {
  return [
    (bbox.minX + bbox.maxX) / 2 - ((frame.across - 1) * pitchMM) / 2,
    (bbox.minY + bbox.maxY) / 2 - ((frame.down - 1) * pitchMM) / 2,
  ]
}

/**
 * The templates a permission cell may instantiate: those whose own node frame the cell names.
 * The DECISION lives here with the frame arithmetic it needs; spec.ts stays values-only and simply
 * holds the cells.
 */
function templatesForCell(
  calibration: CalibrationSpec,
  cell: FramePermissionCell,
): ReadonlyArray<LayoutTemplate> {
  if (cell.status === 'deferred' || !cell.frames.length) return []
  return calibration.templates.filter((template) => {
    const frame = templateFrame(template)
    return cell.frames.includes(`${frame.across}x${frame.down}`)
  })
}

/** The pattern's node offsets in millimetres, relative to its own first node. */
function templateOffsetsMM(template: LayoutTemplate, pitchMM: number): Pt[] {
  return template.steps.map(([across, down]) => [across * pitchMM, down * pitchMM] as Pt)
}

export type RejectionCode =
  // Geometry could not carry the arrangement.
  | 'SAFE_CORE_EMPTY'
  | 'NO_LAWFUL_REGISTRATION'
  | 'REGISTRATION_REFUSED_BY_CONSTRUCTION'
  | 'DECISION_INDETERMINATE'
  // Authority is missing — a different thing entirely from geometric infeasibility.
  | 'AXIS_CLASS_UNRESOLVED'
  | 'PATTERN_POLICY_DEFERRED'
  | 'NO_TEMPLATE_FOR_PERMITTED_FRAME'
  // Lawful, measured, and certifiably beaten by another candidate — not a geometric failure.
  | 'CERTIFIED_DOMINATED'
  // A MAJOR SUPPORT REGION reaches past the active P4 limit. Policy, applied by Logic.
  | 'EXCESSIVE_UNSUPPORTED_EXTENT'

export interface NodeAddress {
  across: number
  down: number
}

export interface NodeEvidence {
  address: NodeAddress
  centreMM: Pt
  /** Exact distance from the node centre to the outline — the legality proof, not an estimate. */
  edgeClearanceMM: number
  /** Legal by construction: the exact door re-proved this disc, or the candidate never existed. */
  legality: 'legal' | 'illegal'
  /** PB §9's states. 'indeterminate' when the hierarchy itself could not certify the region. */
  structuralClass: 'strong' | 'marginal' | 'illegal' | 'indeterminate'
}

/** The complete Product Base §19 result for one accepted candidate. */
export interface SelectorResult {
  exactWidthMM: number
  exactHeightMM: number
  scaleFactor: number
  axisClassX: number | null
  axisClassY: number | null
  band: number
  nodeFrame: { across: number; down: number }
  registrationOffsetMM: Pt
  patternId: string
  nodeAddresses: NodeAddress[]
  magnetCentresMM: Pt[]
  minimumEdgeClearanceMM: number
  nodes: NodeEvidence[]
  /** Structural authority actually used, reproducibly — counts alone cannot be re-walked. */
  supportedRegionCount: number
  distinctMassCount: number
  hierarchyCertain: boolean
  structuralEvidence: {
    clearanceLevelsMM: readonly number[]
    levels: ReadonlyArray<{
      clearanceLevelMM: number
      status: string
      envelopeOmissionBoundMM: number
      regionCount: number
      witnessCount: number
      collapsed: boolean
    }>
    regions: ReadonlyArray<{
      /** Stable identity of the region's own geometry, so a reader can match it again. */
      regionId: string
      levelIndex: number
      widthFloorMM: number
      areaMM2Lo: number
      areaMM2Hi: number
      persistenceLevels: number
      parentStatus: string
      parentRegionId: string | null
    }>
    witnessIds: readonly string[]
  }
  /**
   * THE EVIDENCE SELECTION ACTUALLY USED. The descriptor fields below are re-measured at the ONE
   * published registration — output evidence. They cannot show where the sequential restriction
   * stopped, because a single point re-prices cleanly even when the chain over the surviving set
   * did not. A consumer honouring the stop point must read it from here, not infer it from prose.
   */
  selectionTrace: {
    /** The rule the restriction stopped at, or null when the whole order ran. */
    stoppedAt: string | null
    chain: Partial<Record<(typeof APPROVED_ORDER)[number]['key'], DescriptorEvidence>>
  }
  /** Evidence, carried whole from Compute — never restated as a Logic number. */
  coverage: DescriptorEvidence
  upperHangingMass: DescriptorEvidence
  unsupportedExtent: DescriptorEvidence
  peelLeverage: DescriptorEvidence
  distribution: DescriptorEvidence
  /** P7's second key, kept separate so the lexicographic order can restrict on it in turn. */
  distributionVariance: DescriptorEvidence
  balance: DescriptorEvidence
  feasibility: ContinuousFeasibilityResult['status']
  proofStatus: 'CERTIFIED' | 'INDETERMINATE'
  decisionReasons: string[]
  rejectionReasons: RejectionCode[]
  /**
   * P4 APPLIED, not merely measured. Compute reports the reach and deliberately applies nothing;
   * this is Logic's verdict against the active released switch. An exemption is REPORTED here with
   * the side and reach that earned it — a silent exemption is the violation T0b records.
   */
  unsupportedExtentPolicy: {
    activeLimitMM: 12 | 24
    outcome: 'WITHIN_LIMIT' | 'TRIVIAL_LIMB_EXEMPT'
    /** Every side and its reach beyond the padded box, whether or not it exceeded the limit. */
    perSideMM: { left: number; right: number; top: number; bottom: number }
    /** Sides that exceeded the limit and were exempted because no MAJOR region reached that far. */
    exemptedSides: ReadonlyArray<{ side: 'left' | 'right' | 'top' | 'bottom'; reachMM: number }>
  }
  /** Distance from the canonical starting frame — the FINAL tie-break only, never a preference. */
  canonicalProximityMM: number
  identity: {
    sourceGeometryHash: string
    sizeMM: number
    population: number
    originParity: { across: 'node-line' | 'spacer-line'; down: 'node-line' | 'spacer-line' }
    frame: string
    patternVariant: string
    registrationMM: Pt
    profileHash: string
    /** Hash of the EVIDENCE this answer was measured from — not an artifact identity. */
    evidenceHash: string
    /** Hash of the RESULT itself — not an artifact identity. */
    resultHash: string
  }
}

/** Why a size/pattern produced nothing — surfaced, never swallowed by a fallback. */
export interface SelectorRejection {
  sizeMM: number
  patternId: string
  reasons: RejectionCode[]
  /**
   * Present exactly when `reasons` carries CERTIFIED_DOMINATED: WHO beat this candidate and under
   * WHICH rule. Without it a dominated candidate vanishes with no way to re-walk the decision.
   */
  dominatedBy?: { patternId: string; sizeMM: number; rule: string }
}

/**
 * One evaluated candidate.
 *
 * `chain` is the SELECTION evidence — the interval evidence each priority produced while the
 * feasible set was being restricted, plus where the chain stopped. `result` is the OUTPUT evidence,
 * re-measured at the published point. Selection reads the chain only: judging on point values would
 * let a candidate be eliminated by numbers that belong to one arbitrarily chosen representative.
 */
interface Candidate {
  variant: SizeVariant
  result: SelectorResult
  chain: Partial<Record<(typeof APPROVED_ORDER)[number]['key'], DescriptorEvidence>>
  stoppedAt: string | null
}

/** The approved total order — Logic Spec §2 / Product Base §11. No opaque score, no re-ordering. */
const APPROVED_ORDER: ReadonlyArray<{
  key:
    | 'coverage'
    | 'upperHangingMass'
    | 'unsupportedExtent'
    | 'peelLeverage'
    | 'distribution'
    | 'distributionVariance'
    | 'balance'
  rule: string
}> = [
  { key: 'coverage', rule: 'P2 coverage of major support regions' },
  { key: 'upperHangingMass', rule: 'P3 support of the upper gravity-critical mass' },
  { key: 'unsupportedExtent', rule: 'P4 reduction of unsupported extent' },
  { key: 'peelLeverage', rule: 'P5 reduction of peel leverage' },
  { key: 'distribution', rule: 'P7 distribution across distinct masses' },
  { key: 'distributionVariance', rule: 'P7b evenness of anchors per mass' },
  { key: 'balance', rule: 'P8 balance' },
]

/**
 * Compare two candidates in the approved order.
 *
 * UNCERTAINTY IS NOT EQUALITY. At the first comparison Compute cannot certify either way, the pair
 * is DECISION-INDETERMINATE and no later priority may decide it — advancing would let a lower rule
 * overturn a higher one it never actually won.
 */
function decide(a: Candidate, b: Candidate): { winner: -1 | 0 | 1; undecided: boolean; reason: string } {
  for (const step of APPROVED_ORDER) {
    const left = a.chain[step.key]
    const right = b.chain[step.key]
    // A chain that never reached this priority cannot speak at it, and no later one may speak for it.
    if (!left || !right)
      return { winner: 0, undecided: true, reason: `${step.rule} unmeasured in one chain` }
    if (certifiedDominance(left, right, 0)) return { winner: -1, undecided: false, reason: step.rule }
    if (certifiedDominance(right, left, 0)) return { winner: 1, undecided: false, reason: step.rule }
    if (a.stoppedAt === step.rule || b.stoppedAt === step.rule)
      return { winner: 0, undecided: true, reason: `${step.rule} stopped the chain` }
    const bothCertified =
      left.status !== 'DECISION_INDETERMINATE' && right.status !== 'DECISION_INDETERMINATE'
    const separable = left.lo !== right.lo || left.hi !== right.hi
    if (!bothCertified || separable)
      return { winner: 0, undecided: true, reason: `${step.rule} could not certify` }
  }
  const countA = a.result.magnetCentresMM.length
  const countB = b.result.magnetCentresMM.length
  if (countA !== countB)
    return {
      winner: countA < countB ? -1 : 1,
      undecided: false,
      reason: 'P9 fewer magnets at equivalent support',
    }
  // DISTINCT OPTIMAL IDENTITIES SURVIVE, AND THE TEST COMES BEFORE SIZE. Two mechanically
  // equivalent but genuinely different arrangements are both answers; size may not delete one of
  // them, because a smaller seat is not a reason to withdraw a distinct layout the brief promises.
  // Only WITHIN one arrangement does size act, as the snug-seat tie-break, and canonical proximity
  // after it — neither ever collapses two governed identities.
  const addresses = (candidate: Candidate): string =>
    candidate.result.nodeAddresses.map((node) => `${node.across},${node.down}`).join(';')
  const sameArrangement =
    a.result.patternId === b.result.patternId &&
    a.result.identity.frame === b.result.identity.frame &&
    a.result.identity.population === b.result.identity.population &&
    a.result.identity.originParity.across === b.result.identity.originParity.across &&
    a.result.identity.originParity.down === b.result.identity.originParity.down &&
    addresses(a) === addresses(b)
  if (!sameArrangement)
    return { winner: 0, undecided: false, reason: 'mechanically equivalent, distinct identities' }
  if (a.variant.sizeMM !== b.variant.sizeMM)
    return {
      winner: a.variant.sizeMM < b.variant.sizeMM ? -1 : 1,
      undecided: false,
      reason: 'size selector: the snug seat inside one arrangement',
    }
  if (a.result.canonicalProximityMM !== b.result.canonicalProximityMM)
    return {
      winner: a.result.canonicalProximityMM < b.result.canonicalProximityMM ? -1 : 1,
      undecided: false,
      reason: 'canonical registration tie-break inside one arrangement',
    }
  return { winner: 0, undecided: false, reason: 'identical' }
}

/**
 * The feasible set restricted to one descriptor's certified optimal/equivalent set.
 *
 * The incoming STATUS and envelope are carried, never re-asserted: restricting an indeterminate set
 * cannot make it proved, and a subset of an uncertain set is still uncertain.
 */
function restrictTo(
  feasible: ContinuousFeasibilityResult,
  evidence: DescriptorEvidence,
): ContinuousFeasibilityResult | null {
  if (!evidence.argopt) return null
  const components = evidence.argopt.regions
  const witnesses = evidence.argopt.points
  if (!components.length && !witnesses.length) return null
  return {
    status: feasible.status,
    components,
    exactWitnessesMM: witnesses,
    envelope: feasible.envelope,
  }
}

/** One registration as a feasible set — for OUTPUT re-pricing only. Status is carried, not raised. */
function singleton(feasible: ContinuousFeasibilityResult, point: Pt): ContinuousFeasibilityResult {
  return {
    status: feasible.status,
    components: [],
    exactWitnessesMM: [point],
    envelope: feasible.envelope,
  }
}

/** Honest absence of evidence — used when an input classification does not exist to measure. */
function deferredEvidence(
  units: DescriptorEvidence['units'],
  direction: DescriptorEvidence['direction'],
  reason: string,
  feasible: ContinuousFeasibilityResult,
): DescriptorEvidence {
  return {
    units,
    direction,
    status: 'DECISION_INDETERMINATE',
    lo: Number.NaN,
    hi: Number.NaN,
    argopt: null,
    completenessProof: reason,
    sourceEnvelope: feasible.envelope,
    perComponent: [],
    witnessEvidence: [],
  }
}

interface DescriptorInputs {
  majorSupportRegions: Contour[]
  distinctMasses: Contour[]
  peelToleranceMM3: number
  peelMaxEvaluations: number
  distributionMaxCells: number
}

function runDescriptor(
  key: (typeof APPROVED_ORDER)[number]['key'],
  subject: DescriptorSubject,
  inputs: DescriptorInputs,
): DescriptorEvidence {
  switch (key) {
    case 'coverage':
      return coverageEvidence(subject, inputs.majorSupportRegions)
    case 'upperHangingMass':
      return upperHangingMassEvidence(subject)
    case 'unsupportedExtent':
      return unsupportedExtentEvidence(subject, inputs.majorSupportRegions)
    case 'peelLeverage':
      return peelLeverageEvidence(subject, {
        toleranceMM3: inputs.peelToleranceMM3,
        maxEvaluations: inputs.peelMaxEvaluations,
      })
    case 'distribution':
      return inputs.distinctMasses.length
        ? distributionEvidence(subject, inputs.distinctMasses, inputs.distributionMaxCells)
        : deferredEvidence(
            'count',
            'maximize',
            'no distinct-mass classification exists at the deep clearance level; the key is deferred, not substituted',
            subject.feasible,
          )
    case 'distributionVariance':
      return inputs.distinctMasses.length
        ? (
            distributionEvidence(
              subject,
              inputs.distinctMasses,
              inputs.distributionMaxCells,
            ) as DistributionEvidence
          ).anchorVariance
        : deferredEvidence(
            'ratio',
            'minimize',
            'no distinct-mass classification exists at the deep clearance level; the key is deferred, not substituted',
            subject.feasible,
          )
    case 'balance':
      return balanceEvidence(subject)
  }
}

/**
 * THE LEXICOGRAPHIC RESTRICTION, run for ONE candidate.
 *
 * P2 is measured over the whole feasible set; the set is then restricted to P2's certified optimal
 * set and P3 is measured over THAT, and so on down the order. The registration the chain arrives at
 * therefore owns every number reported for it — the earlier defect scored six independent optima and
 * pinned them to an arbitrary point no registration achieved. A step that cannot certify stops the
 * chain: later priorities may not decide what an earlier one left open.
 */
function restrictInOrder(
  base: DescriptorSubject,
  inputs: DescriptorInputs,
): {
  // PARTIAL, and typed so: a chain that stopped never measured the priorities after the stop, and
  // a full Record would manufacture the claim that it did.
  evidence: Partial<Record<(typeof APPROVED_ORDER)[number]['key'], DescriptorEvidence>>
  surviving: ContinuousFeasibilityResult
  stoppedAt: string | null
} {
  const evidence: Partial<Record<(typeof APPROVED_ORDER)[number]['key'], DescriptorEvidence>> = {}
  let surviving = base.feasible
  let stoppedAt: string | null = null
  for (const step of APPROVED_ORDER) {
    const measured = runDescriptor(step.key, { ...base, feasible: surviving }, inputs)
    evidence[step.key] = measured
    if (measured.status === 'DECISION_INDETERMINATE') {
      stoppedAt = step.rule
      break
    }
    const next = restrictTo(surviving, measured)
    if (!next) {
      stoppedAt = step.rule
      break
    }
    surviving = next
  }
  return { evidence, surviving, stoppedAt }
}

/**
 * The registration to publish out of what survived the chain.
 *
 * After a chain that ran the WHOLE order, canonical proximity picks among the survivors — that is
 * the one place the brief allows it, inside the mechanically equivalent set. A chain that STOPPED
 * carries unresolved priorities, so canonical may not speak there at all; the choice falls back to a
 * deterministic coordinate order, and the candidate is already marked indeterminate.
 */
function chooseRegistration(
  feasible: ContinuousFeasibilityResult,
  canonical: Pt,
  chainComplete: boolean,
): Pt | null {
  const options: Pt[] = [
    ...feasible.exactWitnessesMM.map(([x, y]) => [x, y] as Pt),
    ...feasible.components.flatMap((component) => component.map(([x, y]) => [x, y] as Pt)),
  ]
  if (!options.length) return null
  const order = (a: Pt, b: Pt): number => a[0] - b[0] || a[1] - b[1]
  if (!chainComplete) return [...options].sort(order)[0]
  return [...options].sort((a, b) => {
    const da = Math.hypot(a[0] - canonical[0], a[1] - canonical[1])
    const db = Math.hypot(b[0] - canonical[0], b[1] - canonical[1])
    return da - db || order(a, b)
  })[0]
}

function parityOf(lines: number): 'node-line' | 'spacer-line' {
  return lines % 2 === 1 ? 'node-line' : 'spacer-line'
}

function judgeBand(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  band: BandSpec,
  unitContour: Contour,
  sourceDominantMM: number,
  sourceGeometryHash: string,
  profileHash: string,
): BandAnswer {
  const candidates: Candidate[] = []
  const rejections: SelectorRejection[] = []
  const step = calibration.sizeStepMM

  for (
    let sizeMM = Math.ceil(band.minSizeMM / step) * step;
    sizeMM < band.maxSizeMM;
    sizeMM += step
  ) {
    // EVERY SIZE IS EVALUATED INDEPENDENTLY (PB §12): no prior size or band truncates this domain.
    const contour = scaleContour(unitContour, sizeMM)
    const prepared = prepareExactContour(contour)
    const bbox = prepared.bbox
    const widthMM = bbox.maxX - bbox.minX
    const heightMM = bbox.maxY - bbox.minY
    const axisClassX = axisClassOf(calibration, widthMM)
    const axisClassY = axisClassOf(calibration, heightMM)
    if (axisClassX === null || axisClassY === null) {
      rejections.push({ sizeMM, patternId: '*', reasons: ['AXIS_CLASS_UNRESOLVED'] })
      continue
    }
    const cell = frameCellFor(calibration, band.band, axisClassX, axisClassY)
    const permitted = cell ? templatesForCell(calibration, cell) : []
    if (!cell || cell.status === 'deferred') {
      rejections.push({ sizeMM, patternId: '*', reasons: ['PATTERN_POLICY_DEFERRED'] })
      continue
    }
    if (!permitted.length) {
      // The cell names frames, but no released template realises them — a vocabulary gap, stated as
      // such rather than filled by permitting something the cell did not name.
      rejections.push({ sizeMM, patternId: '*', reasons: ['NO_TEMPLATE_FOR_PERMITTED_FRAME'] })
      continue
    }

    const domain: Contour = {
      outer: {
        pts: [
          [bbox.minX, bbox.minY],
          [bbox.maxX, bbox.minY],
          [bbox.maxX, bbox.maxY],
          [bbox.minX, bbox.maxY],
        ],
      },
      holes: [],
    }
    // THE MATERIAL-MASS GRAPH IS THE CERTIFIED SAFE CORE. Logic Spec §2 P7 distributes across
    // distinct MATERIAL masses — one per lobe or wing — and Logic Spec §4 step 6 / PB §§7.3 and 8
    // put major masses, connectors and branches in the structural graph. PB §21 leaves the exact
    // strong/marginal thresholds OPEN, and no governing source says a distinct mass is a component
    // surviving the authored 24mm level. T6 made that equation anyway, so on a shape whose deeper
    // level cannot be certified P7 lost the shape's masses entirely — measured on BAT B2 and PILL
    // B2, both distinctMassCount 0 with the 24mm level INDETERMINATE_WITHIN_TOLERANCE and collapsed.
    //
    // The deep level is NOT the mass source. It stays exactly what the calibration says it is — the
    // authored strong/marginal threshold — and is applied per node from exact clearance below. This
    // is not a fallback: there is no conditional, no "if the deep level failed". The safe-core
    // components ARE the mass graph, always.
    const levels = calibration.nodeClassification.clearanceLevelsMM
    const hierarchy = buildComponentHierarchy(contour, levels)
    const asContours = (levelIndex: number): Contour[] =>
      (hierarchy.levels[levelIndex]?.nodes ?? []).map((node) => ({
        outer: { pts: node.ringMM.map(([x, y]) => [x, y] as Pt) },
        holes: [],
      }))
    const safeCoreMasses = asContours(0)
    const majorSupportRegions = safeCoreMasses
    const distinctMasses = safeCoreMasses
    /** Diagnostic only, and emitted as such: whether EVERY level, deep one included, was certified. */
    const hierarchyCertain =
      hierarchy.levels.every((level) => level.status !== 'INDETERMINATE_WITHIN_TOLERANCE') &&
      hierarchy.levels.every((level) =>
        level.nodes.every((node) => node.parentStatus !== 'INDETERMINATE'),
      )
    // PROOF RESTS ON WHAT SELECTION ACTUALLY CONSUMED: the certified safe-core masses, plus each
    // node's exact measured clearance. The deeper level's status is preserved and emitted, but an
    // uncertainty in a level nothing consumed cannot make a consumed answer uncertain.
    const safeCoreCertain =
      hierarchy.levels[0] !== undefined &&
      hierarchy.levels[0].status !== 'INDETERMINATE_WITHIN_TOLERANCE' &&
      hierarchy.levels[0].nodes.every((node) => node.parentStatus !== 'INDETERMINATE')
    if (!majorSupportRegions.length) {
      // Emptiness is only a geometric fact when T4 CERTIFIED it. An indeterminate level, or one
      // where only witnesses survived, is undecided evidence — not proof that nothing fits.
      const level = hierarchy.levels[0]
      const certifiedEmpty =
        level !== undefined &&
        level.status === 'INFEASIBLE_CERTIFIED' &&
        level.witnessesMM.length === 0
      rejections.push({
        sizeMM,
        patternId: '*',
        reasons: [certifiedEmpty ? 'SAFE_CORE_EMPTY' : 'DECISION_INDETERMINATE'],
      })
      continue
    }
    const inputs: DescriptorInputs = {
      majorSupportRegions,
      // The same certified graph, named for the duty it serves here: P7 distributes anchors across
      // distinct material masses. One source, two named inputs — not one list quietly relabelled
      // when another failed.
      distinctMasses,
      peelToleranceMM3: calibration.peelToleranceMM3,
      peelMaxEvaluations: calibration.peelMaxEvaluations,
      distributionMaxCells: calibration.distributionMaxCells,
    }

    for (const template of permitted) {
      const frame = templateFrame(template)
      const offsetsMM = templateOffsetsMM(template, spec.grid.basePitchMM)
      // THE CANONICAL STARTING FRAME IS ACTUALLY TESTED (PB §6): it enters T4 as an exact witness,
      // so it is exact-validated and retained when lawful instead of being asserted in prose.
      const canonical = canonicalOrigin(bbox, frame, spec.grid.basePitchMM)
      const feasible = computeContinuousFeasibleSet({
        contour,
        permittedDomain: domain,
        effectiveRadiusMM: spec.grid.paddingMM,
        offsetsMM,
        exactWitnessesMM: [canonical],
      })
      if (feasible.status === 'INFEASIBLE_CERTIFIED') {
        rejections.push({ sizeMM, patternId: template.name, reasons: ['SAFE_CORE_EMPTY'] })
        continue
      }
      if (!feasible.components.length && !feasible.exactWitnessesMM.length) {
        rejections.push({ sizeMM, patternId: template.name, reasons: ['NO_LAWFUL_REGISTRATION'] })
        continue
      }
      const base: DescriptorSubject = {
        contour,
        offsetsMM,
        effectiveRadiusMM: spec.grid.paddingMM,
        feasible,
      }
      const chain = restrictInOrder(base, inputs)
      const chosen = chooseRegistration(chain.surviving, canonical, chain.stoppedAt === null)
      if (!chosen) {
        rejections.push({ sizeMM, patternId: template.name, reasons: ['NO_LAWFUL_REGISTRATION'] })
        continue
      }
      let placed: { originMM: Pt; grid: GridResult }
      try {
        placed = quantiseAndValidateRegistration(
          prepared,
          chosen,
          template.steps,
          spec.grid.basePitchMM,
          { paddingMM: spec.grid.paddingMM, plan: calibration.plan, perimeterOnly: true },
        )
      } catch {
        rejections.push({
          sizeMM,
          patternId: template.name,
          reasons: ['REGISTRATION_REFUSED_BY_CONSTRUCTION'],
        })
        continue
      }
      // THE QUANTISED REGISTRATION IS RE-PRICED. Every number published for this candidate is
      // measured at the point that is actually published, not at the pre-quantisation optimum.
      const atAnswer: DescriptorSubject = { ...base, feasible: singleton(feasible, placed.originMM) }
      const evidence = {} as Record<(typeof APPROVED_ORDER)[number]['key'], DescriptorEvidence>
      for (const orderStep of APPROVED_ORDER)
        evidence[orderStep.key] = runDescriptor(orderStep.key, atAnswer, inputs)

      // P4 POLICY, APPLIED AT THE PUBLISHED REGISTRATION. Compute measured the per-side reach and
      // the per-major-region reach and applied NEITHER, by design. Logic applies both here against
      // the active released switch: a MAJOR support region past the limit rejects the candidate; a
      // reach past the limit that no major region shares is the ruled trivial-limb exemption, and it
      // is reported with its side and reach rather than passing silently.
      // The loop above already measured this at the SAME subject with the SAME regions —
      // runDescriptor('unsupportedExtent') is exactly unsupportedExtentEvidence(subject,
      // inputs.majorSupportRegions) — so the narrowing is sound by construction and a second call
      // would only be a second chance to diverge.
      const extent = evidence.unsupportedExtent as UnsupportedExtentEvidence
      const activeLimitMM = calibration.unsupportedExtent.activeLimitMM
      const SIDES = ['left', 'right', 'top', 'bottom'] as const
      const overLimit = SIDES.filter((side) => extent.reachMM[side] > activeLimitMM)
      const majorOverLimit = overLimit.some((side) =>
        extent.perRegion.some((region) => region[`${side}MM`] > activeLimitMM),
      )
      if (majorOverLimit) {
        rejections.push({
          sizeMM,
          patternId: template.name,
          reasons: ['EXCESSIVE_UNSUPPORTED_EXTENT'],
        })
        continue
      }
      const unsupportedExtentPolicy = {
        activeLimitMM,
        outcome: (overLimit.length ? 'TRIVIAL_LIMB_EXEMPT' : 'WITHIN_LIMIT') as
          | 'WITHIN_LIMIT'
          | 'TRIVIAL_LIMB_EXEMPT',
        perSideMM: { ...extent.reachMM },
        exemptedSides: overLimit.map((side) => ({ side, reachMM: extent.reachMM[side] })),
      }
      // THE PUBLISHED VALUES MUST BE CONTAINED IN THE BRACKETS THE CHAIN CERTIFIED. Not merely
      // overlapping them: a value that extends past the interval its own restriction proved is not
      // the answer the chain selected, and that is reported — never published as though it were.
      const bracketViolations: string[] = []
      for (const orderStep of APPROVED_ORDER) {
        const promised = chain.evidence[orderStep.key]
        const published = evidence[orderStep.key]
        if (!promised || promised.status === 'DECISION_INDETERMINATE') continue
        if (published.status === 'DECISION_INDETERMINATE') {
          bracketViolations.push(`${orderStep.rule} could not be re-measured at the answer`)
          continue
        }
        // DIRECTION-RELEVANT CONTAINMENT. Only the bound that can make the chosen point WORSE is
        // binding: minimising, the point must not exceed the certified upper bound; maximising, it
        // must not fall under the certified lower one. The opposite side is outward measurement
        // uncertainty — a conservative lo may legitimately sit below a global proven lower bound —
        // and holding it against the point would reject lawful answers. Slack is the two ulps of
        // outward rounding the descriptors already applied, nothing wider.
        const slack = (value: number): number => Math.abs(value) * 2 ** -51 + Number.MIN_VALUE
        const contained =
          promised.direction === 'minimize'
            ? published.hi <= promised.hi + slack(promised.hi)
            : published.lo >= promised.lo - slack(promised.lo)
        if (!contained)
          bracketViolations.push(
            `${orderStep.rule} published [${published.lo},${published.hi}] breaches the certified ${promised.direction === 'minimize' ? 'upper' : 'lower'} bound of [${promised.lo},${promised.hi}]`,
          )
      }

      const variant = variantFrom(
        spec,
        calibration,
        band,
        contour,
        sizeMM,
        spec.grid.basePitchMM,
        'standard',
        placed.grid,
        template.name,
      )
      if (!variant) {
        rejections.push({ sizeMM, patternId: template.name, reasons: ['NO_LAWFUL_REGISTRATION'] })
        continue
      }

      const nodes: NodeEvidence[] = placed.grid.anchors.map((anchor, index) => {
        const [across, down] = template.steps[index] ?? [0, 0]
        const clearance = distanceToPreparedContour(anchor.p, prepared)
        // LEGAL BY CONSTRUCTION: quantiseAndValidateRegistration re-proved every disc through the
        // exact door and throws otherwise, so reaching here IS the proof. No epsilon is invented to
        // re-decide what the door already settled; the measured clearance is reported as evidence.
        return {
          address: { across, down },
          centreMM: [anchor.p[0], anchor.p[1]] as Pt,
          edgeClearanceMM: clearance,
          legality: 'legal' as const,
          // STRONG OR MARGINAL FROM THE NODE'S OWN EXACT CLEARANCE, against the authored deep
          // threshold. Membership in a conservative deep-level POLYGON answered a different
          // question — whether a disc of that radius fits somewhere containing this point — and
          // made every node indeterminate whenever that polygon could not be certified, although
          // this node's clearance was already measured exactly.
          structuralClass:
            clearance >= levels[calibration.nodeClassification.strongLevelIndex]
              ? ('strong' as const)
              : ('marginal' as const),
        }
      })
      const regionId = (ring: ReadonlyArray<Pt>): string => contentHash(stableStringify({ ring }))
      const structuralEvidence: SelectorResult['structuralEvidence'] = {
        clearanceLevelsMM: levels,
        levels: hierarchy.levels.map((level) => ({
          clearanceLevelMM: level.clearanceLevelMM,
          status: level.status,
          envelopeOmissionBoundMM: level.envelope.omissionBoundMM,
          regionCount: level.nodes.length,
          witnessCount: level.witnessesMM.length,
          collapsed: level.collapsed,
        })),
        regions: hierarchy.levels.flatMap((level, levelIndex) =>
          level.nodes.map((node) => ({
            regionId: regionId(node.ringMM),
            levelIndex,
            widthFloorMM: node.widthFloorMM,
            areaMM2Lo: node.areaMM2Lo,
            areaMM2Hi: node.areaMM2Hi,
            persistenceLevels: node.persistenceLevels,
            parentStatus: node.parentStatus,
            parentRegionId:
              node.parentStatus === 'RESOLVED' && node.parentIndex !== null
                ? regionId(hierarchy.levels[levelIndex - 1].nodes[node.parentIndex].ringMM)
                : null,
          })),
        ),
        witnessIds: hierarchy.levels.flatMap((level) =>
          level.witnessesMM.map((witness) => contentHash(stableStringify({ witness }))),
        ),
      }
      const minimumEdgeClearanceMM = nodes.length
        ? Math.min(...nodes.map((node) => node.edgeClearanceMM))
        : 0
      const undecided = APPROVED_ORDER.filter(
        (orderStep) => evidence[orderStep.key].status === 'DECISION_INDETERMINATE',
      )
      const classificationCertain = nodes.every((node) => node.structuralClass !== 'indeterminate')
      const magnetCentresMM = placed.grid.anchors.map((anchor) => [anchor.p[0], anchor.p[1]] as Pt)
      // The evidence hash covers the evidence AS EMITTED — whole descriptor records, the structural
      // evidence and the feasibility, not a handful of scalars read off them.
      // ONE object, hashed and emitted. Hashing the object itself rather than an APPROVED_ORDER map
      // keeps ABSENCE canonical: a priority the chain never reached is a missing key, not a present
      // key holding undefined, and that distinction is part of the identity.
      const selectionTrace = { stoppedAt: chain.stoppedAt, chain: chain.evidence }
      const evidenceHash = contentHash(
        stableStringify({
          feasibility: feasible.status,
          envelope: feasible.envelope,
          measuredAt: placed.originMM,
          structuralEvidence,
          emitted: APPROVED_ORDER.map((orderStep) => [orderStep.key, evidence[orderStep.key]]),
          // The chain the selection ran on, not only what was re-measured at the answer.
          selectionTrace,
          // The APPLIED policy, not just the measured reach it was applied to.
          unsupportedExtentPolicy,
        }),
      )
      const result: SelectorResult = {
        exactWidthMM: widthMM,
        exactHeightMM: heightMM,
        // The uniform scale relative to the SUPPLIED source contour, not the target size.
        scaleFactor: sourceDominantMM > 0 ? sizeMM / sourceDominantMM : 1,
        axisClassX,
        axisClassY,
        band: band.band,
        nodeFrame: frame,
        registrationOffsetMM: placed.originMM,
        patternId: template.name,
        nodeAddresses: nodes.map((node) => node.address),
        magnetCentresMM,
        minimumEdgeClearanceMM,
        nodes,
        supportedRegionCount: majorSupportRegions.length,
        distinctMassCount: distinctMasses.length,
        hierarchyCertain,
        structuralEvidence,
        unsupportedExtentPolicy,
        selectionTrace,
        coverage: evidence.coverage,
        upperHangingMass: evidence.upperHangingMass,
        unsupportedExtent: evidence.unsupportedExtent,
        peelLeverage: evidence.peelLeverage,
        distribution: evidence.distribution,
        distributionVariance: evidence.distributionVariance,
        balance: evidence.balance,
        feasibility: feasible.status,
        // PROOF COVERS THE WHOLE FUNNEL, not the descriptors alone.
        proofStatus:
          undecided.length === 0 &&
          classificationCertain &&
          safeCoreCertain &&
          feasible.status === 'PROVED_FEASIBLE' &&
          chain.stoppedAt === null &&
          bracketViolations.length === 0
            ? 'CERTIFIED'
            : 'INDETERMINATE',
        decisionReasons: [
          `funnel: axis classes ${axisClassX}/${axisClassY} → band ${band.band} → cell ${cell.source} → frame ${frame.across}x${frame.down} → permitted pattern ${template.name}`,
          chain.stoppedAt
            ? `restriction stopped at ${chain.stoppedAt}; later priorities did not decide it`
            : 'restriction ran the whole order; the published registration owns every value',
          `values re-measured at the quantised registration ${placed.originMM.join(',')}`,
          unsupportedExtentPolicy.outcome === 'TRIVIAL_LIMB_EXEMPT'
            ? `P4 at ${activeLimitMM}mm: trivial-limb exemption reported for ${unsupportedExtentPolicy.exemptedSides
                .map((entry) => `${entry.side} ${entry.reachMM.toFixed(3)}mm`)
                .join(', ')} — no major support region reaches past the limit`
            : `P4 at ${activeLimitMM}mm: every side within the limit`,
          ...(bracketViolations.length
            ? bracketViolations.map((violation) => `bracket violation: ${violation}`)
            : ['every published value lies inside the bracket its restriction certified']),
        ],
        rejectionReasons: bracketViolations.length ? ['DECISION_INDETERMINATE'] : [],
        canonicalProximityMM: Math.hypot(
          placed.originMM[0] - canonical[0],
          placed.originMM[1] - canonical[1],
        ),
        identity: {
          sourceGeometryHash,
          sizeMM,
          population: magnetCentresMM.length,
          originParity: { across: parityOf(frame.across), down: parityOf(frame.down) },
          frame: `${frame.across}x${frame.down}`,
          patternVariant: template.name,
          registrationMM: placed.originMM,
          profileHash,
          evidenceHash,
          // Filled ONCE, after the decision reasons land — the payload is not complete until then,
          // and a self-hash cannot include itself. A candidate that does not survive is never
          // published, so it never needs one.
          resultHash: '',
        },
      }
      candidates.push({ variant, result, chain: chain.evidence, stoppedAt: chain.stoppedAt })
    }
  }

  // THE ARRANGEMENT, not the millimetre step. Candidates are grouped by their GOVERNED identity
  // without the search size — pattern, frame, population, origin parity and the ordered node
  // addresses, so two arrangements that differ in parity or node order stay distinct.
  const arrangementKey = (candidate: Candidate): string => {
    const identity = candidate.result.identity
    return [
      identity.patternVariant,
      identity.frame,
      identity.population,
      `${identity.originParity.across}/${identity.originParity.down}`,
      candidate.result.nodeAddresses.map((node) => `${node.across},${node.down}`).join(';'),
    ].join('|')
  }

  /**
   * Those no sibling certifiably beats — and WHY each loser fell. An undecided pair leaves BOTH
   * standing. The deciding rival is the FIRST in pool order that beats the candidate, and pool order
   * is the deterministic size-then-template order the candidates were built in, so the recorded
   * reason is stable across runs rather than whichever rival happened to be visited first.
   */
  const eliminate = (
    pool: Candidate[],
  ): { survivors: Candidate[]; removed: Array<{ loser: Candidate; winner: Candidate; rule: string }> } => {
    const survivors: Candidate[] = []
    const removed: Array<{ loser: Candidate; winner: Candidate; rule: string }> = []
    for (const candidate of pool) {
      let beatenBy: { winner: Candidate; rule: string } | null = null
      for (const rival of pool) {
        if (rival === candidate) continue
        const verdict = decide(rival, candidate)
        if (verdict.winner === -1) {
          beatenBy = { winner: rival, rule: verdict.reason }
          break
        }
      }
      if (beatenBy) removed.push({ loser: candidate, winner: beatenBy.winner, rule: beatenBy.rule })
      else survivors.push(candidate)
    }
    return { survivors, removed }
  }

  /** A candidate named the way a reader can find it again. */
  const nameOf = (candidate: Candidate): string =>
    `${candidate.result.identity.patternVariant}@${candidate.variant.sizeMM}mm`

  const dominationRejection = (entry: {
    loser: Candidate
    winner: Candidate
    rule: string
  }): SelectorRejection => ({
    sizeMM: entry.loser.variant.sizeMM,
    patternId: entry.loser.result.identity.patternVariant,
    reasons: ['CERTIFIED_DOMINATED'],
    dominatedBy: {
      patternId: entry.winner.result.identity.patternVariant,
      sizeMM: entry.winner.variant.sizeMM,
      rule: entry.rule,
    },
  })

  const groups = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const key = arrangementKey(candidate)
    const held = groups.get(key)
    if (held) held.push(candidate)
    else groups.set(key, [candidate])
  }

  // WITHIN an arrangement, the sizes are compared MECHANICALLY FIRST — and that is now entirely
  // decide()'s job: it applies the whole approved order, then count, and only inside one identity
  // does it reach size. A second snug-seat reducer here would be a second selector re-deciding what
  // decide() already settled, so there is none: whatever `eliminate` leaves standing is the seat.
  const seats: Candidate[] = []
  const defeated: Array<{ loser: Candidate; winner: Candidate; rule: string }> = []
  for (const group of groups.values()) {
    const { survivors, removed } = eliminate(group)
    seats.push(...survivors)
    defeated.push(...removed)
  }

  // The certified optimal set across arrangements, then a DETERMINISTIC order by identity — an
  // unresolved partial order must not be sorted by a comparator that cannot rank it.
  const final = eliminate(seats)
  const surviving = final.survivors
  defeated.push(...final.removed)
  surviving.sort((a, b) => (arrangementKey(a) < arrangementKey(b) ? -1 : arrangementKey(a) > arrangementKey(b) ? 1 : a.variant.sizeMM - b.variant.sizeMM))
  for (const entry of defeated) rejections.push(dominationRejection(entry))

  // THE DECISION IS PART OF THE ANSWER. decide() knows why each candidate won, tied or could not be
  // separated; without recording it here the offer cannot be re-walked, and a lawful candidate that
  // lost would vanish with no trace. Reasons are appended in the sorted survivor order, so they are
  // stable across runs.
  for (const candidate of surviving) {
    const relations: string[] = []
    for (const rival of surviving) {
      if (rival === candidate) continue
      const verdict = decide(candidate, rival)
      relations.push(
        verdict.undecided
          ? `unresolved against ${nameOf(rival)}: ${verdict.reason}`
          : verdict.winner === -1
            ? `beats ${nameOf(rival)}: ${verdict.reason}`
            : verdict.winner === 1
              ? `beaten by ${nameOf(rival)}: ${verdict.reason}`
              : `co-optimum with ${nameOf(rival)}: ${verdict.reason}`,
      )
    }
    for (const entry of defeated)
      if (entry.winner === candidate)
        relations.push(`defeated ${nameOf(entry.loser)}: ${entry.rule}`)
    candidate.result.decisionReasons.push(
      relations.length
        ? relations.join(' | ')
        : 'sole surviving candidate: no rival remained to compare against',
    )
    // The result hash must cover the reasons it now carries, so it is recomputed LAST.
    candidate.result.identity.resultHash = contentHash(
      stableStringify({
        ...candidate.result,
        identity: { ...candidate.result.identity, resultHash: undefined },
      }),
    )
    candidate.variant.selection = candidate.result
  }

  const anyUndecided = surviving.some((candidate) =>
    surviving.some((rival) => rival !== candidate && decide(candidate, rival).undecided),
  )
  const allCertified = surviving.every((candidate) => candidate.result.proofStatus === 'CERTIFIED')
  const decisionState: BandAnswer['decisionState'] = !surviving.length
    ? 'NONE'
    : anyUndecided || !allCertified
      ? 'UNRESOLVED_SET'
      : surviving.length === 1
        ? 'CERTIFIED_WINNER'
        : 'CERTIFIED_SET'
  return {
    band,
    variants: surviving.map((candidate) => candidate.variant),
    rejections,
    decisionState,
  }
}

export function judgeShape(
  spec: GridSystemSpec,
  calibration: CalibrationSpec,
  contourMM: Contour,
): ShapeJudgement | null {
  const unitContour = normalizeContour(contourMM)
  if (!unitContour) return null
  // Identity inputs, hashed once: the source geometry as supplied, and the released profile the
  // whole answer was produced under. Both travel with every result so it can be reproduced.
  const sourceGeometryHash = contentHash(stableStringify({ outer: contourMM.outer.pts }))
  // THE GOVERNING VALUES IN FULL — the whole spec and the whole calibration. A named subset would
  // silently omit whatever was added to either since the list was written.
  const profileHash = contentHash(stableStringify({ spec, calibration }))
  // The source's own dominant side, so the published scale is target/source, not the target.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of contourMM.outer.pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const sourceDominantMM = Math.max(maxX - minX, maxY - minY)
  const bands: BandAnswer[] = []
  for (const band of calibration.bands)
    bands.push(
      judgeBand(
        spec,
        calibration,
        band,
        unitContour,
        sourceDominantMM,
        sourceGeometryHash,
        profileHash,
      ),
    )
  return { bands }
}
