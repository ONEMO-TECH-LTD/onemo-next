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
import type { DesignState } from '../types'
import type { OutlineDocument, FairTracedRingOpts } from '@/lib/outline-core'
import type { VShape } from '@/lib/vector-core'

// #28: artwork position (pan/zoom within the shape) — ONE source for the scene's Position mode
// and the editor's Image tool. Matrix-only downstream (texture repeat/offset).
export const INITIAL_ARTWORK: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

// #28: image adjustments — applied identically to the live 3D texture AND the print composite
// (one composeFront), so what Dan sees is what's printed. 100/100/100/0 = neutral.
export interface ImageFx { brightness: number; contrast: number; saturate: number; warmth: number }
export const NEUTRAL_FX: ImageFx = { brightness: 100, contrast: 100, saturate: 100, warmth: 0 }

// SHORTLIST #21 (Dan, 2026-06-10): fine-tuned BEN settings ARE the defaults — Magic must not reset
// them. Durable across reloads (localStorage) until changed again.
export interface FairingPrefs { detail: number; params: FairTracedRingOpts }

// DRAW (KAI-8949 — Dan's correction model): one drawing = ONE path with two renderings of the
// SAME hand — the faithful fit and the BEN-style CORRECTED version (imperfections auto-removed).
// Snap-to-stock was DROPPED by Dan ("if a shape's in stock the user just picks it perfect").
export interface DrawRecipe {
  /** the raw accumulated stroke in editor px (the "reset to raw" source of truth) */
  raw: [number, number][]
  /** the hand, faithfully vectorised (intentional wobble preserved) */
  fitted: VShape
  /** the hand, BEN-style corrected — flagrant imperfections removed (absent = correction failed) */
  corrected?: VShape
  active: 'raw' | 'corrected'
}
const FAIRING_KEY = 'kai-ben-fairing-v1'
function loadFairing(): FairingPrefs | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(FAIRING_KEY)
    return raw ? (JSON.parse(raw) as FairingPrefs) : null
  } catch { return null }
}

interface OutlineStore {
  spec: EffectSpecDraft | null
  setSpec: (spec: EffectSpecDraft | null) => void
  editedContourMM: Contour | null
  setEditedContourMM: (c: Contour | null) => void
  // The last committed editor document — so reopening "Edit" restores edits instead of re-deriving
  // the original BEN contour (the 3D already reflects edits via editedContourMM).
  editedDoc: OutlineDocument | null
  setEditedDoc: (d: OutlineDocument | null) => void
  // VECTOR CORE (reset Run 1): the committed vector-shape truth, persisted ALONGSIDE editedDoc —
  // reopening a vector-native shape restores true curves, never a polyline re-derivation.
  editedVShape: VShape | null
  setEditedVShape: (v: VShape | null) => void
  // DRAW: both renderings of the drawn shape live in the recipe while the shape exists —
  // "back to my drawing" is one tap at any time, in either direction (Dan, locked 2026-06-10).
  // Cleared when a different shape SOURCE lands (chip/upload/tune/generator/doc edit/reset);
  // survives transforms and point edits (reset-to-raw is an explicit, loud discard by design).
  drawRecipe: DrawRecipe | null
  setDrawRecipe: (r: DrawRecipe | null) => void
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
  // #21: Dan's tuned BEN fairing — the Tune dash writes it on commit; Magic reads it as the default.
  fairing: FairingPrefs | null
  setFairing: (f: FairingPrefs | null) => void
  // #28: image adjustments (editor Image tool) — ShapedModel re-composes the front on change.
  imageFx: ImageFx | null
  setImageFx: (fx: ImageFx | null) => void
  artwork: DesignState
  setArtwork: (d: DesignState) => void
}

export const useOutlineStore = create<OutlineStore>((set) => ({
  spec: null,
  setSpec: (spec) => set({ spec }),
  editedContourMM: null,
  setEditedContourMM: (editedContourMM) => set({ editedContourMM }),
  editedDoc: null,
  setEditedDoc: (editedDoc) => set({ editedDoc }),
  editedVShape: null,
  setEditedVShape: (editedVShape) => set({ editedVShape }),
  drawRecipe: null,
  setDrawRecipe: (drawRecipe) => set({ drawRecipe }),
  bgBlur: null,
  setBgBlur: (bgBlur) => set({ bgBlur }),
  subjMatteUrl: null,
  setSubjMatteUrl: (subjMatteUrl) => set({ subjMatteUrl }),
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  imageFx: null,
  setImageFx: (imageFx) => set({ imageFx }),
  artwork: INITIAL_ARTWORK,
  setArtwork: (artwork) => set({ artwork }),
  fairing: loadFairing(),
  setFairing: (fairing) => {
    try {
      if (typeof window !== 'undefined') {
        if (fairing) window.localStorage.setItem(FAIRING_KEY, JSON.stringify(fairing))
        else window.localStorage.removeItem(FAIRING_KEY)
      }
    } catch { /* private mode etc. — in-session value still applies */ }
    set({ fairing })
  },
}))
