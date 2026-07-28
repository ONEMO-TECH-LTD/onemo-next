'use client'

// grid-lab — Session 59 magnetic-grid registration bench (2D vector).
// ALL engine shape sources through contourFromShape → computeGrid, rendered true-to-scale:
//   • Presets    — shape-library getShape() (baked vector data)
//   • Generators — generateShapeRing() (blob / clover / daisy / pinwheel)
//   • AI Magic   — image upload → prepareShaped() → u2netp lightweight cut-out → outline
// Every source yields a VShape → final mm contour consumed by the neutral grid engine.

import { useEffect, useMemo, useRef, useState } from 'react'
import { getShape, hasVectorDef, type VectorShapeKind } from '@/lib/shape-library'
import { type VShape } from '@/lib/vector-core'
import { generateShapeRing, type ShapeKind } from '../v5.3.1/user/shapes'
import { loadImage, prepareShaped } from '../v5.3.1/core/primitives'
import { contourFromShape } from '@/lib/effect/geometry-truth'
import type { Contour, Pt } from '@/lib/effect/types'
import { nearestAnchorPair, nearestSemanticRung, resolveDesignSizeMM, resolveRectangleRungs, scaleContour, stdShapeContour, rectFormat, minEffectMM, maxDesignMM, DEFAULT_MARGIN_MM, DEFAULT_LAW, type GridJob, type GridJobResult, type GridPattern, type GridPlanOptions, type MagnetPlan, type GridDensity, type GridMode, type PlanRecipe, type ResolvedGridPlan, type SemanticRung, type StandardLadderShape, type StdShape, type Attachment } from '@/lib/effect/grid'
import { requestGridWorkerJobInBackground } from '@/lib/effect/grid-worker-client'
import {
  cachedGridJob,
  gridJobKey,
  requestGridJob,
} from '@/lib/effect/grid-client'
import { GridWorkbenchAdminPanel, type GridWorkbenchAdminPanelProps } from './GridWorkbenchAdminPanel'
import { GridWorkbenchPanel, type GridWorkbenchPanelProps } from './GridWorkbenchPanel'
import { contourDimension as dim, GridWorkbenchReadouts, GridWorkbenchStage } from './GridWorkbenchRenderer'
import { useGridWorkerJob } from './useGridWorkerJob'

const IMG = 1000
const VP = 440
const FIT = 0.86

type Src = 'std' | 'preset' | 'gen' | 'magic'
type StdGeo = StdShape
type MagicState = { vshape: VShape; maskH: number; adapter: string; imgUrl: string } | null
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
/** VShape → mm contour normalized so its longest side = 1mm. Flatten FINELY first (mmPerPx=1 → 0.05px
 *  tolerance = smooth curves), THEN normalize the points — otherwise the tiny mmPerPx blows up the
 *  flatten tolerance and circles/squircles come out faceted. */
function normBase(vs: VShape, maskH: number): Contour | null {
  const c = contourFromShape(vs, { mmPerPx: 1, maskHeightPx: maskH })
  if (!c || c.outer.pts.length < 3) return null
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
  for (const [x, y] of c.outer.pts) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y }
  const L = Math.max(mxx - mnx, mxy - mny, 1)
  return { outer: { pts: c.outer.pts.map(([x, y]) => [x / L, y / L] as Pt) }, holes: [] }
}

