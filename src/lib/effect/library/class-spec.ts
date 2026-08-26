// library/class-spec.ts — THE PORTABLE CLASS SPECIFICATION.
//
// Dan, 08-26: "no logic in UI shell and poage" · "modular - the library must carry class spec
// portable to the engine" · "separation of UI clean shell and logic and spec must be followed
// as in the fucking bench".
//
// One contract per class. Every caller — the resolver, the option layer, the draft store, the
// engine bridge — asks the spec and branches on nothing. Before this file each of them carried
// its own `source === 'geometry'` test and its own concrete triangle imports, which is the
// noodle soup: seven copies of one distinction, each free to drift from the others.
//
// It adds no new behaviour. Every member below reuses a function that already existed, by
// reference; the file's whole job is to name the seam so the branches can be deleted.

import { CLASS_FRAMES } from './frames'
import { REGISTRY_RULES, SPACING_96, SPACING_BASE } from './rules'
import { LIBRARY_SHAPES } from './shapes'
import { frameKeyOf } from './transforms'
import { TRIANGLE_LAYOUTS } from './corpus-triangle'
import { boundsOf, convexHull } from './triangle-geometry'
import { TRIANGLE_TYPES, type TriangleProductType } from './triangle-types'
import {
  assertTrianglePopulation, restsFlat, triangleById, triangleFrame, trianglesOfType,
  triangleTypeOf, uprightView,
} from './triangle-frames'
import type {
  LibraryFamily, LibraryFrame, LibraryLayout, LibrarySelection, LibraryTransform, RegistryFamily,
} from './types'

/** A point in millimetres. The library states its own geometry; the bridge maps it to the
 *  engine's Pt without reinterpreting it. */
export type PointMM = readonly [number, number]

/** ONE OFFER — a thing the class can be set to. For a registry class that is a frame; for a
 *  class whose shape IS its layout it is one geometry. The caller never learns which. */
export interface ClassVariant {
  /** Stable identity: the frame key, or the geometry id. */
  id: string
  label: string
  /** Distinguishes two offers that would otherwise read alike. */
  accessibleLabel?: string
  frame: LibraryFrame
  /** The view this offer is PRESENTED in — its 0 degrees. */
  view: LibraryTransform
}

export interface ClassType { id: string; label: string }

/** The part of a hand-authored layout a class rules on. Stated STRUCTURALLY, not imported from
 *  the draft store: the engine-facing contract below must not depend on browser-local storage,
 *  and drafts.ts already asks this file for validation, so importing back would be a cycle. */
export interface DraftShape {
  nodes: ReadonlyArray<readonly [number, number]>
  geometryId?: string
}
/** What identifies where a stored layout belongs. Structural for the same reason. */
export interface DraftIdentity {
  className: string
  frameKey: string
  geometryId?: string
}

/** WHAT A CLASS IS — the geometry an engine consumes. Nothing here knows about a panel, a
 *  selection history or a browser store, so a consumer that only needs shapes takes only this. */
export interface ClassSpec {
  family: LibraryFamily
  /** The product types offered, in order. One entry means a single fixed type. */
  types: ClassType[]
  /** The offers of one type. */
  variants: (typeId: string, pitchMM: number) => ClassVariant[]
  /** The frame a selection names — throws on an unknown id, never a silent retarget. */
  frameOf: (sel: LibrarySelection, pitchMM: number) => LibraryFrame
  /** Materialise a layout at a pitch — the 96mm mode is physical, not an index rule. */
  layoutAt: (frame: LibraryFrame, layout: LibraryLayout, pitchMM: number) => LibraryLayout
  /** The outline in mm around a materialised population. */
  outline: (
    nodesMM: readonly PointMM[], frameCols: number, frameRows: number, pitchMM: number, padMM: number,
  ) => PointMM[]
  /** Why a hand-authored layout cannot be saved — empty list means sound. */
  validateDraft: (d: DraftShape, frame: LibraryFrame) => string[]
}

/** HOW THE ADMIN MOVES THROUGH A CLASS — navigation and storage identity. Only the authoring
 *  surface needs these, so they are a separate contract over the same object rather than
 *  freight on the engine-facing one. */
