// Layout-library module + bridge — corpus completeness, classifier goldens, integrity,
// bridge mapping (QA F3: tests must FAIL when any required shape/frame/layout/primitive
// is removed; never a point-count oracle).

import { describe, expect, it } from 'vitest'
import {
  SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES, CLASS_FRAMES, LIBRARY_SHAPES, FAMILY_APPLICABILITY_DRAFT,
  LIBRARY_FAMILIES, libraryIntegrity, transformLayout, kindOf, orientationOf, frameKeyOf,
  resolveSelection, selectedRecords, draftLayoutId, type LibraryDraft,
  type LibrarySelection,
} from '../library'
import { libraryArrangement, libraryPreview, libraryStageModel } from '../grid-magnet-library-bridge'
import { classifyShape } from '../grid-magnet-class'
import { shapeFamilyOf } from '../grid-magnet-class'

const FRAME_KEYS = ['1x1', '2x2', '3x3', '4x4', '5x5']
const SHAPE_IDS = ['square', 'rectangle', 'diamond']

const sel = (over: Partial<LibrarySelection> = {}): LibrarySelection => ({
  shapeId: 'square', frameKey: '3x3', layoutId: 'perimeter',
  view: { transpose: false, flipX: false, flipY: false }, ...over,
})

describe('corpus completeness — removal must fail these', () => {
  it('exactly the 15 canonical frame keys', () => {
    expect(SQUARE_FRAMES.map(frameKeyOf).sort()).toEqual([...FRAME_KEYS].sort())
  })
  it('exactly 16 square layouts as the panel and the pipeline see them', () => {
    // 12 literal semantic populations in the corpus + the 4 computed 96mm modes.
    expect(SQUARE_FRAMES.reduce((n, f) => n + f.layouts.length, 0)).toBe(12)
    expect(CLASS_FRAMES.square.reduce((n, f) => n + f.layouts.length, 0)).toBe(16)
  })
  it('the complete ruled shape-ID set', () => {
    expect(LIBRARY_SHAPES.map((x) => x.id).sort()).toEqual([...SHAPE_IDS].sort())
  })

  it('square class: every frame is even, 1x1..5x5, square kind', () => {
    const seen = new Set<string>()
    for (const f of SQUARE_FRAMES) { expect(f.cols).toBe(f.rows); seen.add(f.cols + 'x' + f.rows) }
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
      const ENGINE_FAMILY: Record<string, string> = { square: 'square', rectangle: 'square', diamond: 'triangle' }
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
      // The diamond's outline WRAPS its magnet group (Dan), so its box is deliberately not
      // the frame's class floor — the frame golden does not apply to that class.
      if (s.family === 'diamond') continue
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
    expect(LIBRARY_FAMILIES).toEqual(['square', 'rectangle', 'diamond'])
    for (const fam of LIBRARY_FAMILIES) expect(FAMILY_APPLICABILITY_DRAFT[fam].length).toBeGreaterThan(0)
  })
})

