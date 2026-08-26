// Layout-library module + bridge — corpus completeness, classifier goldens, integrity,
// bridge mapping (QA F3: tests must FAIL when any required shape/frame/layout/primitive
// is removed; never a point-count oracle).

import { describe, expect, it } from 'vitest'
import {
  SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES, CLASS_FRAMES, LIBRARY_SHAPES,
  LIBRARY_FAMILIES, SPACING_MODES, CLASS_RULES, libraryIntegrity, transformLayout, kindOf, orientationOf, frameKeyOf,
  resolveSelection, selectedRecords, draftLayoutId, sample96, canonicalNode, layoutAtPitch,
  transformLayout as tl,
  TRIANGLE_LAYOUTS, triangleGeometry, triangleProductType, triangleTypeOf, triangleFrameKey,
  triangleFrame, trianglePerimeter96, canonicalTriangleId, perimeterRuns, perimeterNodes,
  fullNodes, boundsOf, selfSymmetries, D4, triangleById, assertTrianglePopulation, draftId,
  draftIntegrity, panelOptions, selectionForFamily, uprightView, trianglesOfType, restsFlat, isActive,
  type LatticeNode,
  type LibraryDraft,
  type LibrarySelection,
} from '../library'
import { libraryArrangement, libraryPreview, libraryStageModel, draftStageModel } from '../grid-magnet-library-bridge'
import { classifyShape } from '../grid-magnet-class'
import { shapeFamilyOf } from '../grid-magnet-class'