export interface ClassControls {
  /** Which type a selection sits in. */
  typeOf: (sel: LibrarySelection, pitchMM: number) => string
  /** Which offer a selection names. */
  variantIdOf: (sel: LibrarySelection) => string
  /** The selection this class opens on. */
  open: (current: LibrarySelection, pitchMM: number) => LibrarySelection
  /** The selection an offer produces, carrying the layout across where the offer has it. */
  select: (current: LibrarySelection, v: ClassVariant) => LibrarySelection
  /** The views this class NAMES. Empty means it names none and the turns are derived. */
  orientations: Array<{ id: string; view: LibraryTransform }>
  /** The presented view that IS 0 degrees. */
  baseView: (sel: LibrarySelection, pitchMM: number) => LibraryTransform
  /** Does a stored layout belong to this selection's frame? */
  draftMatches: (d: DraftIdentity, sel: LibrarySelection, frameKey: string) => boolean
  /** The identity a new hand-authored layout is stored under. */
  draftIdParts: (sel: LibrarySelection, frameKey: string) => DraftIdentity
}

/** One object answers both. The registry is single; the contracts are two, so what an engine
 *  imports and what the admin surface imports are visibly different things. */
export type LibraryClass = ClassSpec & ClassControls

const NO_VIEW: LibraryTransform = { transpose: false, flipX: false, flipY: false }
const pickLayoutName = (frame: LibraryFrame, preferred: string): string =>
  frame.layouts.some((l) => l.name === preferred) ? preferred : frame.layouts[0].name

/** Bounds violations and duplicates — the same rule for every class. */
function boundsAndDuplicates(d: DraftShape, frame: LibraryFrame): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const [x, y] of d.nodes) {
    if (x < 0 || x >= frame.cols || y < 0 || y >= frame.rows) out.push('node out of frame: ' + x + ',' + y)
    const k = x + ',' + y
    if (seen.has(k)) out.push('duplicate node ' + k)
    seen.add(k)
  }
  return out
}

/** A REGISTRY CLASS — its frames are a literal table and its outline is a stored unit shape
 *  scaled to the frame's own box. Square, rectangle and diamond. */
function registrySpec(family: RegistryFamily): LibraryClass {
  const rules = REGISTRY_RULES[family]
  const shape = LIBRARY_SHAPES.find((x) => x.family === family)!
  const frames = () => CLASS_FRAMES[family]
  const subOf = (f: LibraryFrame) => rules.subOf(f.cols, f.rows)
  const asVariant = (f: LibraryFrame): ClassVariant =>
    ({ id: frameKeyOf(f), label: rules.label(f.cols, f.rows), frame: f, view: NO_VIEW })
  const frameOf = (sel: LibrarySelection): LibraryFrame => {
    const f = frames().find((x) => frameKeyOf(x) === sel.frameKey)
    if (!f) throw new Error('library: unknown frameKey ' + sel.frameKey)
    return f
  }
  return {
    family,
    types: rules.subs.map((id) => ({ id, label: id })),
    typeOf: (sel) => subOf(frameOf(sel)),
    variants: (typeId) => frames().filter((f) => subOf(f) === typeId).map(asVariant),
    variantIdOf: (sel) => sel.frameKey,
    frameOf,
    open: (current) => {
      const f0 = frames()[0]
      return { ...current, shapeId: shape.id, geometryId: undefined, frameKey: frameKeyOf(f0), layoutId: pickLayoutName(f0, 'perimeter') }
    },
    select: (current, v) => ({ ...current, frameKey: v.id, layoutId: pickLayoutName(v.frame, current.layoutId) }),
    orientations: rules.orientations,
    baseView: () => NO_VIEW,
    layoutAt: (frame, layout, pitchMM) => {
      if (layout.name !== SPACING_96) return layout
      const per = frame.layouts.find((l) => l.name === SPACING_BASE)
      if (!per) throw new Error('library: 96mm mode has no perimeter in ' + frame.cols + 'x' + frame.rows)
      return { name: SPACING_96, nodes: rules.spacing96(frame, per.nodes, pitchMM) }
    },
    // The frame's physical span is CLASS POLICY: the square/rectangle class floor, the diamond's
    // wrap-the-ring rule. A shape drawn square keeps its square span on an oblong frame.
    outline: (_nodesMM, frameCols, frameRows, pitchMM, padMM) => {
      const { w: w0, h: h0 } = rules.boxMM(frameCols, frameRows, pitchMM, padMM)
      const fits = shape.aspect === 'frame' || frameCols === frameRows
      const w = fits ? w0 : Math.max(w0, h0), h = fits ? h0 : Math.max(w0, h0)
      const cx = (frameCols - 1) * pitchMM / 2, cy = (frameRows - 1) * pitchMM / 2
      return shape.outline.map(([ux, uy]) => [cx - w / 2 + ux * w, cy + h / 2 - uy * h] as PointMM)
    },
    validateDraft: boundsAndDuplicates,
    draftMatches: (d, _sel, frameKey) => d.className === family && d.frameKey === frameKey,
    draftIdParts: (_sel, frameKey) => ({ className: family, frameKey }),
  }
}

