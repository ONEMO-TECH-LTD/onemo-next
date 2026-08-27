// Layout-library module + bridge — corpus completeness, classifier goldens, integrity,
// bridge mapping (QA F3: tests must FAIL when any required shape/frame/layout
// is removed; never a point-count oracle).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { LIBRARY_FAMILIES, specOf } from '../library/class-registry'
import { registryIntegrity } from '../library/integrity'
import { SPACING_MODES, sample96 } from '../library/rules'
import { transformLayout, frameKeyOf, canonicalNode, transformLayout as tl } from '../library/transforms'
import { resolveSelection, selectVariant, draftLayoutId } from '../library/selection'
import { TRIANGLE_LAYOUTS } from '../library/corpus-triangle'
import { triangleGeometry, canonicalTriangleId, perimeterRuns, perimeterNodes, fullNodes, boundsOf, selfSymmetries, D4, assertTrianglePopulation, type LatticeNode, type TriangleLayout } from '../library/triangle-geometry'
import { triangleById, triangleFrame, trianglePerimeter96 } from '../library/triangle-frames'
import { TRIANGLE_TYPES, triangleTypeOf, uprightView, trianglesOfType, restsFlat, isActive } from '../library/triangle-types'
import { draftId, draftIntegrity, type LibraryDraft } from '../library/drafts'
import { panelOptionsResolved, selectionForFamily, type PanelOption } from '../library/options'
import { startAdd, startEdit, saveEdit, deleteEdit, toggleNodeAt, type LibraryEdit } from '../library/authoring'
import { materializeSelection, materializeResolved } from '../library/materialize'
import { librarySurface } from '../library/surface'
import { catalogue } from '../library/catalogue'
import type { LibraryFrame, LibrarySelection } from '../library/types'
import { SQUARE_FRAMES } from '../library/corpus-square'
import { RECTANGLE_FRAMES } from '../library/corpus-rectangle'
import { DIAMOND_FRAMES } from '../library/corpus-diamond'
import { libraryStageModel } from '../grid-magnet-library-bridge'
import { classifyShape } from '../grid-magnet-class'
import { MANUFACTURING_TOLERANCE_MM } from '../geometry-truth'
import { convexHull } from '../library/geometry'

/** The library states its own millimetres as readonly pairs; the engine's classifiers take
 *  mutable Pt. Converting is the BRIDGE's whole job, so a test that calls an engine classifier
 *  converts here too rather than the library loosening its own type. */
const enginePts = (ps: ReadonlyArray<readonly [number, number]>): Array<[number, number]> =>
  ps.map((p) => [p[0], p[1]])

const libraryArrangement = (selection: LibrarySelection, pitchMM: number) =>
  materializeSelection(selection, pitchMM)
const libraryPreview = (selection: LibrarySelection, pitchMM: number) => materializeSelection(selection, pitchMM)
const panelOptionsFor = (selection: LibrarySelection, drafts: readonly LibraryDraft[] = [], pitchMM: number) =>
  panelOptionsResolved(selection, drafts, pitchMM, resolveSelection(selection, drafts, pitchMM))
const materializeDraftResolved = (
  selection: LibrarySelection, nodes: ReadonlyArray<readonly [number, number]>, pitchMM: number,
  drafts: readonly LibraryDraft[] = [],
) => materializeResolved(resolveSelection(selection, drafts, pitchMM), nodes, pitchMM)

const FRAME_KEYS = ['1x1', '2x2', '3x3', '4x4', '5x5']
const framesAt = (classId: string, pitchMM: number) => {
  const spec = specOf(classId)
  return spec.types.flatMap((type) => spec.variants(type.id, pitchMM).map((variant) => variant.frame))
}
const sel = (over: Partial<LibrarySelection> = {}): LibrarySelection => ({
  classId: 'square', frameKey: '3x3', layoutId: 'perimeter',
  view: { transpose: false, flipX: false, flipY: false }, ...over,
})

describe('corpus completeness — removal must fail these', () => {
  it('exactly the five canonical square frame keys', () => {
    expect(SQUARE_FRAMES.map(frameKeyOf).sort()).toEqual([...FRAME_KEYS].sort())
  })
  it('exactly 16 square layouts as the panel and the pipeline see them', () => {
    // 12 literal semantic populations in the corpus + the 4 computed 96mm modes.
    expect(SQUARE_FRAMES.reduce((n, f) => n + f.layouts.length, 0)).toBe(12)
    expect(framesAt('square', 48).reduce((n, f) => n + f.layouts.length, 0)).toBe(16)
  })
  it('square class: every frame is even, 1x1..5x5, square kind', () => {
    const seen = new Set<string>()
    for (const f of SQUARE_FRAMES) { expect(f.cols).toBe(f.rows); seen.add(f.cols + 'x' + f.rows) }
    for (const n of [1, 2, 3, 4, 5]) expect(seen.has(n + 'x' + n)).toBe(true)
  })
})

