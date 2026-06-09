'use client'

// Two-way bridge between the 3D engine and the 2D editor (decouples the R3F tree from the DOM
// editor — no prop threading).
//   engine → editor : ShapedModel writes the latest cut-out `spec` when BEN2 finishes; OutlineEditor
//                      reads it to build the editable OutlineDocument from the REAL contour (A1d).
//   editor → engine : OutlineEditor writes `editedContourMM` (the resolved outline in mm) as the user
//                      edits; ShapedModel rebuilds the 3D mesh from it (reusing the texture) so the
//                      object follows the 2D edits and the approved shape is exactly what's shown
//                      (ADDENDUM D steps 4 + 8 — "the 3D follows" / "what you approve is what's made").

import { create } from 'zustand'
import type { EffectSpecDraft, Contour } from '@/lib/effect/types'
import type { OutlineDocument } from '@/lib/outline-core'

interface OutlineStore {
  spec: EffectSpecDraft | null
  setSpec: (spec: EffectSpecDraft | null) => void
  editedContourMM: Contour | null
  setEditedContourMM: (c: Contour | null) => void
  // The last committed editor document — so reopening "Edit outline" restores edits instead of
  // re-deriving the original BEN contour (the 3D already reflects edits via editedContourMM).
  editedDoc: OutlineDocument | null
  setEditedDoc: (d: OutlineDocument | null) => void
  // "Magic blend" background-blur intensity, edit-mode controllable. null = use the build default (on);
  // 0 = off (sharp full photo); 0..1 = blur amount. ShapedModel re-composes the front texture from it.
  bgBlur: number | null
  setBgBlur: (v: number | null) => void
  // Sharp-subject matte (data URL) from BEN — lets the 2D editor preview the "magic blend" live (blurred
  // photo + this sharp subject on top), reacting to the intensity slider. Set by ShapedModel after build.
  subjMatteUrl: string | null
  setSubjMatteUrl: (u: string | null) => void
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
}))
