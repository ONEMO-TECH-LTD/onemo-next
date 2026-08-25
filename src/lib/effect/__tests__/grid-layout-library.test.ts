// Layout-library module + bridge — corpus completeness, classifier goldens, integrity,
// bridge mapping (QA F3: tests must FAIL when any required shape/frame/layout/primitive
// is removed; never a point-count oracle).

import { describe, expect, it } from 'vitest'
import {
  LAYOUT_LIBRARY, LIBRARY_SHAPES, UNIVERSAL_PRIMITIVES, FAMILY_APPLICABILITY_DRAFT,
  LIBRARY_FAMILIES, libraryIntegrity, transformLayout, kindOf, orientationOf, frameKeyOf,
  type LibrarySelection,
} from '../grid-magnet-library'
import { libraryArrangement, libraryStageModel } from '../grid-magnet-library-bridge'
import { classifyShape } from '../grid-magnet-class'
import { shapeFamilyOf } from '../grid-magnet-class'

const FRAME_KEYS = ['1x1', '1x2', '1x3', '1x4', '1x5', '2x2', '2x3', '2x4', '2x5', '3x3', '3x4', '3x5', '4x4', '4x5', '5x5']
const SHAPE_IDS = ['square', 'rectangle', 'rounded-square', 'rounded-rectangle', 'circle', 'triangle', 'diamond', 'tee', 'ell', 'waisted']
const PRIMS = ['single', 'pair-h', 'pair-v', 'pair-diag', 'pair-anti']

const sel = (over: Partial<LibrarySelection> = {}): LibrarySelection => ({
  shapeId: 'tee', frameKey: '2x3', layoutId: 'tee-L',
  view: { transpose: false, flipX: false, flipY: false }, ...over,
})

describe('corpus completeness — removal must fail these', () => {
  it('exactly the 15 canonical frame keys', () => {
    expect(LAYOUT_LIBRARY.map(frameKeyOf).sort()).toEqual([...FRAME_KEYS].sort())
  })
  it('exactly 100 reviewed layouts across the frames', () => {
    expect(LAYOUT_LIBRARY.reduce((n, f) => n + f.layouts.length, 0)).toBe(100)
  })
  it('the complete ruled shape-ID set', () => {
    expect(LIBRARY_SHAPES.map((x) => x.id).sort()).toEqual([...SHAPE_IDS].sort())
  })
  it('the five universal primitives exist and resolve in EVERY frame', () => {
    expect(UNIVERSAL_PRIMITIVES.map((l) => l.name)).toEqual(PRIMS)
    for (const f of LAYOUT_LIBRARY) for (const nm of PRIMS) {
      const a = libraryArrangement(sel({ frameKey: frameKeyOf(f), layoutId: 'prim:' + nm }), 48)
      expect(a.layoutId).toBe('prim:' + nm)
      expect(a.nodesMM.length).toBe(nm === 'single' ? 1 : 2)
    }
  })
  it('frames plus transpose cover all 25 axis pairs with expected kind/orientation', () => {
    const seen = new Set<string>()
    for (const f of LAYOUT_LIBRARY) { seen.add(f.cols + 'x' + f.rows); seen.add(f.rows + 'x' + f.cols) }
    for (let c = 1; c <= 5; c++) for (let r = 1; r <= 5; r++) expect(seen.has(c + 'x' + r)).toBe(true)
    expect(kindOf(2, 3)).toBe('slim'); expect(orientationOf(2, 3)).toBe('tall')
    expect(kindOf(3, 3)).toBe('square'); expect(orientationOf(3, 2)).toBe('wide')
    expect(kindOf(3, 4)).toBe('standard')
  })
})