describe('classifier goldens — library and engine taxonomies stay distinct', () => {
  it('QA F1 golden: the outline CLASSIFIES as the selected/transformed frame (compatible pairs)', () => {
    for (const family of ['square', 'rectangle'] as const) for (const f of framesAt(family, 48)) {
      // The engine classifier tops out at 5 magnet lines per axis (bands B1-B5), so a 6-line
      // library frame has no class to be read back as. The library carries it; the classifier
      // cannot express it until a sixth band is ruled.
      if (f.cols > 5 || f.rows > 5) continue
      for (const transpose of [false, true]) {
        const cols = transpose ? f.rows : f.cols, rows = transpose ? f.cols : f.rows
        if (family === 'square' && cols !== rows) continue
        const pv = libraryPreview(sel({ classId: family, frameKey: frameKeyOf(f), layoutId: f.layouts[0].name, view: { transpose, flipX: false, flipY: false } }), 48)
        const c = classifyShape(enginePts(pv.outlineMM), 48)
        expect([c.cx, c.cy], `${family} on ${frameKeyOf(f)}${transpose ? ' T' : ''}`).toEqual([cols, rows])
      }
    }
  })
  it('QA F1 counterexamples: 1x1 spans 24mm and 3x3 spans 120x120mm — never one class larger', () => {
    const a1 = libraryPreview(sel({ classId: 'square', frameKey: '1x1', layoutId: 'single' }), 48)
    const xs = a1.outlineMM.map((q) => q[0]), ys = a1.outlineMM.map((q) => q[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(24, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(24, 6)
    const a2 = libraryPreview(sel({ classId: 'square', frameKey: '3x3', layoutId: 'perimeter' }), 48)
    const xs2 = a2.outlineMM.map((q) => q[0]), ys2 = a2.outlineMM.map((q) => q[1])
    expect(Math.max(...xs2) - Math.min(...xs2)).toBeCloseTo(120, 6)
    expect(Math.max(...ys2) - Math.min(...ys2)).toBeCloseTo(120, 6)
  })
})

describe('data integrity + transforms', () => {
  it('unique frames/names, in-bounds unique nodes, no empties', () => {
    expect(registryIntegrity()).toEqual([])
  })
  it('integrity rejects every corrupted variant class at every pitch', () => {
    const spec = specOf('square')
    const original = spec.variants
    const frame: LibraryFrame = {
      cols: 1, rows: 1, layouts: [
        { name: 'duplicate', nodes: [[0, 0], [0, 0], [1, 0]] as const },
        { name: 'duplicate', nodes: [] },
      ],
    }
    const variant = { ...original('box', 48)[0], id: 'duplicate', frame }
    const spy = vi.spyOn(spec, 'variants').mockImplementation(() => [variant, variant])
    try {
      expect(registryIntegrity()).toEqual(expect.arrayContaining([
        expect.stringContaining('duplicate variant id'),
        expect.stringContaining('duplicate layout name'),
        expect.stringContaining('duplicate node'),
        expect.stringContaining('node out of bounds'),
        expect.stringContaining('empty layout'),
      ]))
    } finally {
      spy.mockRestore()
    }
  })
  it('integrity rejects a type with no variants at every pitch', () => {
    const spec = specOf('square')
    const spy = vi.spyOn(spec, 'variants').mockImplementation(() => [])
    try {
      const errors = registryIntegrity()
      for (const pitchMM of [24, 48, 96])
        expect(errors).toContain('square box @' + pitchMM + ': no variants')
    } finally {
      spy.mockRestore()
    }
  })
  it('registry drafts fail bounds and duplicate checks before save at every pitch', () => {
    for (const classId of ['square', 'rectangle', 'diamond'] as const) {
      const spec = specOf(classId)
      for (const pitchMM of [24, 48, 96]) {
        const selection = spec.open(sel(), pitchMM)
        const frame = spec.variantOf(selection, pitchMM).frame
        const records = [
          {
            edit: { name: 'outside', nodes: [[frame.cols, 0]] as Array<[number, number]> },
            error: 'node out of frame: ' + frame.cols + ',0',
          },
          {
            edit: { name: 'duplicate', nodes: [[0, 0], [0, 0]] as Array<[number, number]> },
            error: 'duplicate node 0,0',
          },
        ]
        for (const { edit, error } of records) {
          const draft: LibraryDraft = {
            id: 'draft:' + classId + ':' + selection.frameKey + ':' + edit.name,
            className: classId, frameKey: selection.frameKey, name: edit.name, nodes: edit.nodes,
          }
          expect(draftIntegrity(draft, frame), classId + ' @' + pitchMM).toContain(error)
          expect(saveEdit(selection, [], edit, pitchMM)).toEqual({ ok: false, error })
        }
      }
    }
  })
  it('transform closure keeps nodes in bounds', () => {
    for (const family of LIBRARY_FAMILIES) for (const f of framesAt(family, 48)) for (const l of f.layouts)
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

describe('one resolved population at every caller', () => {
  it('surface, catalogue, and bridge preserve each class variant at every pitch', () => {
    for (const classId of LIBRARY_FAMILIES) {
      const spec = specOf(classId)
      for (const pitchMM of [24, 48, 96]) {
        const opened = spec.open(sel(), pitchMM)
        const entries = catalogue(pitchMM)
        for (const type of spec.types) for (const variant of spec.variants(type.id, pitchMM)) {
          const selected = selectVariant(opened, variant)
          for (const layout of variant.frame.layouts) {
            const selection = { ...selected, layoutId: layout.name }
            const expected = materializeSelection(selection, pitchMM)
            const surface = librarySurface(selection, [], null, pitchMM).materialized
            const id = [classId, type.id, variant.id, layout.name,
              selection.view.transpose ? 't' : 'n', selection.view.flipX ? 'x' : 'n', selection.view.flipY ? 'y' : 'n',
            ].map(encodeURIComponent).join('/')
            const entry = entries.find((item) => item.id === id)
            expect(surface, id).toStrictEqual(expected)
            expect(entry, id).toBeDefined()
            expect(entry!.nodesMM, id).toStrictEqual(expected.nodesMM)
            expect(entry!.outlineMM, id).toStrictEqual(expected.outlineMM)
            expect(entry!.widthMM, id).toBe(expected.widthMM)
            expect(entry!.heightMM, id).toBe(expected.heightMM)
            expect(entry!.frameCols, id).toBe(expected.frameCols)
            expect(entry!.frameRows, id).toBe(expected.frameRows)
            const stage = libraryStageModel(expected, pitchMM)
            expect(stage.contour.outer.pts, id).toStrictEqual(expected.outlineMM)
            expect(stage.grid.anchors.map((anchor) => anchor.p), id).toStrictEqual(expected.nodesMM)
          }
        }
      }
    }
  })
  it('librarySurface resolves its active variant exactly once', () => {
    const spec = specOf('square')
    const spy = vi.spyOn(spec, 'variantOf')
    try {
      librarySurface(sel(), [], null, 48)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })
  it('every class rejects an unknown type at every pitch', () => {
    for (const classId of LIBRARY_FAMILIES) for (const pitchMM of [24, 48, 96])
      expect(() => specOf(classId).variants('nope', pitchMM)).toThrow('unknown typeId nope in ' + classId)
  })
})

describe('bridge — stable IDs, wrapGroup-ready arrangement, Stage composition', () => {
  it('arrangement carries stable IDs and mm nodes', () => {
    const a = libraryArrangement(sel(), 48)
    expect(a).toMatchObject({ sourceFrameKey: '3x3', frameKey: '3x3', layoutId: 'perimeter', frameCols: 3, frameRows: 3 })
    expect(libraryPreview(sel(), 48)).toMatchObject({ classId: 'square' })
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
    const m = libraryStageModel(librarySurface(sel(), [], null, 48).materialized, 48)
    expect(m.grid.anchors.length).toBe(8)
    expect(m.grid.pitchCentreMM).toBe(48)
    expect(m.grid.spotRadiusMM).toBe(12)
    expect(m.grid.lattice).toEqual([[0, 96]])
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
      const names = framesAt('square', 48).find((x) => x.cols === f.cols && x.rows === f.rows)!.layouts.map((l) => l.name)
      expect(names).toContain('perimeter')
      expect(names).toContain('perimeter-96')
    }
  })
})

describe('rectangle class', () => {
  it('carries exactly its ruled frames', () => {
    expect(framesAt('rectangle', 48).map(frameKeyOf).sort()).toEqual(['1x2', '1x3', '1x4', '1x5', '2x3', '2x4', '2x5', '3x4', '3x5', '4x5', '4x6', '5x6'].sort())
  })
  it('every frame offers a perimeter, and only 3+ line frames carry an interior full', () => {
    for (const f of framesAt('rectangle', 48)) {
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
    expect(framesAt('diamond', 48).map(frameKeyOf)).toEqual(['1x1', '3x3', '5x5', '7x7'])
  })
  it('uses the SHARED layout vocabulary — full / perimeter / perimeter-96 / corners', () => {
    for (const f of framesAt('diamond', 48).slice(1)) {
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
    for (const f of framesAt('diamond', 48)) {
      const k = (f.cols - 1) / 2
      const pv = libraryPreview({ classId: 'diamond', frameKey: frameKeyOf(f), layoutId: f.layouts[0].name, view: { transpose: false, flipX: false, flipY: false } }, 48)
      const xs = pv.outlineMM.map((q) => q[0])
      const span = Math.max(...xs) - Math.min(...xs)
      expect(Math.abs(span - 2 * (k * 48 + 12 * Math.SQRT2))).toBeLessThanOrEqual(MANUFACTURING_TOLERANCE_MM)
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
    const r = resolveSelection(sel({ classId: 'diamond', frameKey: '1x1', layoutId: 'perimeter' }), [], 48)
    expect(r.frame.layouts.some((l) => l.name === r.safeSel.layoutId)).toBe(true)
    expect(() => materializeSelection(r.safeSel, 48)).not.toThrow()
  })

  it('unknown shape or frame is a caller bug — both resolvers refuse it (QA F4)', () => {
    // Guessing here produced a 'safeSel' that still carried the bad classId and threw when the
    // pipeline resolved it. Only the LAYOUT is carried across frames, by design.
    expect(() => resolveSelection(sel({ classId: 'nope' as never }), [], 48)).toThrow('unknown classId')
    expect(() => resolveSelection(sel({ frameKey: '9x9' }), [], 48)).toThrow('unknown frameKey')
  })

  it('the strict materializer still refuses the same input — the two are not merged', () => {
    expect(() => materializeSelection(sel({ classId: 'diamond', frameKey: '1x1', layoutId: 'perimeter' }), 48)).toThrow('unknown layoutId')
    expect(() => materializeSelection(sel({ frameKey: '9x9' }), 48)).toThrow('unknown frameKey')
  })

  it('a draft identity resolves only for its own class AND frame AND name', () => {
    const ds = [draft()]
    const hit = resolveSelection(sel({ classId: 'square', frameKey: '3x3', layoutId: draftLayoutId('mine') }), ds, 48)
    expect(hit.draft?.id).toBe('draft:square:3x3:mine')
    expect(() => resolveSelection(
      sel({ classId: 'diamond', frameKey: '3x3', layoutId: draftLayoutId('mine') }), ds, 48,
    )).toThrow('unknown draft mine in 3x3')
    expect(() => resolveSelection(
      sel({ classId: 'square', frameKey: '4x4', layoutId: draftLayoutId('mine') }), ds, 48,
    )).toThrow('unknown draft mine in 4x4')
  })

  it('a draft selection still hands the bridge a real corpus layout', () => {
    const r = resolveSelection(sel({ classId: 'square', frameKey: '3x3', layoutId: draftLayoutId('mine') }), [draft()], 48)
    expect(r.safeSel.layoutId).toBe(r.frame.layouts[0].name)
    expect(() => materializeSelection(r.safeSel, 48)).not.toThrow()
  })

  it('a draft identity that no longer exists fails loudly', () => {
    expect(() => resolveSelection(
      sel({ classId: 'square', frameKey: '3x3', layoutId: draftLayoutId('deleted') }), [], 48,
    )).toThrow('library: unknown draft deleted in 3x3')
  })
})

describe('the 96mm spacing mode is computed policy, one rule for every class', () => {
  const key = (n: readonly [number, number]) => n[0] + ',' + n[1]
  it('the corpus stores no 96mm population — it is derived, never hand-written', () => {
    for (const frames of [SQUARE_FRAMES, RECTANGLE_FRAMES, DIAMOND_FRAMES])
      for (const f of frames) expect(f.layouts.map((l) => l.name)).not.toContain('perimeter-96')
  })

  it('a frame with a perimeter always offers the 96mm mode, and it is a subset of that perimeter', () => {
    for (const fam of LIBRARY_FAMILIES) for (const f of framesAt(fam, 48)) {
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
    for (const fam of LIBRARY_FAMILIES) for (const f of framesAt(fam, 48)) {
      const s96 = f.layouts.find((l) => l.name === 'perimeter-96')
      if (!s96) continue
      const got = new Set(s96.nodes.map(key))
      const per = f.layouts.find((l) => l.name === 'perimeter')!
      for (const e of convexHull(per.nodes))
        expect(got.has(key(e)), `${fam} ${frameKeyOf(f)} missing ${key(e)}`).toBe(true)
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

  it('the panel and the canvas see the SAME magnets, at every pitch, for every class', () => {
    // The 96mm population is a physical distance, so it depends on the pitch. Composing it once
    // at 48 and repairing it at draw time meant every reader BEFORE the repair — the resolver,
    // the option layer, the orientation dedupe — counted a different set from the one on
    // screen: 28 shapes disagreed at 24mm and 96mm. Nothing visibly broke only because those
    // classes are symmetric.
    let checked = 0
    for (const fam of LIBRARY_FAMILIES) {
      const spec = specOf(fam)
      for (const pitch of [24, 48, 96]) {
        const open = spec.open(sel(), pitch)
        for (const t of spec.types) for (const v of spec.variants(t.id, pitch)) {
          for (const layout of v.frame.layouts) {
            const s = { ...selectVariant(open, v), layoutId: layout.name }
            const drawn = materializeSelection(s, pitch)
            const transformed = transformLayout(v.frame, layout, s.view)
            const expected = transformed.nodes.map(([x, y]) =>
              [x * pitch, (transformed.rows - 1 - y) * pitch] as const)
            expect(drawn.nodesMM, `${fam} ${v.id} ${layout.name} @${pitch}`).toEqual(expected)
            checked++
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200)
  })

  it('the population follows the pitch tier, and the label does not (Dan: 96 is fixed)', () => {
    const at = (p: number) => framesAt('square', p).find((x) => x.cols === 5)!
      .layouts.find((l) => l.name === 'perimeter-96')!.nodes.length
    expect([at(24), at(48), at(96)]).toEqual([4, 8, 16])
    expect(SPACING_MODES.map((m) => m.label)).toEqual(['48 mm', '96 mm'])
  })

  it('a non-divisible ring pairs instead of leaning — square 4x4 exactly', () => {
    // Walked clockwise, each side indexes from its own start, so the short closing interval
    // lands as four balanced adjacent pairs rather than biased to one absolute direction.
    const f = framesAt('square', 48).find((x) => x.cols === 4)!
    const got = f.layouts.find((l) => l.name === 'perimeter-96')!.nodes.map(key).sort()
    expect(got).toEqual(['0,0', '0,1', '0,3', '1,3', '2,0', '3,0', '3,2', '3,3'].sort())
  })

  it('every square 96 population is closed under a quarter turn', () => {
    for (const f of framesAt('square', 48).filter((x) => x.cols > 1)) {
      const s96 = f.layouts.find((l) => l.name === 'perimeter-96')
      if (!s96) continue
      const got = new Set(s96.nodes.map(key))
      for (const [x, y] of s96.nodes)
        expect(got.has(key([f.rows - 1 - y, x])), `${frameKeyOf(f)} rotate ${key([x, y])}`).toBe(true)
    }
  })

  it('the ruled populations follow from that one rule', () => {
    const n96 = (fam: 'square' | 'rectangle' | 'diamond', c: number, r: number) =>
      framesAt(fam, 48).find((f) => f.cols === c && f.rows === r)!
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
    for (const f of framesAt('diamond', 48).slice(1)) {
      const names = f.layouts.map((l) => l.name)
      for (const n of ['full', 'perimeter', 'perimeter-96', 'corners']) expect(names, frameKeyOf(f)).toContain(n)
      const corners = f.layouts.find((l) => l.name === 'corners')!
      const perimeter = f.layouts.find((l) => l.name === 'perimeter')!
      expect(corners.nodes.map(key).sort()).toEqual(convexHull(perimeter.nodes).map(key).sort())
    }
  })
})

describe('authoring under a view transform stays canonical (QA F2)', () => {
  const frame = framesAt('rectangle', 48).find((f) => f.cols === 2 && f.rows === 3)!
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

  it('the universe stays 79; every active layout has exactly one named type', () => {
    // Grouping is derived from the presented shape; Dan's retirements take shapes out of the
    // PRODUCT — three on 08-26 08:11, then the nine tilted symmetric ones. The universe
    // underneath never changes, so every retirement stays reversible and the review survives.
    expect(TRIANGLE_LAYOUTS.length).toBe(79)
    expect(TRIANGLE_LAYOUTS.filter(isActive).length).toBe(24)
    // every active layout lands in exactly one named type, and no type is a dumping ground
    const byType = TRIANGLE_TYPES.map((t) => trianglesOfType(t))
    expect(byType.reduce((n, l) => n + l.length, 0)).toBe(24)
    expect(new Set(byType.flat().map((t) => t.id)).size).toBe(24)
    for (const l of byType) expect(l.length).toBeGreaterThan(0)
  })

  it('every retired layout is out of the product and still in the universe', () => {
    // 08-26 08:11 "remove these layouts" (the Wedge / 3x4 screen), then "remove slice it is
    // same as basic triangles just turned" (the nine symmetric shapes with no level side)
    for (const id of [
      'tri:0,0;0,3;2,0', 'tri:0,0;1,3;2,1', 'tri:0,0;1,3;2,2',
      'tri:0,0;3,4;4,3', 'tri:0,0;1,2;3,3', 'tri:0,0;2,3;3,2', 'tri:0,0;1,3;4,4', 'tri:0,0;1,2;2,1',
      'tri:0,0;2,4;4,2', 'tri:0,0;2,4;3,1', 'tri:0,0;1,3;3,1', 'tri:0,0;1,4;4,1',
    ]) {
      const t = TRIANGLE_LAYOUTS.find((x) => x.id === id)!
      expect(isActive(t), id).toBe(false)
      expect(([...TRIANGLE_TYPES] as const).some((k) => trianglesOfType(k).includes(t))).toBe(false)
    }
  })

  it('the retired vocabulary never reaches the UI, and no name is two words', () => {
    const first = TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === 'pyramid')!
    const ff = triangleFrame(first, 48)
    const labels = panelOptionsFor({ classId: 'triangle', geometryId: first.id, frameKey: frameKeyOf(ff),
      layoutId: 'corners', view: { transpose: false, flipX: false, flipY: false } }, [], 48)
      .types.map((o) => o.label)
    expect(labels).toEqual(['Pyramid', 'Arrowhead', 'Mountain', 'Needle', 'Wedge', 'Flag'])
    for (const l of labels) expect(l.includes(' '), l).toBe(false)
    expect(labels.join(' ')).not.toContain('retired-three-name-type')
  })

  it('the frame distribution of the universe is exactly the derived table', () => {
    const table: Record<string, [number, number, number]> = {
      '2x2': [0, 1, 0], '2x3': [0, 2, 1], '2x4': [0, 1, 3], '2x5': [1, 1, 4], '3x3': [2, 1, 1],
      '3x4': [1, 3, 5], '3x5': [1, 2, 9], '4x4': [3, 1, 4], '4x5': [1, 3, 14], '5x5': [5, 2, 7],
    }
    const got: Record<string, [number, number, number]> = {}
    for (const t of TRIANGLE_LAYOUTS) {
      const b = boundsOf([...t.vertices])
      const k = b.cols + 'x' + b.rows
      got[k] = got[k] ?? [0, 0, 0]
      // the universe's own distribution, by SCIENTIFIC class — those stay internal and fixed,
      // while the product grouping above them is Dan's to name and change
      const geo = triangleGeometry(t.vertices)
      got[k][geo.angleClass === 'right' ? 1 : geo.sideClass === 'isosceles' ? 0 : 2]++
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

  it('the scientific classification survives every transform', () => {
    // The product group is read from the PRESENTED view and may therefore differ between
    // orientations by design; what must never move is the geometry underneath it.
    for (const t of TRIANGLE_LAYOUTS) for (const f of D4F) {
      const a = triangleGeometry(t.vertices.map(f) as never), b = triangleGeometry(t.vertices)
      expect([a.sideClass, a.angleClass], t.id).toEqual([b.sideClass, b.angleClass])
    }
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

  it('a balanced symmetric type stays mirror-balanced — a non-divisible run cannot make it lean', () => {
    for (const t of TRIANGLE_LAYOUTS.filter((x) => triangleTypeOf(x) === 'pyramid')) {
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
    return { classId: 'triangle', geometryId: id, frameKey: frameKeyOf(f), layoutId,
      view: { transpose: false, flipX: false, flipY: false } }
  }
  const one = (type: string) => TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === type)!.id
  /** distance from a point to the supporting line of a hull edge */
  const clearance = (p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]) =>
    Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1])

  it('one active type representative each clears its three edges by 12mm', () => {
    for (const type of [...TRIANGLE_TYPES]) {
      const sel = triSel(one(type))
      const a = libraryArrangement(sel, 48)
      const outline = libraryPreview(sel, 48).outlineMM
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
    const base = triSel(one('flag'))
    for (const view of [{ transpose: true, flipX: false, flipY: false }, { transpose: false, flipX: true, flipY: true }]) {
      const sel = { ...base, view }
      const a = libraryArrangement(sel, 48)
      const outline = libraryPreview(sel, 48).outlineMM
      for (const m of a.nodesMM) {
        let best = Infinity
        for (let i = 0; i < outline.length; i++)
          best = Math.min(best, clearance(m, outline[i], outline[(i + 1) % outline.length]))
        expect(best).toBeGreaterThan(PAD - 0.05)
      }
    }
  })

  it('moving one corner changes the derived triangle outline', () => {
    const selection = triSel('tri:0,0;0,2;2,0', 'corners')
    const before = materializeDraftResolved(selection, [[0, 0], [0, 2], [2, 0]], 48)
    const after = materializeDraftResolved(selection, [[0, 0], [0, 2], [2, 1]], 48)
    expect(before.error).toBeNull(); expect(after.error).toBeNull()
    expect(after.outlineMM).not.toEqual(before.outlineMM)
  })

  it('a collinear or four-corner population fails loudly', () => {
    expect(() => assertTrianglePopulation([[0, 0], [1, 1], [2, 2]])).toThrow('collinear population')
    expect(() => assertTrianglePopulation([[0, 0], [2, 0], [2, 2], [0, 2]])).toThrow('hull has 4 vertices')
    expect(() => assertTrianglePopulation([[0, 0], [2, 0], [1, 2]])).not.toThrow()
  })

  it('a triangle selection without a geometry fails loud', () => {
    expect(() => libraryArrangement(
      { classId: 'triangle', frameKey: '3x3', layoutId: 'corners', view: { transpose: false, flipX: false, flipY: false } }, 48,
    )).toThrow('carries no geometryId')
    expect(() => triangleById('tri:nope')).toThrow('unknown triangle geometry')
  })

  it('draft identity carries the geometry, so two layouts on one frame cannot cross', () => {
    const [a, b] = TRIANGLE_LAYOUTS.filter((t) => frameKeyOf(triangleFrame(t, 48)) === '3x4').slice(0, 2)
    expect(draftId('triangle', '3x4', 'mine', a.id)).not.toBe(draftId('triangle', '3x4', 'mine', b.id))
  })
})

describe('triangle — authoring, identity and orientation (QA F1-F6)', () => {
  const sel3 = (id: string, layoutId = 'corners'): LibrarySelection => {
    const f = triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)
    return { classId: 'triangle', geometryId: id, frameKey: frameKeyOf(f), layoutId,
      view: { transpose: false, flipX: false, flipY: false } }
  }
  const one = (type: string) => TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === type)!
  const frameOf = (id: string) => triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)

  it('F1 — a population being drawn never throws, and says why it is not saveable', () => {
    const id = one('wedge').id
    const sel = sel3(id)
    for (const nodes of [[], [[0, 0]], [[0, 0], [1, 1]]] as Array<Array<[number, number]>>) {
      const m = librarySurface(sel, [], { name: '', nodes }, 48).materialized
      expect(m.outlineMM.length).toBeGreaterThanOrEqual(3)
      expect(m.error).toBeTruthy()
    }
    const good = [...one('wedge').vertices] as Array<[number, number]>
    expect(librarySurface(sel, [], { name: '', nodes: good }, 48).materialized.error).toBeNull()
  })

  it('F1 — save refuses a collinear or four-corner triangle draft, and a missing geometry', () => {
    const id = one('flag').id
    const frame = frameOf(id)
    const base = { id: 'x', className: 'triangle', frameKey: frameKeyOf(frame), geometryId: id, name: 'n' }
    expect(draftIntegrity({ ...base, nodes: [...one('flag').vertices] as Array<[number, number]> }, frame)).toEqual([])
    expect(draftIntegrity({ ...base, nodes: [[0, 0], [0, 1], [0, 2]] }, frame).join()).toContain('collinear')
    expect(draftIntegrity({ ...base, geometryId: undefined, nodes: [...one('flag').vertices] as Array<[number, number]> }, frame).join())
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
        const opts = panelOptionsFor({ ...sel3(t.id), view: { transpose, flipX, flipY } }, [], 48).orientations
        expect(opts.length, t.id).toBe(distinct.size)
        expect(opts.filter((o) => o.active), `${t.id} ${transpose}${flipX}${flipY}`).toHaveLength(1)
        expect(new Set(opts.map((o) => o.label)).size, t.id).toBe(opts.length)
        for (const o of opts) expect(o.next.geometryId).toBe(t.id)
      }
    }
  })

  it('F2 — a saved custom layout is deduped from its own population, not the corpus', () => {
    // an asymmetric population on a symmetric geometry has all eight views, even though its
    // own corners have fewer
    const peak = TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === 'pyramid'
      && panelOptionsFor(sel3(t.id), [], 48).orientations.length < 8)!
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
    expect(panelOptionsFor(selD, [draft], 48).orientations.length).toBe(distinct.size)
  })

  it('F3 — an asymmetric shape really does offer all eight turns', () => {
    // a scalene triangle has no symmetry of its own, so all eight lattice views are distinct
    expect(panelOptionsFor(sel3(one('flag').id), [], 48).orientations.map((o) => o.label)).toEqual(
      ['0°', '90°', '180°', '270°', 'mirror horizontal', 'mirror vertical',
        'mirror down-diagonal', 'mirror up-diagonal'])
  })

  it('a turn is named by the plainest transform that reaches it, and the row reads in order', () => {
    // Several transforms draw the same picture: a shape symmetric about its vertical axis is
    // flipped top-to-bottom by BOTH "mirror horizontal" and a 180 degree turn. Dan, 08-26:
    // "why orientation has 3 buttons with degrees and 1 mirror horizontal text button when
    // logical to just say 180?" — every symmetric class now reads as four plain turns.
    for (const type of TRIANGLE_TYPES) {
      const labels = panelOptionsFor(sel3(one(type).id), [], 48).orientations.map((o) => o.label)
      const turns = ['0°', '90°', '180°', '270°']
      expect(labels.slice(0, Math.min(4, labels.length)), type).toEqual(turns.slice(0, labels.length))
      // a mirror name appears only where no turn reaches that picture — never as a fifth way
      // of saying a turn already on the row
      expect(new Set(labels).size, type).toBe(labels.length)
    }
    // and a class with its own vocabulary keeps it
    const rect = selectionForFamily(sel(), 'rectangle', 48)
    expect(panelOptionsFor(rect, [], 48).orientations.map((o) => o.label)).toEqual(['portrait', 'landscape'])
  })

  it('F4 — a frameKey that does not name the geometry is refused by both resolvers', () => {
    const bad = { ...sel3(one('pyramid').id), frameKey: '9x9' }
    expect(() => materializeSelection(bad, 48)).toThrow('does not match geometry')
    expect(() => resolveSelection(bad, [], 48)).toThrow('does not match geometry')
  })

  it('F5 — the family transition is the module’s, and lands on a resolvable selection', () => {
    let cur = sel3(one('flag').id, 'perimeter')
    for (const fam of LIBRARY_FAMILIES) {
      cur = selectionForFamily(cur, fam, 48)
      expect(() => materializeSelection(cur, 48), fam).not.toThrow()
      expect(resolveSelection(cur, [], 48).classId).toBe(fam)
    }
  })

  it('F6 — every option on one block is distinguishable, and types read as products', () => {
    // ONE block, not two: for this class the frame IS the shape, so the frame chips carry the
    // geometry and its miniature. A second picker would be two controls for one choice.
    const peak = TRIANGLE_LAYOUTS.find((t) => triangleTypeOf(t) === 'pyramid')!
    const opts = panelOptionsFor(sel3(peak.id), [], 48)
    const labels = opts.frames.map((o) => o.accessibleLabel!)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[0]).toContain('Pyramid 1')
    expect(opts.frames.length).toBe(TRIANGLE_LAYOUTS.filter((t) => triangleTypeOf(t) === 'pyramid').length)
    expect(opts.types.map((o) => o.label)).toEqual(
      ['Pyramid', 'Arrowhead', 'Mountain', 'Needle', 'Wedge', 'Flag'])
  })

  it('F7 — no block, on any class, offers two chips that READ the same', () => {
    // F6 proved it for one block of one triangle type, which is why two orientation chips could
    // both read "mirror diagonal" and reach Dan's screen (08-27). Distinguishability is a law of
    // every block on every class, so it is checked over the whole registry, not one sample.
    let cur: LibrarySelection = sel3(one('flag').id, 'perimeter')
    for (const fam of LIBRARY_FAMILIES) {
      cur = selectionForFamily(cur, fam, 48)
      const spec = specOf(fam)
      for (const type of spec.types) for (const variant of spec.variants(type.id, 48)) {
        const opts = panelOptionsFor(selectVariant(cur, variant), [], 48)
        for (const [block, options] of Object.entries(opts) as Array<[string, PanelOption[]]>) {
          const reads = options.map((o) => o.label)
          expect(new Set(reads).size, fam + '/' + type.id + '/' + variant.id + '/' + block
            + ' reads: ' + reads.join(' | ')).toBe(reads.length)
        }
      }
    }
  })
})

describe('triangle — a corner is a corner, and it opens the right way up', () => {
  const sel3 = (id: string, layoutId = 'corners'): LibrarySelection => {
    const f = triangleFrame(TRIANGLE_LAYOUTS.find((t) => t.id === id)!, 48)
    return { classId: 'triangle', geometryId: id, frameKey: frameKeyOf(f), layoutId,
      view: { transpose: false, flipX: false, flipY: false } }
  }
  it('every layout, population and view is a three-cornered triangle clearing exactly 12mm', () => {
    // The shared sharp-outline producer must preserve the triangle's three supporting corners
    // while keeping every magnet at least the released padding inside them.
    let checked = 0
    for (const t of TRIANGLE_LAYOUTS) {
      const f = triangleFrame(t, 48)
      for (const layoutId of f.layouts.map((l) => l.name)) {
        for (const view of [{ transpose: false, flipX: false, flipY: false },
          { transpose: true, flipX: true, flipY: false }]) {
          const sel: LibrarySelection = { classId: 'triangle', geometryId: t.id, frameKey: frameKeyOf(f), layoutId, view }
          const o = libraryPreview(sel, 48).outlineMM
          expect(o.length, `${t.id} ${layoutId}`).toBe(3)
          for (const m of libraryArrangement(sel, 48).nodesMM) {
            let best = Infinity
            for (let i = 0; i < 3; i++) {
              const q1 = o[i], q2 = o[(i + 1) % 3]
              const dx = q2[0] - q1[0], dy = q2[1] - q1[1]
              best = Math.min(best, Math.abs((m[0] - q1[0]) * dy - (m[1] - q1[1]) * dx) / Math.hypot(dx, dy))
            }
            expect(best, `${t.id} ${layoutId}`).toBeGreaterThanOrEqual(12 - MANUFACTURING_TOLERANCE_MM)
            checked++
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(2000)
  })

  it('every triangle chip measures the one produced outline', () => {
    const spec = specOf('triangle')
    for (const type of spec.types) for (const variant of spec.variants(type.id, 48)) {
      const selection = { ...variant.selection, layoutId: variant.frame.layouts[0].name, view: variant.view }
      const outline = materializeSelection(selection, 48).outlineMM
      const xs = outline.map(([x]) => x), ys = outline.map(([, y]) => y)
      expect(variant.label, variant.id).toBe(
        Math.round(Math.max(...xs) - Math.min(...xs)) + '×'
        + Math.round(Math.max(...ys) - Math.min(...ys)),
      )
    }
  })

  it('a geometry opens RESTING, never in its de-duplication form', () => {
    // A shape rests on a flat side. Ranking by apex-above-base alone hung a wedge from its
    // point (Dan, 08-26); the rule prefers a level edge on the floor, then one up the left
    // wall, and only falls back to apex-above for a triangle with no axis-aligned side.
    let floor = 0, wall = 0, none = 0
    for (const t of TRIANGLE_LAYOUTS) {
      const b = boundsOf([...t.vertices])
      const r = tl({ cols: b.cols, rows: b.rows }, { name: 'c', nodes: [...t.vertices] }, uprightView(t))
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
      const sel: LibrarySelection = { classId: 'triangle', geometryId: t.id, frameKey: frameKeyOf(f),
        layoutId: 'corners', view: uprightView(t) }
      const opts = panelOptionsFor(sel, [], 48).orientations
      expect(opts[0].label, t.id).toBe('0°')
      expect(opts[0].active, t.id).toBe(true)
      expect(opts.filter((o) => o.active)).toHaveLength(1)
      expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length)
    }
  })

  it('the upright view is the one a selection hands back', () => {
    // selecting a class or a geometry hands back that view
    const t0 = trianglesOfType('flag')[0]
    const opt = panelOptionsFor(sel3(t0.id), [], 48).frames.find((o) => o.id === t0.id)!
    expect(opt.next.view).toEqual(uprightView(t0))
  })
})

describe('triangle — straight layouts come before the diagonal ones', () => {
  it('every type lists the ones that rest on a flat side first', () => {
    for (const type of [...TRIANGLE_TYPES] as const) {
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
    const active = ([...TRIANGLE_TYPES] as const).flatMap((t) => trianglesOfType(t))
    expect(active.length).toBe(24)
    // and no active shape is symmetric without a level side any more — that was the Slice tab
    expect(active.filter((t) => triangleGeometry(t.vertices).sideClass === 'isosceles' && !restsFlat(t)))
      .toEqual([])
    expect(active.every((t) => (TRIANGLE_LAYOUTS as readonly TriangleLayout[]).includes(t))).toBe(true)
  })
})

describe('triangle — every tab carries only its own kind', () => {
  const byId = (id: string) => TRIANGLE_LAYOUTS.find((t) => t.id === id)!
  /** The measurable form of each name, read on the view the shape is presented in. */
  const shown = (t: TriangleLayout) => {
    const b = boundsOf([...t.vertices])
    const r = tl({ cols: b.cols, rows: b.rows }, { name: 'c', nodes: [...t.vertices] }, uprightView(t))
    const [p, q, s] = r.nodes
    const E = [[p, q], [q, s], [s, p]] as Array<[LatticeNode, LatticeNode]>
    const g = triangleGeometry(t.vertices)
    return {
      sym: g.sideClass === 'isosceles', right: g.angleClass === 'right',
      scalene: g.sideClass === 'scalene',
      level: E.some(([a, c]) => a[1] === c[1]),
      upright: E.some(([a, c]) => a[0] === c[0]),
      aspect: Math.max(1, r.rows - 1) / Math.max(1, r.cols - 1),
    }
  }

  it('no tab contains a triangle alien to its name', () => {
    // Every name is a PROMISE about the shape as it is presented. This asserts each promise on
    // every member, so a shape can never sit under a name that does not describe it.
    const SYMMETRIC = ['pyramid', 'arrowhead', 'mountain', 'needle']
    const LEANING = ['flag']
    for (const type of TRIANGLE_TYPES) {
      for (const t of trianglesOfType(type)) {
        const m = shown(t)
        const why: string[] = []
        // a Wedge is a SQUARED CORNER — a right angle stood on a level side with an upright
        // side beside it, equal legs or not. A right angle presented any other way sits where
        // nobody reads it as a corner, and the shape is named by its silhouette like any other.
        const squared = m.right && m.level && m.upright
        if (type === 'wedge' && !squared) why.push('is not a squared corner')
        if (type !== 'wedge' && squared) why.push('is a squared corner')
        if (SYMMETRIC.includes(type) && !m.sym) why.push('is not symmetric')
        if (LEANING.includes(type) && m.sym) why.push('is symmetric')
        // every symmetric name stands on a base: Dan retired the tilted symmetric shapes
        if (SYMMETRIC.includes(type) && !m.level) why.push('has no level base')
        // the proportion each SYMMETRIC name promises. Nothing splits the leaning family by
        // proportion any more: the retired leaning categories were one family, cut by a
        // number, which is why the same shape read as one at one size and another at another.
        if (type === 'needle') expect(m.aspect, t.id).toBeGreaterThanOrEqual(2)
        if (type === 'arrowhead') { expect(m.aspect, t.id).toBeGreaterThan(1); expect(m.aspect, t.id).toBeLessThan(2) }
        if (type === 'pyramid') expect(m.aspect, t.id).toBe(1)
        if (type === 'mountain') expect(m.aspect, t.id).toBeLessThan(1)
        expect(why, `${type} <- ${t.id} ${why.join(', ')}`).toEqual([])
      }
    }
  })

  it('the named aliens stay out of the tabs that once held them', () => {
    // Frozen counterexamples, each one a shape that WAS under a name that did not fit it.
    // The tall spikes that were once filed as Ramps are out of the product altogether.
    expect(isActive(byId('tri:0,0;1,0;2,4'))).toBe(false)   // presented 3x5, point jutted 110mm
    expect(isActive(byId('tri:0,0;1,0;2,3'))).toBe(false)   // presented 3x4, point jutted  90mm
    // 08-26 09:0x Dan — "Mountain is missing 2 x 3". Right angle at the apex, resting on its
    // hypotenuse: a wide symmetric shape, not a squared corner.
    expect(triangleTypeOf(byId('tri:0,0;0,2;1,1'))).toBe('mountain')
    expect(triangleTypeOf(byId('tri:0,0;0,4;2,2'))).toBe('mountain')
    // 08-26 08:16 Dan — the 2x2 IS a Wedge: equal legs, squared corner
    expect(triangleTypeOf(byId('tri:0,0;0,1;1,0'))).toBe('wedge')
    // 08-26 Dan, on the same shape sitting under Pennant at 159x79mm: "how is the first
    // pennant?" — it is a squared corner, unequal legs and all, and it belongs with the others.
    expect(triangleTypeOf(byId('tri:0,0;0,2;1,0'))).toBe('wedge')
    // 08-26 Dan: "ramp has wedge option" — this one had fallen through into Ramp
    expect(triangleTypeOf(byId('tri:0,0;0,4;3,0'))).toBe('wedge')
    // and the seven he kept when the four leaning tabs went, named by their size on screen
    expect(trianglesOfType('flag').map((t) => t.id).sort()).toEqual([
      'tri:0,0;0,3;1,1', 'tri:0,0;0,3;2,1', 'tri:0,0;0,3;3,1', 'tri:0,0;0,4;2,1',
      'tri:0,0;0,4;3,1', 'tri:0,0;0,4;4,1', 'tri:0,0;1,4;3,0',
    ].sort())
    // every Wedge is a squared corner and every squared corner is a Wedge — no third home
    for (const t of TRIANGLE_LAYOUTS.filter(isActive)) {
      const m = shown(t)
      expect(triangleTypeOf(t) === 'wedge', t.id).toBe(m.right && m.level && m.upright)
    }
    // all three of Dan's rulings fall out of one derived rule; no override table is needed
  })

  it('the tabs hold exactly this population — nothing missing, nothing extra', () => {
    const got: Record<string, number> = {}
    for (const t of TRIANGLE_TYPES) got[t] = trianglesOfType(t).length
    expect(got).toEqual({
      pyramid: 2, arrowhead: 1, mountain: 4, needle: 1, wedge: 9, flag: 7,
    })
    expect(Object.values(got).reduce((a, b) => a + b, 0)).toBe(24)
  })

  it('every active layout appears in exactly one tab, and every tab has members', () => {
    const seen = TRIANGLE_TYPES.flatMap((t) => trianglesOfType(t).map((x) => x.id))
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen.length).toBe(TRIANGLE_LAYOUTS.filter(isActive).length)
    for (const t of TRIANGLE_TYPES) expect(trianglesOfType(t).length, t).toBeGreaterThan(0)
  })
})

describe('the class spec is portable, and nothing outside it knows a class by name', () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')
  const PANEL = 'src/app/(dev)/effect-creator/grid-centre/LibraryPanel.tsx'
  const PAGE = 'src/app/(dev)/effect-creator/grid-centre/page.tsx'
  const BRIDGE = 'src/lib/effect/grid-magnet-library-bridge.ts'

  it('every class answers every member of one contract', () => {
    for (const fam of LIBRARY_FAMILIES) {
      const spec = specOf(fam)
      expect(spec.classId, fam).toBe(fam)
      expect(spec.types.length, fam).toBeGreaterThan(0)
      for (const t of spec.types) {
        expect(t.label.trim(), `${fam} ${t.id}`).not.toBe('')
        const vs = spec.variants(t.id, 48)
        expect(vs.length, `${fam} ${t.id}`).toBeGreaterThan(0)
        // every offer is complete: a stable id, a readable label, a real frame and its 0 degrees
        for (const v of vs) {
          expect(v.id, `${fam} ${t.id}`).toBeTruthy()
          expect(v.frame.layouts.length, `${fam} ${v.id}`).toBeGreaterThan(0)
          expect(typeof v.view.transpose, `${fam} ${v.id}`).toBe('boolean')
        }
      }
      // and the class round-trips: open it, and every answer it gives about that selection
      // agrees with every other — the type it reports contains the offer it landed on, and the
      // frame it resolves is the one the selection names
      const opened = spec.open(sel(), 48)
      const type = spec.variantOf(opened, 48).typeId
      expect(spec.types.map((t) => t.id), fam).toContain(type)
      expect(spec.variants(type, 48).map((v) => v.id), fam).toContain(spec.variantOf(opened, 48).id)
      expect(frameKeyOf(spec.variantOf(opened, 48).frame), fam).toBe(opened.frameKey)
      // and selecting any offer of any type is likewise self-consistent
      for (const t of spec.types) for (const v of spec.variants(t.id, 48)) {
        const next = selectVariant(opened, v)
        expect(spec.variantOf(next, 48).id, `${fam} ${v.id}`).toBe(v.id)
        expect(spec.variantOf(next, 48).typeId, `${fam} ${v.id}`).toBe(t.id)
        expect(frameKeyOf(spec.variantOf(next, 48).frame), `${fam} ${v.id}`).toBe(next.frameKey)
        expect(() => materializeSelection(next, 48), `${fam} ${v.id}`).not.toThrow()
      }
    }
  })

  it('every class variant carries the recipe used by materialisation', () => {
    for (const fam of LIBRARY_FAMILIES) {
      const spec = specOf(fam)
      const opened = spec.open(sel(), 48)
      const variant = spec.variantOf(opened, 48)
      expect(variant.outline.corners, fam).toMatch(/sharp|round|bevel/)
    }
  })

  it('the panel, the page and the bridge hold no class policy', () => {
    for (const f of [PANEL, PAGE, BRIDGE]) {
      const src = read(f)
      // no class name used as a decision
      expect(src, f).not.toMatch(/===\s*'(triangle|square|rectangle|diamond)'/)
      expect(src, f).not.toMatch(/family\s*===/)
      // no re-derived draft identity, spacing test or outline maths
      expect(src, f).not.toContain('isSpacingMode')
      expect(src, f).not.toContain('draftId(')
      expect(src, f).not.toContain('convexHull')
    }
    // and the two UI files import no class table at all
    for (const f of [PANEL, PAGE]) {
      const src = read(f)
      for (const sym of ['RAW_CLASS_FRAMES', 'registryFramesAt', 'REGISTRY_RULES', 'specOf', 'TRIANGLE_'])
        expect(src, `${f} :: ${sym}`).not.toContain(sym)
    }
  })

  it('the bridge is an adapter: it receives a materialised record and never builds one', () => {
    const src = read(BRIDGE)
    // it must not resolve, transform, name a frame or ask a class anything
    for (const sym of ['transformLayout', 'frameKeyOf', 'specOf', 'resolveSelection'])
      expect(src, `bridge :: ${sym}`).not.toContain(sym)
    expect(src).toContain('MaterializedLibrary')
    expect(src).not.toContain('materializeSelection')
    expect(src).not.toContain('materializeDraft')
  })

  it('the engine-facing contract does not depend on the browser draft store', () => {
    const src = read('src/lib/effect/library/class-contract.ts')
    // drafts.ts asks the registered class for validation; importing browser draft state into the
    // contract would create a cycle and put
    // browser-local storage inside the contract an engine consumes
    expect(src).not.toMatch(/from '\.\/drafts'/)
  })
})

describe('authoring transitions — the five the page used to spell out itself', () => {
  const triSel = (id: string, layoutId = 'corners'): LibrarySelection => {
    const t = triangleById(id)
    return { classId: 'triangle', geometryId: id, frameKey: frameKeyOf(triangleFrame(t, 48)),
      layoutId, view: uprightView(t) }
  }

  it('a new layout starts empty, and the canvas still has somewhere to look', () => {
    expect(startAdd()).toEqual({ name: '', nodes: [] })
    const m = materializeDraftResolved(sel({ frameKey: '3x3' }), [], 48)
    // nothing drawn: the seed is the selected layout's own first magnet, not the mm origin
    expect(m.nodesMM).toEqual([])
    expect(m.seedMM).not.toBeNull()
    expect(m.seedMM).toEqual(materializeSelection(sel({ frameKey: '3x3' }), 48).nodesMM[0])
  })

  it('the producer consumes the selection saveEdit hands back — its own output', () => {
    // saveEdit returns a selection naming draft:<name>, which is not a corpus layout. The
    // materialiser must normalise it itself; resolving it strictly made the library refuse its
    // own output, and the page was hiding that by pre-normalising and passing frame dimensions.
    const base = sel({ frameKey: '3x3' })
    const saved = saveEdit(base, [], { name: 'probe', nodes: [[0, 0], [2, 0], [0, 2], [2, 2]] }, 48)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const m = materializeDraftResolved(saved.sel, saved.drafts[0].nodes, 48, saved.drafts)
    expect(m.nodesMM).toEqual([[0, 96], [96, 96], [0, 0], [96, 0]])
    // the frame is the one the SELECTION resolves to, never a caller's claim about it
    expect(m.frameKey).toBe('3x3')
    expect(m.frameCols).toBe(3)
    expect(m.frameRows).toBe(3)
    expect(m.error).toBeNull()

    // and the same for a triangle, where the outline is derived from the drawn magnets
    const t = triangleById('tri:0,0;0,2;2,0')
    const tsel: LibrarySelection = { classId: 'triangle', geometryId: t.id,
      frameKey: frameKeyOf(triangleFrame(t, 48)), layoutId: 'corners', view: uprightView(t) }
    const tsaved = saveEdit(tsel, [], { name: 'probe', nodes: [[0, 0], [0, 2], [2, 0]] }, 48)
    expect(tsaved.ok).toBe(true)
    if (!tsaved.ok) return
    const tm = materializeDraftResolved(tsaved.sel, tsaved.drafts[0].nodes, 48, tsaved.drafts)
    expect(tm.error).toBeNull()
    expect(tm.outlineMM).toHaveLength(3)
    // the magnets it wraps are the DRAWN ones, and every one clears the padding exactly
    for (const n of tm.nodesMM) {
      const d = Math.min(...tm.outlineMM.map((a, i) => {
        const b = tm.outlineMM[(i + 1) % 3]
        const vx = b[0] - a[0], vy = b[1] - a[1], L = Math.hypot(vx, vy)
        return Math.abs((n[0] - a[0]) * vy - (n[1] - a[1]) * vx) / L
      }))
      expect(d).toBeCloseTo(12, 6)
    }
  })

  it('a custom seeds from what is ON SCREEN at this pitch, not the canonical 48mm set', () => {
    const s = sel({ frameKey: '5x5', layoutId: 'perimeter-96' })
    // the 96mm mode is physical: at 24mm it keeps every fourth node, at 48 every other
    expect(startEdit(s, [], 24).nodes.length).toBe(4)
    expect(startEdit(s, [], 48).nodes.length).toBe(8)
    expect(startEdit(s, [], 96).nodes.length).toBe(16)
    expect(startEdit(s, [], 48).name).toBe('perimeter-96-custom')
  })

  it('a click in a TRANSPOSED view lands on the canonical node, and clicking again removes it', () => {
    const s = sel({ classId: 'rectangle', frameKey: '2x3', layoutId: 'perimeter',
      view: { transpose: true, flipX: false, flipY: false } })
    // shown 3 wide x 2 tall; the far column, top row, is canonical [0,2]
    const once = toggleNodeAt(s, [], { name: 'x', nodes: [] }, [96, 48], 48)
    expect(once.nodes).toEqual([[0, 2]])
    expect(toggleNodeAt(s, [], once, [96, 48], 48).nodes).toEqual([])
  })

  it('a click outside the frame changes nothing', () => {
    const s = sel({ classId: 'rectangle', frameKey: '2x3', layoutId: 'perimeter' })
    const before: LibraryEdit = { name: 'x', nodes: [[0, 0]] }
    for (const p of [[-48, 0], [480, 0], [0, -48], [0, 480]] as Array<[number, number]>)
      expect(toggleNodeAt(s, [], before, p, 48), String(p)).toEqual(before)
  })

  it('save refuses a triangle that is not a triangle, and keeps the geometry in its identity', () => {
    const id = 'tri:0,0;0,2;2,0'
    const s = triSel(id)
    const bad = saveEdit(s, [], { name: 'flat', nodes: [[0, 0], [0, 1], [0, 2]] }, 48)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/collinear|hull/)
    const good = saveEdit(s, [], { name: 'three', nodes: [[0, 0], [0, 2], [2, 0]] }, 48)
    expect(good.ok).toBe(true)
    if (good.ok) {
      expect(good.drafts).toHaveLength(1)
      expect(good.drafts[0].geometryId).toBe(id)
      expect(good.drafts[0].id).toContain(id)
      expect(good.sel.layoutId).toBe(draftLayoutId('three'))
      // and it resolves back to itself rather than to the corpus layout
      expect(resolveSelection(good.sel, good.drafts, 48).draft?.nodes).toEqual([[0, 0], [0, 2], [2, 0]])
    }
  })

  it('delete removes only THIS geometry’s draft, even when another shares the frame and the name', () => {
    // two distinct triangles on one frame: same frameKey, same draft name, different shapes
    const pair = TRIANGLE_LAYOUTS.filter((t) => frameKeyOf(triangleFrame(t, 48)) === '3x4' && isActive(t)).slice(0, 2)
    expect(pair).toHaveLength(2)
    const mk = (t: typeof pair[number]) => {
      const s = triSel(t.id)
      const r = saveEdit(s, [], { name: 'same-name', nodes: t.vertices.map(([x, y]) => [x, y] as [number, number]) }, 48)
      expect(r.ok, t.id).toBe(true)
      // delete acts on the selection that NAMES the draft, which is what save hands back
      return { s: r.ok ? r.sel : s, rec: r.ok ? r.drafts[0] : null! }
    }
    const a = mk(pair[0]), b = mk(pair[1])
    expect(a.rec.id).not.toBe(b.rec.id)
    const both = [a.rec, b.rec]
    const after = deleteEdit(a.s, both, null, 48)
    expect(after.drafts.map((d) => d.geometryId)).toEqual([pair[1].id])
    // and the surviving one is still reachable from its own selection
    expect(resolveSelection(b.s, after.drafts, 48).draft?.name).toBe('same-name')
  })
})
