import type { LibraryFamily, LibraryFrame, LibrarySelection, LibraryTransform, PointMM } from './types'

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

export interface ClassSpec {
  classId: LibraryFamily
  types: readonly ClassType[]
  variants(typeId: string, pitchMM: number): readonly ClassVariant[]
  variantOf(sel: LibrarySelection, pitchMM: number): ClassVariant
  boundaryOf?(sel: LibrarySelection, nodesMM: readonly PointMM[]): readonly PointMM[] | undefined
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
