// Layout-library module + bridge — corpus completeness, classifier goldens, integrity,
// bridge mapping (QA F3: tests must FAIL when any required shape/frame/layout/primitive
// is removed; never a point-count oracle).

import { describe, expect, it } from 'vitest'
import {
  LAYOUT_LIBRARY, CLASS_FRAMES, LIBRARY_SHAPES, FAMILY_APPLICABILITY_DRAFT,
  LIBRARY_FAMILIES, libraryIntegrity, transformLayout, kindOf, orientationOf, frameKeyOf,
  type LibrarySelection,
} from '../grid-magnet-library'
import { libraryArrangement, libraryPreview, libraryStageModel } from '../grid-magnet-library-bridge'
import { classifyShape } from '../grid-magnet-class'
import { shapeFamilyOf } from '../grid-magnet-class'

const FRAME_KEYS = ['1x1', '2x2', '3x3', '4x4', '5x5']
const SHAPE_IDS = ['square', 'rectangle']

const sel = (over: Partial<LibrarySelection> = {}): LibrarySelection => ({
  shapeId: 'square', frameKey: '3x3', layoutId: 'perimeter',
  view: { transpose: false, flipX: false, flipY: false }, ...over,
})

describe('corpus completeness — removal must fail these', () => {
  it('exactly the 15 canonical frame keys', () => {
    expect(LAYOUT_LIBRARY.map(frameKeyOf).sort()).toEqual([...FRAME_KEYS].sort())
  })
  it('exactly 16 ruled square layouts across the frames', () => {
    expect(LAYOUT_LIBRARY.reduce((n, f) => n + f.layouts.length, 0)).toBe(16)
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
      // The LIBRARY class is not the ENGINE family (Meta M1): a rectangle fills its box, so
      // the engine classifier reads it as the box-filling 'square' family. The mapping is
      // asserted explicitly so the two taxonomies can never silently merge.
      const ENGINE_FAMILY: Record<string, string> = { square: 'square', rectangle: 'square' }
      const f0 = CLASS_FRAMES[s.family][0]
      const pv = libraryPreview(sel({ shapeId: s.id, frameKey: frameKeyOf(f0), layoutId: f0.layouts[0].name }), 48)
      expect(shapeFamilyOf(pv.outlineMM), s.id).toBe(ENGINE_FAMILY[s.family])
    }
  })
  it('QA F1 golden: the outline CLASSIFIES as the selected/transformed frame (compatible pairs)', () => {
    for (const s of LIBRARY_SHAPES) for (const f of CLASS_FRAMES[s.family]) {
      // The engine classifier tops out at 5 magnet lines per axis (bands B1-B5), so a 6-line
      // library frame has no class to be read back as. The library carries it; the classifier
      // cannot express it until a sixth band is ruled.
      if (f.cols > 5 || f.rows > 5) continue
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
    const a2 = libraryPreview(sel({ shapeId: 'square', frameKey: '3x3', layoutId: 'perimeter' }), 48)
    const xs2 = a2.outlineMM.map((q) => q[0]), ys2 = a2.outlineMM.map((q) => q[1])
    expect(Math.max(...xs2) - Math.min(...xs2)).toBeCloseTo(120, 6)
    expect(Math.max(...ys2) - Math.min(...ys2)).toBeCloseTo(120, 6)
  })




  it('families and draft applicability stay complete', () => {
    expect(LIBRARY_FAMILIES).toEqual(['square', 'rectangle'])
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
    expect(a).toMatchObject({ sourceFrameKey: '3x3', frameKey: '3x3', layoutId: 'perimeter', frameCols: 3, frameRows: 3 })
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

describe('interior rule and the belt mode', () => {
  it('4x4 carries NO interior magnet in any layout (Dan, 08-25)', () => {
    const f = LAYOUT_LIBRARY.find((x) => x.cols === 4 && x.rows === 4)!
    for (const l of f.layouts) for (const [x, y] of l.nodes)
      expect(x === 0 || x === 3 || y === 0 || y === 3, `4x4 ${l.name} interior ${x},${y}`).toBe(true)
    expect(f.layouts.map((l) => l.name)).not.toContain('full')
  })
  it('belt is a spacing mode: every frame above 1x1 carries perimeter and perimeter-96', () => {
    for (const f of LAYOUT_LIBRARY.filter((x) => x.cols > 1)) {
      const names = f.layouts.map((l) => l.name)
      expect(names).toContain('perimeter')
      expect(names).toContain('perimeter-96')
    }
  })
})

describe('rectangle class', () => {
  it('carries exactly its ruled frames', () => {
    expect(CLASS_FRAMES.rectangle.map(frameKeyOf)).toEqual(['1x2', '1x3', '1x4', '1x5', '2x3', '2x4', '2x5', '3x4', '3x5', '4x5', '4x6', '5x6'])
  })
  it('every frame offers a perimeter, and only 3+ line frames carry an interior full', () => {
    for (const f of CLASS_FRAMES.rectangle) {
      const names = f.layouts.map((l) => l.name)
      expect(names).toContain('perimeter')
      const hasFull = names.includes('full')
      expect(hasFull).toBe(f.cols >= 3 && f.rows >= 3)
      for (const l of f.layouts) if (l.name !== 'full')
        for (const [x, y] of l.nodes)
          expect(x === 0 || x === f.cols - 1 || y === 0 || y === f.rows - 1,
            `${frameKeyOf(f)} ${l.name} interior ${x},${y}`).toBe(true)
    }
  })
})