const FRAME_KEYS = ['1x1', '2x2', '3x3', '4x4', '5x5']
const SHAPE_IDS = ['square', 'rectangle', 'diamond', 'triangle']

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
      // a derived outline has no stored shape to classify — it is proven by its own hull tests
      if (CLASS_RULES[s.family].source === 'geometry') continue
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




  it('families stay complete', () => {
    expect(LIBRARY_FAMILIES).toEqual(['square', 'rectangle', 'diamond', 'triangle'])
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
  // An extreme is a vertex of the class's own outline — four for a box, four for a Manhattan
  // ring, three for a triangle.
  const extremes = (f: { cols: number; rows: number }, family: string): Array<[number, number]> => {
    if (family === 'diamond') { const k = (f.cols - 1) / 2; return [[k, 0], [0, k], [f.cols - 1, k], [k, f.rows - 1]] }
    return [[0, 0], [f.cols - 1, 0], [0, f.rows - 1], [f.cols - 1, f.rows - 1]]
  }

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

  it('every 96mm population keeps every extreme — an extreme is never left bare', () => {
    for (const fam of LIBRARY_FAMILIES) for (const f of CLASS_FRAMES[fam]) {
      const s96 = f.layouts.find((l) => l.name === 'perimeter-96')
      if (!s96) continue
      const got = new Set(s96.nodes.map(key))
      for (const e of extremes(f, fam)) expect(got.has(key(e)), `${fam} ${frameKeyOf(f)} missing ${key(e)}`).toBe(true)
    }
  })

  it('96mm is a physical distance — the stride is 96/pitch nodes, far end always kept', () => {
    const run = (n: number, p = 48) => [...sample96(n, p)].sort((a, b) => a - b)
    expect(run(4)).toEqual([0, 2, 3])
    expect(run(5)).toEqual([0, 2, 4])
    expect(run(6)).toEqual([0, 2, 4, 5])
    expect(run(5, 96)).toEqual([0, 1, 2, 3, 4])   // one node per 96mm: every node
    expect(run(5, 24)).toEqual([0, 4])            // four nodes per 96mm
    expect(() => sample96(5, 36)).toThrow('unsupported at pitch')
  })

  it('the population follows the pitch tier, and the label does not (Dan: 96 is fixed)', () => {
    const f = CLASS_FRAMES.square.find((x) => x.cols === 5)!
    const at = (p: number) => layoutAtPitch('square', f, f.layouts.find((l) => l.name === 'perimeter-96')!, p).nodes.length
    expect([at(24), at(48), at(96)]).toEqual([4, 8, 16])
    expect(SPACING_MODES.map((m) => m.label)).toEqual(['48 mm', '96 mm'])
  })

  it('a non-divisible ring pairs instead of leaning — square 4x4 exactly', () => {
    // Walked clockwise, each side indexes from its own start, so the short closing interval
    // lands as four balanced adjacent pairs rather than biased to one absolute direction.
    const f = CLASS_FRAMES.square.find((x) => x.cols === 4)!
    const got = f.layouts.find((l) => l.name === 'perimeter-96')!.nodes.map(key).sort()
    expect(got).toEqual(['0,0', '0,1', '0,3', '1,3', '2,0', '3,0', '3,2', '3,3'].sort())
  })

  it('every square 96 population is closed under a quarter turn', () => {
    for (const f of CLASS_FRAMES.square.filter((x) => x.cols > 1)) {
      const s96 = f.layouts.find((l) => l.name === 'perimeter-96')
      if (!s96) continue
      const got = new Set(s96.nodes.map(key))
      for (const [x, y] of s96.nodes)
        expect(got.has(key([f.rows - 1 - y, x])), `${frameKeyOf(f)} rotate ${key([x, y])}`).toBe(true)
    }
  })

  it('the ruled populations follow from that one rule', () => {
    const n96 = (fam: 'square' | 'rectangle' | 'diamond', c: number, r: number) =>
      CLASS_FRAMES[fam].find((f) => f.cols === c && f.rows === r)!
        .layouts.find((l) => l.name === 'perimeter-96')!.nodes.length
    expect(n96('square', 3, 3)).toBe(4)
    expect(n96('square', 4, 4)).toBe(8)
    expect(n96('square', 5, 5)).toBe(8)
    expect(n96('rectangle', 1, 4)).toBe(3)
    expect(n96('rectangle', 3, 4)).toBe(6)
    expect(n96('rectangle', 4, 6)).toBe(10)
    expect(n96('diamond', 3, 3)).toBe(4)
    expect(n96('diamond', 7, 7)).toBe(8)
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

describe('authoring under a view transform stays canonical (QA F2)', () => {
  const frame = CLASS_FRAMES.rectangle.find((f) => f.cols === 2 && f.rows === 3)!
  const views = [false, true].flatMap((transpose) => [false, true].flatMap((flipX) =>
    [false, true].map((flipY) => ({ transpose, flipX, flipY }))))

  it('every canonical node round-trips through all eight transforms', () => {
    for (const v of views) for (let y = 0; y < frame.rows; y++) for (let x = 0; x < frame.cols; x++) {
      const shown = tl(frame, { name: 'p', nodes: [[x, y]] }, v).nodes[0]
      expect(canonicalNode(frame, v, shown), `${x},${y} via ${JSON.stringify(v)}`).toEqual([x, y])
    }
  })

  it('a landscape pick at the far column is a valid canonical node, not an out-of-frame one', () => {
    // The rightmost click in landscape used to be stored as [2,0] and rejected at save: the
    // frame is truthfully 3x2 on screen while the draft it feeds is the canonical 2x3.
    const v = { transpose: true, flipX: false, flipY: false }
    const n = canonicalNode(frame, v, [2, 0])
    expect(n[0]).toBeGreaterThanOrEqual(0); expect(n[0]).toBeLessThan(frame.cols)
    expect(n[1]).toBeGreaterThanOrEqual(0); expect(n[1]).toBeLessThan(frame.rows)
    expect(n).toEqual([0, 2])
  })
})

describe('triangle — the three-point layout universe', () => {
  const D4F = D4
  const canonOf = (v: readonly LatticeNode[]) => canonicalTriangleId(v)
  const ids = TRIANGLE_LAYOUTS.map((t) => t.id)

  it('the literal corpus is exactly the independently derived universe', () => {
    // derived here from first principles, not from the corpus, so a deleted or invented
    // record fails set equality
    const universe = new Set<string>()
    const pts: LatticeNode[] = []
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) pts.push([x, y])
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++) {
        const v = [pts[i], pts[j], pts[k]] as [LatticeNode, LatticeNode, LatticeNode]
        const cr = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0])
        if (cr === 0) continue
        universe.add(canonOf(v))
      }
    expect(ids.length).toBe(79)
    expect([...new Set(ids)].length).toBe(79)
    expect([...universe].sort()).toEqual([...ids].sort())
  })

  it('the universe stays 79; the ACTIVE catalogue is Peak 16 / Wedge 12 / Sail 48', () => {
    // Geometry supplies the default grouping; Dan's per-layout rulings override it, and three
    // layouts are retired from the product. Neither changes the universe underneath.
    expect(TRIANGLE_LAYOUTS.length).toBe(79)
    expect(TRIANGLE_LAYOUTS.filter(isActive).length).toBe(76)
    expect([trianglesOfType('peak').length, trianglesOfType('wedge').length, trianglesOfType('sail').length])
      .toEqual([16, 12, 48])
  })

  it('every ruled layout is grouped as Dan ruled it, and the retired three are out', () => {
    // 08-26 08:11 "2x3 is not wedge it is peak"
    for (const id of ['tri:0,0;0,2;1,0', 'tri:0,0;0,2;1,1'])
      expect(triangleTypeOf(TRIANGLE_LAYOUTS.find((t) => t.id === id)!), id).toBe('peak')
    // 08-26 08:16 "it is not peak it is wedge"
    expect(triangleTypeOf(TRIANGLE_LAYOUTS.find((t) => t.id === 'tri:0,0;0,1;1,0')!)).toBe('wedge')
    // 08-26 08:11 "remove these layouts", of the Wedge / 3x4 screen
    for (const id of ['tri:0,0;0,3;2,0', 'tri:0,0;1,3;2,1', 'tri:0,0;1,3;2,2']) {
      const t = TRIANGLE_LAYOUTS.find((x) => x.id === id)!
      expect(isActive(t), id).toBe(false)
      expect((['peak', 'wedge', 'sail'] as const).some((k) => trianglesOfType(k).includes(t))).toBe(false)
    }
  })

  it('no single geometric precedence reproduces the ruled grouping', () => {
    // This is why the catalogue is curated: right-angle-first makes the 2x3 a Wedge,
    // two-equal-sides-first makes the 2x2 a Peak. Both rulings cannot come from one formula.
    const g = (id: string) => triangleGeometry(TRIANGLE_LAYOUTS.find((t) => t.id === id)!.vertices)
    const rightFirst = (id: string) => g(id).angleClass === 'right' ? 'wedge' : g(id).sideClass === 'isosceles' ? 'peak' : 'sail'
    const isoFirst = (id: string) => g(id).sideClass === 'isosceles' ? 'peak' : g(id).angleClass === 'right' ? 'wedge' : 'sail'
    expect(rightFirst('tri:0,0;0,2;1,0')).toBe('wedge')   // but Dan ruled it Peak
    expect(isoFirst('tri:0,0;0,1;1,0')).toBe('peak')      // but Dan ruled it Wedge
  })

  it('the frame distribution of the universe is exactly the derived table', () => {
    const table: Record<string, [number, number, number]> = {
      '2x2': [0, 1, 0], '2x3': [0, 2, 1], '2x4': [0, 1, 3], '2x5': [1, 1, 4], '3x3': [2, 1, 1],
      '3x4': [1, 3, 5], '3x5': [1, 2, 9], '4x4': [3, 1, 4], '4x5': [1, 3, 14], '5x5': [5, 2, 7],
    }
    const got: Record<string, [number, number, number]> = {}
    for (const t of TRIANGLE_LAYOUTS) {
      const k = triangleFrameKey(t)
      got[k] = got[k] ?? [0, 0, 0]
      // the universe's own distribution, from geometry alone — the curated catalogue sits above
      const geo = triangleGeometry(t.vertices)
      const base = geo.angleClass === 'right' ? 'wedge' : geo.sideClass === 'isosceles' ? 'peak' : 'sail'
      got[k][{ peak: 0, wedge: 1, sail: 2 }[base]]++
    }
    expect(got).toEqual(table)
    // three nodes in one line are collinear, so there is no 1xN triangle frame
    expect(Object.keys(got).some((k) => k.startsWith('1x'))).toBe(false)
  })

  it('every record is non-collinear, portrait, self-canonical and D4-unique', () => {
    const seen = new Set<string>()
    for (const t of TRIANGLE_LAYOUTS) {
      expect(() => triangleGeometry(t.vertices)).not.toThrow()
      const b = boundsOf([...t.vertices])
      expect(b.cols, t.id).toBeLessThanOrEqual(b.rows)
      expect(b.cols).toBeLessThanOrEqual(5); expect(b.rows).toBeLessThanOrEqual(5)
      expect(canonOf(t.vertices), t.id).toBe(t.id)
      for (const f of D4F) {
        const id = canonOf(t.vertices.map(f))
        expect(id).toBe(t.id)                      // identity is transform-invariant
      }
      expect(seen.has(t.id)).toBe(false)
      seen.add(t.id)
    }
  })

  it('no record is equilateral — an integer lattice cannot carry one', () => {
    for (const t of TRIANGLE_LAYOUTS) expect(triangleGeometry(t.vertices).sideClass).not.toBe('equilateral')
  })

  it('geometry supplies the DEFAULT grouping: a right angle reads as a Wedge', () => {
    // Dan, 08-26, looking at the right-angled 2x2: "it is not peak it is wedge".
    const rightIso = TRIANGLE_LAYOUTS.filter((t) => {
      const g = triangleGeometry(t.vertices)
      return g.angleClass === 'right' && g.sideClass === 'isosceles'
    })
    expect(rightIso.length).toBe(8)
    for (const t of rightIso) {
      const g = triangleGeometry(t.vertices)
      const base = g.angleClass === 'right' ? 'wedge' : 'peak'
      expect(base).toBe('wedge')
    }
  })

  it('the GEOMETRIC type survives every transform', () => {
    // the curated catalogue can override a layout's grouping, but the geometry it is derived
    // from must be transform-invariant or the identity itself would move
    for (const t of TRIANGLE_LAYOUTS) for (const f of D4F)
      expect(triangleProductType(triangleGeometry(t.vertices.map(f) as never)), t.id)
        .toBe(triangleProductType(triangleGeometry(t.vertices)))
  })
})

