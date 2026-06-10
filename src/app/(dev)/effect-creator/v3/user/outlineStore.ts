'use client'

// Two-way bridge between the 3D engine and the 2D editor (decouples the R3F tree from the DOM
// editor — no prop threading).
//   engine → editor : the page writes the latest `spec` when prepareEffect finishes; OutlineEditor
//                      reads it to build the editable OutlineDocument from the REAL contour.
//   editor → engine : OutlineEditor writes `editedContourMM` (the resolved outline in mm) as the user
//                      commits edits; ShapedModel rebuilds the 3D mesh from it (reusing the texture)
//                      so the object follows the 2D edits — what you approve is what's shown.
//   editorOpen      : §6.3 — while the editor overlay is open the scene is frozen, so ShapedModel
//                      DEFERS mesh rebuilds; ONE rebuild fires at the editor boundary (close).

import { create } from 'zustand'
import type { EffectSpecDraft, Contour } from '@/lib/effect/types'
import type { OutlineDocument } from '@/lib/outline-core'

interface OutlineStore {
  spec: EffectSpecDraft | null
  setSpec: (spec: EffectSpecDraft | null) => void
  editedContourMM: Contour | null
  setEditedContourMM: (c: Contour | null) => void
  // The last committed editor document — so reopening "Edit" restores edits instead of re-deriving
  // the original BEN contour (the 3D already reflects edits via editedContourMM).
  editedDoc: OutlineDocument | null
  setEditedDoc: (d: OutlineDocument | null) => void
  // "Magic blend" background-blur intensity, edit-mode controllable. null = use the build default (on);
  // 0 = off (sharp full photo); 0..1 = blur amount. ShapedModel re-composes the front texture from it.
  bgBlur: number | null
  setBgBlur: (v: number | null) => void
  // Sharp-subject matte (data URL) from BEN — lets the 2D editor preview the "magic blend" live (blurred
  // photo + this sharp subject on top), reacting to the intensity control. Set by the page after Magic.
  subjMatteUrl: string | null
  setSubjMatteUrl: (u: string | null) => void
  // §6.3: the editor overlay is open → the scene is frozen → 3D rebuilds defer to the close boundary.
  editorOpen: boolean
  setEditorOpen: (v: boolean) => void
}

export const useOutlineStore = create<OutlineStore>((set) => ({
  spec: null,
  setSpec: (spec) => set({ spec }),
  editedContourMM: null,
  setEditedContourMM: (editedContourMM) => set({ editedContourMM }),
  editedDoc: null,
  setEditedDoc: (editedDoc) => set({ editedDoc }),
  bgBlur: null,
  setBgBlur: (bgBlur) => set({ bgBlur }),
  subjMatteUrl: null,
  setSubjMatteUrl: (subjMatteUrl) => set({ subjMatteUrl }),
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
}))
