'use client'

// Two-way bridge between the 3D engine and the 2D editor (decouples the R3F tree from the DOM editor).
//   engine → editor : the page writes the latest `spec` when prepareEffect finishes; OutlineEditor
//                     seeds an OutlineSource from spec.vectorShape (the raw marching-squares truth).
//   editor → engine : every edit is `{ source, adjustments }`; the store DERIVES the display/cut by
//                     `resolve(source, adjustments)` → committedShape → committedContourMM. ShapedModel
//                     rebuilds from the SAME derived truth, so what you approve is what's shown.
//   editorOpen      : §6.3 — while the overlay is open the scene is frozen; ShapedModel defers mesh
//                     rebuilds to the close boundary.
//
// V4 (blueprint v4-foundation.md): the truth is SOURCE + ADJUSTMENTS, not a baked VShape. `resolve`
// is the one impartial, non-destructive engine (all-off === exact source). The old baked-`VShape`
// authority (committed-shape-as-truth, `fairing`-as-durable, lineage strings) is gone — committedShape
// is now a DERIVED projection kept only as the consumer contract (ShapedModel / page / payload).

import { create } from 'zustand'
import type { EffectSpecDraft, Contour } from '@/lib/effect/types'
import type { DesignState } from '../types'
import type { VShape } from '@/lib/vector-core'
import { contourFromShape, assertContourCuttable } from '@/lib/effect/geometry-truth'
import { resolve, ADJUSTMENTS_OFF, mintIds, type OutlineSource, type OutlineAdjustments, type OutlineClass } from '@/lib/effect/outline-resolve'
import type { PresetKey } from '@/lib/effect/composite'

// #28: artwork position (pan/zoom within the shape) — ONE source for the scene's Position mode
// and the editor's Image tool. Matrix-only downstream (texture repeat/offset).
export const INITIAL_ARTWORK: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }

// #28: image adjustments — applied identically to the live 3D texture AND the print composite
// (one composeFront), so what Dan sees is what's printed. 100/100/100/0 = neutral.
// Filters v2 (KAI-9125): preset = a one-tap look; vignette/tint = composite effects. All image-stage
// appearance, baked into the one composite (3D == print). Optional so existing 100/100/100/0 stays neutral.
export interface ImageFx { brightness: number; contrast: number; saturate: number; warmth: number; preset?: PresetKey; vignette?: number; tint?: string | null }
export const NEUTRAL_FX: ImageFx = { brightness: 100, contrast: 100, saturate: 100, warmth: 0, preset: 'none', vignette: 0, tint: null }

/** F8 / inv 21 — transactional commit result. A fail-closed (R9) refusal returns `{ok:false}` + reason so the
 *  caller rolls the control back + signals + pushes NO history/selection-clear; success — and the cleared/null
 *  case — returns `{ok:true}` so void-ignoring flow callers (e.g. `restoreSnap`) are behaviour-unaffected. */
export type CommitResult = { ok: true } | { ok: false; reason: string }

interface OutlineStore {
  spec: EffectSpecDraft | null
  setSpec: (spec: EffectSpecDraft | null) => void

  // ── V4 TRUTH ──────────────────────────────────────────────────────────────
  /** the immutable source vector (per-anchor ids). null = no design loaded. */
  source: OutlineSource | null
  /** the editable recipe over `source`. resolve(source, adjustments) = the display/cut shape. */
  adjustments: OutlineAdjustments

  // ── DERIVED projection (consumer contract — ShapedModel / page / payload read these) ──
  /** = resolve(source, adjustments). null ⇔ source null. The display/cut VShape (what's approved). */
  committedShape: VShape | null
  /** = contourFromShape(committedShape) @ 0.05mm, mm/y-up. null ⇔ committedShape null. */
  committedContourMM: Contour | null

  /** Producer / re-baseline writer: install a NEW source and re-derive. `adjustments` defaults to OFF
   *  (a fresh source shows verbatim). Used by Magic seed, stock/upload/drawn pickers, Reset, and the
   *  re-baseline of manual point edits. */
  setSource: (source: OutlineSource | null, adjustments?: OutlineAdjustments) => CommitResult
  /** Tool writer: update the recipe on the CURRENT source and re-derive (the editor's sliders/radius). */
  setAdjustments: (adjustments: OutlineAdjustments) => CommitResult
  /** COMPAT shim (page.tsx page-level undo/reset): wrap a plain VShape as a fresh all-off source, or
   *  clear (null). `klass` carries the old lineage hint. The contour re-derives here so a restore can
   *  never desync. */
  commitGeometry: (v: VShape | null, klass?: OutlineClass) => CommitResult

