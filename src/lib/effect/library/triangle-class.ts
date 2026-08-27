import { assertTypeId, type ClassType, type ClassVariant, type DraftShape, type LibraryClass } from './class-contract'
import { boundsAndDuplicateErrors } from './registry-class'
import { frameKeyOf, transformLayout } from './transforms'
import { TRIANGLE_TYPES, type TriangleProductType } from './triangle-types'
import { boundsOf, type TriangleLayout } from './triangle-geometry'
import { outlineFromLayout } from './outline'
import { assertTrianglePopulation, restsFlat, triangleById, triangleFrame, trianglesOfType, triangleTypeOf, uprightView } from './triangle-frames'
import type { LibraryFrame, LibrarySelection, PointMM } from './types'

const label: Record<string, string> = {
  pyramid: 'Pyramid', arrowhead: 'Arrowhead', mountain: 'Mountain', needle: 'Needle', wedge: 'Wedge', flag: 'Flag',
}
const types: readonly ClassType[] = TRIANGLE_TYPES.map((id) => ({ id, label: label[id] }))

const sizeOf = (triangle: TriangleLayout, pitchMM: number) => {
  const bounds = boundsOf([...triangle.vertices])
  const view = transformLayout({ cols: bounds.cols, rows: bounds.rows }, { name: 'corners', nodes: [...triangle.vertices] }, uprightView(triangle))
  const nodesMM = view.nodes.map(([x, y]) => [x * pitchMM, (view.rows - 1 - y) * pitchMM] as PointMM)
  const outlineMM = outlineFromLayout(nodesMM, { corners: 'sharp' })
  const xs = outlineMM.map(([x]) => x), ys = outlineMM.map(([, y]) => y)
  return Math.round(Math.max(...xs) - Math.min(...xs)) + '×' + Math.round(Math.max(...ys) - Math.min(...ys))
}

const asVariant = (triangle: TriangleLayout, pitchMM: number, index?: number, frame = triangleFrame(triangle, pitchMM)): ClassVariant => {
  const size = sizeOf(triangle, pitchMM)
  return {
    typeId: triangleTypeOf(triangle),
    id: triangle.id,
    label: size,
    ...(index === undefined ? {} : { accessibleLabel: label[triangleTypeOf(triangle)] + ' ' + (index + 1) + ' · ' + size + 'mm' + (restsFlat(triangle) ? '' : ' · diagonal') }),
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
  types,
  variants: (typeId, pitchMM) => {
    assertTypeId('triangle', types, typeId)
    return trianglesOfType(typeId as TriangleProductType).map((triangle, index) => asVariant(triangle, pitchMM, index))
  },
  variantOf: (sel, pitchMM) => {
    const triangle = triangleBySelection(sel)
    const frame = triangleFrame(triangle, pitchMM)
    const frameKey = frameKeyOf(frame)
    if (frameKey !== sel.frameKey) throw new Error('library: frameKey ' + sel.frameKey + ' does not match geometry ' + triangle.id + ' (' + frameKey + ')')
    return asVariant(triangle, pitchMM, undefined, frame)
  },
  validateDraft: triangleDraftErrors,
  open: (current, pitchMM) => openVariant(current, asVariant(trianglesOfType(TRIANGLE_TYPES[0])[0], pitchMM, 0)),
  orientations: [],
  baseView: (sel) => uprightView(triangleBySelection(sel)),
  draftMatches: (draft, sel, frameKey) => draft.className === 'triangle' && draft.frameKey === frameKey && draft.geometryId === sel.geometryId,
  draftIdParts: (sel, frameKey) => ({ className: 'triangle', frameKey, geometryId: sel.geometryId }),
}
