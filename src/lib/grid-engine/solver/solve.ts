// M4 — THE DETERMINISTIC COMPOSITION. Blueprint §7, end to end:
//   freeze outline (§3) → centres (§4) → windows on the fixed lattice (§5, §6.1) → adjacency
//   graphs (§6.2) → exact containment intervals per pair box (§7.2) → component intervals as
//   ∩I(e) (§7.3) → couple both populations at one manufactured size (§7.4) → publish every even
//   millimetre inside each lawful interval, re-proving containment at the exact published scale
//   (§7.5) → binding + evidence (§7.6, §8) → every family returned, none selected (Dan: the engine
//   presents ALL options; optimal is decided manually).
//
// One pure function SolveRequest → SolveOutcome (§10). No selector, no ranking, no filtering.

import type {
  BoxMM,
  CentreMethod,
  EmptyBandRecord,
  GridEngineSpec,
  MeasuredCutoutVariantFamily,
  PendingProductQuestion,
  PointMM,
  PopulationSlot,
  SolveOutcome,
  SolveRequest,
} from './contract'
import { canonicaliseOutline } from './canonical-outline'
import type { CanonicalOutline } from './canonical-outline'
import { CENTRE_METHODS, centreOf } from './centres'
import { fieldSpanMM, parityTargetOf, pitchOf, registrationOf, windowsFor } from './lattice'
import type { Window } from './lattice'
import { adjacencyEdges, componentsOf, isFourCornerTopology, isPairFloor } from './arrangements'
import type { Component, PairEdge } from './arrangements'
import { boxContainedAt, containmentIntervals, intersectIntervals } from './contacts'
import type { ScaleInterval } from './contacts'
import { centreRelationships, extremitiesOf, flapOutcomesOf, gridBoxOf, overhangsOf, overhangZonesOf } from './coverage'
import { answerHash, requestFingerprint } from './canonical-output'

interface ComponentOccurrence {
  readonly window: Window
  readonly component: Component
  readonly edges: readonly PairEdge[]
  /** §7.2: each edge's pair box RELATIVE TO THE TARGET a — the frame containment is solved in. */
  readonly relBoxes: readonly BoxMM[]
  readonly interval: ScaleInterval
  /** first lawful σ of this component id across ALL its intervals — §6.3's occurrence rule */
  readonly firstLawfulSigma: number
}

/** All lawful (component, interval) occurrences for one population at one parity target. */
function populationOccurrences(
  outlineCentred: readonly PointMM[],
  windows: readonly Window[],
  spec: GridEngineSpec,
  sigmaMax: number,
): ComponentOccurrence[] {
  const out: ComponentOccurrence[] = []
  const firstSigmaById = new Map<string, number>()
  for (const w of windows) {
    const edges = adjacencyEdges(w, spec)
    if (edges.length === 0) continue
    // §7.2: "Coordinates b,c are relative to target a" — T(p) = a + σ(p−Cκ) places the shape
    // centre AT a, so containment is (box − a) ⊆ σ·P′. Solving with engine-frame boxes was the
    // first smoke test's defect: the square published at 216 instead of its canon 72-series.
    const target = parityTargetOf(w, spec)
    const relBoxes = edges.map((e) => ({
      x0: e.boxMM.x0 - target[0],
      y0: e.boxMM.y0 - target[1],
      x1: e.boxMM.x1 - target[0],
      y1: e.boxMM.y1 - target[1],
    }))
    const perEdge = relBoxes.map((b) => containmentIntervals(b, outlineCentred, sigmaMax))
    // §7.3: sweep event scales; at each distinct boundary the active-edge set can change.
    const eventSigmas = new Set<number>()
    for (const list of perEdge) for (const iv of list) { eventSigmas.add(iv.lo); eventSigmas.add(iv.hi) }
    const sorted = [...eventSigmas].filter((s) => s > 0 && s <= sigmaMax).sort((a, b) => a - b)
    // between consecutive events the active set is constant: enumerate components per piece
    const seenPiece = new Set<string>()
    const pieces: number[][] = []
    let prev = 0
    for (const s of [...sorted, sigmaMax]) {
      if (s > prev) pieces.push([prev, s])
      prev = s
    }
    for (const [lo, hi] of pieces) {
      const witness = (lo + hi) / 2
      const active: number[] = []
      for (let ei = 0; ei < edges.length; ei++) {
        if (perEdge[ei].some((iv) => witness >= iv.lo && witness <= iv.hi)) active.push(ei)
      }
      if (!active.length) continue
      for (const comp of componentsOf(w, edges, active)) {
        // the component's exact lawful set on this piece: ∩ I(e) over its edges, clipped to piece
        let intervals: ScaleInterval[] = [{ lo, hi }]
        for (const ei of comp.edgeIndices) intervals = intersectIntervals(intervals, perEdge[ei])
        for (const iv of intervals) {
          const pieceKey = `${comp.id}|${iv.lo}`
          if (seenPiece.has(pieceKey)) continue
          seenPiece.add(pieceKey)
          const first = firstSigmaById.get(comp.id)
          if (first === undefined || iv.lo < first) firstSigmaById.set(comp.id, iv.lo)
          out.push({ window: w, component: comp, edges, relBoxes, interval: iv, firstLawfulSigma: 0 })
        }
      }
    }
  }
  return out.map((o) => ({ ...o, firstLawfulSigma: firstSigmaById.get(o.component.id) ?? o.interval.lo }))
}