export default function GridLab() {
  const [renderedPlanKey, setRenderedPlanKey] = useState<string | null>(null)
  const [sliderTransient, setSliderTransient] = useState(false)
  const [src, setSrc] = useState<Src>('std')
  const [geo, setGeo] = useState<StdGeo>('square')
  // rect system A: long side rung → short side rung (< long) → orientation
  const [longMM, setLongMM] = useState(118)
  const [shortMM, setShortMM] = useState(70)
  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape')
  const [preset, setPreset] = useState<VectorShapeKind>('squircle')
  const [gen, setGen] = useState<ShapeKind>('blob')
  const [p1, setP1] = useState(55) // waviness / pinch / depth / swirl
  const [p2, setP2] = useState(7)  // seed / lobes / petals / blades
  const [sides, setSides] = useState(6)
  const [points, setPoints] = useState(5)
  const [sizeMM, setSizeMM] = useState(70)
  const [pitch, setPitch] = useState(48)
  const [pitchAuto, setPitchAuto] = useState(true)
  const [attachment, setAttachment] = useState<Attachment>('magnetic')
  const [density, setDensity] = useState<GridDensity>('light') // cell count: standard = more cells (48-first), light = fewer (96-first)
  const [pad, setPad] = useState(10)
  const [offsetMM, setOffsetMM] = useState(0)
  const [pattern, setPattern] = useState<GridPattern>('standard')
  const [patternAuto, setPatternAuto] = useState(true) // pattern joins the auto system — same physics search as pitch
  const [plan, setPlan] = useState<MagnetPlan>('auto') // engine law default: size-driven focal ramp
  // NOTE: frame is NOT a control — it is a fixed engine law (DEFAULT_LAW.frameMM = 1, always baked into
  // minEffectMM + semanticLadder). The 1mm suede edge always renders (it also carries the flap-risk signal);
  // there is no user toggle, because a toggle here would only hide the drawn border while the manufactured
  // size keeps the frame — a lying control. Frame thickness, if ever tunable, belongs in the engine law inputs.
  const [front, setFront] = useState(false) // front-face overlay: magnets shown over the design/art
  const [centerMode, setCenterMode] = useState<'centroid' | 'bbox'>('centroid')
  const [maxGrowMM, setMaxGrowMM] = useState(DEFAULT_MARGIN_MM) // engine law default

  const [magic, setMagic] = useState<MagicState>(null)
  const [magStatus, setMagStatus] = useState<string>('')   // '', 'downloading-model', 'cutting', 'error:...'
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const loaded = loadImage(f, magic?.imgUrl)
    if (!loaded) { setMagStatus('error:that file is not an image'); return }
    setSrc('magic'); setMagStatus('cutting')
    prepareShaped(loaded.url, undefined, (s) => setMagStatus(s === 'fallback' ? 'cutting (simple fallback)' : s))
      .then((p) => {
        setMagic({ vshape: p.spec.vectorShape, maskH: p.spec.maskHeightPx, adapter: p.spec.generator?.adapter ?? 'cut', imgUrl: loaded.url })
        setMagStatus('')
      })
      .catch((err) => { console.error('[grid-lab] magic failed', err); setMagStatus('error:' + ((err as Error)?.message ?? 'cut failed')) })
  }

  const sizeMax = maxDesignMM(src === 'std' ? 'std' : src, DEFAULT_LAW) // engine law: per-source max
  const activeLaw = useMemo(() => ({ ...DEFAULT_LAW, paddingMM: pad }), [pad])
  const sizeMin = minEffectMM(activeLaw)
  const resolvedSizeMM = resolveDesignSizeMM(
    sizeMM,
    src === 'std' ? 'std' : src,
    activeLaw,
  )

  // PER-GEOMETRY standard sizes (Dan): each geometry's rungs are solved numerically from the live
  // recipe (padding/frame/pattern law) — square 70/118/…, circle and triangle their own. Rect derives
  // per-axis from the square ladder.
  // SEMANTIC SIZES: every shape's own T-shirt ladder (2XS=1pt · XS=2 · S=3 · M=4 · L/XL/2XL/3XL …).
  const gridMode: GridMode = patternAuto ? 'auto' : pattern
  const ladderShape: StandardLadderShape = src === 'std'
    ? (geo === 'rect' ? 'square' : geo)
    : 'square'
  const ladderRecipe = useMemo(
    () => ({ kind: 'standard', shape: ladderShape } as const),
    [ladderShape],
  )
  const planOptions = useMemo<GridPlanOptions>(() => ({
    attachment,
    mode: gridMode,
    density,
    paddingMM: pad,
    plan,
    center: centerMode,
    baseMarginMM: offsetMM,
    maxGrowMM,
    pitchMM: pitchAuto ? undefined : pitch,
    signedBaseMargin: true,
    diagnosticVelcro: true,
  }), [attachment, gridMode, density, pad, plan, centerMode, offsetMM, maxGrowMM, pitchAuto, pitch])

  const ladderJob = useMemo<GridJob>(() => ({
    operation: 'ladder',
    recipe: ladderRecipe,
    law: activeLaw,
    mode: gridMode,
    options: planOptions,
  }), [ladderRecipe, activeLaw, gridMode, planOptions])
  const ladderKey = gridJobKey(ladderJob)
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

  const planDesign = useMemo<PlanDesign | null>(() => {
    try {
      // ── STANDARD GEOMETRIES (D12–D15): drawn directly in mm, each axis snapped to its own rung ──
      if (src === 'std') {
        // DUAL SIZING LAW (every shape): the slider is CONTINUOUS/adaptive — the engine adapts any size
        // exactly like generators/AI cuts; the semantic buttons are quick-sets to the pre-calculated
        // optimal variants. Rectangle alone remains ladder-dependent because both axes are actual rungs.
        if (geo === 'rect') {
          if (!rectRungs) return null
          const rungW = rectRungs.widthRung
          const rungH = rectRungs.heightRung
          const design = stdShapeContour(geo, rungW.sizeMM, rungH.sizeMM)
          return {
            design,
            recipe: { kind: 'standard', shape: geo, widthMM: rungW.sizeMM, heightMM: rungH.sizeMM },
            designSize: rungW.sizeMM,
            format: rectFormat(rungW.sizeMM, rungH.sizeMM),
          }
        }
        const design = stdShapeContour(geo, resolvedSizeMM, resolvedSizeMM)
        return {
          design,
          recipe: { kind: 'standard', shape: geo, widthMM: resolvedSizeMM, heightMM: resolvedSizeMM },
          designSize: resolvedSizeMM,
          format: null,
        }
      }
      // base contour normalized so longest side = 1mm (scale-free); scaleContour() sizes it in mm
      let base: Contour | null = null
      if (src === 'magic') {
        if (!magic) return null
        base = normBase(magic.vshape, magic.maskH)
      } else if (src === 'preset' && hasVectorDef(preset)) {
        base = normBase(getShape(preset, IMG, IMG, { sides, points }), IMG)
      } else {
        const params = gen === 'blob' ? { kind: gen, waviness: p1, seed: p2 }
          : gen === 'form' ? { kind: gen, pinch: p1, lobes: p2 }
          : gen === 'daisy' ? { kind: gen, depth: p1, petals: p2 }
          : { kind: gen, swirl: p1, blades: p2 }
        const ring = generateShapeRing(params as Parameters<typeof generateShapeRing>[0], IMG, IMG)
        const bb = bboxOf(ring.map(([x, y]) => ({ x, y }))); const L = Math.max(bb.w, bb.h, 1)
        base = { outer: { pts: ring.map(([x, y]) => [x / L, (IMG - y) / L] as Pt) }, holes: [] }
      }
      if (!base || base.outer.pts.length < 3) return null
      const b = base
      // DESIGN stays fixed at the set size. Auto-grow adds an outward MARGIN (offset) around it — the border
      // the magnets' padding uses. Manual "offset" is the starting margin. Total effect = design + 2×margin.
      // random shapes (AI Magic / generators) are capped at 180mm; curated presets use the full ladder.
      // ADAPTIVE sizing (Dan's law, restored): the slider is CONTINUOUS — free shapes take any size and
      // the engine adapts (auto-margin snaps coverage to the 48-family grid dynamically). The rung
      // buttons are quick-sets for the rigid standard sizes; `rung` below is the nearest reference only.
      const dSize = resolvedSizeMM
      const design = scaleContour(b, dSize)
      return {
        design,
        recipe: { kind: 'final-contour', contourMM: design },
        designSize: dSize,
        format: null,
      }
    } catch (e) { console.error('[grid-lab] shape build failed', e); return null }
  }, [src, geo, preset, gen, p1, p2, sides, points, magic, rectRungs, resolvedSizeMM])

  const preparedDesign = useMemo<PreparedDesign | null>(() => {
    if (!planDesign) return null
    if (src === 'std' && geo === 'rect') {
      if (!rectRungs) return null
      return {
        ...planDesign,
        rung: rectRungs.widthRung,
        rungH: rectRungs.heightRung,
      }
    }
    if (!stdRungs.length) return { ...planDesign, rung: null, rungH: null }
    const targetMM = src === 'std' ? sizeMM : planDesign.designSize
    const rung = nearestSemanticRung(stdRungs, targetMM)
    return { ...planDesign, rung, rungH: rung }
  }, [planDesign, stdRungs, src, geo, rectRungs, sizeMM])

  const planJob = useMemo<GridJob | null>(() => planDesign
    ? { operation: 'plan', recipe: planDesign.recipe, options: planOptions }
    : null, [planDesign, planOptions])
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
    const eff = Math.round(Math.max(dim(effect, 0), dim(effect, 1)))
    const anchorPair = nearestAnchorPair(resolvedPlan.grid.anchors)
    return {
      planKey: activePlanResult.key,
      contour: effect,
      design: preparedDesign.design,
      grid: resolvedPlan.grid,
      marginMM: resolvedPlan.resolvedMarginMM,
      grew: resolvedPlan.grewMM,
      effSize: eff,
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
  const panelProps: GridWorkbenchPanelProps = {
    src, setSrc, geo, setGeo, setLongMM, setShortMM, orient, setOrient,
    preset, setPreset, gen, setGen, p1, setP1, p2, setP2, sides, setSides, points, setPoints,
    setSizeMM, attachment, setAttachment,
    magic, magStatus, fileRef, onFile, sizeMax, sizeMin, resolvedSizeMM,
    maxRungMM: DEFAULT_LAW.maxRungMM, gridMode, stdRungs, rectRungs, model,
    onSliderInteractionChange: setSliderTransient,
  }
  const adminPanelProps: GridWorkbenchAdminPanelProps = {
    src, geo, setLongMM, setShortMM, setSizeMM, gridMode, stdRungs, rectRungs,
    pitch, setPitch, pitchAuto, setPitchAuto, density, setDensity, pad, setPad,
    offsetMM, setOffsetMM, pattern, setPattern, patternAuto, setPatternAuto,
    plan, setPlan, front, setFront, centerMode, setCenterMode, maxGrowMM, setMaxGrowMM,
    model,
    onSliderInteractionChange: setSliderTransient,
  }

  return (
    <div
      className="gl"
      data-grid-runtime-status={runtimeStatus}
      data-grid-slider-transient={sliderTransient}
      data-grid-ladder-key={ladderKey}
      data-grid-plan-key={planKey ?? ''}
      data-grid-rendered-plan-key={renderedPlanKey ?? ''}
    >
      <style>{CSS}</style>
      <header className="gl-head">
        <h1>Magnetic Grid Lab <span className="gl-tag">s59 · registration engine</span></h1>
        <p>Every engine shape source — presets, generators, and <b>AI image cut-out</b> — through the mm magnetic grid.
          The window is fixed; change the effect&apos;s real size and the proportions move. Drawn entirely from millimetres.</p>
      </header>

      <div className="gl-body">
        <aside className="gl-controls">
          <div className="gl-panel-stack"><GridWorkbenchAdminPanel {...adminPanelProps} /></div>
        </aside>

        <GridWorkbenchStage
          model={model}
          scale={scale}
          viewportPx={VP}
          fit={FIT}
          front={front}
          frontImg={src === 'magic' && magic ? magic.imgUrl : null}
          emptyText={runtimeError
            ? `Grid error · ${runtimeError}`
            : runtimeStatus === 'resolving-sizes'
              ? 'Resolving sizes…'
              : runtimeStatus === 'resolving-grid'
                ? 'Resolving grid…'
                : src === 'magic'
                  ? magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'
                  : 'shape unavailable'}
          emptySpin={runtimeStatus === 'resolving-sizes' || runtimeStatus === 'resolving-grid' || magStatus === 'downloading-model' || magStatus.startsWith('cutting')}
          onRenderedPlanCommit={setRenderedPlanKey}
        />

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
  --accent:#2f6bff;--accent-soft:#2f6bff18;--grid:#9fb0cc;--suede:#ccd0d7;--margin:#aeb4bf;--suede-edge:#8a919c;--magnet:#20242c;
  --magnet-hi:#6b7280;--mag8:#c98a12;--pass:#1a9e4b;--fail:#e5484d;--shadow:0 1px 2px #18202e0d,0 10px 26px #18202e0f;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;padding:26px 20px 70px;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme:dark){.gl:not([data-theme]){--bg:#0f141b;--panel:#161c25;--panel-2:#12171f;--line:#232c3a;--ink:#e6edf3;--ink-2:#9aa6b6;--ink-3:#66717f;--accent:#4d84ff;--accent-soft:#4d84ff20;--grid:#3d4a60;--suede:#3a3e46;--margin:#4d535e;--suede-edge:#22262d;--magnet:#0b0e12;--magnet-hi:#4a515c;--shadow:0 1px 2px #0005,0 12px 30px #0006}}
.gl *{box-sizing:border-box}
.gl-head{max-width:1060px;margin:0 auto 20px}
.gl-head h1{font-size:20px;font-weight:640;letter-spacing:-.01em;margin:0 0 5px;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.gl-tag{font:600 11px var(--mono);color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:20px;letter-spacing:.02em}
.gl-head p{color:var(--ink-2);font-size:13.5px;margin:0;max-width:74ch;line-height:1.55}
.gl-body{max-width:1436px;margin:0 auto;display:grid;grid-template-columns:336px minmax(0,1fr) 336px;gap:20px;align-items:start}
@media (max-width:840px){.gl-body{grid-template-columns:1fr}}
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
.gl-verdict{padding:10px 13px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);font-size:13px}
.gl-vrow{display:flex;align-items:center;gap:9px}
.gl-dot{width:9px;height:9px;border-radius:50%;flex:none}
.gl-verdict.ok .gl-dot{background:var(--pass)}.gl-verdict.ok b{color:var(--pass)}
.gl-verdict.bad .gl-dot{background:var(--fail)}.gl-verdict.bad b{color:var(--fail)}
.gl-issue{font:11.5px var(--mono);color:var(--ink-2);margin-top:6px;padding-left:18px}
.gl-legend{display:flex;flex-wrap:wrap;gap:13px;font:11px var(--mono);color:var(--ink-2)}
.gl-legend span{display:inline-flex;align-items:center;gap:5px}.gl-legend i{width:10px;height:10px;border-radius:3px}
.gl-controls{display:flex;flex-direction:column;gap:16px}
.gl-panel-stack{display:flex;flex-direction:column;gap:16px}
.gl-resolving{padding:11px 13px;display:flex;align-items:center;gap:9px;color:var(--ink-2);font:11.5px var(--mono)}.gl-glabel{font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.gl-seg{display:flex;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:3px}
.gl-seg3 button,.gl-seg button{flex:1;min-width:0;font:550 12px var(--sans);color:var(--ink-2);background:none;border:0;border-radius:7px;padding:8px 4px;cursor:pointer;transition:.12s;white-space:nowrap}
.gl-seg.gl-wrap{flex-wrap:wrap}.gl-seg.gl-wrap button{min-width:64px}
.gl-seg button:hover{color:var(--ink)}
.gl-seg button[aria-pressed=true]{background:var(--accent);color:#fff;box-shadow:0 1px 2px #0002}
.gl-seg button.gl-hidden-rung{color:var(--mag8);font-style:italic}
.gl-seg button.gl-hidden-rung[aria-pressed=true]{background:var(--mag8);color:#fff;font-style:normal}
.gl-inline-resolving{width:100%;padding:6px 8px;color:var(--ink-3);font:11px var(--mono);text-align:center;text-transform:none;letter-spacing:0}
.gl-field{display:flex;flex-direction:column;gap:8px;font:600 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-field select{font:500 13px var(--sans);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px;cursor:pointer}
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
