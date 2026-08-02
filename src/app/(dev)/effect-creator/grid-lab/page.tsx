'use client'

// grid-lab — Session 59 magnetic-grid registration bench (2D vector).
// ALL engine shape sources through contourFromShape → computeGrid, rendered true-to-scale:
//   • Presets    — shape-library getShape() (baked vector data)
//   • Generators — generateShapeRing() (blob / clover / daisy / pinwheel)
//   • AI Magic   — image upload → prepareShaped() → cut-out + vector outline + blend composite
// Every source yields a VShape → final mm contour consumed by the neutral grid engine.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getShape, hasVectorDef, type VectorShapeKind } from '@/lib/shape-library'
import { shapeBBox, type VShape } from '@/lib/vector-core'
import { generateShapeRing, type ShapeKind } from '../v5.3.1/user/shapes'
import {
  resolveTraceOutline,
  TRACE_OUTLINE_DEFAULTS,
  type TraceOutlineSettings,
} from '../v5.3.1/user/editor/producers'
import {
  composeEffectArtwork,
  loadImage,
  prepareShaped,
  type ArtworkFillMode,
} from '../v5.3.1/core/primitives'
import { contourFromShape, MANUFACTURING_TOLERANCE_MM } from '@/lib/effect/geometry-truth'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { DEFAULT_ROUNDED_SQUARE_CALIBRATION } from '@/lib/effect/effect-calibration'
import { roundedSquareContourMM } from '@/lib/effect/rounded-square'
import type { Contour, Pt } from '@/lib/effect/types'
import { deriveRectangleConstruction, nearestAnchorPair, nearestSemanticRung, nextSemanticRung, resolveDesignSizeMM, resolveRectangleRungs, scaleContour, stdShapeContour, rectFormat, minEffectMM, maxDesignMM, DEFAULT_MARGIN_MM, DEFAULT_LAW, type GridJob, type GridJobResult, type GridPattern, type GridPlanOptions, type LadderRecipe, type MagnetPlan, type GridDensity, type GridMode, type PlanRecipe, type ResolvedGridPlan, type SemanticRung, type StandardLadderShape, type StdShape, type Attachment } from '@/lib/effect/grid'
import { requestGridWorkerJobInBackground } from '@/lib/effect/grid-worker-client'
import {
  cachedGridJob,
  gridJobKey,
  requestGridJob,
  suspendGridWork,
} from '@/lib/effect/grid-client'
import { GridWorkbenchAdminPanel, type GridWorkbenchAdminPanelProps } from './GridWorkbenchAdminPanel'
import {
  GridWorkbenchOutlinePanel,
  type GridWorkbenchOutlinePanelProps,
} from './GridWorkbenchOutlinePanel'
import { GridWorkbenchPanel, type GridWorkbenchPanelProps } from './GridWorkbenchPanel'
import { contourDimension as dim, GridWorkbenchReadouts, GridWorkbenchStage } from './GridWorkbenchRenderer'
import { useGridWorkerJob } from './useGridWorkerJob'

const IMG = 1000
const VP = 440
const FIT = 0.86

type Src = 'std' | 'preset' | 'gen' | 'magic' | 'magic2'
type GridTheme = 'light' | 'dark'
type StdGeo = StdShape
type MagicState = {
  prepared: PreparedEffect
  adapter: string
  imgUrl: string
  fileKey: string
  initialCompositeSha256: string
} | null
type LiveArtwork = {
  key: string
  imageUrl: string
  imgW: number
  imgH: number
  originX: number
  originY: number
}
interface NormalizedContour {
  contour: Contour
  longestPx: number
}
interface PlanDesign {
  design: Contour
  recipe: PlanRecipe
  designSize: number
  format: string | null
}

interface PreparedDesign extends PlanDesign {
  rung: SemanticRung | null
  rungH: SemanticRung | null
}

const requestLadderJob = (job: GridJob) =>
  requestGridWorkerJobInBackground(job, requestGridJob)

declare global {
  interface Window {
    __GRID_LAB_PROOF__?: {
      status: 'resolving-sizes' | 'resolving-grid' | 'ready' | 'error'
      ladderKey: string | null
      planKey: string | null
      renderedPlanKey: string | null
      plan: ResolvedGridPlan | null
      rendered: { effectMM: number; seated: number; pitchMM: number; pattern: string } | null
    }
  }
}

function bboxOf(pts: ReadonlyArray<{ x: number; y: number }>) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y }
  return { w: c - a, h: d - b }
}

function contourBoundsPx(contour: Contour, pixelsToMM: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of contour.outer.pts) {
    minX = Math.min(minX, x / pixelsToMM); maxX = Math.max(maxX, x / pixelsToMM)
    minY = Math.min(minY, y / pixelsToMM); maxY = Math.max(maxY, y / pixelsToMM)
  }
  return { minX, minY, maxX, maxY }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function canvasSha256(canvas: HTMLCanvasElement): Promise<string> {
  return sha256Hex(await (await fetch(canvas.toDataURL())).arrayBuffer())
}

