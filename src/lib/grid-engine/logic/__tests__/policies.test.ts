// The logic layer's two laws, enforced here rather than remembered:
//
//   1. With every switch OFF the layer is TRANSPARENT — the annotated output is the pure
//      engine's output, item for item, nothing marked.
//   2. A policy ANNOTATES, never removes: whatever is switched on, output length and order
//      equal input length and order.
//
// Each policy also gets one hand-checked case in BOTH directions (fires / stays quiet), so no
// assertion here can pass vacuously — the failure mode a tautological test was caught doing
// earlier in this build's history. The pitch is SUPPLIED (48 here, as the spec releases it);
// the layer holds no law values of its own.

import { describe, expect, it } from 'vitest'
import type { MeasuredVariant } from '../../engine/measure'
import { ALL_OFF, annotate, type PolicySettings } from '../policies'

const PITCH = 48

const node = (xMm: number, yMm: number, held: boolean, clearanceMm = held ? 15 : -3) => ({
  xMm,
  yMm,
  held,
  clearanceMm,
})

/** A band-2 square at 72mm: the canon case — four corners held, tangent. */
const square72: MeasuredVariant = {
  band: 2,
  sizeMm: 72,
  runsX: 2,
  runsY: 2,
  widthMm: 72,
  heightMm: 72,
  heldCount: 4,
  nodes: [
    node(-24, -24, true, 12),
    node(24, -24, true, 12),
    node(-24, 24, true, 12),
    node(24, 24, true, 12),
  ],
  links: [
    { axMm: -24, ayMm: -24, bxMm: 24, byMm: -24, direct: true },
    { axMm: -24, ayMm: -24, bxMm: -24, byMm: 24, direct: true },
    { axMm: 24, ayMm: -24, bxMm: 24, byMm: 24, direct: true },
    { axMm: -24, ayMm: 24, bxMm: 24, byMm: 24, direct: true },
  ],
  overhangMm: { left: 0, right: 0, bottom: 0, top: 0 },
}

/** A butterfly-waist case: two held magnets whose straight strip crosses the gap. */
const waist: MeasuredVariant = {
  band: 2,
  sizeMm: 96,
  runsX: 2,
  runsY: 1,
  widthMm: 96,
  heightMm: 60,
  heldCount: 2,
  nodes: [node(-24, 0, true), node(24, 0, true)],
  links: [{ axMm: -24, ayMm: 0, bxMm: 24, byMm: 0, direct: false }],
  overhangMm: { left: 18, right: 18, bottom: 6, top: 6 },
}

/** A single held disc — the triangle-corner case Dan ruled must count. */
const single: MeasuredVariant = {
  band: 1,
  sizeMm: 36,
  runsX: 1,
  runsY: 1,
  widthMm: 36,
  heightMm: 30,
  heldCount: 1,
  nodes: [node(0, 0, true)],
  links: [],
  overhangMm: { left: 6, right: 6, bottom: 3, top: 3 },
}

/** A band-3 mixed variant where only a diagonal of positions holds: no shared 96mm phase. */
const staircase: MeasuredVariant = {
  band: 3,
  sizeMm: 120,
  runsX: 3,
  runsY: 3,
  widthMm: 120,
  heightMm: 120,
  heldCount: 2,
  nodes: [node(-48, -48, true), node(0, 0, true), node(48, 48, false)],
  links: [],
  overhangMm: { left: 10, right: 10, bottom: 10, top: 10 },
}

const CASES = [square72, waist, single, staircase]

const withOn = (
  overrides: Partial<Record<keyof PolicySettings, { enabled: boolean; value?: number }>>,
): PolicySettings => ({ ...ALL_OFF, ...overrides }) as PolicySettings

describe('logic layer — transparency and annotate-never-remove', () => {
  it('with every switch off, output IS the input: same length, same order, nothing marked', () => {
    const out = annotate(CASES, ALL_OFF, PITCH)
    expect(out).toHaveLength(CASES.length)
    out.forEach((entry, i) => {
      expect(entry.variant).toBe(CASES[i])
      expect(entry.excludedBy).toEqual([])
    })
  })

  it('whatever is on, nothing is ever removed or reordered', () => {
    const everythingOn = withOn({
      minimumMagnets: { enabled: true, value: 4 },
      bandSpan: { enabled: true },
      corridor: { enabled: true },
      sparseEngagement: { enabled: true, value: 2 },
      flapLimit: { enabled: true, value: 12 },
    })
    const out = annotate(CASES, everythingOn, PITCH)
    expect(out.map((entry) => entry.variant)).toEqual(CASES)
  })
})

describe('each policy fires on its hand-checked case and stays quiet on the clean one', () => {
  it('minimumMagnets: single disc fails a floor of 2, passes a floor of 1', () => {
    const floor2 = annotate([single], withOn({ minimumMagnets: { enabled: true, value: 2 } }), PITCH)
    expect(floor2[0].excludedBy.map((x) => x.id)).toEqual(['minimumMagnets'])
    const floor1 = annotate([single], withOn({ minimumMagnets: { enabled: true, value: 1 } }), PITCH)
    expect(floor1[0].excludedBy).toEqual([])
  })

  it('bandSpan: the waist pair (48mm reach) satisfies band 2; a single disc in band 2 does not', () => {
    const on = withOn({ bandSpan: { enabled: true } })
    expect(annotate([waist], on, PITCH)[0].excludedBy).toEqual([])
    expect(annotate([single], on, PITCH)[0].excludedBy).toEqual([]) // band 1 spans 0mm
    const singleInBand2 = { ...single, band: 2 }
    expect(annotate([singleInBand2], on, PITCH)[0].excludedBy.map((x) => x.id)).toEqual(['bandSpan'])
  })

  it('corridor: fires on the waist (strip crosses the gap), quiet on the square', () => {
    const on = withOn({ corridor: { enabled: true } })
    expect(annotate([waist], on, PITCH)[0].excludedBy.map((x) => x.id)).toEqual(['corridor'])
    expect(annotate([square72], on, PITCH)[0].excludedBy).toEqual([])
  })

  it('sparseEngagement: a diagonal never shares a 96mm phase; a full odd run does', () => {
    const on = withOn({ sparseEngagement: { enabled: true, value: 2 } })
    expect(annotate([staircase], on, PITCH)[0].excludedBy.map((x) => x.id)).toEqual([
      'sparseEngagement',
    ])
    // A held 3-run on one axis: 0 and ±48 → residues 0,2,2 in half-pitch units... 0 and -48,+48:
    // -48/24=-2→2, 48/24=2→2 — two magnets share phase (2,0)-class → engages.
    const run3: MeasuredVariant = {
      ...staircase,
      nodes: [node(-48, 0, true), node(0, 0, true), node(48, 0, true)],
      heldCount: 3,
    }
    expect(annotate([run3], on, PITCH)[0].excludedBy).toEqual([])
  })

  it('flapLimit: waist overhang of 18mm fails WITHIN-12, passes WITHIN-24 (direction is Dan’s)', () => {
    const within12 = annotate([waist], withOn({ flapLimit: { enabled: true, value: 12 } }), PITCH)
    expect(within12[0].excludedBy.map((x) => x.id)).toEqual(['flapLimit'])
    const within24 = annotate([waist], withOn({ flapLimit: { enabled: true, value: 24 } }), PITCH)
    expect(within24[0].excludedBy).toEqual([])
    const flush = annotate([square72], withOn({ flapLimit: { enabled: true, value: 12 } }), PITCH)
    expect(flush[0].excludedBy).toEqual([]) // zero overhang is WITHIN — the old reversed rule failed this
  })
})