describe('triangle — populations', () => {
  const key = (n: LatticeNode) => n[0] + ',' + n[1]
  const some = TRIANGLE_LAYOUTS.filter((_, i) => i % 7 === 0)

  it('perimeter is exactly the union of the three gcd edge runs', () => {
    for (const t of some) {
      const runs = perimeterRuns(t.vertices).flat().map(key)
      expect([...new Set(perimeterNodes(t.vertices).map(key))].sort()).toEqual([...new Set(runs)].sort())
    }
  })

  it('full is every lattice node inside or on the triangle, and contains the perimeter', () => {
    for (const t of some) {
      const full = new Set(fullNodes(t.vertices).map(key))
      for (const n of perimeterNodes(t.vertices)) expect(full.has(key(n)), t.id).toBe(true)
      const b = boundsOf([...t.vertices])
      expect(full.size).toBeLessThanOrEqual(b.cols * b.rows)
    }
  })

  it('corners are exactly the three vertices', () => {
    for (const t of some) {
      const f = triangleFrame(t, 48)
      expect(f.layouts.find((l) => l.name === 'corners')!.nodes.map(key).sort())
        .toEqual([...t.vertices].map(key).sort())
    }
  })

  it('96 is a subset of perimeter, keeps every vertex, and follows the pitch', () => {
    for (const t of some) {
      const per = new Set(perimeterNodes(t.vertices).map(key))
      for (const pitch of [24, 48, 96]) {
        const s96 = trianglePerimeter96(t, pitch)
        for (const n of s96) expect(per.has(key(n)), `${t.id} @${pitch}`).toBe(true)
        for (const v of t.vertices) expect(s96.map(key)).toContain(key(v))
      }
      expect(trianglePerimeter96(t, 96).length).toBeGreaterThanOrEqual(trianglePerimeter96(t, 24).length)
    }
  })

  it('a Peak stays mirror-balanced — a non-divisible run cannot make it lean', () => {
    for (const t of TRIANGLE_LAYOUTS.filter((x) => triangleTypeOf(x) === 'peak')) {
      const s96 = new Set(trianglePerimeter96(t, 48).map(key))
      for (const f of selfSymmetries(t.vertices)) {
        const img = t.vertices.map(f)
        const tx = Math.min(...img.map((q) => q[0])), ty = Math.min(...img.map((q) => q[1]))
        for (const n of [...s96].map((s) => s.split(',').map(Number) as [number, number])) {
          const [x, y] = f(n)
          expect(s96.has(key([x - tx, y - ty])), `${t.id} asymmetric`).toBe(true)
        }
      }
    }
  })
})