async function sessionFileKey(file: File): Promise<string> {
  return sha256Hex(await file.arrayBuffer())
}
/** VShape → contour normalized so its longest side = 1mm. The source is flattened at the
 * manufacturing tolerance of the largest physical rung, not at an arbitrary source-pixel scale:
 * at 310mm this remains ≤0.05mm, while smaller rungs are necessarily finer. */
function normBase(vs: VShape, maskH: number): NormalizedContour | null {
  const sourceBounds = shapeBBox(vs, MANUFACTURING_TOLERANCE_MM)
  const sourceLongestPx = Math.max(
    sourceBounds.maxX - sourceBounds.minX,
    sourceBounds.maxY - sourceBounds.minY,
    1,
  )
  const maxRungMMPerPx = DEFAULT_LAW.maxRungMM / sourceLongestPx
  const c = contourFromShape(vs, {
    mmPerPx: maxRungMMPerPx,
    maskHeightPx: maskH,
  })
  if (!c || c.outer.pts.length < 3) return null
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
  for (const [x, y] of c.outer.pts) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y }
  const L = Math.max(mxx - mnx, mxy - mny, 1)
  return {
    contour: { outer: { pts: c.outer.pts.map(([x, y]) => [x / L, y / L] as Pt) }, holes: [] },
    longestPx: sourceLongestPx,
  }
}

function normGeneratedRing(ring: ReadonlyArray<Pt>): Contour | null {
  if (ring.length < 3) return null
  const bb = bboxOf(ring.map(([x, y]) => ({ x, y })))
  const L = Math.max(bb.w, bb.h, 1)
  return {
    outer: { pts: ring.map(([x, y]) => [x / L, (IMG - y) / L] as Pt) },
    holes: [],
  }
}

