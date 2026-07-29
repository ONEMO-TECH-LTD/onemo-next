// descriptors/shape/shape-pick.ts — the Shape PICKER (one descriptor, one file). A source-PRODUCER, not a
// value tool: pick a stock/parametric/generator shape (or upload one) → install a NEW source. Re-homed from
// OutlineEditor.pickShape/nudgeParam/previewParam/commitShape/rerollBlob/onUploadShape + producers +
// shape-library. ALL picker-specific logic (chip lineup, param specs, shape-build) is self-contained here;
// only the SHARED EditorCtx.installSource is the engine binding. Remove this file + its registry line = the
// Shape outlet vanishes, zero shared-controller edit (the bundling test, verified live at step 7).

import type { PickerDescriptor, PickerParamSpec, PickerParams, EditorCtx } from '../types'
import type { CommitResult } from '../../../outlineStore'
import { mintIds, type OutlineSource, type OutlineAdjustments } from '@/lib/effect/outline-resolve'
import { DEFAULT_ROUNDED_SQUARE_CALIBRATION } from '@/lib/effect/effect-calibration'
import { shapeBBox, type VShape } from '@/lib/vector-core'
import { getShape, hasVectorDef } from '@/lib/shape-library'
import { vshapeFromSVG, fitShapeToBox } from '@/lib/export'
import { GEN_VECTOR_KINDS, vecFromGenerator, vecFromImageFile, shapePreviewD } from '../../producers'
import { cornerRadiusAdjustments } from '../../seed-defaults'
import { SHAPE_CHIPS } from '../../shape-chips'
import { type ShapeKind } from '../../../shapes'

type Dims = { widthPx: number; heightPx: number; mmPerPx: number; maskHeightPx: number }

/** Canvas dims + mm scale from the spec/source (the picker reads them; it never owns store state). */
function dimsOf(ctx: EditorCtx): Dims {
  const sp = ctx.getSpec()
  const src = ctx.getSource()
  const widthPx = sp?.maskWidthPx ?? 1000
  const heightPx = sp?.maskHeightPx ?? 1000
  return {
    widthPx,
    heightPx,
    mmPerPx: src?.mmPerPx ?? sp?.mmPerPx ?? 1,
    maskHeightPx: src?.maskHeightPx ?? sp?.maskHeightPx ?? heightPx,
  }
}

const wrap = (shape: VShape, d: Dims): OutlineSource => ({ shape, klass: 'stock', mmPerPx: d.mmPerPx, maskHeightPx: d.maskHeightPx })

/** Build the source (+ optional default adjustments) for a picked kind at the given params (pure). */
function buildSource(kind: ShapeKind, params: PickerParams, d: Dims): { source: OutlineSource; adjustments?: OutlineAdjustments } | null {
  // squircle / pill — math-derived: a SHARP square/rect + a reversible Radius adjustment (KAI-9129).
  if (kind === 'squircle' || kind === 'pill') {
    let base: VShape
    if (kind === 'squircle') base = mintIds(getShape('square', d.widthPx, d.heightPx))
    else {
      const long = Math.min(d.widthPx, d.heightPx) * 0.72, hw = long / 2, hh = (long * 0.5) / 2
      const cx = d.widthPx / 2, cy = d.heightPx / 2
      base = mintIds({ paths: [{ anchors: [
        { p: { x: cx - hw, y: cy - hh }, hIn: null, hOut: null, corner: true },
        { p: { x: cx + hw, y: cy - hh }, hIn: null, hOut: null, corner: true },
        { p: { x: cx + hw, y: cy + hh }, hIn: null, hOut: null, corner: true },
        { p: { x: cx - hw, y: cy + hh }, hIn: null, hOut: null, corner: true },
      ] }] })
    }
    const bb = shapeBBox(base, 1)
    const half = Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 2
    const r = kind === 'squircle'
      ? DEFAULT_ROUNDED_SQUARE_CALIBRATION.radiusMM / d.mmPerPx
      : Math.round(half) // pill: full short-end round → stadium
    return { source: { ...wrap(base, d) }, adjustments: cornerRadiusAdjustments(base, r) }
  }
  // vector-def kinds (square/circle/polygon/star/heart/diamond/sparkle/pinched/…) — true Bézier from the library.
  if (hasVectorDef(kind as Parameters<typeof getShape>[0])) {
    const base = getShape(kind as Parameters<typeof getShape>[0], d.widthPx, d.heightPx, { sides: params.sides, points: params.points, spikiness: params.spikiness })
    return { source: wrap(mintIds(base), d) }
  }
  // live generators (daisy/pinwheel/form/blob) — fitted once to a vector path.
  if (GEN_VECTOR_KINDS.has(kind)) {
    const v = vecFromGenerator(kind, { ...params }, { widthPx: d.widthPx, heightPx: d.heightPx }, d.mmPerPx)
    return { source: wrap(mintIds(v), d) }
  }
  return null
}