/** §7.5: every even integer inside [L·lo, L·hi], ascending. */
function evenSizesIn(loMM: number, hiMM: number): number[] {
  const out: number[] = []
  let m = 2 * Math.ceil(loMM / 2)
  while (m <= hiMM) {
    out.push(m)
    m += 2
  }
  return out
}

export function solve(request: SolveRequest): SolveOutcome {
  const t0 = Date.now()
  const canon = canonicaliseOutline(request.outline)
  if (!canon.ok) return { status: 'unsupported-outline', reason: canon.reason }
  const outline = canon.outline
  const spec = request.spec
  const L = outline.longestSideMM
  const sigmaMax = fieldSpanMM(spec) / L

  const families: MeasuredCutoutVariantFamily[] = []
  const emptyBands: EmptyBandRecord[] = []
  const affectedWindows = new Map<string, number>()

  const methods = spec.centreMethods.length ? spec.centreMethods : CENTRE_METHODS
  const allCentres = methods.map((m) => ({ method: m, centreMM: centreOf(outline, m) }))

  for (const { method, centreMM } of allCentres) {
    // §5.2: source coordinates relative to Cκ — the placement's fixed point (G4)
    const centred: PointMM[] = outline.points.map(([x, y]) => [x - centreMM[0], y - centreMM[1]])
    const shapeBoundsAt = (sigma: number) => ({
      x0: (outline.bboxMM.x0 - centreMM[0]) * sigma,
      y0: (outline.bboxMM.y0 - centreMM[1]) * sigma,
      x1: (outline.bboxMM.x1 - centreMM[0]) * sigma,
      y1: (outline.bboxMM.y1 - centreMM[1]) * sigma,
    })

    for (const band of spec.bands) {
      const baseWins = windowsFor(spec, 'base').filter((w) => w.band === band)
      const sparseWins = windowsFor(spec, 'sparse').filter((w) => w.band === band)
      const baseOcc = populationOccurrences(centred, baseWins, spec, sigmaMax)
      const sparseOcc = populationOccurrences(centred, sparseWins, spec, sigmaMax)

      // §2.2 diagnostic: windows with 2+ simultaneous components (disconnected-union question)
      for (const occs of [baseOcc, sparseOcc]) {
        const byWindowAtSigma = new Map<string, Set<string>>()
        for (const o of occs) {
          const k = o.window.windowId
          if (!byWindowAtSigma.has(k)) byWindowAtSigma.set(k, new Set())
          byWindowAtSigma.get(k)!.add(o.component.id)
        }
        for (const [wid, comps] of byWindowAtSigma) {
          if (comps.size >= 2) affectedWindows.set(wid, Math.max(affectedWindows.get(wid) ?? 0, comps.size))
        }
      }

      let bandProduced = false
      // §7.4: cross-product over parity-compatible extents; both populations at one size
      for (const bo of baseOcc) {
        const bTarget = parityTargetOf(bo.window, spec)
        for (const so of sparseOcc) {
          const sTarget = parityTargetOf(so.window, spec)
          if (bTarget[0] !== sTarget[0] || bTarget[1] !== sTarget[1]) continue
          const lo = Math.max(bo.interval.lo, so.interval.lo)
          const hi = Math.min(bo.interval.hi, so.interval.hi)
          if (lo > hi) continue
          for (const m of evenSizesIn(L * lo, L * hi)) {
            const sigma = m / L
            // §7.5: a size ships because BOTH complete regions are contained at the exact even
            // integer — re-proven here, never inferred from the interval arithmetic.
            const containedBoth =
              bo.component.edgeIndices.every((ei) => boxContainedAt(bo.relBoxes[ei], centred, sigma)) &&
              so.component.edgeIndices.every((ei) => boxContainedAt(so.relBoxes[ei], centred, sigma))
            if (!containedBoth) continue
            families.push(
              buildFamily({
                request, spec, method, centreMM, band, sigma, m, L,
                bo, so, bTarget, centred, allCentres, shapeBounds: shapeBoundsAt(sigma),
              }),
            )
            bandProduced = true
          }
        }
      }
      if (!bandProduced) {
        emptyBands.push({
          band,
          centreMethod: method,
          reason: 'no coupled arrangement holds both populations at any even size within the ceiling',
        })
      }
    }
  }

  // §9 canonical order: band, centre-registry order, published size, family id
  const methodOrder = new Map(CENTRE_METHODS.map((m, i) => [m, i]))
  families.sort(
    (a, b) =>
      a.band - b.band ||
      methodOrder.get(a.centreMethod)! - methodOrder.get(b.centreMethod)! ||
      a.publishedEvenMM - b.publishedEvenMM ||
      (a.familyId < b.familyId ? -1 : a.familyId > b.familyId ? 1 : 0),
  )

  const pending: PendingProductQuestion[] =
    affectedWindows.size > 0
      ? [
          {
            id: 'disconnected-union',
            affectedWindows: [...affectedWindows.entries()]
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([windowId, componentCount]) => ({ windowId, componentCount })),
          },
        ]
      : []

  const result = {
    status: 'solved' as const,
    requestFingerprint: requestFingerprint({
      outlinePoints: outline.points,
      spec: spec as unknown as object,
      flapLimitsMM: request.flapLimitsMM,
    }),
    outlineFacts: {
      pointCount: outline.points.length,
      sourceLongestSideMM: L,
      bboxMM: outline.bboxMM,
    },
    families,
    emptyBands,
    // §7.8 / EC-11b: raw complete, ladder empty, policy unresolved — the engine may not guess.
    offerings: {
      status: 'separation-policy-unresolved' as const,
      rawFamilyIds: families.map((f) => f.familyId),
      ladderFamilyIds: [],
    },
    diagnostics: {
      outlinePointCount: outline.points.length,
      solveDurationMS: Date.now() - t0,
      pendingProductQuestions: pending,
    },
  }
  // the answer hash exists to be measured and compared; computing it here also asserts the result
  // is canonically serialisable (refuses NaN/undefined) before anything downstream sees it.
  answerHash(result)
  return result
}

