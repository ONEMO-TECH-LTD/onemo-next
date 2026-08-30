import type { LibraryFamily, LibraryFrame, LibrarySelection, LibraryTransform } from './types'

export type CornerMode = 'sharp' | 'bevel' | 'round'

export interface OutlineRecipe {
  corners: CornerMode
  pointRotationDeg?: number
}

/** Which way round a frame sits. A fact of the record, not a transform of it: a 3x4 and a 4x3
 *  are two published products (Dan, 2026-08-30 "those toggles must be separate layouts"). */
export type FrameOrientation = 'portrait' | 'landscape' | 'square'

export interface ClassVariant {
  typeId: string
  id: string
  label: string
  /** The band this frame sits in, so the panel can group by it instead of spelling it into
   *  every title. Null past the last band. */
  bandId: number | null
  orientation: FrameOrientation
  accessibleLabel?: string
  frame: LibraryFrame
  view: LibraryTransform
  outline: OutlineRecipe
  selection: Pick<LibrarySelection, 'classId' | 'frameKey' | 'geometryId'>
}

export interface ClassType { id: string; label: string }

export interface DraftShape { nodes: ReadonlyArray<readonly [number, number]>; geometryId?: string }
export interface DraftIdentity { className: string; frameKey: string; geometryId?: string }

/** WHETHER THE ENGINE MAY MATCH THIS CLASS BY ITSELF.
 *
 *  canon  — square and rectangle. The frame IS the class, so a classified shape maps straight onto
 *           one canon population and the engine offers it without being asked.
 *  preset — diamond and triangle. Node subsets held on the same rectangular frames, kept for when
 *           someone CHOOSES them. Dan, 2026-08-29: "the canon is square and rectangle the rest are
 *           layouts for us to have for potential presets."
 *
 *  The distinction has to be a FIELD, not a comment: classId is a name, so nothing downstream could
 *  tell eligibility from it, and a squircle's 4x4 frame came back carrying one square and twelve
 *  triangle presets — 52 wrap attempts for a frame that has exactly one canon answer. */
export type CatalogueRole = 'canon' | 'preset'

export interface ClassSpec {
  classId: LibraryFamily
  /** May the engine offer this class automatically, or only on request? */
  catalogueRole: CatalogueRole
  types: readonly ClassType[]
  variants(typeId: string, pitchMM: number): readonly ClassVariant[]
  variantOf(sel: LibrarySelection, pitchMM: number): ClassVariant
  validateDraft(draft: DraftShape, frame: LibraryFrame): string[]
}

export interface ClassControls {
  open(current: LibrarySelection, pitchMM: number): LibrarySelection
  orientations: readonly { id: string; view: LibraryTransform }[]
  baseView(sel: LibrarySelection, pitchMM: number): LibraryTransform
  draftMatches(draft: DraftIdentity, sel: LibrarySelection, frameKey: string): boolean
  draftIdParts(sel: LibrarySelection, frameKey: string): DraftIdentity
}

export type LibraryClass = ClassSpec & ClassControls