export const shapePickDescriptor: PickerDescriptor = {
  kind: 'picker',
  id: 'shape-pick',
  outlet: 'shape',
  label: 'Shape',
  icon: 'shape',
  chips: SHAPE_CHIPS.map((c) => ({ id: c.kind, label: c.label })),
  paramSpecs: (kind): PickerParamSpec[] => {
    switch (kind) {
      case 'polygon': return [{ key: 'sides', label: 'Sides', control: 'stepper', min: 3, max: 12 }]
      case 'star': return [{ key: 'points', label: 'Points', control: 'stepper', min: 3, max: 12 }, { key: 'spikiness', label: 'Spike', control: 'slider', min: 5, max: 95 }]
      case 'daisy': return [{ key: 'petals', label: 'Petals', control: 'stepper', min: 5, max: 12 }, { key: 'depth', label: 'Depth', control: 'slider', min: 0, max: 100 }]
      case 'pinwheel': return [{ key: 'blades', label: 'Blades', control: 'stepper', min: 3, max: 8 }, { key: 'swirl', label: 'Swirl', control: 'slider', min: 0, max: 100 }]
      case 'form': return [{ key: 'lobes', label: 'Lobes', control: 'stepper', min: 1, max: 8 }, { key: 'pinch', label: 'Pinch', control: 'slider', min: 0, max: 100 }]
      case 'blob': return [{ key: 'waviness', label: 'Wavy', control: 'slider', min: 0, max: 100 }]
      default: return []
    }
  },
  pick: (kind, params, ctx) => {
    // params PERSIST across picks within a session (matches OutlineEditor.pickShape's shapeParamsRef); only
    // blob mints a fresh seed merged into the CURRENT params (a new blob on each pick).
    const next: PickerParams = kind === 'blob' ? { ...params, seed: Math.floor(Math.random() * 1e9) } : params
    const built = buildSource(kind as ShapeKind, next, dimsOf(ctx))
    if (!built) return { params: next, result: { ok: false, reason: `no vector construction for "${kind}"` } }
    return { params: next, result: ctx.installSource(built.source, built.adjustments, true) }
  },
  apply: (kind, params, ctx): CommitResult => {
    const built = buildSource(kind as ShapeKind, params, dimsOf(ctx))
    if (!built) return { ok: false, reason: `no vector construction for "${kind}"` }
    return ctx.installSource(built.source, built.adjustments, true)
  },
  previewRing: (kind, params, ctx): string | null => {
    // generator kinds preview as a display ring while a tick drags; vector kinds regenerate on apply (no ring).
    if (!GEN_VECTOR_KINDS.has(kind as ShapeKind)) return null
    const d = dimsOf(ctx)
    return shapePreviewD(kind as ShapeKind, { ...params }, { widthPx: d.widthPx, heightPx: d.heightPx })
  },
  reroll: (kind, params, ctx) => {
    const next: PickerParams = { ...params, seed: Math.floor(Math.random() * 1e9) } // dice — a fresh blob seed
    const result = shapePickDescriptor.apply(kind, next, ctx)
    return { params: next, result }
  },
  uploadShape: async (file, ctx): Promise<CommitResult> => {
    const d = dimsOf(ctx)
    try {
      const isSVG = file.type.includes('svg') || /\.svg$/i.test(file.name)
      const raw = isSVG ? vshapeFromSVG(await file.text()) : await vecFromImageFile(file)
      const v = fitShapeToBox(raw, d.widthPx, d.heightPx)
      return ctx.installSource(wrap(mintIds(v), d), undefined, true)
    } catch (err: unknown) {
      ctx.notify('error', err instanceof Error ? err.message : 'This file could not be read')
      return { ok: false, reason: 'upload-failed' }
    }
  },
}