/** THE TRIANGLE — its frame, its populations and its outline all come from the geometry the
 *  selection names, so it carries no frame table and no stored unit shape. */
function triangleSpec(): LibraryClass {
  const shape = LIBRARY_SHAPES.find((x) => x.family === 'triangle')!
  const geoOf = (sel: LibrarySelection) => {
    if (!sel.geometryId) throw new Error('library: triangle selection carries no geometryId')
    return triangleById(sel.geometryId)
  }
  const firstOf = (typeId: string) => trianglesOfType(typeId as TriangleProductType)[0]
  const asVariant = (t: (typeof TRIANGLE_LAYOUTS)[number], pitchMM: number, i: number): ClassVariant => {
    const b = boundsOf([...t.vertices])
    return {
      id: t.id, label: b.cols + '×' + b.rows, frame: triangleFrame(t, pitchMM), view: uprightView(t),
      accessibleLabel: TYPE_LABEL[triangleTypeOf(t)] + ' ' + (i + 1) + ' · ' + b.cols + '×' + b.rows
        + (restsFlat(t) ? '' : ' · diagonal'),
    }
  }
  const frameOf = (sel: LibrarySelection, pitchMM: number): LibraryFrame => {
    const geo = geoOf(sel)
    const frame = triangleFrame(geo, pitchMM)
    const actual = frameKeyOf(frame)
    // The frame a geometry carries is not a matter of opinion: a selection naming a different
    // one is a caller bug, exactly as an unknown frame key is for a registry class.
    if (sel.frameKey !== actual)
      throw new Error('library: frameKey ' + sel.frameKey + ' does not match geometry ' + geo.id + ' (' + actual + ')')
    return frame
  }
  return {
    family: 'triangle',
    types: TRIANGLE_TYPES.map((id) => ({ id, label: TYPE_LABEL[id] })),
    typeOf: (sel) => triangleTypeOf(geoOf(sel)),
    variants: (typeId, pitchMM) => trianglesOfType(typeId as TriangleProductType).map((t, i) => asVariant(t, pitchMM, i)),
    variantIdOf: (sel) => sel.geometryId ?? '',
    frameOf,
    open: (current, pitchMM) => {
      const t = firstOf(TRIANGLE_TYPES[0])
      const f = triangleFrame(t, pitchMM)
      return {
        ...current, shapeId: shape.id, geometryId: t.id, frameKey: frameKeyOf(f),
        layoutId: pickLayoutName(f, 'perimeter'), view: uprightView(t),
      }
    },
    // a geometry opens standing on its base, not in its de-duplication form
    select: (current, v) => ({
      ...current, geometryId: v.id, frameKey: frameKeyOf(v.frame),
      layoutId: pickLayoutName(v.frame, current.layoutId), view: { ...v.view },
    }),
    orientations: [],
    baseView: (sel) => uprightView(geoOf(sel)),
    // this class materialises its own frames at the requested pitch, so nothing is left to do
    layoutAt: (_frame, layout) => layout,
    // THE DERIVED OUTLINE: connect the magnet centres, move each edge out by the padding.
    outline: (nodesMM, _c, _r, _pitchMM, padMM) => hullOutlineMM(nodesMM, padMM),
    validateDraft: (d, frame) => {
      const out = boundsAndDuplicates(d, frame)
      // Two geometries can share a frame, so a triangle draft that does not name its own is
      // ambiguous the moment it is stored.
      if (!d.geometryId) out.push('triangle: geometryId required')
      // A class whose outline is its magnets' hull has a shape rule as well as bounds. SAVE is
      // the fail-loud boundary, so it is checked here, not while the population is being drawn.
      try { assertTrianglePopulation(d.nodes) } catch (e) { out.push((e as Error).message) }
      return out
    },
    draftMatches: (d, sel, frameKey) =>
      d.className === 'triangle' && d.frameKey === frameKey && d.geometryId === sel.geometryId,
    draftIdParts: (sel, frameKey) => ({ className: 'triangle', frameKey, geometryId: sel.geometryId }),
  }
}