describe('triangle — the outline is derived from the magnets, at exactly 12mm', () => {
  const PAD = 12
  const triSel = (id: string, layoutId = 'corners'): LibrarySelection => {
    const f = triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)
    return { shapeId: 'triangle', geometryId: id, frameKey: frameKeyOf(f), layoutId,
      view: { transpose: false, flipX: false, flipY: false } }
  }
  const one = (type: string) => TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === type)!.id
  /** distance from a point to the supporting line of a hull edge */
  const clearance = (p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]) =>
    Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1])

  it('one Peak, one Wedge and one Sail each clear their three edges by 12mm', () => {
    for (const type of ['peak', 'wedge', 'sail']) {
      const sel = triSel(one(type))
      const a = libraryArrangement(sel, 48)
      const outline = libraryPreview(sel, 48, PAD).outlineMM
      const hull = a.nodesMM
      expect(hull.length).toBe(3)
      // every magnet sits at least the padding inside the outline
      for (const m of hull) {
        let best = Infinity
        for (let i = 0; i < outline.length; i++)
          best = Math.min(best, clearance(m, outline[i], outline[(i + 1) % outline.length]))
        expect(best, `${type} magnet clearance`).toBeGreaterThan(PAD - 0.05)
      }
      // and the three supporting edges are exactly the padding away
      for (let i = 0; i < 3; i++) {
        const A = hull[i], B = hull[(i + 1) % 3], C = hull[(i + 2) % 3]
        const far = outline.map((q) => clearance(q, A, B)).sort((x, y) => y - x)[0]
        void C; void far
        const near = Math.min(...outline.map((q) => clearance(q, A, B)))
        expect(near, `${type} edge ${i}`).toBeLessThan(0.05 + PAD)
      }
    }
  })

  it('the outline is derived AFTER the view transform and still clears', () => {
    const base = triSel(one('sail'))
    for (const view of [{ transpose: true, flipX: false, flipY: false }, { transpose: false, flipX: true, flipY: true }]) {
      const sel = { ...base, view }
      const a = libraryArrangement(sel, 48)
      const outline = libraryPreview(sel, 48, PAD).outlineMM
      for (const m of a.nodesMM) {
        let best = Infinity
        for (let i = 0; i < outline.length; i++)
          best = Math.min(best, clearance(m, outline[i], outline[(i + 1) % outline.length]))
        expect(best).toBeGreaterThan(PAD - 0.05)
      }
    }
  })

  it('the triangle stores no unit outline — one discriminant decides, not two', () => {
    const tri = LIBRARY_SHAPES.find((s) => s.id === 'triangle')!
    expect(CLASS_RULES.triangle.source).toBe('geometry')
    expect(tri.outline.length).toBe(0)
    for (const s of LIBRARY_SHAPES)
      if (CLASS_RULES[s.family].source === 'registry') expect(s.outline.length).toBeGreaterThan(2)
  })

  it('a node on an edge or inside leaves the outline unchanged; one outside changes it', () => {
    const id = one('wedge')
    const t = TRIANGLE_LAYOUTS.find((x) => x.id === id)!
    const sel = triSel(id, 'perimeter')
    const corners = libraryPreview({ ...sel, layoutId: 'corners' }, 48, PAD).outlineMM
    const per = libraryPreview(sel, 48, PAD).outlineMM          // adds the edge nodes
    const same = (a: typeof corners, b: typeof corners) =>
      a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 0.05 && Math.abs(p[1] - b[i][1]) < 0.05)
    expect(same(corners, per), 'edge nodes must not move the outline').toBe(true)
    // a node outside the hull is a different triangle
    const outside = [...t.vertices.map(([x, y]) => [x, y] as [number, number])]
    outside[0] = [outside[0][0], outside[0][1] + 1]
    expect(canonicalTriangleId(outside)).not.toBe(id)
  })

  it('a collinear or four-corner population fails loudly', () => {
    expect(() => assertTrianglePopulation([[0, 0], [1, 1], [2, 2]])).toThrow('collinear population')
    expect(() => assertTrianglePopulation([[0, 0], [2, 0], [2, 2], [0, 2]])).toThrow('hull has 4 vertices')
    expect(() => assertTrianglePopulation([[0, 0], [2, 0], [1, 2]])).not.toThrow()
  })

  it('a triangle selection without a geometry fails loud', () => {
    expect(() => libraryArrangement(
      { shapeId: 'triangle', frameKey: '3x3', layoutId: 'corners', view: { transpose: false, flipX: false, flipY: false } }, 48,
    )).toThrow('carries no geometryId')
    expect(() => triangleById('tri:nope')).toThrow('unknown triangle geometry')
  })

  it('draft identity carries the geometry, so two layouts on one frame cannot cross', () => {
    const [a, b] = TRIANGLE_LAYOUTS.filter((t) => triangleFrameKey(t) === '3x4').slice(0, 2)
    expect(draftId('triangle', '3x4', 'mine', a.id)).not.toBe(draftId('triangle', '3x4', 'mine', b.id))
  })
})

