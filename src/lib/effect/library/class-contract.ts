import type { LibraryFamily, LibraryFrame, LibrarySelection, LibraryTransform } from './types'

export type CornerMode = 'sharp' | 'bevel' | 'round'

export interface OutlineRecipe {
  corners: CornerMode
  pointRotationDeg?: number
}

export interface ClassVariant {
  typeId: string
  id: string
  label: string
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

/** One choice on the Orientation row, resolved by the CLASS. A class whose records own their
 *  orientation returns these; one whose orientation is a view returns null and keeps the
 *  transform-based row. The panel renders either without knowing which it is looking at. */
export interface ClassOrientationChoice {
  readonly id: string
  readonly label: string
  readonly active: boolean
  readonly disabled?: boolean
  readonly next: LibrarySelection
}

export interface ClassControls {
  /** Record-owned orientation, or null to use the transform-based row. */
  orientationChoices?(sel: LibrarySelection, pitchMM: number): readonly ClassOrientationChoice[] | null
  open(current: LibrarySelection, pitchMM: number): LibrarySelection
  orientations: readonly { id: string; view: LibraryTransform }[]
  baseView(sel: LibrarySelection, pitchMM: number): LibraryTransform
  draftMatches(draft: DraftIdentity, sel: LibrarySelection, frameKey: string): boolean
  draftIdParts(sel: LibrarySelection, frameKey: string): DraftIdentity
}

export type LibraryClass = ClassSpec & ClassControls
