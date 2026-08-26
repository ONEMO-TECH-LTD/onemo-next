import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import type { ClassVariant, DraftShape, LibraryClass } from './class-contract'
import { boundsAndDuplicateErrors } from './registry-class'
import { frameKeyOf, transformLayout } from './transforms'
import { TRIANGLE_TYPES, type TriangleProductType } from './triangle-types'
import { boundsOf, type TriangleLayout } from './triangle-geometry'
import { assertTrianglePopulation, restsFlat, triangleById, triangleFrame, trianglesOfType, triangleTypeOf, uprightView } from './triangle-frames'
import type { LibraryFrame, LibrarySelection, PointMM } from './types'

const label: Record<string, string> = {
  pyramid: 'Pyramid', arrowhead: 'Arrowhead', mountain: 'Mountain', needle: 'Needle', wedge: 'Wedge', flag: 'Flag',
}

const sizeOf = (triangle: TriangleLayout, pitchMM: number) => {
  const bounds = boundsOf([...triangle.vertices])
  const view = transformLayout({ cols: bounds.cols, rows: bounds.rows, layouts: [] }, { name: 'corners', nodes: [...triangle.vertices] }, uprightView(triangle))
  const nodes = view.nodes.map(([x, y]) => [x * pitchMM, (view.rows - 1 - y) * pitchMM] as PointMM)
  const xs = nodes.map((node) => node[0]), ys = nodes.map((node) => node[1])
  return Math.round(Math.max(...xs) - Math.min(...xs) + RELEASED_PADDING_MM * 2) + '×' + Math.round(Math.max(...ys) - Math.min(...ys) + RELEASED_PADDING_MM * 2)
}

const asVariant = (triangle: TriangleLayout, pitchMM: number, index: number): ClassVariant => {
  const frame = triangleFrame(triangle, pitchMM)
  return {
    id: triangle.id,
    label: sizeOf(triangle, pitchMM),
    accessibleLabel: label[triangleTypeOf(triangle)] + ' ' + (index + 1) + ' · ' + sizeOf(triangle, pitchMM) + 'mm' + (restsFlat(triangle) ? '' : ' · diagonal'),
    frame,
    view: uprightView(triangle),
    outline: { corners: 'sharp' },
    selection: { classId: 'triangle', geometryId: triangle.id, frameKey: frameKeyOf(frame) },
  }
}

const triangleBySelection = (sel: LibrarySelection): TriangleLayout => {
  if (!sel.geometryId) throw new Error('library: triangle selection carries no geometryId')
  return triangleById(sel.geometryId)
}

const triangleDraftErrors = (draft: DraftShape, frame: LibraryFrame): string[] => {
  const errors = boundsAndDuplicateErrors(draft, frame)
  if (!draft.geometryId) errors.push('triangle: geometryId required')
  try { assertTrianglePopulation(draft.nodes) } catch (error) { errors.push((error as Error).message) }
  return errors
}

const openVariant = (current: LibrarySelection, variant: ClassVariant): LibrarySelection => ({
  ...current,
  ...variant.selection,
  layoutId: variant.frame.layouts.some((layout) => layout.name === current.layoutId) ? current.layoutId : variant.frame.layouts[0].name,
  view: { ...variant.view },
})

export const triangleClass: LibraryClass = {
  classId: 'triangle',
  types: TRIANGLE_TYPES.map((id) => ({ id, label: label[id] })),
  variants: (typeId, pitchMM) => trianglesOfType(typeId as TriangleProductType).map((triangle, index) => asVariant(triangle, pitchMM, index)),
  variantOf: (sel, pitchMM) => {
    const triangle = triangleBySelection(sel)
    const variant = asVariant(triangle, pitchMM, 0)
    if (variant.selection.frameKey !== sel.frameKey) throw new Error('library: frameKey ' + sel.frameKey + ' does not match geometry ' + triangle.id + ' (' + variant.selection.frameKey + ')')
    return variant
  },
  validateDraft: triangleDraftErrors,
  typeOf: (sel) => triangleTypeOf(triangleBySelection(sel)),
  open: (current, pitchMM) => openVariant(current, asVariant(trianglesOfType(TRIANGLE_TYPES[0])[0], pitchMM, 0)),
  orientations: [],
  baseView: (sel) => uprightView(triangleBySelection(sel)),
  draftMatches: (draft, sel, frameKey) => draft.className === 'triangle' && draft.frameKey === frameKey && draft.geometryId === sel.geometryId,
  draftIdParts: (sel, frameKey) => ({ className: 'triangle', frameKey, geometryId: sel.geometryId }),
}
