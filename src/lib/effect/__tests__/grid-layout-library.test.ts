// Layout-library module + bridge — corpus completeness, classifier goldens, integrity,
// bridge mapping (QA F3: tests must FAIL when any required shape/frame/layout/primitive
// is removed; never a point-count oracle).

import { describe, expect, it } from 'vitest'
import {
  LAYOUT_LIBRARY, LIBRARY_SHAPES, FAMILY_APPLICABILITY_DRAFT,
  LIBRARY_FAMILIES, libraryIntegrity, transformLayout, kindOf, orientationOf, frameKeyOf,
  type LibrarySelection,
} from '../grid-magnet-library'
import { libraryArrangement, libraryPreview, libraryStageModel } from '../grid-magnet-library-bridge'
import { classifyShape } from '../grid-magnet-class'
import { shapeFamilyOf } from '../grid-magnet-class'

const FRAME_KEYS = ['1x1', '2x2', '3x3', '4x4', '5x5']
const SHAPE_IDS = ['square']

const sel = (over: Partial<LibrarySelection> = {}): LibrarySelection => ({
  shapeId: 'square', frameKey: '3x3', layoutId: 'ring',
  view: { transpose: false, flipX: false, flipY: false }, ...over,
})

describe('corpus completeness — removal must fail these', () => {
  it('exactly the 15 canonical frame keys', () => {
    expect(LAYOUT_LIBRARY.map(frameKeyOf).sort()).toEqual([...FRAME_KEYS].sort())
  })
  it('exactly 14 ruled square layouts across the frames', () => {
    expect(LAYOUT_LIBRARY.reduce((n, f) => n + f.layouts.length, 0)).toBe(14)
  })
  it('the complete ruled shape-ID set', () => {
    expect(LIBRARY_SHAPES.map((x) => x.id).sort()).toEqual([...SHAPE_IDS].sort())
  })

  it('square class: every frame is even, 1x1..5x5, square kind', () => {
    const seen = new Set<string>()
    for (const f of LAYOUT_LIBRARY) { expect(f.cols).toBe(f.rows); seen.add(f.cols + 'x' + f.rows) }
    for (const n of [1, 2, 3, 4, 5]) expect(seen.has(n + 'x' + n)).toBe(true)
    expect(kindOf(3, 3)).toBe('square'); expect(orientationOf(3, 3)).toBe('even')
  })
})

describe('classifier goldens — declared family is the classifier verdict, not a point count', () => {
  it('every shape outline classifies as its declared family', () => {
    for (const s of LIBRARY_SHAPES) {
      const pv = libraryPreview(sel({ shapeId: s.id, frameKey: '3x3', layoutId: 'ring' }), 48)
      expect(shapeFamilyOf(pv.outlineMM), s.id).toBe(s.family)
    }
  })
  it('QA F1 golden: the outline CLASSIFIES as the selected/transformed frame (compatible pairs)', () => {
    for (const f of LAYOUT_LIBRARY) for (const s of LIBRARY_SHAPES) {
      for (const transpose of [false, true]) {
        const cols = transpose ? f.rows : f.cols, rows = transpose ? f.cols : f.rows
        if (s.aspect === 'square' && cols !== rows) continue          // marked incompatible, not stretched
        const pv = libraryPreview(sel({ shapeId: s.id, frameKey: frameKeyOf(f), layoutId: f.layouts[0].name, view: { transpose, flipX: false, flipY: false } }), 48)
        expect(pv.shapeCompatible).toBe(true)
        const c = classifyShape(pv.outlineMM, 48)
        expect([c.cx, c.cy], `${s.id} on ${frameKeyOf(f)}${transpose ? ' T' : ''}`).toEqual([cols, rows])
      }
    }
  })
  it('QA F1 counterexamples: 1x1 spans 24mm and 3x3 spans 120x120mm — never one class larger', () => {
    const a1 = libraryPreview(sel({ shapeId: 'square', frameKey: '1x1', layoutId: 'single' }), 48)
    const xs = a1.outlineMM.map((q) => q[0]), ys = a1.outlineMM.map((q) => q[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(24, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(24, 6)
    const a2 = libraryPreview(sel({ shapeId: 'square', frameKey: '3x3', layoutId: 'ring' }), 48)
    const xs2 = a2.outlineMM.map((q) => q[0]), ys2 = a2.outlineMM.map((q) => q[1])
    expect(Math.max(...xs2) - Math.min(...xs2)).toBeCloseTo(120, 6)
    expect(Math.max(...ys2) - Math.min(...ys2)).toBeCloseTo(120, 6)
  })




  it('families and draft applicability stay complete', () => {
    expect(LIBRARY_FAMILIES).toEqual(['square'])
    for (const fam of LIBRARY_FAMILIES) expect(FAMILY_APPLICABILITY_DRAFT[fam].length).toBeGreaterThan(0)
  })
})

describe('data integrity + transforms', () => {
  it('unique frames/names, in-bounds unique nodes, no empties', () => {
    expect(libraryIntegrity()).toEqual([])
  })
  it('transform closure keeps nodes in bounds', () => {
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

describe('bridge — stable IDs, wrapGroup-ready arrangement, Stage composition', () => {
  it('arrangement carries stable IDs and mm nodes', () => {
    const a = libraryArrangement(sel(), 48)
    expect(a).toMatchObject({ sourceFrameKey: '3x3', frameKey: '3x3', layoutId: 'ring', frameCols: 3, frameRows: 3 })
    expect(libraryPreview(sel(), 48)).toMatchObject({ shapeId: 'square', declaredFamily: 'square', shapeCompatible: true })
    expect(a.nodesMM.length).toBe(8)
  })
  it('unknown IDs fail loudly — no silent 1x1 retarget (QA F3)', () => {
    expect(() => libraryArrangement(sel({ frameKey: '9x9' }), 48)).toThrow('unknown frameKey')
    expect(() => libraryArrangement(sel({ layoutId: 'nope' }), 48)).toThrow('unknown layoutId')
  })
  it('transpose exposes the truthful actual frame identity (QA F3)', () => {
    const a = libraryArrangement(sel({ view: { transpose: true, flipX: false, flipY: false } }), 48)
    expect(a.sourceFrameKey).toBe('3x3')
    expect(a.frameKey).toBe('3x3')
    expect([a.frameCols, a.frameRows]).toEqual([3, 3])
  })
  it('stage model composes the arrangement; lattice stays the canvas own', () => {
    const m = libraryStageModel(sel(), 48, 12)
    expect(m.grid.anchors.length).toBe(8)
    expect(m.grid.pitchCentreMM).toBe(48)
    expect(m.grid.spotRadiusMM).toBe(12)
    expect(m.grid.lattice).toEqual([])
    expect(m.contour.outer.pts.length).toBeGreaterThanOrEqual(4)
  })
  it('node geometry scales with the pitch tier', () => {
    const a48 = libraryArrangement(sel(), 48).nodesMM
    const a96 = libraryArrangement(sel(), 96).nodesMM
    for (let i = 0; i < a48.length; i++) {
      expect(a96[i][0]).toBeCloseTo(a48[i][0] * 2, 6)
      expect(a96[i][1]).toBeCloseTo(a48[i][1] * 2, 6)
    }
  })
})
