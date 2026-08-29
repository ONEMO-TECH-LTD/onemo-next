import type { ClassType, ClassVariant, DraftShape, LibraryClass, OutlineRecipe } from './class-contract'
import { assertTypeId, boundsAndDuplicateErrors } from './registry-class'
import { bandOfFrame } from './rules'
import { selectVariant } from './selection-transition'
import { frameKeyOf } from './transforms'
import { TRIANGLE_TYPES, restsFlat, triangleTypeOf, trianglesOfType, uprightView, type TriangleProductType } from './triangle-types'
import { assertTrianglePopulation, boundsOf, type TriangleLayout } from './triangle-geometry'
import { outlineFromLayout } from './outline'
import { boundsMM, placeMM } from './geometry'
import { triangleById, triangleFrame } from './triangle-frames'
import type { LibraryFrame, LibrarySelection } from './types'

const label: Record<string, string> = {
  pyramid: 'Pyramid', arrowhead: 'Arrowhead', mountain: 'Mountain', needle: 'Needle', wedge: 'Wedge', flag: 'Flag',
}
const types: readonly ClassType[] = TRIANGLE_TYPES.map((id) => ({ id, label: label[id] }))

/** ONE recipe for the class, so the chip and the canvas cannot be measured differently. */
const OUTLINE: OutlineRecipe = { corners: 'sharp' }

/** The chip reads the size the producer would draw — same placement, same recipe, same bounds. */
const sizeOf = (triangle: TriangleLayout, pitchMM: number) => {
  const bounds = boundsOf([...triangle.vertices])
  const placed = placeMM({ cols: bounds.cols, rows: bounds.rows },
    { name: 'corners', nodes: [...triangle.vertices] }, uprightView(triangle), pitchMM)
  const { widthMM, heightMM } = boundsMM(outlineFromLayout(placed.nodesMM, OUTLINE))
  return Math.round(widthMM) + '×' + Math.round(heightMM)
}

const asVariant = (triangle: TriangleLayout, pitchMM: number, index?: number, frame = triangleFrame(triangle)): ClassVariant => {
  const size = sizeOf(triangle, pitchMM)
  const band = bandOfFrame(frame, pitchMM)
  return {
    typeId: triangleTypeOf(triangle),
    id: triangle.id,
    label: (band === null ? '' : 'B' + band + ' · ') + size,
    ...(index === undefined ? {} : { accessibleLabel: label[triangleTypeOf(triangle)] + ' ' + (index + 1) + ' · ' + size + 'mm' + (restsFlat(triangle) ? '' : ' · diagonal') }),
    frame,
    view: uprightView(triangle),
    outline: OUTLINE,
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

export const triangleClass: LibraryClass = {
  classId: 'triangle',
  catalogueRole: 'preset',
  types,
  variants: (typeId, pitchMM) => {
    assertTypeId('triangle', types, typeId)
    return trianglesOfType(typeId as TriangleProductType).map((triangle, index) => asVariant(triangle, pitchMM, index))
  },
  variantOf: (sel, pitchMM) => {
    const triangle = triangleBySelection(sel)
    const frame = triangleFrame(triangle)
    const frameKey = frameKeyOf(frame)
    if (frameKey !== sel.frameKey) throw new Error('library: frameKey ' + sel.frameKey + ' does not match geometry ' + triangle.id + ' (' + frameKey + ')')
    return asVariant(triangle, pitchMM, undefined, frame)
  },
  validateDraft: triangleDraftErrors,
  open: (current, pitchMM) => selectVariant(current, asVariant(trianglesOfType(TRIANGLE_TYPES[0])[0], pitchMM, 0)),
  orientations: [],
  baseView: (sel) => uprightView(triangleBySelection(sel)),
  draftMatches: (draft, sel, frameKey) => draft.className === 'triangle' && draft.frameKey === frameKey && draft.geometryId === sel.geometryId,
  draftIdParts: (sel, frameKey) => ({ className: 'triangle', frameKey, geometryId: sel.geometryId }),
}