/** THE EXACT 12mm OFFSET. Three edge lines moved outward and intersected — a triangle's corner
 *  is a triangle corner, so there is no join style, no miter limit and nothing to clip. The
 *  result's position is authoritative; it is never re-centred on the group's box. */
export function hullOutlineMM(nodesMM: readonly PointMM[], padMM: number): PointMM[] {
  const hull = convexHull(nodesMM)
  if (hull.length < 3) throw new Error('triangle: collinear population')
  if (hull.length !== 3) throw new Error('triangle: hull has ' + hull.length + ' vertices')
  // Each edge moves AWAY from the middle. Taking the normal relative to the centroid needs no
  // winding convention, so it cannot silently invert in one coordinate system or the other.
  const cx = (hull[0][0] + hull[1][0] + hull[2][0]) / 3
  const cy = (hull[0][1] + hull[1][1] + hull[2][1]) / 3
  const edges = hull.map((a, i) => {
    const b = hull[(i + 1) % 3]
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy)
    if (L === 0) throw new Error('triangle: collinear population')
    const d: PointMM = [dx / L, dy / L]
    let n: PointMM = [-d[1], d[0]]
    if ((cx - a[0]) * n[0] + (cy - a[1]) * n[1] > 0) n = [-n[0], -n[1]]
    return { p: [a[0] + n[0] * padMM, a[1] + n[1] * padMM] as PointMM, d }
  })
  const meet = (e1: typeof edges[0], e2: typeof edges[0]): PointMM => {
    const den = e1.d[0] * e2.d[1] - e1.d[1] * e2.d[0]
    if (Math.abs(den) < 1e-12) throw new Error('triangle: collinear population')
    const t = ((e2.p[0] - e1.p[0]) * e2.d[1] - (e2.p[1] - e1.p[1]) * e2.d[0]) / den
    return [e1.p[0] + e1.d[0] * t, e1.p[1] + e1.d[1] * t]
  }
  // corner i is where the edge arriving at it meets the edge leaving it
  return [meet(edges[2], edges[0]), meet(edges[0], edges[1]), meet(edges[1], edges[2])]
}

/** The one-word product names Dan ruled (08-26). The panel renders what the spec hands it. */
const TYPE_LABEL: Record<string, string> = {
  box: 'box', rhomb: 'rhomb', frame: 'frame', banner: 'banner', slim: 'slim',
  pyramid: 'Pyramid', arrowhead: 'Arrowhead', mountain: 'Mountain', needle: 'Needle',
  slice: 'Slice', wedge: 'Wedge', ramp: 'Ramp', pennant: 'Pennant', sail: 'Sail', fin: 'Fin',
}

export const CLASS_SPECS: Record<LibraryFamily, LibraryClass> = {
  square: registrySpec('square'),
  rectangle: registrySpec('rectangle'),
  diamond: registrySpec('diamond'),
  triangle: triangleSpec(),
}

/** The one call every other module makes. Nobody outside this file tests what a class is. */
export const specOf = (family: LibraryFamily): LibraryClass => CLASS_SPECS[family]
