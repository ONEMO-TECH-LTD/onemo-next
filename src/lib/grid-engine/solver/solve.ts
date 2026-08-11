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

/**
 * §6.2 at the published scale: the claimed component must equal a connected component of the
 * edges actually active (exactly contained) at σ. Implies containment of its own boxes — an
 * uncontained own edge changes the component id — and refuses a component that a newly active
 * neighbouring edge has merged into a larger arrangement at this exact size.
 */
function isMaximalComponentAt(occ: ComponentOccurrence, centred: readonly PointMM[], sigma: number): boolean {
  const active: number[] = []
  for (let ei = 0; ei < occ.edges.length; ei++) {
    if (boxContainedAt(occ.relBoxes[ei], centred, sigma)) active.push(ei)
  }
  if (!active.length) return false
  return componentsOf(occ.window, occ.edges, active).some((c) => c.id === occ.component.id)
}

/** Closest point on segment [a,b] to p, with the parameter t. */
function closestOnSegment(p: PointMM, a: PointMM, b: PointMM): { q: PointMM; t: number } {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return { q: [a[0] + t * dx, a[1] + t * dy], t }
}

/** §8: distance from a point to the manufactured boundary, with the nearest edge + closest point. */
function pointToOutline(p: PointMM, pts: readonly PointMM[]): { d: number; edge: number; q: PointMM } {
  let best = { d: Infinity, edge: -1, q: p }
  for (let i = 0; i < pts.length; i++) {
    const { q } = closestOnSegment(p, pts[i], pts[(i + 1) % pts.length])
    const d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (d < best.d) best = { d, edge: i, q }
  }
  return best
}

const BOX_CORNER_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const
const BOX_EDGE_NAMES = ['top', 'right', 'bottom', 'left'] as const

/**
 * §7.6: the minimum boundary separation between one pair box and the outline, with both features
 * and closest points named. The box sits inside the outline (proven at publication), so the
 * minimum is attained corner-against-edge or vertex-against-box-edge — both directions searched.
 * Display approximation (float); the binding IDENTITY comes from the interval's own exact contact.
 */
function boxOutlineSeparation(
  box: BoxMM,
  pts: readonly PointMM[],
): {
  separationMM: number
  regionFeature: { kind: 'edge' | 'corner'; which: (typeof BOX_CORNER_NAMES)[number] | (typeof BOX_EDGE_NAMES)[number] }
  outlineFeature: { kind: 'edge' | 'vertex'; index: number }
  onRegionMM: PointMM
  onOutlineMM: PointMM
} {
  const corners: PointMM[] = [
    [box.x0, box.y0],
    [box.x1, box.y0],
    [box.x1, box.y1],
    [box.x0, box.y1],
  ]
  let best = {
    separationMM: Infinity,
    regionFeature: { kind: 'corner' as 'edge' | 'corner', which: BOX_CORNER_NAMES[0] as (typeof BOX_CORNER_NAMES)[number] | (typeof BOX_EDGE_NAMES)[number] },
    outlineFeature: { kind: 'edge' as 'edge' | 'vertex', index: -1 },
    onRegionMM: corners[0],
    onOutlineMM: corners[0],
  }
  // box corner → outline edge
  for (let c = 0; c < 4; c++) {
    const hit = pointToOutline(corners[c], pts)
    if (hit.d < best.separationMM) {
      best = {
        separationMM: hit.d,
        regionFeature: { kind: 'corner', which: BOX_CORNER_NAMES[c] },
        outlineFeature: { kind: 'edge', index: hit.edge },
        onRegionMM: corners[c],
        onOutlineMM: hit.q,
      }
    }
  }
  // outline vertex → box edge
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i]
    for (let e = 0; e < 4; e++) {
      const { q, t } = closestOnSegment(v, corners[e], corners[(e + 1) % 4])
      const d = Math.hypot(v[0] - q[0], v[1] - q[1])
      if (d < best.separationMM) {
        best = {
          separationMM: d,
          regionFeature:
            t === 0 || t === 1
              ? { kind: 'corner', which: BOX_CORNER_NAMES[t === 0 ? e : (e + 1) % 4] }
              : { kind: 'edge', which: BOX_EDGE_NAMES[e] },
          outlineFeature: { kind: 'vertex', index: i },
          onRegionMM: q,
          onOutlineMM: v,
        }
      }
    }
  }
  return best
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
            // integer — re-proven here, never inferred from the interval arithmetic. And §6.2:
            // an arrangement is a MAXIMAL connected component of the edges active at that exact
            // σ. A piece interval closes at an event scale inclusively, so its component can be
            // published at the very σ where a neighbouring edge becomes (tangentially) active
            // and absorbs it — the L fixture caught exactly that at 360. Recomputing the active
            // set at σ proves both containment and maximality in one pass.
            if (!isMaximalComponentAt(bo, centred, sigma) || !isMaximalComponentAt(so, centred, sigma)) continue
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
      spec,
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

  const scaledPts = args.centred.map(([x, y]) => [x * sigma, y * sigma] as PointMM)

  const popEvidence = (occ: ComponentOccurrence, slot: PopulationSlot) => {
    // shape frame: q_shape = q − a (§2.2)
    const magnets = occ.component.vertices.map((vi) => {
      const q = occ.window.points[vi]
      return [q[0] - bTarget[0], q[1] - bTarget[1]] as PointMM
    })
    const gridBox = gridBoxOf(magnets, spec)
    const over = overhangsOf(shapeBounds, gridBox)
    const outcomes = flapOutcomesOf(over, request.flapLimitsMM)
    const extremities = extremitiesOf(scaledPts, shapeBounds, over)
    const zones = overhangZonesOf(
      slot,
      scaledPts,
      gridBox,
      over,
      extremities,
      request.flapLimitsMM,
    )
    // §7.6: region binding — the minimum boundary separation between the arrangement's region
    // (its pair boxes) and the outline, measured at the published scale with features and closest
    // points named. Zero when the published size sits exactly on its binding contact.
    let binding: ReturnType<typeof boxOutlineSeparation> & { pairBoxIndex: number } = {
      ...boxOutlineSeparation(occ.relBoxes[occ.component.edgeIndices[0]], scaledPts),
      pairBoxIndex: 0,
    }
    for (let bi = 1; bi < occ.component.edgeIndices.length; bi++) {
      const sep = boxOutlineSeparation(occ.relBoxes[occ.component.edgeIndices[bi]], scaledPts)
      if (sep.separationMM < binding.separationMM) binding = { ...sep, pairBoxIndex: bi }
    }
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
        // §8: implied disc clearance = distance from the magnet centre to the manufactured
        // boundary minus the padding disc — material beyond the 24mm spot. Display approximation;
        // lawfulness never reads it (containment is the exact pair-box predicate).
        magnets: magnets.map((coordinateMM) => {
          const hit = pointToOutline(coordinateMM, scaledPts)
          return {
            coordinateMM,
            impliedDiscClearanceMM: hit.d - spec.paddingMM,
            discContact: { outlineEdgeIndex: hit.edge, closestOutlinePointMM: hit.q },
          }
        }),
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
        separationMM: binding.separationMM,
        population: slot,
        regionFeature: {
          pairBoxIndex: binding.pairBoxIndex,
          kind: binding.regionFeature.kind,
          which: binding.regionFeature.which,
        },
        outlineFeature: binding.outlineFeature,
        closestPoints: { onRegionMM: binding.onRegionMM, onOutlineMM: binding.onOutlineMM },
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