export default function GridLab() {
  const [renderedPlanKey, setRenderedPlanKey] = useState<string | null>(null)
  const [sliderTransient, setSliderTransient] = useState(false)
  const [theme, setTheme] = useState<GridTheme>('dark')
  const [src, setSrc] = useState<Src>('std')
  const [geo, setGeo] = useState<StdGeo>('square')
  // rect system A: two legal axis rungs (equal = square) → orientation
  const [longMM, setLongMM] = useState(116)
  const [shortMM, setShortMM] = useState(68)
  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape')
  const [preset, setPreset] = useState<VectorShapeKind>('squircle')
  const [gen, setGen] = useState<ShapeKind>('blob')
  const [p1, setP1] = useState(55) // waviness / pinch / depth / swirl
  const [p2, setP2] = useState(7)  // seed / lobes / petals / blades
  const [sides, setSides] = useState(6)
  const [points, setPoints] = useState(5)
  const [roundedSquareRadiusMM, setRoundedSquareRadiusMM] = useState<number>(
    DEFAULT_ROUNDED_SQUARE_CALIBRATION.radiusMM,
  )
  const [sizeMM, setSizeMM] = useState(68)
  const [pitch, setPitch] = useState(48)
  const [pitchAuto, setPitchAuto] = useState(true)
  const [attachment, setAttachment] = useState<Attachment>('magnetic')
  const [density, setDensity] = useState<GridDensity>('light') // cell count: standard = more cells (48-first), light = fewer (96-first)
  const [pad, setPad] = useState(10)
  const [frameBufferMM, setFrameBufferMM] = useState(0)
  const [marginMode, setMarginMode] = useState<'auto' | 'manual'>('auto')
  const [manualMarginMM, setManualMarginMM] = useState(0)
  const [minMarginMM, setMinMarginMM] = useState(0)
  const [maxMarginMM, setMaxMarginMM] = useState(DEFAULT_MARGIN_MM)
  const [pattern, setPattern] = useState<GridPattern>('standard')
  const [patternAuto, setPatternAuto] = useState(true) // pattern joins the auto system — same physics search as pitch
  const [plan, setPlan] = useState<MagnetPlan>('auto') // engine law default: size-driven focal ramp
  const [front, setFront] = useState(false) // front-face overlay: magnets shown over the design/art
  const [centerMode, setCenterMode] = useState<'centroid' | 'bbox'>('centroid')
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [outlineSettings, setOutlineSettings] = useState<TraceOutlineSettings>(
    () => ({ ...TRACE_OUTLINE_DEFAULTS }),
  )
  const [blendPercent, setBlendPercent] = useState(50)
  const [fillMode, setFillMode] = useState<ArtworkFillMode>('clamp')
  const [liveArtwork, setLiveArtwork] = useState<LiveArtwork | null>(null)
  const handleSliderInteractionChange = useCallback((transient: boolean) => {
    if (transient) suspendGridWork()
    setSliderTransient(transient)
  }, [])

  const [magic, setMagic] = useState<MagicState>(null)
  const [magStatus, setMagStatus] = useState<string>('')   // '', 'downloading-model', 'cutting', 'error:...'
  const fileRef = useRef<HTMLInputElement>(null)
  const magicRequestRef = useRef(0)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const request = ++magicRequestRef.current
    setSrc((current) => current === 'magic2' ? 'magic2' : 'magic')
    const fileKey = await sessionFileKey(f)
    if (request !== magicRequestRef.current) return
    const cached = magic?.fileKey === fileKey ? magic : null
    setMagStatus(cached ? '' : 'cutting')
    const loaded = loadImage(f, magic?.imgUrl)
    if (!loaded) { setMagStatus('error:that file is not an image'); return }
    setOutlineSettings({ ...TRACE_OUTLINE_DEFAULTS })
    const prepared = cached
      ? Promise.resolve({
          ...cached.prepared,
          spec: { ...cached.prepared.spec, sourceRef: loaded.url },
        })
      : prepareShaped(loaded.url,
          undefined,
          (s) => {
            if (request === magicRequestRef.current) {
              setMagStatus(s === 'fallback' ? 'cutting (simple fallback)' : s)
            }
          },
        )
    prepared
      .then(async (p) => {
        const initialCompositeSha256 = cached?.initialCompositeSha256
          ?? await canvasSha256(p.composite)
        if (request !== magicRequestRef.current) {
          URL.revokeObjectURL(loaded.url)
          return
        }
        setMagic({
          prepared: p,
          adapter: p.spec.generator?.adapter ?? 'cut',
          imgUrl: loaded.url,
          fileKey,
          initialCompositeSha256,
        })
        setBlendPercent(Math.round(p.frontSrc.defaultBlendPercent))
        setFillMode('clamp')
        setMagStatus('')
      })
      .catch((err) => {
        URL.revokeObjectURL(loaded.url)
        if (request !== magicRequestRef.current) return
        console.error('[grid-lab] magic failed', err)
        setMagStatus('error:' + ((err as Error)?.message ?? 'cut failed'))
      })
  }

  const isMagicSource = src === 'magic' || src === 'magic2'
  const engineSource = src === 'magic2' ? 'magic' : src
  // V1 keeps its provisional random-shape cap. V2 deliberately uses the shared full system range;
  // both still enter the one engine as the same freeform `magic` source.
  const sizeBoundsSource = src === 'magic2' ? 'std' : engineSource
  const sizeMax = maxDesignMM(sizeBoundsSource, DEFAULT_LAW) // engine law: per-source max
  const activeLaw = useMemo(() => ({ ...DEFAULT_LAW, paddingMM: pad }), [pad])
  const sizeMin = minEffectMM(activeLaw)
  const resolvedSizeMM = resolveDesignSizeMM(
    sizeMM,
    sizeBoundsSource,
    activeLaw,
  )
  const fitMarginMinMM = marginMode === 'auto' ? minMarginMM : manualMarginMM
  const fitMarginMaxMM = marginMode === 'auto' ? maxMarginMM : manualMarginMM

  // PER-GEOMETRY standard sizes (Dan): each geometry's rungs are solved numerically from the live
  // recipe (padding/pattern law) — each shape derives its own frameless base. Rect derives
  // per-axis from the square ladder.
  // SEMANTIC SIZES: every shape's own T-shirt ladder (2XS=1pt · XS=2 · S=3 · M=4 · L/XL/2XL/3XL …).
  const gridMode: GridMode = patternAuto ? 'auto' : pattern
  const ladderShape: StandardLadderShape = src === 'std'
    ? (geo === 'rect' ? 'square' : geo)
    : 'square'
  const presetUnitContour = useMemo(
    () => src === 'preset' && hasVectorDef(preset)
      ? normBase(getShape(preset, IMG, IMG, { sides, points }), IMG)?.contour ?? null
      : null,
    [src, preset, sides, points],
  )
  const generatedUnitContour = useMemo(() => {
    if (src !== 'gen') return null
    const params = gen === 'blob' ? { kind: gen, waviness: p1, seed: p2 }
      : gen === 'form' ? { kind: gen, pinch: p1, lobes: p2 }
      : gen === 'daisy' ? { kind: gen, depth: p1, petals: p2 }
      : { kind: gen, swirl: p1, blades: p2 }
    return normGeneratedRing(
      generateShapeRing(params as Parameters<typeof generateShapeRing>[0], IMG, IMG),
    )
  }, [src, gen, p1, p2])
  const magicOutline = useMemo(() => {
    if (!isMagicSource || !magic) return null
    const spec = magic.prepared.spec
    return resolveTraceOutline({
      vectorShape: spec.vectorShape,
      rawTracePx: spec.rawTracePx,
      maskWidthPx: spec.maskWidthPx,
      maskHeightPx: spec.maskHeightPx,
      mmPerPx: spec.mmPerPx,
    }, outlineSettings)
  }, [isMagicSource, magic, outlineSettings])
  const magicBase = useMemo(
    () => magicOutline && magic
      ? normBase(magicOutline, magic.prepared.spec.maskHeightPx)
      : null,
    [magicOutline, magic],
  )
  const magicUnitContour = magicBase?.contour ?? null
  const sourceUnitContour = presetUnitContour ?? generatedUnitContour ?? magicUnitContour
  const isRoundedSquarePreset = src === 'preset' && preset === 'squircle'
  const ladderRecipe = useMemo<LadderRecipe | null>(
    () => isRoundedSquarePreset
      ? {
          kind: 'rounded-square',
          radiusMM: roundedSquareRadiusMM,
          minimumAnchors: DEFAULT_ROUNDED_SQUARE_CALIBRATION.minimumAnchors,
        }
      : presetUnitContour
      ? { kind: 'uniform-contour', unitContour: presetUnitContour }
      : src === 'magic2' && magicUnitContour
        ? {
            kind: 'uniform-contour',
            unitContour: magicUnitContour,
            minMarginMM: fitMarginMinMM,
            maxMarginMM: fitMarginMaxMM,
          }
      : src === 'magic2'
        ? null
      : snapToGrid && sourceUnitContour
        ? { kind: 'uniform-contour', unitContour: sourceUnitContour }
      : { kind: 'standard', shape: ladderShape },
    [
      isRoundedSquarePreset,
      fitMarginMaxMM,
      fitMarginMinMM,
      ladderShape,
      magicUnitContour,
      presetUnitContour,
      roundedSquareRadiusMM,
      snapToGrid,
      sourceUnitContour,
      src,
    ],
  )
  const planOptions = useMemo<GridPlanOptions>(() => ({
    attachment,
    source: engineSource,
    mode: gridMode,
    density,
    paddingMM: pad,
    frameBufferMM,
    plan,
    center: centerMode,
    baseMarginMM: fitMarginMinMM,
    // Catalogue rungs already are exact zero-margin grid extents. Adaptive growth is an explicit
    // freeform-only tool; applying it to a rung would silently invent a second product size.
    maxGrowMM: src === 'gen' || src === 'magic' || src === 'magic2'
      ? Math.max(0, fitMarginMaxMM - fitMarginMinMM)
      : 0,
    pitchMM: pitchAuto ? undefined : pitch,
    signedBaseMargin: true,
    diagnosticVelcro: true,
  }), [
    attachment, engineSource, gridMode, density, pad, frameBufferMM, plan, centerMode,
    fitMarginMinMM, fitMarginMaxMM, pitchAuto, pitch, src,
  ])

  const ladderJob = useMemo<GridJob | null>(() => ladderRecipe ? ({
    operation: 'ladder',
    recipe: ladderRecipe,
    law: activeLaw,
    mode: gridMode,
    options: planOptions,
  }) : null, [ladderRecipe, activeLaw, gridMode, planOptions])
  const ladderKey = ladderJob ? gridJobKey(ladderJob) : null
  const ladderState = useGridWorkerJob<GridJob, GridJobResult>(
    ladderJob,
    ladderKey,
    requestLadderJob,
    cachedGridJob,
    sliderTransient,
  )
  const stdRungs = useMemo(
    () => ladderState.result?.operation === 'ladder' ? ladderState.result.value : [],
    [ladderState.result],
  )

  const rectRungs = useMemo(
    () => stdRungs.length
      ? resolveRectangleRungs(stdRungs, { longMM, shortMM, orientation: orient })
      : null,
    [stdRungs, longMM, shortMM, orient],
  )
  const snapRungs = useMemo(
    () => stdRungs.filter((rung) => rung.sizeMM >= sizeMin && rung.sizeMM <= sizeMax),
    [stdRungs, sizeMin, sizeMax],
  )
  const rectangleSnapRungs = useMemo(
    () => snapRungs.filter((rung) => rung.points >= 2 && rung.sizeMM >= shortMM),
    [snapRungs, shortMM],
  )
  const rawTestSizeMM = src === 'std' && geo === 'rect' ? longMM : resolvedSizeMM
  const activeSnapRungs = src === 'std' && geo === 'rect' ? rectangleSnapRungs : snapRungs
  const activeSnapRung = snapToGrid && activeSnapRungs.length
    ? nextSemanticRung(activeSnapRungs, rawTestSizeMM)
    : null
  const effectiveTestSizeMM = activeSnapRung
    ? activeSnapRung.sizeMM
    : rawTestSizeMM
  const gridDerivedDesignSizeMM = activeSnapRung
    ? activeSnapRung.designSizeMM
    : resolvedSizeMM

  const planDesign = useMemo<PlanDesign | null>(() => {
    try {
      if (snapToGrid && !activeSnapRung) return null
      // ── STANDARD GEOMETRIES (D12–D15): drawn directly in mm; grid snap is explicit and shared ──
      if (src === 'std') {
        // Product buttons remain catalogue sizes; the admin test slider can explicitly inspect a
        // continuous size or advance it to the next engine-derived rung.
        if (geo === 'rect') {
          if (!rectRungs) return null
          const longSizeMM = snapToGrid
            ? activeSnapRung?.designSizeMM ?? effectiveTestSizeMM
            : longMM
          const shortSizeMM = snapToGrid ? rectRungs.shortRung.designSizeMM : shortMM
          const widthMM = orient === 'landscape' ? longSizeMM : shortSizeMM
          const heightMM = orient === 'landscape' ? shortSizeMM : longSizeMM
          const design = stdShapeContour(geo, widthMM, heightMM)
          return {
            design,
            recipe: { kind: 'standard', shape: geo, widthMM, heightMM },
            designSize: widthMM,
            format: rectFormat(widthMM, heightMM),
          }
        }
        const design = stdShapeContour(
          geo,
          gridDerivedDesignSizeMM,
          gridDerivedDesignSizeMM,
        )
        return {
          design,
          recipe: {
            kind: 'standard',
            shape: geo,
            widthMM: gridDerivedDesignSizeMM,
            heightMM: gridDerivedDesignSizeMM,
          },
          designSize: gridDerivedDesignSizeMM,
          format: null,
        }
      }
      if (isRoundedSquarePreset) {
        const design = roundedSquareContourMM(
          gridDerivedDesignSizeMM,
          gridDerivedDesignSizeMM,
          roundedSquareRadiusMM,
        )
        return {
          design,
          recipe: {
            kind: 'rounded-square',
            sizeMM: gridDerivedDesignSizeMM,
            radiusMM: roundedSquareRadiusMM,
          },
          designSize: gridDerivedDesignSizeMM,
          format: null,
        }
      }
      // base contour normalized so longest side = 1mm (scale-free); scaleContour() sizes it in mm
      const base = sourceUnitContour
      if (!base || base.outer.pts.length < 3) return null
      const b = base
      // Every contour uses the effective test size. Grid snap is on by default; disabling it is an
      // explicit continuous calibration mode. Only generators/AI may add adaptive outer margin.
      const dSize = gridDerivedDesignSizeMM
      const design = scaleContour(b, dSize)
      return {
        design,
        recipe: { kind: 'final-contour', contourMM: design },
        designSize: dSize,
        format: null,
      }
    } catch (e) { console.error('[grid-lab] shape build failed', e); return null }
  }, [
    src, geo, sourceUnitContour, rectRungs, gridDerivedDesignSizeMM,
    isRoundedSquarePreset, roundedSquareRadiusMM,
    snapToGrid, activeSnapRung, effectiveTestSizeMM, longMM, shortMM, orient,
  ])

  const preparedDesign = useMemo<PreparedDesign | null>(() => {
    if (!planDesign) return null
    if (snapToGrid && !stdRungs.length) return null
    if (src === 'std' && geo === 'rect') {
      if (!rectRungs) return null
      return {
        ...planDesign,
        rung: rectRungs.widthRung,
        rungH: rectRungs.heightRung,
      }
    }
    if (!stdRungs.length) return { ...planDesign, rung: null, rungH: null }
    const targetMM = snapToGrid
      ? effectiveTestSizeMM
      : src === 'std' ? sizeMM : planDesign.designSize
    const rung = nearestSemanticRung(stdRungs, targetMM)
    return { ...planDesign, rung, rungH: rung }
  }, [
    planDesign, stdRungs, src, geo, rectRungs, sizeMM,
    snapToGrid, effectiveTestSizeMM,
  ])

  const selectedConstruction = useMemo(() => {
    if (!snapToGrid || !preparedDesign?.rung) return undefined
    if (src !== 'std' || geo !== 'rect') return preparedDesign.rung.construction
    if (!preparedDesign.rungH) return undefined
    return deriveRectangleConstruction(
      preparedDesign.rung,
      preparedDesign.rungH,
      activeLaw,
      gridMode,
      planOptions,
    ) ?? undefined
  }, [preparedDesign, snapToGrid, src, geo, activeLaw, gridMode, planOptions])
  const planJob = useMemo<GridJob | null>(() => {
    if (!planDesign) return null
    const snappedMarginMM = src === 'magic2' && activeSnapRung
      ? activeSnapRung.marginMM
      : planOptions.baseMarginMM
    return {
      operation: 'plan',
      recipe: planDesign.recipe,
      options: {
        ...planOptions,
        baseMarginMM: snappedMarginMM,
        construction: selectedConstruction,
      },
    }
  }, [planDesign, planOptions, selectedConstruction, src, activeSnapRung])
  const planKey = planJob ? gridJobKey(planJob) : null
  const planState = useGridWorkerJob<GridJob, GridJobResult>(
    planJob,
    planKey,
    requestGridJob,
    cachedGridJob,
    sliderTransient,
  )
  const activePlanResult = planState.result?.operation === 'plan' ? planState.result : null
  const resolvedPlan = activePlanResult?.value ?? null

  const model = useMemo(() => {
    if (!preparedDesign || !resolvedPlan || !activePlanResult) return null
    const effect = resolvedPlan.effectContourMM
    const anchorPair = nearestAnchorPair(resolvedPlan.grid.anchors)
    return {
      planKey: activePlanResult.key,
      contour: effect,
      base: resolvedPlan.baseContourMM,
      design: preparedDesign.design,
      grid: resolvedPlan.grid,
      marginMM: resolvedPlan.resolvedMarginMM,
      grew: resolvedPlan.grewMM,
      effSize: Math.round(resolvedPlan.publishedSizeMM),
      baseSize: Math.round(resolvedPlan.baseSizeMM),
      frameBufferMM: resolvedPlan.frameBufferMM,
      designSize: preparedDesign.designSize,
      pitch: resolvedPlan.pitchMM,
      patternUsed: resolvedPlan.pattern ?? 'surface',
      magDist: resolvedPlan.nearestAnchorMM,
      anchorPair,
      rung: preparedDesign.rung,
      rungH: preparedDesign.rungH,
      format: preparedDesign.format,
    }
  }, [preparedDesign, resolvedPlan, activePlanResult])

  const runtimeError = ladderState.error ?? planState.error
  const runtimeStatus = runtimeError
    ? 'error'
    : planDesign && planState.pending
      ? 'resolving-grid'
      : ladderState.pending
        ? 'resolving-sizes'
        : 'ready'

  const artworkRequest = useMemo(() => {
    if (!isMagicSource || !magic || !model || !magicBase) return null
    const pixelsToMM = model.designSize / magicBase.longestPx
    const bounds = contourBoundsPx(model.contour, pixelsToMM)
    return {
      key: `${magic.imgUrl}|${model.planKey}|${blendPercent}|${fillMode}|${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`,
      pixelsToMM,
      bounds,
      magic,
      blendPercent,
      fillMode,
    }
  }, [isMagicSource, magic, model, magicBase, blendPercent, fillMode])

  useEffect(() => {
    if (!artworkRequest) return
    let current = true
    const { key, bounds, blendPercent: requestedBlendPercent, fillMode: requestedFillMode } = artworkRequest
    const { origCanvas, subjCanvas } = artworkRequest.magic.prepared.frontSrc
    composeEffectArtwork({
      originalCanvas: origCanvas,
      subjectCanvas: subjCanvas,
      outputBoundsPx: bounds,
      blendPercent: requestedBlendPercent,
      fillMode: requestedFillMode,
    }).then(({ canvas, frame }) => {
      if (!current) return
      setLiveArtwork({
        key,
        imageUrl: canvas.toDataURL(),
        imgW: canvas.width,
        imgH: canvas.height,
        originX: frame.originX,
        originY: frame.originY,
      })
    }).catch((error) => {
      if (current) console.error('[grid-lab] image recomposition failed', error)
    })
    return () => { current = false }
  }, [artworkRequest])

  useEffect(() => {
    const committedModel = model?.planKey === renderedPlanKey ? model : null
    window.__GRID_LAB_PROOF__ = {
      status: runtimeStatus,
      ladderKey,
      planKey,
      renderedPlanKey,
      plan: resolvedPlan,
      rendered: committedModel ? {
        effectMM: committedModel.effSize,
        seated: committedModel.grid.anchors.length,
        pitchMM: committedModel.pitch,
        pattern: committedModel.patternUsed,
      } : null,
    }
  }, [runtimeStatus, ladderKey, planKey, renderedPlanKey, resolvedPlan, model])

  const scale = model ? (VP * FIT) / Math.max(dim(model.contour, 0), dim(model.contour, 1)) : 0
  const frontArtwork = artworkRequest && liveArtwork?.key === artworkRequest.key
    ? {
        imageUrl: liveArtwork.imageUrl,
        imgW: liveArtwork.imgW,
        imgH: liveArtwork.imgH,
        originX: liveArtwork.originX,
        originY: liveArtwork.originY,
        pixelsToMM: artworkRequest.pixelsToMM,
      }
    : null
  const panelProps: GridWorkbenchPanelProps = {
    src, setSrc, geo, setGeo, setLongMM, setShortMM, orient, setOrient,
    preset, setPreset, gen, setGen, p1, setP1, p2, setP2, sides, setSides, points, setPoints,
    setSizeMM, attachment, setAttachment,
    magic, magStatus, fileRef, onFile, sizeMax, sizeMin,
    resolvedSizeMM: snapToGrid ? effectiveTestSizeMM : resolvedSizeMM,
    maxRungMM: DEFAULT_LAW.maxRungMM, gridMode, stdRungs, rectRungs, model,
    onSliderInteractionChange: handleSliderInteractionChange,
  }
  const outlinePanelProps: GridWorkbenchOutlinePanelProps = {
    values: outlineSettings,
    offsetJoin: outlineSettings.offsetJoin,
    blendPercent,
    fillMode,
    setValue: (key, value) => setOutlineSettings((current) => ({
      ...current,
      [key]: Math.max(0, Math.min(100, value)),
    })),
    setOffsetJoin: offsetJoin => setOutlineSettings((current) => ({
      ...current,
      offsetJoin,
    })),
    setBlendPercent: value => setBlendPercent(Math.max(0, Math.min(100, value))),
    setFillMode,
    onSliderInteractionChange: handleSliderInteractionChange,
  }
  const adminPanelProps: GridWorkbenchAdminPanelProps = {
    pitch, setPitch, pitchAuto, setPitchAuto, density, setDensity, pad, setPad,
    frameBufferMM,
    setFrameBufferMM: value => setFrameBufferMM(
      Number.isFinite(value) ? Math.max(0, value) : 0,
    ),
    marginMode, setMarginMode,
    appliedMarginMM: model?.marginMM ?? fitMarginMinMM,
    manualMarginMM,
    setManualMarginMM: value => setManualMarginMM(
      Math.max(0, Math.min(80, Math.round(value))),
    ),
    minMarginMM,
    setMinMarginMM: value => setMinMarginMM(
      Math.max(0, Math.min(maxMarginMM, Math.round(value))),
    ),
    maxMarginMM,
    setMaxMarginMM: value => setMaxMarginMM(
      Math.max(minMarginMM, Math.min(80, Math.round(value))),
    ),
    pattern, setPattern, patternAuto, setPatternAuto,
    plan, setPlan, front, setFront, centerMode, setCenterMode,
    roundedSquareRadiusMM,
    setRoundedSquareRadiusMM,
    roundedSquareRadiusMaxMM: DEFAULT_ROUNDED_SQUARE_CALIBRATION.sideMM / 2,
    showRoundedSquareRadius: isRoundedSquarePreset,
    testSizeMM: effectiveTestSizeMM,
    setTestSizeMM: value => {
      if (src === 'std' && geo === 'rect') setLongMM(value)
      else setSizeMM(value)
    },
    testSizeMin: src === 'std' && geo === 'rect' ? Math.max(sizeMin, shortMM) : sizeMin,
    testSizeMax: sizeMax,
    snapToGrid, setSnapToGrid,
    snapSizesMM: activeSnapRungs.map((rung) => rung.sizeMM),
    model,
    onSliderInteractionChange: handleSliderInteractionChange,
  }

  return (
    <div
      className="gl"
      data-theme={theme}
      data-grid-runtime-status={runtimeStatus}
      data-grid-slider-transient={sliderTransient}
      data-grid-ladder-key={ladderKey}
      data-grid-plan-key={planKey ?? ''}
      data-grid-rendered-plan-key={renderedPlanKey ?? ''}
      data-v531-initial-composite-sha256={magic?.initialCompositeSha256 ?? ''}
    >
      <style>{CSS}</style>
      <header className="gl-head">
        <div className="gl-head-top">
          <h1>Magnetic Grid Lab <span className="gl-tag">s59 · registration engine</span></h1>
          <button
            type="button"
            className="gl-theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            Theme · {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
        <p>Every engine shape source — presets, generators, and <b>AI image cut-out</b> — through the mm magnetic grid.
          The window is fixed; change the effect&apos;s real size and the proportions move. Drawn entirely from millimetres.</p>
      </header>

      <div className="gl-body">
        <aside className="gl-controls">
          <div className="gl-panel-stack"><GridWorkbenchAdminPanel {...adminPanelProps} /></div>
        </aside>

        <div className="gl-center">
          <GridWorkbenchStage
            model={model}
            scale={scale}
            viewportPx={VP}
            fit={FIT}
            front={front}
            frontArtwork={frontArtwork}
            emptyText={runtimeError
              ? `Grid error · ${runtimeError}`
              : runtimeStatus === 'resolving-sizes'
                ? 'Resolving sizes…'
                : runtimeStatus === 'resolving-grid'
                  ? 'Resolving grid…'
                  : isMagicSource
                    ? magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'
                    : 'shape unavailable'}
            emptySpin={runtimeStatus === 'resolving-sizes' || runtimeStatus === 'resolving-grid' || magStatus === 'downloading-model' || magStatus.startsWith('cutting')}
            onRenderedPlanCommit={setRenderedPlanKey}
          />
          {isMagicSource && magic && <GridWorkbenchOutlinePanel {...outlinePanelProps} />}
        </div>

        <aside className="gl-controls">
          {runtimeStatus !== 'ready' && (
            <div className="gl-card gl-resolving" role="status">
              {!runtimeError && <span className="gl-spin" />}
              <span>{runtimeError
                ? `Grid error · ${runtimeError}`
                : runtimeStatus === 'resolving-sizes'
                  ? 'Resolving sizes… controls remain available'
                  : 'Resolving grid… controls remain available'}</span>
            </div>
          )}

          <div className="gl-panel-stack"><GridWorkbenchPanel {...panelProps} /></div>

          {model && <GridWorkbenchReadouts model={model} scale={scale} />}
        </aside>
      </div>
    </div>
  )
}