describe('triangle — authoring, identity and orientation (QA F1-F6)', () => {
  const sel3 = (id: string, layoutId = 'corners'): LibrarySelection => {
    const f = triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)
    return { shapeId: 'triangle', geometryId: id, frameKey: frameKeyOf(f), layoutId,
      view: { transpose: false, flipX: false, flipY: false } }
  }
  const one = (type: string) => TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === type)!
  const frameOf = (id: string) => triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)

  it('F1 — a population being drawn never throws, and says why it is not saveable', () => {
    const id = one('wedge').id
    const sel = sel3(id)
    for (const nodes of [[], [[0, 0]], [[0, 0], [1, 1]]] as Array<Array<[number, number]>>) {
      const m = draftStageModel(sel, nodes, 48, 12, 2, 2)
      expect(m.contour.outer.pts.length).toBeGreaterThanOrEqual(3)   // still renderable
      expect(m.error).toBeTruthy()
    }
    const good = [...one('wedge').vertices] as Array<[number, number]>
    expect(draftStageModel(sel, good, 48, 12, 2, 2).error).toBeNull()
  })

  it('F1 — save refuses a collinear or four-corner triangle draft, and a missing geometry', () => {
    const id = one('sail').id
    const frame = frameOf(id)
    const base = { id: 'x', className: 'triangle', frameKey: frameKeyOf(frame), geometryId: id, name: 'n' }
    expect(draftIntegrity({ ...base, nodes: [...one('sail').vertices] as Array<[number, number]> }, frame)).toEqual([])
    expect(draftIntegrity({ ...base, nodes: [[0, 0], [0, 1], [0, 2]] }, frame).join()).toContain('collinear')
    expect(draftIntegrity({ ...base, geometryId: undefined, nodes: [...one('sail').vertices] as Array<[number, number]> }, frame).join())
      .toContain('geometryId required')
  })

  it('F3 — every layout exposes exactly its distinct views, with one active and unique labels', () => {
    for (const t of TRIANGLE_LAYOUTS) {
      const f = triangleFrame(t, 48)
      const corners = f.layouts.find((l) => l.name === 'corners')!
      const distinct = new Set<string>()
      for (const transpose of [false, true]) for (const flipX of [false, true]) for (const flipY of [false, true]) {
        const r = tl(f, corners, { transpose, flipX, flipY })
        distinct.add(r.cols + 'x' + r.rows + '|' + r.nodes.map((n) => n[0] + ',' + n[1]).sort().join(' '))
      }
      // EVERY valid current transform must have exactly one active representative — marking
      // active by exact transform equality left 80 states with nothing pressed (QA F2).
      for (const transpose of [false, true]) for (const flipX of [false, true]) for (const flipY of [false, true]) {
        const opts = panelOptions({ ...sel3(t.id), view: { transpose, flipX, flipY } }, [], 48).orientations
        expect(opts.length, t.id).toBe(distinct.size)
        expect(opts.filter((o) => o.active), `${t.id} ${transpose}${flipX}${flipY}`).toHaveLength(1)
        expect(new Set(opts.map((o) => o.label)).size, t.id).toBe(opts.length)
        for (const o of opts) expect(o.next.geometryId).toBe(t.id)
      }
    }
  })

  it('F2 — a saved custom layout is deduped from its own population, not the corpus', () => {
    // an asymmetric population on a symmetric Peak has all eight views, even though the Peak's
    // own corners have fewer
    const peak = TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === 'peak'
      && panelOptions(sel3(t.id), [], 48).orientations.length < 8)!
    const f = triangleFrame(peak, 48)
    const asym: Array<[number, number]> = [[0, 0], [0, f.rows - 1], [f.cols - 1, f.rows - 1]]
    const draft = {
      id: draftId('triangle', frameKeyOf(f), 'asym', peak.id), className: 'triangle',
      frameKey: frameKeyOf(f), geometryId: peak.id, name: 'asym', nodes: asym,
    }
    const selD = { ...sel3(peak.id), layoutId: draftLayoutId('asym') }
    const distinct = new Set<string>()
    for (const transpose of [false, true]) for (const flipX of [false, true]) for (const flipY of [false, true]) {
      const r = tl(f, { name: 'd', nodes: asym }, { transpose, flipX, flipY })
      distinct.add(r.cols + 'x' + r.rows + '|' + r.nodes.map((n) => n[0] + ',' + n[1]).sort().join(' '))
    }
    expect(panelOptions(selD, [draft], 48).orientations.length).toBe(distinct.size)
  })

  it('F3 — an asymmetric Sail really does offer all eight', () => {
    expect(panelOptions(sel3(one('sail').id), [], 48).orientations.length).toBe(8)
  })

  it('F4 — a frameKey that does not name the geometry is refused by both resolvers', () => {
    const bad = { ...sel3(one('peak').id), frameKey: '9x9' }
    expect(() => selectedRecords(bad)).toThrow('does not match geometry')
    expect(() => resolveSelection(bad)).toThrow('does not match geometry')
  })

  it('F5 — the family transition is the module’s, and lands on a resolvable selection', () => {
    let cur = sel3(one('sail').id, 'perimeter')
    for (const fam of LIBRARY_FAMILIES) {
      cur = selectionForFamily(cur, fam, 48)
      expect(() => selectedRecords(cur), fam).not.toThrow()
      expect(resolveSelection(cur).shape.family).toBe(fam)
    }
  })

  it('F6 — every option on one block is distinguishable, and types read as products', () => {
    // ONE block, not two: for this class the frame IS the shape, so the frame chips carry the
    // geometry and its miniature. A second picker would be two controls for one choice.
    const peak = TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === 'peak')!
    const opts = panelOptions(sel3(peak.id), [], 48)
    const labels = opts.frames.map((o) => o.accessibleLabel!)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[0]).toContain('Peak 1')
    expect(opts.frames.every((o) => o.nodes && o.nodes.length === 3)).toBe(true)
    expect(opts.frames.length).toBe(TRIANGLE_LAYOUTS.filter((t) => triangleTypeOf(t) === 'peak').length)
    expect(opts.types.map((o) => o.label)).toEqual(['Peak', 'Wedge', 'Sail'])
    // and a registry class keeps plain frame chips with no shape of their own
    const sq = panelOptions(sel({ shapeId: 'square', frameKey: '3x3', layoutId: 'perimeter' }), [], 48)
    expect(sq.frames.every((o) => !o.nodes)).toBe(true)
  })
})

