import { flattenPath, type VPath, type VShape } from '@/lib/vector-core'
import { rdpClosed, repairSimplePolygon, type Vec2Px } from '@/lib/outline-core/math'
import { insetRingMM, type OffsetJoin } from './offset'
import {
  GLOBAL_OFF,
  mintIds,
  outlineCurveFactor,
  outlineRadiusPx,
  resolve,
  simplifyTolPx,
  type LocalAdjustment,
  type OutlineSource,
} from './outline-resolve'

// ── GENERATION controls (KAI-9127 Detail / 9128 Offset) — re-derive the SOURCE from the cached AI trace,
//    no AI re-run (DEC-v5-04 / blueprint v5.2 §5). Dan-validated mappings (branch v5poc-detail). ──

/** Detail %: 100 = tightest pixel-clean (RDP floored to ~1px); 0 = coarsest facets. mm-true / scale-invariant. */
export const DETAIL_TIGHT_MM = 0
export const DETAIL_COARSE_MM = 10
export const detailToFloorMm = (pct: number) => {
  const d = Math.max(0, Math.min(100, pct)) / 100
  return DETAIL_COARSE_MM + d * (DETAIL_TIGHT_MM - DETAIL_COARSE_MM)
}
/** Inverse: the Detail % that corresponds to a given mm-floor — so the dial reflects the BORN trace's
 *  detail (value-reflection) instead of a guessed default. */
export const floorMmToDetail = (mm: number) => {
  const span = DETAIL_TIGHT_MM - DETAIL_COARSE_MM || 1
  return Math.round(Math.max(0, Math.min(100, ((mm - DETAIL_COARSE_MM) / span) * 100)))
}
/** Offset %: 0 → 0; 100 → the image's longest side (mm) so it can reach the image edges (bridge split subjects). */
export const offsetPctToMm = (pct: number, imgLongestMm: number) => (Math.max(0, Math.min(100, pct)) / 100) * imgLongestMm

/**
 * GENERATION re-derive: rebuild the editor's SHARP `OutlineSource` shape from the cached raw AI trace at a
 * chosen Detail (+ optional Offset), with NO AI re-run. Detail = RDP simplify to the mm-floor (tight↔coarse);
 * `repairSimplePolygon` drops degenerate/crossing vertices so the staircase can't tear the mesh; Offset
 * (applied LAST, no re-simplify) = Clipper2 outset with the chosen join, expand-only. De-staircasing into
 * smooth curves is the editor's Simplify tool (resolve adjustor), NOT here — this stays a raw sharp polygon
 * source (Generation births the raw sharp geometry; Editing shapes it). Returns null if degenerate.
 */
function traceSourceFromRawUnits(
  rawTracePx: ReadonlyArray<readonly [number, number]>, maskHeightPx: number, mmPerPx: number,
  detailPx: number, offsetMM: number, join: OffsetJoin,
): VShape | null {
  if (!rawTracePx.length) return null
  const eps = Math.max(1, detailPx)
  const yDown = rawTracePx.map(([x, y]) => [x, maskHeightPx - y] as Vec2Px)
  let pts = rdpClosed(yDown, eps)
  pts = repairSimplePolygon(pts, 1)
  if (pts.length < 3) return null
  let path: VPath = { anchors: pts.map(([x, y]) => ({ p: { x, y }, hIn: null, hOut: null, corner: true })) }
  if (offsetMM > 0) {
    const k = mmPerPx || 1
    const ringMM = flattenPath(path, 0.3).map((p) => [p.x * k, p.y * k] as [number, number])
    const off = insetRingMM(ringMM, offsetMM, join)
    if (off && off.length >= 3) path = { anchors: off.map(([x, y]) => ({ p: { x: x / k, y: y / k }, hIn: null, hOut: null, corner: true })) }
  }
  return { paths: [path] }
}

export function traceSourceFromRaw(
  rawTracePx: ReadonlyArray<readonly [number, number]>, maskHeightPx: number, mmPerPx: number,
  detailPct: number, offsetMM: number, join: OffsetJoin,
): VShape | null {
  return traceSourceFromRawUnits(
    rawTracePx, maskHeightPx, mmPerPx,
    detailToFloorMm(detailPct) / (mmPerPx || 1), offsetMM, join,
  )
}

export interface TraceOutlineInput {
  vectorShape: VShape
  rawTracePx?: ReadonlyArray<readonly [number, number]>
  maskWidthPx: number
  maskHeightPx: number
  mmPerPx: number
}

export interface TraceOutlineSettings {
  /** Omitted/legacy preserves Creator/Grid controls; px keeps Cutout Offset/Simplify/Radius in pixels. */
  spatialUnit?: 'legacy' | 'px'
  detail: number
  offset: number
  offsetJoin: OffsetJoin
  radius: number
  curve: number
  simplify: number
  smooth: number
  straighten: number
}

