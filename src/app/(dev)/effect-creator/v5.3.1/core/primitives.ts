'use client'

// core/primitives.ts — Layer-2a SOCKET PRIMITIVES (Creator v5.5 · blueprint §4 · DEC-v5-06 · KAI-9221).
//
// The flow-BLIND seam: each primitive performs exactly ONE engine operation and knows NOTHING about
// sequence (blueprint inv 15) — no history, no seq-guard, no cache, no notify, no "when". A flow
// (Layer 2b) composes them; the macro temporarily calls them during the Phase-2 cut-over (one impl
// per op — inv 2 — until v53Flow replaces the macro's composition in Phase 3).
//
// Lifted verbatim (behaviour-neutral) from the Creator macro (now flows/v53Flow.ts):
//   loadImage      ← upload                   prepareStandard ← upload
//   runCutout      ← startBackgroundCutout (segmentation ONLY; the seq-guard + matte publish + caches
//                    are the publishCutoutResult / history transactions — NOT here)
//   prepareShaped  ← magic                    exportCutlineSvg ← exportSvg
//
// NOT here: publishToViewer + handleStatus = the stateful VIEWER-ADAPTER (inv 26 2D/3D split);
// the 4 transaction services (history / publishCutoutResult / generation / sessions). Those own
// flow-timing state and live in their own modules.

import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import type { MLResult, SegmentProgress } from '@/lib/effect/segment-ml'
import type { Contour } from '@/lib/effect/types'
import type { ResolvedGridPlan, UserGridPlanOptions } from '@/lib/effect/grid-user'
import type { VShape } from '@/lib/vector-core'
import { detailToFloorMm } from '../user/editor/producers'

/** loadImage(file) → { url } — decode + the new-image blob lifecycle ONLY (validate type, revoke the
 *  prior blob, mint a fresh object URL). Flow-BLIND: NO store/state reset, NO downstream prepare/cut-out
 *  (blueprint §4 "no downstream side-effects, no auto-anything"). The app-state reset is the flow's job.
 *  Returns null on a non-image file (the flow decides what to do). */
export function loadImage(file: File, prevBlobUrl?: string): { url: string } | null {
  if (!file.type.startsWith('image/')) return null
  if (prevBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(prevBlobUrl)
  return { url: URL.createObjectURL(file) }
}

/** prepareStandard(url) → prepared — the instant flat ONEMO square at the display cap (inv 19). Does
 *  NOT build 3D and does NOT start a cut-out — those are separate primitives a flow may or may not call. */
export async function prepareStandard(url: string): Promise<PreparedEffect> {
  const { prepareEffect } = await import('@/lib/effect/prepare-effect')
  return prepareEffect(url, 'standard')
}

/** runCutout(url) → seg — the AI cut. Owns the working-res cap (passes effectiveTextureDim() to
 *  segmentML — inv 19; the cut-out WORKER self-caps separately inside ben.worker.runRembg). Returns the
 *  segmentation DATA only: it does NOT publish, cache, seq-guard, or build a matte — the flow's
 *  publishCutoutResult / history transactions own those. segPresent (the ?seg harness skip) is a FLOW
 *  decision (inv 25), checked by the caller, never here. */
export async function runCutout(url: string, onProgress?: (s: SegmentProgress) => void): Promise<MLResult> {
  const [{ segmentML }, { effectiveTextureDim }, { EFFECT_BUILD_CONFIG }] = await Promise.all([
    import('@/lib/effect/segment-ml'),
    import('@/lib/effect/mask'),
    import('@/lib/effect/prepare-effect'),
  ])
  return segmentML(url, EFFECT_BUILD_CONFIG.maxImageDim, effectiveTextureDim(), onProgress)
}

/** prepareShaped(url, preseg?) → prepared — Magic's shaped subject. preseg is OPTIONAL pass-through
 *  (Phase-2 Option A, expert source-verified): when supplied (the cache-hit path) the AI is not re-run;
 *  when absent, prepareEffect segments internally AT THE CAP and keeps the G4 flood-fill fallback
 *  (prepare-effect.ts:191/:194-199 — both already capped, no crash bypass). Behaviour-IDENTICAL to the
 *  macro, same cfg (Detail 100 floor, paddingMM 0). inv-28's literal required-preseg (one segmentation
 *  entry) is DEFERRED to a flagged hardening that MUST relocate the flood-fill + 'fallback' notify, not
 *  drop it (G4 "a degraded cut is never silent"). */
export async function prepareShaped(
  url: string,
  preseg?: MLResult,
  onProgress?: (s: 'downloading-model' | 'cutting' | 'fallback') => void,
): Promise<PreparedEffect> {
  const { prepareEffect, EFFECT_BUILD_CONFIG } = await import('@/lib/effect/prepare-effect')
  return prepareEffect(url, 'shaped', { ...EFFECT_BUILD_CONFIG, minFeatureMM: detailToFloorMm(100), paddingMM: 0 }, onProgress, preseg)
}

export type ExportResult =
  | { ok: true; svg: string }
  | { ok: false; reason: 'not-cuttable'; detail: string }

/** exportCutlineSvg(shape, geom) → result — the clean mm cut-line SVG from THE vector truth, feasibility
 *  gated (KAI-9077/MFG-1: never emit a folded/uncuttable shape). Flow-BLIND: returns a discriminated
 *  RESULT, never notifies (notify is an injected flow adapter — blueprint §4). The caller checks for a
 *  null shape ("nothing to export") and performs the file download (the injected export adapter). */
export async function exportCutlineSvg(
  shape: VShape,
  geom: { mmPerPx: number; maskWidthPx: number; maskHeightPx: number },
): Promise<ExportResult> {
  const [{ toManufacturingSVG }, { contourFromShape, assertContourCuttable }] = await Promise.all([
    import('@/lib/export'),
    import('@/lib/effect/geometry-truth'),
  ])
  const mmPerPx = geom.mmPerPx || 1
  const c = contourFromShape(shape, { mmPerPx, maskHeightPx: geom.maskHeightPx })
  const feas = c ? assertContourCuttable(c, mmPerPx) : { ok: false as const, reason: 'degenerate' as const }
  if (!feas.ok) return { ok: false, reason: 'not-cuttable', detail: feas.reason ?? 'degenerate' }
  return { ok: true, svg: toManufacturingSVG(shape, { mmPerPx, widthPx: geom.maskWidthPx, heightPx: geom.maskHeightPx }) }
}

/** Resolve the magnetic attachment plan from Creator's current mm contour. One flow-blind engine op:
 * no store, history, notification, UI control, or sequencing knowledge. */
export async function computeAttachmentGrid(
  contourMM: Contour,
  options: UserGridPlanOptions,
): Promise<ResolvedGridPlan> {
  const { resolveUserPlan } = await import('@/lib/effect/grid-user')
  return resolveUserPlan(contourMM, options)
}
