import type { ClassControls, ClassSpec, ClassType, ClassVariant, DraftIdentity, DraftShape, LibraryClass, OutlineRecipe } from './class-contract'
import { frameKeyOf } from './transforms'
import type { LibraryFamily, LibraryFrame, LibrarySelection, LibraryTransform, PointMM } from './types'

export interface RegistryClassConfig {
  classId: LibraryFamily
  types: readonly ClassType[]
  frames(pitchMM: number): readonly LibraryFrame[]
  typeOfFrame(frame: LibraryFrame): string
  label(frame: LibraryFrame): string
  orientations: readonly { id: string; view: LibraryTransform }[]
  outline: OutlineRecipe
  boundaryOf?(sel: LibrarySelection, nodesMM: readonly PointMM[]): readonly PointMM[] | undefined
  validateDraft(draft: DraftShape, frame: LibraryFrame): string[]
  draftMatches(draft: DraftIdentity, sel: LibrarySelection, frameKey: string): boolean
  draftIdParts(sel: LibrarySelection, frameKey: string): DraftIdentity
}

const none: LibraryTransform = { transpose: false, flipX: false, flipY: false }
const pickLayout = (frame: LibraryFrame, preferred: string) =>
  frame.layouts.some((layout) => layout.name === preferred) ? preferred : frame.layouts[0].name

export function registryClass(config: RegistryClassConfig): LibraryClass {
  const variant = (frame: LibraryFrame): ClassVariant => ({
    id: frameKeyOf(frame), label: config.label(frame), frame, view: none,
    outline: config.outline,
    selection: { classId: config.classId, frameKey: frameKeyOf(frame) },
  })
  const frameOf = (sel: LibrarySelection, pitchMM: number) => {
    const frame = config.frames(pitchMM).find((candidate) => frameKeyOf(candidate) === sel.frameKey)
    if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
    return frame
  }
  const spec: ClassSpec = {
    classId: config.classId,
    types: config.types,
    variants: (typeId, pitchMM) => config.frames(pitchMM).filter((frame) => config.typeOfFrame(frame) === typeId).map(variant),
    variantOf: (sel, pitchMM) => variant(frameOf(sel, pitchMM)),
    boundaryOf: config.boundaryOf,
    validateDraft: config.validateDraft,
  }
  const controls: ClassControls = {
    typeOf: (sel, pitchMM) => config.typeOfFrame(frameOf(sel, pitchMM)),
    open: (current, pitchMM) => {
      const frame = config.frames(pitchMM)[0]
      return { ...current, classId: config.classId, geometryId: undefined, frameKey: frameKeyOf(frame), layoutId: pickLayout(frame, 'perimeter'), view: none }
    },
    orientations: config.orientations,
    baseView: () => none,
    draftMatches: config.draftMatches,
    draftIdParts: config.draftIdParts,
  }
  return { ...spec, ...controls }
}