describe('data integrity + transforms', () => {
  it('unique frames/names, in-bounds unique nodes, no empties', () => {
    expect(libraryIntegrity()).toEqual([])
  })
  it('transform closure keeps nodes in bounds', () => {
    for (const f of Object.values(CLASS_FRAMES).flat()) for (const l of f.layouts)
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
    const f = SQUARE_FRAMES.find((x) => x.cols === 4 && x.rows === 4)!
    for (const l of f.layouts) for (const [x, y] of l.nodes)
      expect(x === 0 || x === 3 || y === 0 || y === 3, `4x4 ${l.name} interior ${x},${y}`).toBe(true)
    expect(f.layouts.map((l) => l.name)).not.toContain('full')
  })
  it('belt is a spacing mode: every frame above 1x1 carries perimeter and perimeter-96', () => {
    for (const f of SQUARE_FRAMES.filter((x) => x.cols > 1)) {
      const names = CLASS_FRAMES.square.find((x) => x.cols === f.cols && x.rows === f.rows)!.layouts.map((l) => l.name)
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

describe('diamond class', () => {
  it('carries the ruled rings', () => {
    expect(CLASS_FRAMES.diamond.map(frameKeyOf)).toEqual(['1x1', '3x3', '5x5', '7x7'])
  })
  it('uses the SHARED layout vocabulary — full / perimeter / perimeter-96 / corners', () => {
    for (const f of CLASS_FRAMES.diamond.slice(1)) {
      const k = (f.cols - 1) / 2
      const names = f.layouts.map((l) => l.name)
      expect(names).toContain('full')
      expect(names).toContain('perimeter')
      const per = f.layouts.find((l) => l.name === 'perimeter')!
      expect(per.nodes.length).toBe(4 * k)
      for (const [x, y] of per.nodes) expect(Math.abs(x - k) + Math.abs(y - k)).toBe(k)
      // 'full' means the same thing in every class: every node inside the region. On a diamond
      // that is the whole Manhattan disc, NOT the ring plus one centre magnet — the hardcoded
      // ring+centre left the inner nodes bare and made a class-special out of a shared word.
      const full = f.layouts.find((l) => l.name === 'full')!
      const disc: string[] = []
      for (let y = 0; y < f.rows; y++) for (let x = 0; x < f.cols; x++)
        if (Math.abs(x - k) + Math.abs(y - k) <= k) disc.push(x + ',' + y)
      expect(full.nodes.map(([x, y]) => x + ',' + y).sort()).toEqual(disc.sort())
      expect(full.nodes.length).toBe(2 * k * k + 2 * k + 1)
      expect(full.note).toContain('Full grid only')
    }
  })
})

describe('diamond wrapping', () => {
  it('the outline wraps the ring: half-diagonal = k*pitch + padding on the diagonal', () => {
    for (const f of CLASS_FRAMES.diamond) {
      const k = (f.cols - 1) / 2
      const pv = libraryPreview({ shapeId: 'diamond', frameKey: frameKeyOf(f), layoutId: f.layouts[0].name, view: { transpose: false, flipX: false, flipY: false } }, 48)
      const xs = pv.outlineMM.map((q) => q[0])
      const span = Math.max(...xs) - Math.min(...xs)
      expect(span).toBeCloseTo(2 * (k * 48 + 12 * Math.SQRT2), 6)
    }
  })
})

describe('selection resolution — one owner, no guessing in the view', () => {
  const draft = (over: Partial<LibraryDraft> = {}): LibraryDraft => ({
    id: 'draft:square:3x3:mine', className: 'square', frameKey: '3x3', name: 'mine',
    nodes: [[0, 0], [2, 2]], ...over,
  })

  it('a stale cross-class layout lands on a real one instead of throwing', () => {
    // Clicking diamond while 'perimeter' was selected on square used to throw and white-screen
    // the tab: the diamond's 1x1 carries only 'single'.
    const r = resolveSelection(sel({ shapeId: 'diamond', frameKey: '1x1', layoutId: 'perimeter' }))
    expect(r.frame.layouts.some((l) => l.name === r.safeSel.layoutId)).toBe(true)
    expect(() => selectedRecords(r.safeSel)).not.toThrow()
  })

  it('unknown shape or frame is a caller bug — both resolvers refuse it (QA F4)', () => {
    // Guessing here produced a 'safeSel' that still carried the bad shapeId and threw when the
    // pipeline resolved it. Only the LAYOUT is carried across frames, by design.
    expect(() => resolveSelection(sel({ shapeId: 'nope' as never }))).toThrow('unknown shapeId')
    expect(() => resolveSelection(sel({ frameKey: '9x9' }))).toThrow('unknown frameKey')
  })

  it('the strict resolver still refuses the same input — the two are not merged', () => {
    expect(() => selectedRecords(sel({ shapeId: 'diamond', frameKey: '1x1', layoutId: 'perimeter' }))).toThrow('unknown layoutId')
    expect(() => selectedRecords(sel({ frameKey: '9x9' }))).toThrow('unknown frameKey')
  })

  it('a draft resolves only for its own class AND frame AND name', () => {
    const ds = [draft()]
    const hit = resolveSelection(sel({ shapeId: 'square', frameKey: '3x3', layoutId: draftLayoutId('mine') }), ds)
    expect(hit.draft?.id).toBe('draft:square:3x3:mine')
    // same frame key, different class — must NOT answer for the diamond
    const cross = resolveSelection(sel({ shapeId: 'diamond', frameKey: '3x3', layoutId: draftLayoutId('mine') }), ds)
    expect(cross.draft).toBeNull()
    // same class, different frame
    const other = resolveSelection(sel({ shapeId: 'square', frameKey: '4x4', layoutId: draftLayoutId('mine') }), ds)
    expect(other.draft).toBeNull()
  })

  it('a draft selection still hands the bridge a real corpus layout', () => {
    const r = resolveSelection(sel({ shapeId: 'square', frameKey: '3x3', layoutId: draftLayoutId('mine') }), [draft()])
    expect(r.safeSel.layoutId).toBe(r.frame.layouts[0].name)
    expect(() => selectedRecords(r.safeSel)).not.toThrow()
  })

  it('a draft that no longer exists resolves to the corpus, not to nothing', () => {
    const r = resolveSelection(sel({ shapeId: 'square', frameKey: '3x3', layoutId: draftLayoutId('deleted') }), [])
    expect(r.draft).toBeNull()
    expect(r.layout.name).toBe(r.frame.layouts[0].name)
  })
})

describe('the 96mm spacing mode is computed policy, one rule for every class', () => {
  const key = (n: readonly [number, number]) => n[0] + ',' + n[1]
  const extremes = (f: { cols: number; rows: number }, family: string) => family === 'diamond'
    ? (() => { const k = (f.cols - 1) / 2; return [[k, 0], [0, k], [f.cols - 1, k], [k, f.rows - 1]] as Array<[number, number]> })()
    : [[0, 0], [f.cols - 1, 0], [0, f.rows - 1], [f.cols - 1, f.rows - 1]] as Array<[number, number]>

  it('the corpus stores no 96mm population — it is derived, never hand-written', () => {
    for (const frames of [SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES])
      for (const f of frames) expect(f.layouts.map((l) => l.name)).not.toContain('perimeter-96')
  })

  it('a frame with a perimeter always offers the 96mm mode, and it is a subset of that perimeter', () => {
    for (const fam of LIBRARY_FAMILIES) for (const f of CLASS_FRAMES[fam]) {
      const per = f.layouts.find((l) => l.name === 'perimeter')
      const s96 = f.layouts.find((l) => l.name === 'perimeter-96')
      if (!per) { expect(s96).toBeUndefined(); continue }
      expect(s96, `${fam} ${frameKeyOf(f)}`).toBeDefined()
      const ring = new Set(per.nodes.map(key))
      for (const n of s96!.nodes) expect(ring.has(key(n)), `${fam} ${frameKeyOf(f)} ${key(n)}`).toBe(true)
      expect(s96!.nodes.length).toBeLessThanOrEqual(per.nodes.length)
    }
  })

  it('every 96mm population keeps all four extremes — an extreme is never left bare', () => {
    for (const fam of LIBRARY_FAMILIES) for (const f of CLASS_FRAMES[fam]) {
      const s96 = f.layouts.find((l) => l.name === 'perimeter-96')
      if (!s96) continue
      const got = new Set(s96.nodes.map(key))
      for (const e of extremes(f, fam)) expect(got.has(key(e)), `${fam} ${frameKeyOf(f)} missing ${key(e)}`).toBe(true)
    }
  })

  it("square 4x4 in 96mm is the four corners — Dan's ruling, 08-25 19:40", () => {
    // A 144mm side carries no even 96mm sample, so it keeps its corners only. This froze the
    // ruling that a later 'the computed value is already right' edit silently reverted.
    const f = CLASS_FRAMES.square.find((x) => x.cols === 4 && x.rows === 4)!
    const s96 = f.layouts.find((l) => l.name === 'perimeter-96')!
    expect(s96.nodes.map(key).sort()).toEqual(['0,0', '0,3', '3,0', '3,3'])
    expect(CLASS_FRAMES.square.find((x) => x.cols === 3)!.layouts.find((l) => l.name === 'perimeter-96')!.nodes.length).toBe(4)
    expect(CLASS_FRAMES.square.find((x) => x.cols === 5)!.layouts.find((l) => l.name === 'perimeter-96')!.nodes.length).toBe(8)
  })

  it('the diamond vocabulary is complete on every ring, corners are exactly the vertices', () => {
    for (const f of CLASS_FRAMES.diamond.slice(1)) {
      const names = f.layouts.map((l) => l.name)
      for (const n of ['full', 'perimeter', 'perimeter-96', 'corners']) expect(names, frameKeyOf(f)).toContain(n)
      const corners = f.layouts.find((l) => l.name === 'corners')!
      expect(corners.nodes.map(key).sort()).toEqual(extremes(f, 'diamond').map(key).sort())
    }
  })
})
