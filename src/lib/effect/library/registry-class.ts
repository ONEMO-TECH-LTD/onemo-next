import type { CatalogueRole, ClassControls, ClassSpec, ClassType, ClassVariant, DraftIdentity, DraftShape, LibraryClass, OutlineRecipe } from './class-contract'
import { bandOfFrame } from './rules'
import { frameKeyOf } from './transforms'
import type { LibraryFamily, LibraryFrame, LibrarySelection, LibraryTransform } from './types'

interface RegistryClassConfig {
  classId: LibraryFamily
  catalogueRole: CatalogueRole
  types: readonly ClassType[]
  frames(pitchMM: number): readonly LibraryFrame[]
  typeOfFrame(frame: LibraryFrame): string
  label(frame: LibraryFrame): string
  orientations: readonly { id: string; view: LibraryTransform }[]
  outline: OutlineRecipe
  validateDraft(draft: DraftShape, frame: LibraryFrame): string[]
  draftMatches(draft: DraftIdentity, sel: LibrarySelection, frameKey: string): boolean
  draftIdParts(sel: LibrarySelection, frameKey: string): DraftIdentity
}

export function assertTypeId(classId: string, types: readonly ClassType[], typeId: string): void {
  if (!types.some((type) => type.id === typeId))
    throw new Error(`library: unknown typeId ${typeId} in ${classId}`)
}

const none: LibraryTransform = { transpose: false, flipX: false, flipY: false }
export function boundsAndDuplicateErrors(draft: DraftShape, frame: LibraryFrame): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const [x, y] of draft.nodes) {
    if (x < 0 || x >= frame.cols || y < 0 || y >= frame.rows) errors.push('node out of frame: ' + x + ',' + y)
    const key = x + ',' + y
    if (seen.has(key)) errors.push('duplicate node ' + key)
    seen.add(key)
  }
  return errors
}

export function registryClass(config: RegistryClassConfig): LibraryClass {
  const variant = (frame: LibraryFrame, typeId: string, pitchMM: number): ClassVariant => {
    const band = bandOfFrame(frame, pitchMM)
    return {
      typeId, id: frameKeyOf(frame),
      // The band is no longer spelled into the title: the panel carries a band row and groups by
      // it, so a chip reads "3x4" and not "B4 · 3x4" (Dan, 2026-08-30).
      label: config.label(frame),
      bandId: band,
      orientation: frame.cols === frame.rows ? 'square' : frame.rows > frame.cols ? 'portrait' : 'landscape',
      frame, view: none,
      outline: config.outline,
      selection: { classId: config.classId, frameKey: frameKeyOf(frame) },
    }
  }
  const variantFrame = (sel: LibrarySelection, pitchMM: number) => {
    const frame = config.frames(pitchMM).find((candidate) => frameKeyOf(candidate) === sel.frameKey)
    if (!frame) throw new Error('library: unknown frameKey ' + sel.frameKey)
    return frame
  }
  const spec: ClassSpec = {
    classId: config.classId,
    catalogueRole: config.catalogueRole,
    types: config.types,
    variants: (typeId, pitchMM) => {
      assertTypeId(config.classId, config.types, typeId)
      return config.frames(pitchMM).filter((frame) => config.typeOfFrame(frame) === typeId)
        .map((frame) => variant(frame, typeId, pitchMM))
    },
    variantOf: (sel, pitchMM) => {
      const frame = variantFrame(sel, pitchMM)
      return variant(frame, config.typeOfFrame(frame), pitchMM)
    },
    validateDraft: (draft, frame) => [
      ...boundsAndDuplicateErrors(draft, frame),
      ...config.validateDraft(draft, frame),
    ],
  }
  const controls: ClassControls = {
    open: (current, pitchMM) => {
      const frame = config.frames(pitchMM)[0]
      return { ...current, classId: config.classId, geometryId: undefined, frameKey: frameKeyOf(frame), layoutId: frame.layouts[0].name, view: none }
    },
    orientations: config.orientations,
    baseView: () => none,
    draftMatches: config.draftMatches,
    draftIdParts: config.draftIdParts,
  }
  return { ...spec, ...controls }
}