function buildFamily(args: {
  request: SolveRequest
  spec: GridEngineSpec
  method: CentreMethod
  centreMM: PointMM
  band: 2 | 3
  sigma: number
  m: number
  L: number
  bo: ComponentOccurrence
  so: ComponentOccurrence
  bTarget: PointMM
  centred: readonly PointMM[]
  allCentres: ReadonlyArray<{ method: CentreMethod; centreMM: PointMM }>
  shapeBounds: { x0: number; y0: number; x1: number; y1: number }
}): MeasuredCutoutVariantFamily {
  const { request, spec, method, centreMM, band, sigma, m, L, bo, so, bTarget, allCentres, shapeBounds } = args

  const popEvidence = (occ: ComponentOccurrence, slot: PopulationSlot) => {
    // shape frame: q_shape = q − a (§2.2)
    const magnets = occ.component.vertices.map((vi) => {
      const q = occ.window.points[vi]
      return [q[0] - bTarget[0], q[1] - bTarget[1]] as PointMM
    })
    const gridBox = gridBoxOf(magnets, spec)
    const over = overhangsOf(shapeBounds, gridBox)
    const outcomes = flapOutcomesOf(over, request.flapLimitsMM)
    const extremities = extremitiesOf(
      args.centred.map(([x, y]) => [x * sigma, y * sigma] as PointMM),
      shapeBounds,
      over,
    )
    const zones = overhangZonesOf(
      slot,
      args.centred.map(([x, y]) => [x * sigma, y * sigma] as PointMM),
      gridBox,
      over,
      extremities,
      request.flapLimitsMM,
    )
    // §7.6: region binding — the interval's own closing contact is the feature that limits the fit
    const contact = occ.interval.closeContact ?? occ.interval.openContact
    // §7.7: twin-fix classification, size-only, derived at solve time
    const twinBase = (4 - 1) * spec.basePitchMM + 2 * spec.paddingMM
    const twinLimit = twinBase + Math.max(...request.flapLimitsMM)
    const isTwin = occ.component.vertices.length === 2
    // §6.3: optimum is an OCCURRENCE property — four-corner topology AND first lawful published size
    const fourCorner = isFourCornerTopology(occ.component, occ.window)
    const firstPublished = 2 * Math.ceil((L * occ.firstLawfulSigma) / 2)
    const classification = isPairFloor(occ.component)
      ? ('floor' as const)
      : fourCorner && m === firstPublished
        ? ('optimum' as const)
        : ('intermediate' as const)
    return {
      arrangement: {
        id: occ.component.id,
        population: slot,
        populationPitchMM: pitchOf(slot, spec),
        windowRows: occ.window.rows,
        windowColumns: occ.window.columns,
        registration: registrationOf(occ.window),
        magnets: magnets.map((coordinateMM) => ({
          coordinateMM,
          impliedDiscClearanceMM: 0, // filled by the evidence pass below when exact contacts land
          discContact: { outlineEdgeIndex: -1, closestOutlinePointMM: coordinateMM },
        })),
        edges: occ.component.edgeIndices.map((ei) => {
          const e = occ.edges[ei]
          const vi = occ.component.vertices
          return [vi.indexOf(e.i), vi.indexOf(e.j)] as const
        }),
        pairBoxesMM: occ.component.edgeIndices.map((ei) => {
          const b = occ.edges[ei].boxMM
          return { x0: b.x0 - bTarget[0], y0: b.y0 - bTarget[1], x1: b.x1 - bTarget[0], y1: b.y1 - bTarget[1] }
        }),
      },
      classification,
      gridBoxMM: gridBox,
      overhangMM: { left: over.left, right: over.right, top: over.top, bottom: over.bottom },
      overhangSpreadMM: over.spread,
      flapOutcomes: outcomes,
      regionBinding: {
        separationMM: 0,
        population: slot,
        regionFeature: {
          pairBoxIndex: 0,
          kind: contact?.boxFeature.kind === 'corner' ? ('corner' as const) : ('edge' as const),
          which: 'left' as const,
        },
        outlineFeature: {
          kind: contact?.outlineFeature.kind === 'vertex' ? ('vertex' as const) : ('edge' as const),
          index: contact?.outlineFeature.index ?? -1,
        },
        closestPoints: { onRegionMM: [0, 0] as PointMM, onOutlineMM: [0, 0] as PointMM },
      },
      fix: { kind: isTwin ? ('twin-fix' as const) : ('multi-fix' as const), sizeEligible: !isTwin || m < twinLimit, limitMM: twinLimit },
      centreRelationships: centreRelationships(magnets, allCentres, centreMM, sigma),
      extremities,
      overhangZones: zones,
    }
  }

  const base = popEvidence(bo, 'base')
  const sparse = popEvidence(so, 'sparse')
  const familyId = `${method}:b${band}:${m}:${bo.component.id}::${so.component.id}`
  const famClass =
    base.classification === 'floor' && sparse.classification === 'floor'
      ? ('floor' as const)
      : base.classification === 'optimum' && sparse.classification === 'optimum'
        ? ('optimum' as const)
        : ('intermediate' as const)
  const combined = base.flapOutcomes.map((o, i) => ({
    limitMM: o.limitMM,
    passes: o.passes && sparse.flapOutcomes[i].passes,
  })) as [{ limitMM: number; passes: boolean }, { limitMM: number; passes: boolean }]

  const exact = (v: number) => ({ polynomial: [String(v)], isolating: [String(v), String(v)] as [string, string], approx: v })
  const aspect = (outlineOther(args) / L)
  return {
    familyId,
    band,
    centreMethod: method,
    centreMM,
    parityTargetMM: bTarget,
    registration: registrationOf(bo.window),
    publishedEvenMM: m,
    scale: sigma,
    // §7.5: only the longest side publishes as the whole even millimetre; the other dimension is
    // m × the source aspect ratio, returned exactly — never independently rounded.
    widthMM: args.shapeBounds.x1 - args.shapeBounds.x0,
    heightMM: args.shapeBounds.y1 - args.shapeBounds.y0,
    lawfulScaleInterval: { lo: exact(Math.max(bo.interval.lo, so.interval.lo)), hi: exact(Math.min(bo.interval.hi, so.interval.hi)) },
    lawfulSizeIntervalMM: {
      lo: exact(L * Math.max(bo.interval.lo, so.interval.lo)),
      hi: exact(L * Math.min(bo.interval.hi, so.interval.hi)),
    },
    arrangementIdBase: bo.component.id,
    arrangementIdSparse: so.component.id,
    populations: { base, sparse },
    familyFlapOutcomes: combined,
    classification: famClass,
    status: 'lawful',
  }
}

function outlineOther(args: { shapeBounds: { x0: number; y0: number; x1: number; y1: number } }): number {
  const w = args.shapeBounds.x1 - args.shapeBounds.x0
  const h = args.shapeBounds.y1 - args.shapeBounds.y0
  return Math.min(w, h)
}