describe('classifier goldens — declared family is the classifier verdict, not a point count', () => {
  it('every shape outline classifies as its declared family', () => {
    for (const s of LIBRARY_SHAPES) {
      const a = libraryArrangement(sel({ shapeId: s.id, frameKey: '3x3', layoutId: 'ring' }), 48)
      expect(shapeFamilyOf(a.outlineMM), s.id).toBe(s.family)
    }
  })
  it('QA F1 golden: the outline CLASSIFIES as the selected/transformed frame (compatible pairs)', () => {
    for (const f of LAYOUT_LIBRARY) for (const s of LIBRARY_SHAPES) {
      for (const transpose of [false, true]) {
        const cols = transpose ? f.rows : f.cols, rows = transpose ? f.cols : f.rows
        if (s.aspect === 'square' && cols !== rows) continue          // marked incompatible, not stretched
        const a = libraryArrangement(sel({ shapeId: s.id, frameKey: frameKeyOf(f), layoutId: f.layouts[0].name, view: { transpose, flipX: false, flipY: false } }), 48)
        expect(a.shapeCompatible).toBe(true)
        const c = classifyShape(a.outlineMM, 48)
        expect([c.cx, c.cy], `${s.id} on ${frameKeyOf(f)}${transpose ? ' T' : ''}`).toEqual([cols, rows])
      }
    }
  })
  it('QA F1 counterexamples: 1x1 spans 24mm and 2x3 spans 72x120mm — never one class larger', () => {
    const a1 = libraryArrangement(sel({ shapeId: 'rectangle', frameKey: '1x1', layoutId: 'single' }), 48)
    const xs = a1.outlineMM.map((q) => q[0]), ys = a1.outlineMM.map((q) => q[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(24, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(24, 6)
    const a2 = libraryArrangement(sel({ shapeId: 'rectangle', frameKey: '2x3', layoutId: 'full' }), 48)
    const xs2 = a2.outlineMM.map((q) => q[0]), ys2 = a2.outlineMM.map((q) => q[1])
    expect(Math.max(...xs2) - Math.min(...xs2)).toBeCloseTo(72, 6)
    expect(Math.max(...ys2) - Math.min(...ys2)).toBeCloseTo(120, 6)
  })
  it('QA F2: primitives keep the selected transformed frame and prim identity — every frame x primitive', () => {
    for (const f of LAYOUT_LIBRARY) for (const nm of ['single', 'pair-h', 'pair-v', 'pair-diag', 'pair-anti']) {
      const a = libraryArrangement(sel({ frameKey: frameKeyOf(f), layoutId: 'prim:' + nm }), 48)
      expect(a.frameKey).toBe(frameKeyOf(f))
      expect([a.frameCols, a.frameRows]).toEqual([f.cols, f.rows])
      expect(a.layoutId).toBe('prim:' + nm)
      expect(a.layoutKind).toBe('primitive')
      expect(a.nodesMM.length).toBe(nm === 'single' ? 1 : 2)
      // group midpoint sits on the frame midpoint in the Stage model
      const xs = a.nodesMM.map((q) => q[0]), ys = a.nodesMM.map((q) => q[1])
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo((f.cols - 1) * 24, 6)
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo((f.rows - 1) * 24, 6)
    }
    const m = libraryStageModel(sel({ frameKey: '5x5', layoutId: 'prim:single' }), 48, 12)
    expect(m.title).toContain('5x5')
    expect(m.title).toContain('prim:single')
  })
  it('families and draft applicability stay complete', () => {
    expect(LIBRARY_FAMILIES).toEqual(['square', 'round', 'triangle'])
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
    expect(a).toMatchObject({ shapeId: 'tee', family: 'triangle', sourceFrameKey: '2x3', frameKey: '2x3', layoutId: 'tee-L', layoutKind: 'frame', frameCols: 2, frameRows: 3, shapeCompatible: true })
    expect(a.nodesMM.length).toBe(3)
  })
  it('unknown IDs fail loudly — no silent 1x1 retarget (QA F3)', () => {
    expect(() => libraryArrangement(sel({ frameKey: '9x9' }), 48)).toThrow('unknown frameKey')
    expect(() => libraryArrangement(sel({ layoutId: 'nope' }), 48)).toThrow('unknown layoutId')
    expect(() => libraryArrangement(sel({ layoutId: 'prim:nope' }), 48)).toThrow('unknown primitive')
  })
  it('transpose exposes the truthful actual frame identity (QA F3)', () => {
    const a = libraryArrangement(sel({ view: { transpose: true, flipX: false, flipY: false } }), 48)
    expect(a.sourceFrameKey).toBe('2x3')
    expect(a.frameKey).toBe('3x2')
    expect([a.frameCols, a.frameRows]).toEqual([3, 2])
  })
  it('stage model composes the arrangement; lattice stays the canvas own', () => {
    const m = libraryStageModel(sel(), 48, 12)
    expect(m.grid.anchors.length).toBe(3)
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
