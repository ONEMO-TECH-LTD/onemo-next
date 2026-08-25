// Layout-library module + bridge — integrity, class coverage, bridge mapping (QA F6).

import { describe, expect, it } from 'vitest'
import {
  LAYOUT_LIBRARY, LIBRARY_FAMILIES, FAMILY_APPLICABILITY_DRAFT,
  libraryIntegrity, transformLayout, kindOf, orientationOf,
} from '../grid-magnet-library'
import { libraryStageModel } from '../grid-magnet-library-bridge'

describe('layout library — data integrity', () => {
  it('holds: unique frames, unique names, in-bounds unique nodes, no empties', () => {
    expect(libraryIntegrity()).toEqual([])
  })
  it('transform closure: every transform keeps every node inside its frame', () => {
    for (const f of LAYOUT_LIBRARY) for (const l of f.layouts)
      for (const transpose of [false, true]) for (const flipX of [false, true]) for (const flipY of [false, true]) {
        const t = transformLayout(f, l, { transpose, flipX, flipY })
        expect(t.nodes.length).toBe(l.nodes.length)
        for (const [x, y] of t.nodes) {
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(t.cols)
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(t.rows)
        }
      }
  })
})

describe('layout library — class coverage', () => {
  it('every family has a demonstrable selection and a draft applicability list', () => {
    for (const fam of LIBRARY_FAMILIES) {
      expect(FAMILY_APPLICABILITY_DRAFT[fam].length).toBeGreaterThan(0)
      const m = libraryStageModel({ frameIndex: 0, layoutIndex: 0, family: fam, view: { transpose: false, flipX: false, flipY: false } }, 48, 12)
      expect(m.contour.outer.pts.length).toBeGreaterThanOrEqual(4)
    }
  })
  it('every frame carries at least one layout and a taxonomy reading', () => {
    for (const f of LAYOUT_LIBRARY) {
      expect(f.layouts.length).toBeGreaterThan(0)
      expect(['square', 'slim', 'standard']).toContain(kindOf(f.cols, f.rows))
      expect(['tall', 'wide', 'even']).toContain(orientationOf(f.cols, f.rows))
    }
  })
})

describe('layout library — bridge mapping', () => {
  const sel = { frameIndex: 4, layoutIndex: 0, family: 'triangle' as const, view: { transpose: false, flipX: false, flipY: false } }
  it('maps a selection to the typed Stage model without solver policy', () => {
    const m = libraryStageModel(sel, 48, 12)
    const f = LAYOUT_LIBRARY[4]
    expect(m.grid.anchors.length).toBe(f.layouts[0].nodes.length)
    expect(m.grid.pitchCentreMM).toBe(48)
    expect(m.grid.spotRadiusMM).toBe(12)
    expect(m.grid.lattice).toEqual([])            // one lattice implementation: the canvas's own
    expect(m.grid.segments).toEqual([])
    expect(m.grid.centreMainMM).toEqual([(f.cols - 1) * 24, (f.rows - 1) * 24])
  })
  it('scales node geometry with the pitch tier', () => {
    const a48 = libraryStageModel(sel, 48, 12).grid.anchors.map((a) => a.p)
    const a96 = libraryStageModel(sel, 96, 12).grid.anchors.map((a) => a.p)
    for (let i = 0; i < a48.length; i++) {
      expect(a96[i][0]).toBeCloseTo(a48[i][0] * 2, 6)
      expect(a96[i][1]).toBeCloseTo(a48[i][1] * 2, 6)
    }
  })
})