  bgBlur: number | null
  setBgBlur: (v: number | null) => void
  subjMatteUrl: string | null
  setSubjMatteUrl: (u: string | null) => void
  editorOpen: boolean
  setEditorOpen: (v: boolean) => void
  imageFx: ImageFx | null
  setImageFx: (fx: ImageFx | null) => void
  /** Filters v2 (KAI-9125) fill/tile: when the Offset cut expands past the photo, TILE the photo
   *  (RepeatWrapping = the no-AI "fill") vs CLAMP the edge. false = clamp (default). */
  wrapTile: boolean
  setWrapTile: (v: boolean) => void
  artwork: DesignState
  setArtwork: (d: DesignState) => void
}

/** F8 / inv 21 — the derive outcome: success carries the projection; a fail-closed (R9) refusal carries the
 *  reason so the caller can roll back + signal. The "cleared" (null source) case is handled by each writer. */
type DeriveOutcome = { ok: true; committedShape: VShape; committedContourMM: Contour } | { ok: false; reason: string }
/** Derive the consumer projection from a NON-NULL source. `{ok:false}` ⇔ the contour can't derive or isn't
 *  cuttable — the caller then REFUSES the commit (R9 fail-closed: editor truth never advances past a bad
 *  projection, so source/adjustments and committedShape/contour can never desync). */
function derive(source: OutlineSource, adjustments: OutlineAdjustments): DeriveOutcome {
  const shape = resolve(source, adjustments)
  const contour = contourFromShape(shape, { mmPerPx: source.mmPerPx, maskHeightPx: source.maskHeightPx })
  if (!contour) { console.error('[outlineStore] derive: contour derivation failed — refusing commit (R9 fail-closed)'); return { ok: false, reason: 'null-contour' } }
  // KAI-9077: R9 also refuses a NON-CUTTABLE contour (self-intersection / collapsed), not just null.
  // contourFromShape returns non-null for any >=3-pt ring, so a folded outline would otherwise commit
  // to the mesh + mfg contour. assertContourCuttable is the same feasibility gate payload.ts uses.
  const feas = assertContourCuttable(contour, source.mmPerPx)
  if (!feas.ok) { console.error(`[outlineStore] derive: contour not cuttable (${feas.reason}) — refusing commit (R9 fail-closed)`); return { ok: false, reason: `not-cuttable:${feas.reason}` } }
  return { ok: true, committedShape: shape, committedContourMM: contour }
}

export const useOutlineStore = create<OutlineStore>((set, get) => ({
  spec: null,
  setSpec: (spec) => set({ spec }),

  source: null,
  adjustments: { global: { ...ADJUSTMENTS_OFF.global }, local: {} },
  committedShape: null,
  committedContourMM: null,

  setSource: (source, adjustments) => {
    const adj = adjustments ?? { global: { ...ADJUSTMENTS_OFF.global }, local: {} }
    if (!source) { set({ source: null, adjustments: adj, committedShape: null, committedContourMM: null }); return { ok: true } }
    const d = derive(source, adj)
    if (!d.ok) return d // R9 fail-closed: a refused derive must not advance editor truth
    set({ source, adjustments: adj, committedShape: d.committedShape, committedContourMM: d.committedContourMM })
    return { ok: true }
  },
  setAdjustments: (adjustments) => {
    const source = get().source
    if (!source) { set({ adjustments, committedShape: null, committedContourMM: null }); return { ok: true } }
    const d = derive(source, adjustments)
    if (!d.ok) return d // R9 fail-closed: truth + projection can never desync
    set({ adjustments, committedShape: d.committedShape, committedContourMM: d.committedContourMM })
    return { ok: true }
  },
  commitGeometry: (v, klass) => {
    if (!v) { set({ source: null, adjustments: { global: { ...ADJUSTMENTS_OFF.global }, local: {} }, committedShape: null, committedContourMM: null }); return { ok: true } }
    const spec = get().spec
    if (!spec) { console.error('[outlineStore] commitGeometry: no spec — cannot wrap a source'); return { ok: false, reason: 'no-spec' } }
    const source: OutlineSource = { shape: mintIds(v), klass: klass ?? 'generated', mmPerPx: spec.mmPerPx, maskHeightPx: spec.maskHeightPx }
    const adj = { global: { ...ADJUSTMENTS_OFF.global }, local: {} }
    const d = derive(source, adj)
    if (!d.ok) return d // R9 fail-closed
    set({ source, adjustments: adj, committedShape: d.committedShape, committedContourMM: d.committedContourMM })
    return { ok: true }
  },

  bgBlur: null,
  setBgBlur: (bgBlur) => set({ bgBlur }),
  subjMatteUrl: null,
  setSubjMatteUrl: (subjMatteUrl) => set({ subjMatteUrl }),
  editorOpen: false,
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  imageFx: null,
  setImageFx: (imageFx) => set({ imageFx }),
  wrapTile: false,
  setWrapTile: (wrapTile) => set({ wrapTile }),
  artwork: INITIAL_ARTWORK,
  setArtwork: (artwork) => set({ artwork }),
}))
