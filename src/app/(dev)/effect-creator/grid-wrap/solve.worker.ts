// solve.worker.ts — the wrap bench's solve, off the main thread. Pure dispatch: every decision
// belongs to the engine modules, nothing is computed here.
//
// One request, one answer: N magnets in → the tightest centred wrap, plus what it fails to hold.

import { MIN_EFFECT_MM } from '@/lib/effect/grid-magnet'
import { makeSizer, sizeRange } from '@/lib/effect/grid-magnet-bridge'
import { bbox, latticeAt, makeSeatPredicate, safeSegments, spotRadiusOf } from '@/lib/effect/grid-magnet-compute'
import { applyCoverage, assignSizes, type MagnetPlan } from '@/lib/effect/grid-magnet-logic'
import { unheldOf, wrapFlap, wrapGrid, type WrapAt, type WrapConfig } from '@/lib/effect/grid-magnet-wrap-compute'
import { DEFAULT_PITCH_MM, PADDING_FLOOR_MM, MASS_DEPTH_MM } from '@/lib/effect/grid-magnet-spec'
import type { Contour } from '@/lib/effect/types'

interface SolveRequest {
  id: number
  base: Contour
  offsetMM: number
  cfg: WrapConfig & { plan?: MagnetPlan; circle?: boolean }
  count: number
  /** Manual override — when either is set the wrap solver is skipped entirely. */
  manualPhaseMM: [number, number] | null
  manualSizeMM: number | null
}

/** Twice the signed area of a ring — the shape's own area, so unheld can be a share of it. */
function shoelace(pts: ReadonlyArray<[number, number]>): number {
  let a2 = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return a2 / 2
}

const ctx = self as unknown as Worker

// Computed once = computed. Keyed by shape + config + count; a new shape clears everything.
let shapeSig = ''
const cache = new Map<string, unknown>()
const CAP = 200

ctx.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, base, offsetMM, cfg, count, manualPhaseMM, manualSizeMM } = e.data
  try {
    const pts = base.outer.pts
    let h = 0
    for (let i = 0; i < pts.length; i++) {
      h = (Math.imul(h, 31) + Math.round(pts[i][0] * 1000)) | 0
      h = (Math.imul(h, 31) + Math.round(pts[i][1] * 1000)) | 0
    }
    const sig = JSON.stringify([offsetMM, pts.length, h])
    if (sig !== shapeSig) { shapeSig = sig; cache.clear() }

    const key = JSON.stringify([cfg, count, manualPhaseMM, manualSizeMM])
    const hit = cache.get(key)
    if (hit) { ctx.postMessage({ id, model: hit }); return }

    const sized = makeSizer(base, offsetMM)
    const pad = Math.max(PADDING_FLOOR_MM, cfg.paddingMM ?? PADDING_FLOOR_MM)

    // MANUAL — the solver is OFF. The size and the registration are the caller's; the engine
    // only seats every lattice node that is legally clear at that size and measures the result.
    // This is the bench for judging layouts by hand before any law is written from them.
    let drawn: ReturnType<typeof wrapGrid>
    let at: WrapAt | null = null
    let manualSeated: [number, number][] | null = null
    if (manualSizeMM != null) {
      const contour = sized(manualSizeMM)
      const outerM = contour.outer.pts
      const bb = bbox(outerM)
      const fits = makeSeatPredicate(outerM, spotRadiusOf(pad))
      const pitch = cfg.pitchMM ?? DEFAULT_PITCH_MM
      const ph = manualPhaseMM ?? [0, 0]
      const seats = fits ? latticeAt(bb, pitch, ph[0], ph[1]).filter(fits) : []
      manualSeated = seats as [number, number][]
      drawn = {
        contour,
        grid: {
          anchors: [], pitchCentreMM: pitch,
          lattice: latticeAt(bb, pitch, ph[0], ph[1]),
          phaseMM: [ph[0], ph[1]], panMM: [0, 0],
          spotRadiusMM: spotRadiusOf(pad),
          contactsMM: [], segments: [],
          centresMM: [], centreMainMM: [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2],
        },
      }
    } else {
      // THE FLAP LOOP — exposed edges place the magnets, top first; the size follows.
      const flap = wrapFlap(sized, cfg, count, MIN_EFFECT_MM, sizeRange(pad).maxMM)
      if (!flap) { ctx.postMessage({ id, model: null }); return }
      at = flap.at
      drawn = wrapGrid(sized, cfg, at)
    }
    const outer = drawn.contour.outer.pts
    const placed = manualSeated ?? at!.points

    // Magnet plan reused whole from the voting bench — the 6/8mm choice is a magnet question,
    // nothing to do with how the layout was found.
    const kept = cfg.perimeterOnly && manualSeated ? applyCoverage(manualSeated, true, cfg.pitchMM ?? DEFAULT_PITCH_MM).seated : placed
    const anchors = assignSizes(kept, cfg.plan ?? 'all6')

    // 3 · WHAT IT DOES NOT HOLD — the hold radius is the lattice cell's CIRCUMRADIUS,
    // pitch/√2 (33.9mm at 48). Half the pitch is the wrong choice and the picture proves it:
    // discs that only meet edge-to-edge leave the diamond void between every four magnets
    // uncovered, so material surrounded on all four sides reads as unheld. At the circumradius
    // the four discs of a cell exactly cover it, and unheld means what it says — material the
    // magnet field does not reach. Derived from the board, not dialled.
    //
    // Reported as a SHARE of the shape as well as mm², because the shape's own area grows with
    // the count: raw mm² cannot be compared between rungs of different sizes.
    const holdMM = (cfg.pitchMM ?? DEFAULT_PITCH_MM) / Math.SQRT2
    const patches = unheldOf(outer, kept, holdMM)
    const unheldMM2 = patches.reduce((sum, p) => sum + p.areaMM2, 0)
    const shapeMM2 = Math.abs(shoelace(outer))
    const unheldPct = shapeMM2 > 0 ? (unheldMM2 / shapeMM2) * 100 : 0

    // Centring islands, for the same legend the voting bench draws.
    const r = spotRadiusOf(pad)
    const segments = safeSegments(outer, r, Math.max(r, cfg.massDepthMM ?? MASS_DEPTH_MM), 'full')

    const model = {
      contour: drawn.contour,
      grid: { ...drawn.grid, anchors, segments },
      effSize: at ? at.sizeMM : manualSizeMM!,
      segments,
      gapMM: at && at.gapsMM.length ? Math.min(...at.gapsMM) : null,
      centreOffMM: at ? at.centreOffMM : 0,
      manual: at === null,
      unheldMM2,
      unheldPct,
      patches,
    }
    cache.set(key, model)
    if (cache.size > CAP) cache.delete(cache.keys().next().value!)
    ctx.postMessage({ id, model })
  } catch (err) {
    ctx.postMessage({ id, model: null, error: String((err as Error)?.message ?? err) })
  }
}