const CSS = `
.gl{--bg:#eef1f5;--panel:#fff;--panel-2:#f6f8fb;--line:#dbe1ea;--ink:#18202e;--ink-2:#5a6577;--ink-3:#93a0b3;
  --accent:#2f6bff;--accent-soft:#2f6bff18;--grid:#9fb0cc;--suede:#ccd0d7;--margin:#aeb4bf;--frame:#d8c19a;--suede-edge:#8a919c;--magnet:#20242c;
  --magnet-hi:#6b7280;--mag8:#c98a12;--fail:#e5484d;--shadow:0 1px 2px #18202e0d,0 10px 26px #18202e0f;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;padding:26px 20px 70px;-webkit-font-smoothing:antialiased}
.gl[data-theme=dark]{--bg:#0f141b;--panel:#161c25;--panel-2:#12171f;--line:#232c3a;--ink:#e6edf3;--ink-2:#9aa6b6;--ink-3:#66717f;--accent:#4d84ff;--accent-soft:#4d84ff20;--grid:#3d4a60;--suede:#3a3e46;--margin:#4d535e;--frame:#66583f;--suede-edge:#22262d;--magnet:#0b0e12;--magnet-hi:#4a515c;--shadow:0 1px 2px #0005,0 12px 30px #0006}
.gl *{box-sizing:border-box}
.gl-head{max-width:1060px;margin:0 auto 20px}
.gl-head-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 5px}
.gl-head h1{font-size:20px;font-weight:640;letter-spacing:-.01em;margin:0;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.gl-tag{font:600 11px var(--mono);color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:20px;letter-spacing:.02em}
.gl-theme-toggle{flex:none;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink);padding:7px 10px;font:600 11px var(--mono);cursor:pointer;box-shadow:var(--shadow)}
.gl-theme-toggle:hover{border-color:var(--accent);color:var(--accent)}
.gl-head p{color:var(--ink-2);font-size:13.5px;margin:0;max-width:74ch;line-height:1.55}
.gl-body{max-width:1436px;margin:0 auto;display:grid;grid-template-columns:336px minmax(0,1fr) 336px;gap:20px;align-items:start}
@media (max-width:840px){.gl-body{grid-template-columns:1fr}}
.gl-center{min-width:0;display:flex;flex-direction:column;gap:16px}
.gl-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.gl-pad{padding:18px;display:flex;flex-direction:column;gap:15px}
.gl-stage{padding:20px;display:flex;flex-direction:column;gap:14px}
.gl-stage-head{display:flex;justify-content:space-between;gap:10px}
.gl-eye{font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.gl-vp{aspect-ratio:1;max-width:${VP}px;width:100%;margin:0 auto;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(var(--line) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/22px 22px,var(--panel-2);
  border:1px dashed var(--line);border-radius:12px;overflow:hidden}
.gl-empty{display:flex;align-items:center;gap:9px;color:var(--ink-3);font:12.5px var(--mono);text-align:center;padding:20px;max-width:80%}
.gl-spin{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:gspin .8s linear infinite;flex:none}
@keyframes gspin{to{transform:rotate(360deg)}}
.gl-legend{display:flex;flex-wrap:wrap;gap:13px;font:11px var(--mono);color:var(--ink-2)}
.gl-legend span{display:inline-flex;align-items:center;gap:5px}.gl-legend i{width:10px;height:10px;border-radius:3px}
.gl-controls{display:flex;flex-direction:column;gap:16px}
.gl-panel-stack{display:flex;flex-direction:column;gap:16px}
.gl-resolving{padding:11px 13px;display:flex;align-items:center;gap:9px;color:var(--ink-2);font:11.5px var(--mono)}.gl-glabel{font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.gl-seg{display:flex;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:3px}
.gl-seg3 button,.gl-seg button{flex:1;min-width:0;font:550 12px var(--sans);color:var(--ink-2);background:none;border:0;border-radius:7px;padding:8px 4px;cursor:pointer;transition:.12s;white-space:nowrap}
.gl-source-seg{display:grid;grid-template-columns:repeat(6,minmax(0,1fr))}.gl-source-seg button:nth-child(-n+3){grid-column:span 2}.gl-source-seg button:nth-child(n+4){grid-column:span 3}
.gl-seg.gl-wrap{flex-wrap:wrap}.gl-seg.gl-wrap button{min-width:64px}
.gl-seg button:hover{color:var(--ink)}
.gl-seg button[aria-pressed=true]{background:var(--accent);color:#fff;box-shadow:0 1px 2px #0002}
.gl-inline-resolving{width:100%;padding:6px 8px;color:var(--ink-3);font:11px var(--mono);text-align:center;text-transform:none;letter-spacing:0}
.gl-field{display:flex;flex-direction:column;gap:8px;font:600 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-field select{font:500 13px var(--sans);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px;cursor:pointer}
.gl-outline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px}
@media (max-width:1100px){.gl-outline-grid{grid-template-columns:1fr}}
.gl-upload{font:600 13px var(--sans);color:#fff;background:var(--accent);border:0;border-radius:10px;padding:11px;cursor:pointer;width:100%}
.gl-upload:hover{filter:brightness(1.05)}
.gl-magic-note{font:11.5px var(--mono);color:var(--ink-2);line-height:1.5}
.gl-total{margin:2px 0;padding:13px 15px;background:var(--accent-soft);border:1px solid var(--accent);border-radius:12px;display:flex;flex-direction:column;gap:3px}
.gl-total-k{font:600 10px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
.gl-total-v{font:700 32px var(--mono);color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
.gl-total-v small{font-size:15px;font-weight:600;color:var(--ink-2)}
.gl-total-note{font:11px var(--mono);color:var(--ink-2)}
.gl-slider{display:flex;flex-direction:column;gap:6px}
.gl-slider-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--ink-2)}
.gl-slider-row b{font:600 12.5px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
.gl-number-field{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12.5px;color:var(--ink-2)}
.gl-number-input{display:flex;align-items:center;gap:6px}
.gl-number-input input{width:74px;font:600 12.5px var(--mono);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:7px 8px;text-align:right}
.gl-number-input input:read-only,.gl-number-input input:disabled{color:var(--ink-2);opacity:.72}
.gl-number-input b{font:600 11px var(--mono);color:var(--ink-3)}
.gl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;background:var(--line);outline:none}
.gl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);box-shadow:0 1px 3px #0003;cursor:pointer}
.gl input[type=range]::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);cursor:pointer}
.gl-toggle{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-2);cursor:pointer}
.gl-toggle input{width:17px;height:17px;accent-color:var(--accent)}
.gl-read{padding:0;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);overflow:hidden}
.gl-cell{background:var(--panel);padding:11px 14px;display:flex;flex-direction:column;gap:2px}
.gl-cell span{font:10px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-cell b{font:600 14px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
`