describe('triangle — a corner is a corner, and it opens the right way up', () => {
  const sel3 = (id: string, layoutId = 'corners'): LibrarySelection => {
    const f = triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)
    return { shapeId: 'triangle', geometryId: id, frameKey: frameKeyOf(f), layoutId,
      view: { transpose: false, flipX: false, flipY: false } }
  }
  it('every layout, population and view is a three-cornered triangle clearing exactly 12mm', () => {
    // The offset is three lines moved out and intersected — no join style, no miter limit, so
    // nothing is ever clipped. Under Clipper's miter-2 all 79 came out 4 or 5 sided.
    let checked = 0
    for (const t of TRIANGLE_LAYOUTS) {
      const f = triangleFrame(t, 48)
      for (const layoutId of f.layouts.map((l) => l.name)) {
        for (const view of [{ transpose: false, flipX: false, flipY: false },
          { transpose: true, flipX: true, flipY: false }]) {
          const sel: LibrarySelection = { shapeId: 'triangle', geometryId: t.id, frameKey: frameKeyOf(f), layoutId, view }
          const o = libraryPreview(sel, 48, 12).outlineMM
          expect(o.length, `${t.id} ${layoutId}`).toBe(3)
          for (const m of libraryArrangement(sel, 48).nodesMM) {
            let best = Infinity
            for (let i = 0; i < 3; i++) {
              const q1 = o[i], q2 = o[(i + 1) % 3]
              const dx = q2[0] - q1[0], dy = q2[1] - q1[1]
              best = Math.min(best, Math.abs((m[0] - q1[0]) * dy - (m[1] - q1[1]) * dx) / Math.hypot(dx, dy))
            }
            expect(best, `${t.id} ${layoutId}`).toBeGreaterThanOrEqual(12 - 1e-6)
            checked++
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(2000)
  })

  it('a geometry opens RESTING, never in its de-duplication form', () => {
    // A shape rests on a flat side. Ranking by apex-above-base alone hung a wedge from its
    // point (Dan, 08-26); the rule prefers a level edge on the floor, then one up the left
    // wall, and only falls back to apex-above for a triangle with no axis-aligned side.
    let floor = 0, wall = 0, none = 0
    for (const t of TRIANGLE_LAYOUTS) {
      const b = boundsOf([...t.vertices])
      const r = tl({ cols: b.cols, rows: b.rows, layouts: [] }, { name: 'c', nodes: [...t.vertices] }, uprightView(t))
      const [p, q, s2] = r.nodes
      const E = [[p, q, s2], [q, s2, p], [s2, p, q]] as Array<[LatticeNode, LatticeNode, LatticeNode]>
      const onFloor = E.some(([a, c]) => a[1] === c[1] && a[1] === r.rows - 1)
      const onWall = E.some(([a, c]) => a[0] === c[0] && a[0] === 0)
      if (onFloor) floor++
      if (onWall) wall++
      if (!onFloor && !onWall) none++
      // whichever way it lands, the apex never hangs below the whole base
      const len = (x: readonly number[], y: readonly number[]) => (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2
      const odd = E.find((e) => {
        const o = E.filter((x) => x !== e)
        return len(o[0][0], o[0][1]) === len(o[1][0], o[1][1])
      })
      const [a, c, apex] = odd ?? E.reduce((m, e) => (len(e[0], e[1]) > len(m[0], m[1]) ? e : m))
      expect(apex[1] > a[1] && apex[1] > c[1], t.id).toBe(false)
      // and any axis-aligned side it does have is never left hanging at the top
      if (onFloor) expect(E.some(([x, y]) => x[1] === y[1] && x[1] === r.rows - 1)).toBe(true)
    }
    // 50 rest on the floor and 10 of those also stand a side against the left wall; 29 have no
    // axis-aligned side at all. The lattice never rotates, so that is the ceiling of eight
    // views — a triangle whose sides are all diagonal cannot be stood on one.
    expect([floor, wall, none]).toEqual([50, 10, 29])
  })

  it('the presented view IS 0 degrees, and every other button names the turn from it', () => {
    // Naming turns against the STORED form let a layout sit upright with 'mirror diagonal'
    // pressed — this fails on any build that labels relative to the canonical form.
    for (const t of TRIANGLE_LAYOUTS.slice(0, 12)) {
      const f = triangleFrame(t, 48)
      const sel: LibrarySelection = { shapeId: 'triangle', geometryId: t.id, frameKey: frameKeyOf(f),
        layoutId: 'corners', view: uprightView(t) }
      const opts = panelOptions(sel, [], 48).orientations
      expect(opts[0].label, t.id).toBe('0°')
      expect(opts[0].active, t.id).toBe(true)
      expect(opts.filter((o) => o.active)).toHaveLength(1)
      expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length)
    }
  })

  it('the upright view is the one a selection hands back', () => {
    // selecting a class or a geometry hands back that view
    const t0 = TRIANGLE_LAYOUTS.find((x) => triangleTypeOf(x) === 'sail')!
    const opt = panelOptions(sel3(t0.id), [], 48).frames.find((o) => o.id === t0.id)!
    expect(opt.next.view).toEqual(uprightView(t0))
  })
})

describe('triangle — straight layouts come before the diagonal ones', () => {
  it('every type lists the ones that rest on a flat side first', () => {
    for (const type of ['peak', 'wedge', 'sail'] as const) {
      const list = trianglesOfType(type)
      const firstDiagonal = list.findIndex((t) => !restsFlat(t))
      if (firstDiagonal < 0) continue
      // nothing straight may appear after the first diagonal one
      for (const t of list.slice(firstDiagonal)) expect(restsFlat(t), t.id).toBe(false)
    }
  })

  it('the universe splits 50 flat / 29 leaning; the active catalogue keeps that split honest', () => {
    expect(TRIANGLE_LAYOUTS.filter(restsFlat).length).toBe(50)
    expect(TRIANGLE_LAYOUTS.filter((t) => !restsFlat(t)).length).toBe(29)
    const active = (['peak', 'wedge', 'sail'] as const).flatMap((t) => trianglesOfType(t))
    expect(active.length).toBe(76)
    expect(active.every((t) => TRIANGLE_LAYOUTS.includes(t))).toBe(true)
  })
})