/** The reflected v5 birth recipe: full trace fidelity, no optional vector reshaping applied. */
export const TRACE_OUTLINE_DEFAULTS: TraceOutlineSettings = {
  detail: 100,
  offset: 0,
  offsetJoin: 'sharp',
  radius: 0,
  curve: 0,
  simplify: 0,
  smooth: 0,
  straighten: 0,
}

/** Cutout's all-off recipe: Detail keeps its prior 0=full scale; the other spatial controls use px. */
export const TRACE_OUTLINE_PIXEL_DEFAULTS: TraceOutlineSettings = {
  ...TRACE_OUTLINE_DEFAULTS,
  spatialUnit: 'px',
  detail: 0,
}

function traceSourceFromRawCutout(
  rawTracePx: ReadonlyArray<readonly [number, number]>, maskHeightPx: number, mmPerPx: number,
  detail: number, offsetPx: number, join: OffsetJoin,
): VShape | null {
  return traceSourceFromRawUnits(
    rawTracePx,
    maskHeightPx,
    mmPerPx,
    detailToFloorMm(100 - detail) / (mmPerPx || 1),
    offsetPx * (mmPerPx || 1),
    join,
  )
}

/** Apply the existing v5.3.1 generation + whole-outline controls without its UI/store/history shell. */
export function resolveTraceOutline(
  input: TraceOutlineInput,
  settings: TraceOutlineSettings,
): VShape | null {
  const pixelUnits = settings.spatialUnit === 'px'
  const generationChanged = pixelUnits ? settings.detail > 0 || settings.offset > 0 : settings.detail !== 100 || settings.offset > 0
  const raw = input.rawTracePx
  const sourceShape = generationChanged && raw?.length
    ? pixelUnits
      ? traceSourceFromRawCutout(raw, input.maskHeightPx, input.mmPerPx, settings.detail, settings.offset, settings.offsetJoin)
      : traceSourceFromRaw(
          raw,
          input.maskHeightPx,
          input.mmPerPx,
          settings.detail,
          offsetPctToMm(
            settings.offset,
            Math.max(input.maskWidthPx, input.maskHeightPx) * input.mmPerPx,
          ),
          settings.offsetJoin,
        )
    : input.vectorShape
  if (!sourceShape) return null

  const shape = settings.curve > 0 ? mintIds(sourceShape) : sourceShape
  const local: Record<string, LocalAdjustment> = {}
  if (settings.curve > 0) {
    const curve = outlineCurveFactor(settings.curve)
    for (const path of shape.paths) for (const anchor of path.anchors) {
      if (anchor.id) local[anchor.id] = { curve }
    }
  }
  const source: OutlineSource = {
    shape,
    klass: 'generated',
    mmPerPx: input.mmPerPx,
    maskHeightPx: input.maskHeightPx,
    rawTracePx: raw ? raw.map(([x, y]) => [x, y]) : undefined,
  }
  const global = {
    ...GLOBAL_OFF,
    spatialUnit: pixelUnits ? 'px' as const : 'scaled' as const,
    simplify: settings.simplify,
    smooth: settings.smooth,
    straighten: settings.straighten,
  }
  const withoutRadius = resolve(source, { global, local })
  return resolve(source, {
    global: {
      ...global,
      radius: pixelUnits ? settings.radius : outlineRadiusPx(settings.radius, withoutRadius),
    },
    local,
  })
}

/**
 * Convert a pre-pixel Cutout recipe against its current source without changing its rendered shape.
 * Detail keeps its prior visible 0=full value; Offset/Simplify/Radius become direct pixels.
 */
export function traceSettingsToPixelUnits(
  input: TraceOutlineInput,
  settings: TraceOutlineSettings,
): TraceOutlineSettings {
  if (settings.spatialUnit === 'px') return { ...settings }
  const generationShape = resolveTraceOutline(input, {
    ...settings,
    curve: 0,
    radius: 0,
    simplify: 0,
    smooth: 0,
    straighten: 0,
  }) ?? input.vectorShape
  const path = generationShape.paths[0]
  const xs = path?.anchors.map((anchor) => anchor.p.x) ?? [0, 1]
  const ys = path?.anchors.map((anchor) => anchor.p.y) ?? [0, 1]
  const shortSidePx = Math.max(1, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))
  const withoutRadius = resolveTraceOutline(input, { ...settings, radius: 0 }) ?? generationShape
  return {
    ...settings,
    spatialUnit: 'px',
    detail: 100 - settings.detail,
    offset: (Math.max(0, settings.offset) / 100) * Math.max(input.maskWidthPx, input.maskHeightPx),
    simplify: simplifyTolPx(settings.simplify, shortSidePx),
    radius: outlineRadiusPx(settings.radius, withoutRadius),
  }
}
