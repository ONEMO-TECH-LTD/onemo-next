'use client'

// Two-way bridge between the 3D engine and the 2D editor (decouples the R3F tree from the DOM
// editor — no prop threading).
//   engine → editor : the page writes the latest `spec` when prepareEffect finishes; OutlineEditor
//                      opens FROM the vector truth (committedShape ?? spec.vectorShape).
//   editor → engine : every committed edit goes through commitGeometry (THE one writer) — shape +
//                      derived contour land atomically; ShapedModel rebuilds from the same truth,
//                      so what you approve is what's shown.
//   editorOpen      : §6.3 — while the editor overlay is open the scene is frozen, so ShapedModel
//                      DEFERS mesh rebuilds; ONE rebuild fires at the editor boundary (close).

import { create } from 'zustand'
import type { EffectSpecDraft, Contour } from '@/lib/effect/types'
import type { DesignState } from '../types'
import type { FairTracedRingOpts } from '@/lib/outline-core'
import type { VShape } from '@/lib/vector-core'
import { contourFromShape } from '@/lib/effect/geometry-truth'

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
  // SINGLE GEOMETRY TRUTH (REBUILD-PLAN-v2 §B): the committed vector shape. null = un-edited —
  // consumers fall back to spec.vectorShape (the truth born at generation). There is NO second
  // geometry field to desync from: the contour below is DERIVED inside the one writer.
  committedShape: VShape | null
  // DERIVED manufacturing contour of committedShape (0.05mm, mm/y-up) — written ONLY by
  // commitGeometry, never independently. null ⇔ committedShape null.
  committedContourMM: Contour | null
  // KAI-9032: the committed shape's lineage — 'trace' = the design's raw-trace fit (Magic cut),
  // 'vector' = a picked/uploaded/constructed vector. Tune re-fairs the RAW TRACE only for
  // trace-lineage shapes; vector shapes fair in place (never converted to the Magic cut).
  shapeLineage: 'trace' | 'vector'
  // THE one writer (single-writer invariant, plan §C-4): sets the shape and derives its contour
  // atomically. No store write for geometry exists outside this function. `lineage` marks shape
  // identity changes (seed/pick/upload/reset); omitted = lineage unchanged.
  commitGeometry: (v: VShape | null, lineage?: 'trace' | 'vector') => void
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

export const useOutlineStore = create<OutlineStore>((set, get) => ({
  spec: null,
  setSpec: (spec) => set({ spec }),
  committedShape: null,
  committedContourMM: null,
  shapeLineage: 'trace',
  commitGeometry: (v, lineage) => {
    if (!v) { set({ committedShape: null, committedContourMM: null }); return }
    const spec = get().spec
    const contour = spec ? contourFromShape(v, { mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx }) : null
    // a commit that cannot derive a contour is a degenerate edit — refuse it loudly rather than
    // committing a shape the 3D/manufacturing can't follow (no silent half-commit)
    if (!contour) { console.error('[geometry-truth] commitGeometry: contour derivation failed — commit refused'); return }
    set({ committedShape: v, committedContourMM: contour, ...(lineage ? { shapeLineage: lineage } : {}) })
  },
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
