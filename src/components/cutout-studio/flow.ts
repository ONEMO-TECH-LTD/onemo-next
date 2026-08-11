'use client'

// Product flow. Owns compose cadence and cancellation, history, detection, and Paint/GrabCut
// orchestration behind one { state, actions, view } boundary. The studio renders and captures
// gestures without owning those policies.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mask, Point } from '@/lib/mask-tools/types'
import type { VShape } from '@/lib/vector-core'
import { subtractShapePaper } from '@/lib/vector-core/paper-kernel'
import type { PreparedEffectBase } from '@/lib/effect/prepare-effect'
import { grabCutRefine } from '@/lib/cutout-grabcut'
import {
  bakeStickerEngine, BLEND_DEFAULTS, ZERO_SETTINGS, BakeCancelled,
  disposePrepareAICache, EDGE_FINISH_DEFAULT, finishDrawn, finishSpec,
  finishMask,
  settingsForVectorPreset,
  type BlendSettings, type FinishResult, type OutlineBounds, type TraceOutlineSettings,
  type VectorPresetName,
} from './finish'
import { maskArea, maskFromShape, PAINT_DEFAULTS, polishMask, solidShapeMask, subtractMasks, swathMask, unionMasks, type PaintConfig } from '@/lib/mask-tools'
import { deleteNode, editableShape, insertNode, measureNode, nodeAdjust, nodeTapTol, shapePathD, shapeRing } from '@/lib/vector-edit'
import { prepareAI, prepareNative } from './finish'
import { segmentV531 } from './v531seg'
import { cancelSegmentML, disposeSegmentML, type MLResult } from '@/lib/effect/segment-ml'
import { HistoryStack } from '@/lib/cutout-studio/history'
import { buildCutoutResult, type CutoutResult } from '@/lib/cutout-studio/result'
import type { EditMode } from './EditorOverlay'

const WORK_MAX = 1024
const BAKE_IDLE_MS = 250 // Cadence Law: compose on release/idle — never per knob tick
// §I2b law 3: EVERY await in a tool path carries a timeout → a hang becomes a visible ⚠️ fault
// with busy released — a stuck-busy lockout is impossible by construction. Downloads get the
// generous ceiling (weights on slow links); compute gets the tight one.
const T_COMPUTE_MS = 30_000
const T_DOWNLOAD_MS = 180_000
const HISTORY_DEPTH = 30          // undo/redo ring size
const MIN_DROPPED_REGION_PX = 60  // shape-truth: >this many dropped px = a disconnected region, warn
const MIN_ERASE_KEEP_RATIO = 0.1  // never-destroy: an erase leaving <this fraction of the shape reverts
const sha256Hex = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
class ToolTimeout extends Error { constructor(what: string, ms: number) { super(`${what} timed out after ${Math.round(ms / 1000)}s`) } }
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new ToolTimeout(what, ms)), ms)
    p.then((v) => { clearTimeout(t); res(v) }, (e) => { clearTimeout(t); rej(e) })
  })
}

type PaintCalibrationSource = {
  artwork: number
  base: Mask | null
  baseShape: VShape | null
  stroke: { x: number; y: number }[]
  brushPx: number
  erase: boolean
}
type ResolvedPaintMask = { mask: Mask; shape?: VShape }
type OutlineSourceKind = 'cutout' | 'paint'

const cloneMask = (mask: Mask): Mask => ({ data: mask.data.slice(), w: mask.w, h: mask.h, soft: mask.soft?.slice() })

function paintMask(source: PaintCalibrationSource, cfg: PaintConfig, w: number, h: number): Mask {
  const painted = swathMask(source.stroke, source.brushPx, w, h, cfg)
  const combined = source.base
    ? unionMasks(source.base, painted)
    : painted
  return polishMask(combined, cfg.polishStrength)
}

/** The adapters the flow needs injected (CreatorAdapters precedent — the flow never touches
 *  location/DOM chrome): a render request the shell binds to its canvas draw. */
export interface LabAdapters {
  /** shell's imperative canvas redraw — the flow calls it after every view-affecting mutation */
  requestRender: () => void
  diagnostics?: {
    setStage: (stage: string | null) => void
    getLastStage: () => string | null
  }
}

/** Imperative view surface for the shell's canvas render (canvas inputs — sanctioned).
 *  Refs, not state: the draw path is rAF-imperative, exactly as before. */
export interface LabView {
  imgCanvas: React.MutableRefObject<HTMLCanvasElement | null>
  d: React.MutableRefObject<string | null>
  bounds: React.MutableRefObject<OutlineBounds | null>
  shape: React.MutableRefObject<VShape | null>
  mask: React.MutableRefObject<Mask | null>
  liveBake: React.MutableRefObject<{ canvas: HTMLCanvasElement; bounds: OutlineBounds } | null>
}

export function useCutoutLabFlow(adapters: LabAdapters) {
  // ── state the shell renders from ──
  const [status, setStatus] = useState('ready — upload an image')
  const [busy, setBusy] = useState(false)
  const [hasCut, setHasCut] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [ms, setMs] = useState<{ cut?: number }>({})
  const [settings, setSettings] = useState<TraceOutlineSettings>(() => settingsForVectorPreset('CLASSIC'))
  const [vectorPreset, setVectorPresetState] = useState<VectorPresetName | null>('CLASSIC')
  const [blend, setBlend] = useState<BlendSettings>(BLEND_DEFAULTS)
  const [shapeTick, setShapeTick] = useState(0)
  const [histTick, setHistTick] = useState(0)
  const [disp, setDisp] = useState({ w: 480, h: 360 })
  const [paintCfg, setPaintCfgState] = useState<PaintConfig>(PAINT_DEFAULTS) // Dan: admin-changeable paint-shaper config
  const [edgeFinishPx, setEdgeFinishState] = useState(EDGE_FINISH_DEFAULT)
  const [outputSourceSize, setOutputSourceSize] = useState<{ w: number; h: number } | null>(null)
  const paintCfgRef = useRef(paintCfg); paintCfgRef.current = paintCfg
  const edgeFinishRef = useRef(edgeFinishPx); edgeFinishRef.current = edgeFinishPx

  // ── flow-owned refs (policy + view) ──
  const imgCanvas = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<Mask | null>(null)
  const dRef = useRef<string | null>(null)
  const boundsRef = useRef<OutlineBounds | null>(null)
  const shapeRef = useRef<VShape | null>(null)
  const drawnRef = useRef<{ shape: VShape; ring: { x: number; y: number }[] } | null>(null)
  const preparedRef = useRef<PreparedEffectBase | null>(null)
  const nativePresegRef = useRef<MLResult | null>(null)
  const urlRef = useRef<string | null>(null)
  const artworkRef = useRef<{ file: File; widthPx: number; heightPx: number } | null>(null)
  const liveBakeRef = useRef<{ canvas: HTMLCanvasElement; bounds: OutlineBounds } | null>(null)
  const settingsRef = useRef(settings); settingsRef.current = settings
  const outlineSourceRef = useRef<OutlineSourceKind>('cutout')
  const vectorPresetRef = useRef<VectorPresetName | null>(vectorPreset); vectorPresetRef.current = vectorPreset
  const cutoutSettingsRef = useRef<TraceOutlineSettings>(settingsForVectorPreset('CLASSIC'))
  const paintSettingsRef = useRef<TraceOutlineSettings>({ ...ZERO_SETTINGS, simplify: 15 })
  const cutoutPresetRef = useRef<VectorPresetName | null>('CLASSIC')
  const paintPresetRef = useRef<VectorPresetName | null>(null)
  const activateOutlineSource = useCallback((source: OutlineSourceKind) => {
    if (outlineSourceRef.current === source) return
    const current = { ...settingsRef.current }
    if (outlineSourceRef.current === 'paint') {
      paintSettingsRef.current = current
      paintPresetRef.current = vectorPresetRef.current
    } else {
      cutoutSettingsRef.current = current
      cutoutPresetRef.current = vectorPresetRef.current
    }
    outlineSourceRef.current = source
    const next = { ...(source === 'paint' ? paintSettingsRef.current : cutoutSettingsRef.current) }
    const nextPreset = source === 'paint' ? paintPresetRef.current : cutoutPresetRef.current
    settingsRef.current = next
    setSettings(next)
    vectorPresetRef.current = nextPreset
    setVectorPresetState(nextPreset)
  }, [])
  const blendRef = useRef(blend); blendRef.current = blend
  const hasCutRef = useRef(false); hasCutRef.current = hasCut
  const dispWRef = useRef(disp.w); dispWRef.current = disp.w
  const requestRender = adapters.requestRender
  const diagnostics = adapters.diagnostics
  const detectGen = useRef(0)
  const artworkGen = useRef(0)
  const uploadGen = useRef(0)
  const editPrepGen = useRef(0)
  const paintTuneGen = useRef(0)
  const paintTuneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paintCalibrationRef = useRef<PaintCalibrationSource | null>(null)
  const finishResolvedRef = useRef(false)
  const invalidatePaintCalibration = useCallback(() => {
    paintTuneGen.current++
    if (paintTuneTimer.current) clearTimeout(paintTuneTimer.current)
    paintTuneTimer.current = null
    paintCalibrationRef.current = null
  }, [])

  // ── history (pure module, flow-driven) ──
  type Snap = { mask: Mask | null; drawn: { shape: VShape; ring: { x: number; y: number }[] } | null; outlineSource: OutlineSourceKind; settings: TraceOutlineSettings; preset: VectorPresetName | null; blendS: BlendSettings; paint: PaintConfig; finishResolved: boolean }
  const histRef = useRef(new HistoryStack<Snap>(HISTORY_DEPTH))
  const snapNow = useCallback((): Snap => ({
    mask: maskRef.current ? cloneMask(maskRef.current) : null,
    drawn: drawnRef.current,
    outlineSource: outlineSourceRef.current,
    settings: { ...settingsRef.current }, preset: vectorPresetRef.current,
    blendS: { ...blendRef.current }, paint: { ...paintCfgRef.current }, finishResolved: finishResolvedRef.current, // meta B3: knobs travel with the state
  }), [])
  const pushHistory = useCallback(() => { histRef.current.push(snapNow()); setHistTick((t) => t + 1) }, [snapNow])
  const replaceHistory = useCallback(() => { histRef.current.replaceCurrent(snapNow()); setHistTick((t) => t + 1) }, [snapNow])

  // ── THE BAKE SCHEDULER (Cadence Law) ─────────────────────────────────────────────────────────
  // Single-flight + latched: at most one compose in flight; requests coalesce to the latest
  // settings; a superseded in-flight bake is CANCELLED (its canvases released via the bake's
  // cancel checkpoints), never merely ignored. Trigger = idle (BAKE_IDLE_MS after the last
  // request) — knob ticks during a drag only re-resolve vectors; the live view clips the LAST
  // COMMITTED bake to the updating outline. Reference: twoDFirstFlow's first-blur watcher.
  const bakeGen = useRef(0)          // generation: bumping it cancels the in-flight bake
  const bakeInFlight = useRef(false)
  const bakePending = useRef(false)
  const bakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draggingRef = useRef(false) // knob gesture in progress — bakes DEFER to release (Cadence Law)
  // Every editor, Preview, and Save bake uses the original upload source. The mode distinguishes
  // an ordinary live bake from one a caller is awaiting; it never changes source resolution.
  const bakeModeRef = useRef<'live' | 'awaited'>('live')
  const previewRef = useRef(false)
  const installPrepared = useCallback((prepared: PreparedEffectBase) => {
    preparedRef.current = prepared
    setOutputSourceSize({ w: prepared.frontSrc.origCanvas.width, h: prepared.frontSrc.origCanvas.height })
  }, [])
  type FullBakeWaiter = { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  const fullBakeWaiters = useRef<FullBakeWaiter[]>([])
  const settleFullBakeWaiters = useCallback((error?: Error) => {
    const waiters = fullBakeWaiters.current.splice(0)
    for (const waiter of waiters) {
      clearTimeout(waiter.timer)
      if (error) waiter.reject(error); else waiter.resolve()
    }
  }, [])
  const settleBakes = useCallback((reason: string) => {
    if (bakeTimer.current) clearTimeout(bakeTimer.current)
    bakeTimer.current = null
    bakePending.current = false
    draggingRef.current = false
    bakeModeRef.current = 'live'
    bakeGen.current++
    settleFullBakeWaiters(new Error(reason))
  }, [settleFullBakeWaiters])
  const runBake = useCallback(async () => {
    if (bakeInFlight.current) { bakePending.current = true; return }
    if (!preparedRef.current || !dRef.current || !boundsRef.current) {
      liveBakeRef.current = null
      settleFullBakeWaiters(new Error('full-res bake cancelled: no prepared cut'))
      requestRender()
      return
    }
    bakeInFlight.current = true
    const gen = ++bakeGen.current
    const mode = bakeModeRef.current
    const [d, bounds] = [dRef.current, boundsRef.current]
    try {
      const r = await bakeStickerEngine(
        preparedRef.current, d, bounds, imgCanvas.current!.width, imgCanvas.current!.height,
        blendRef.current, () => gen !== bakeGen.current,
      )
      if (gen === bakeGen.current) {
        liveBakeRef.current = { canvas: r.canvas, bounds }
        requestRender()
        if (mode === 'awaited') settleFullBakeWaiters()
      }
    } catch (e) {
      if (!(e instanceof BakeCancelled)) {
        const error = e instanceof Error ? e : new Error(String(e))
        if (mode === 'awaited' && gen === bakeGen.current) settleFullBakeWaiters(error)
        if (gen === bakeGen.current) setStatus('⚠️ compose failed: ' + error.message) // fail LOUD
      }
    }
    bakeInFlight.current = false
    if (bakePending.current) { bakePending.current = false; void runBake() }
  }, [requestRender, settleFullBakeWaiters])
  const scheduleBake = useCallback((immediate = false) => {
    if (bakeTimer.current) clearTimeout(bakeTimer.current)
    if (immediate) { bakeGen.current++; void runBake(); return } // supersede in-flight, compose now
    bakeTimer.current = setTimeout(() => {
      bakeTimer.current = null
      if (draggingRef.current) { bakePending.current = true; return } // mid-drag: NEVER compose — defer to release
      bakeGen.current++; void runBake()
    }, BAKE_IDLE_MS)
  }, [runBake])
  /** shell reports knob-gesture press/release; release fires any deferred bake */
  const setDragging = useCallback((on: boolean) => {
    draggingRef.current = on
    if (!on && bakePending.current) { bakePending.current = false; bakeGen.current++; void runBake() }
  }, [runBake])

  // ── outline resolve (vector-only — runs per tick, never composes) ──
  const applyFinish = useCallback((bake = true, settingsOverride?: TraceOutlineSettings) => {
    const img = imgCanvas.current
    const drawn = drawnRef.current
    const eff = settingsOverride ?? (finishResolvedRef.current ? ZERO_SETTINGS : settingsRef.current)
    const fin: FinishResult | null = drawn && img
      ? finishDrawn(drawn.shape, drawn.ring, img.width, img.height, eff)
      : preparedRef.current ? finishSpec(preparedRef.current, eff, img?.width) : null
    dRef.current = fin?.d ?? null
    boundsRef.current = fin?.bounds ?? null
    shapeRef.current = fin?.shape ?? null
    setShapeTick((t) => t + 1)
    if (bake) scheduleBake()
    requestRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleBake])

  // ── one FIFO for every accepted Paint/GrabCut gesture ──
  type ToolJob = {
    artwork: number
    run: (isCurrent: () => boolean) => Promise<void>
    settle: () => void
  }
  const toolBusyRef = useRef(false)
  const toolQueueRef = useRef<ToolJob[]>([])
  const activeToolRef = useRef<ToolJob | null>(null)
  const settleToolQueue = useCallback(() => {
    activeToolRef.current?.settle()
    for (const job of toolQueueRef.current.splice(0)) job.settle()
  }, [])
  const drainToolQueue = useCallback(async () => {
    if (toolBusyRef.current) return
    toolBusyRef.current = true
    try {
      while (toolQueueRef.current.length) {
        const job = toolQueueRef.current.shift()!
        activeToolRef.current = job
        const isCurrent = () => job.artwork === artworkGen.current
        try {
          if (isCurrent()) await job.run(isCurrent)
        } catch (e) {
          if (isCurrent()) setStatus('⚠️ ' + String((e as Error)?.message ?? e))
        } finally {
          job.settle()
          activeToolRef.current = null
        }
      }
    } finally {
      toolBusyRef.current = false
    }
  }, [])
  const runTool = useCallback((op: ToolJob['run']): Promise<void> => new Promise((settle) => {
    detectGen.current++
    cancelSegmentML()
    if (!toolBusyRef.current) setBusy(false)
    toolQueueRef.current.push({ artwork: artworkGen.current, run: op, settle })
    if (toolBusyRef.current) setStatus('⏳ finishing the previous edit — your gesture is queued')
    void drainToolQueue()
  }), [drainToolQueue])

  // ── accept a mask (every tool converges here — EXCEPT editCommit's maskFromShape) ──
  const acceptMask = useCallback(async (
    mask: Mask,
    preseg?: MLResult,
    opts?: { erase?: boolean; shapeTruth?: boolean; source?: OutlineSourceKind; isCurrent?: () => boolean; replaceHistory?: boolean; finishSettings?: TraceOutlineSettings; resolvedShape?: VShape },
  ) => {
    const isCurrent = () => !opts?.isCurrent || opts.isCurrent()
    if (!isCurrent()) return false
    // Every source's raw mask/matte remains unchanged (Dan 2026-08-07: no speculative hole/opacity
    // fixes on the pure path); the shared preparation seam applies only the calibrated edge finish. Paint sources still
    // get shape-is-truth below (that is geometry the paint tool OWNS, not a guess on a model matte).
    const img = imgCanvas.current, url = urlRef.current
    if (img && url) {
      try {
        // Native u2net keeps its original MLResult for recalibration; model/brush masks without an
        // engine preseg go through buildPreseg. Both then enter prepareCut's one edge/engine path.
        const loud = (st: string) => {
          if (st === 'fallback' && isCurrent()) setStatus('⚠️ AI cut unavailable — flood-fill fallback (NO matte: blend has no object layer)')
        }
        // E3 (meta-verified): VALIDATE BEFORE COMMIT — prepare runs first; maskRef/drawnRef mutate
        // only on success. A failed prepare (e.g. an erase that emptied the mask → 'No silhouette
        // found') leaves the last good selection + outline fully live.
        const nextPrepared = await withTimeout(
          preseg
            ? prepareNative(url, preseg, loud, edgeFinishRef.current, true)
            : prepareAI(url, mask, loud, edgeFinishRef.current, true),
          T_COMPUTE_MS,
          'engine prepare',
        )
        if (!isCurrent()) return false
        installPrepared(nextPrepared)
        nativePresegRef.current = preseg ?? null
      } catch (e) {
        if (isCurrent()) setStatus('⚠️ engine prepare failed: ' + String((e as Error).message) + ' — selection kept')
        return false
      }
    }
    if (!isCurrent()) return false
    if (!opts?.resolvedShape) activateOutlineSource(opts?.source ?? 'cutout')
    editPrepGen.current++
    drawnRef.current = opts?.resolvedShape ? { shape: opts.resolvedShape, ring: shapeRing(opts.resolvedShape) } : null
    maskRef.current = mask
    finishResolvedRef.current = !!(opts?.finishSettings || opts?.resolvedShape)
    hasCutRef.current = true
    setHasCut(true)
    applyFinish(false, opts?.finishSettings)
    // SHAPE-IS-TRUTH (E6/E7/E8) — PAINT-DEPOSIT SOURCES ONLY (Dan device 2026-08-07): the outline
    // is a smoothed ENVELOPE and must never redefine a model's subject; only paint (which OWNS its
    // geometry) normalizes to the resolved outline — islands drop loudly, slivers go solid, the
    // blend band is parallel. u2net and GrabCut raw segmentation truth stays verbatim.
    let droppedPx = 0
    if (opts?.shapeTruth && !preseg && img && url && shapeRef.current) {
      // E8: the subject derives from the resolved geometry AT OFFSET 0 — the Offset knob is the
      // pillow band's outer ring, never part of the subject. Inner blend line = the same
      // auto-tuned smooth shape → the band is parallel by construction, every tool.
      const activeSettings = opts?.finishSettings ?? settingsRef.current
      const finZ = preparedRef.current ? finishSpec(preparedRef.current, { ...activeSettings, offset: 0 }, img.width) : null
      const zeroShape = finZ?.shape ?? shapeRef.current
      const norm = solidShapeMask(zeroShape, img.width, img.height)
      if (mask.w === norm.w && mask.h === norm.h) {
        for (let i = 0; i < mask.data.length; i++) if (mask.data[i] && !norm.data[i]) droppedPx++
      }
      maskRef.current = norm
      const gen = ++editPrepGen.current
      const artwork = artworkGen.current
      nativePresegRef.current = null
      withTimeout(prepareAI(url, norm, undefined, edgeFinishRef.current, true), T_COMPUTE_MS, 'shape-truth re-prepare')
        .then((p) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current && isCurrent()) {
            installPrepared(p)
            scheduleBake()
          }
        })
        .catch((e) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current && isCurrent()) setStatus('⚠️ engine re-prepare failed: ' + String((e as Error).message))
        })
    }
    if (!isCurrent()) return false
    scheduleBake(true) // tool-commit = a compose trigger (Cadence Law), immediate
    if (opts?.replaceHistory) replaceHistory(); else pushHistory()
    setStatus(droppedPx > MIN_DROPPED_REGION_PX
      ? '⚠️ a SEPARATE region was dropped — the one-shape rule keeps only the main shape (bridge it with a connector first)'
      : `✨ done (cut: ${preparedRef.current?.spec.generator.adapter ?? '?'}) — refine, draw, edit, tune, or Save`)
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activateOutlineSource, applyFinish, installPrepared, scheduleBake])

  const resolvePaintMask = useCallback((
    source: PaintCalibrationSource,
    cfg: PaintConfig,
    vector: TraceOutlineSettings,
    w: number,
    h: number,
    isCurrent: () => boolean,
  ): ResolvedPaintMask | null => {
    if (!source.erase || !source.base) return { mask: paintMask(source, cfg, w, h) }
    // The eraser is its own negative Paint shape: build and finish it with the same Paint + Vector
    // controls, then subtract that resolved geometry from the untouched accepted base.
    const negativeRaster = polishMask(swathMask(source.stroke, source.brushPx, w, h, cfg), cfg.polishStrength)
    if (!isCurrent()) return null
    const negative = finishMask(negativeRaster, vector)
    if (!negative) throw new Error('Paint eraser shape could not be resolved')
    if (!source.baseShape) throw new Error('Paint eraser has no accepted main shape')
    const shape = subtractShapePaper(source.baseShape, negative.shape)
    if (!shape) throw new Error('Paint eraser removed the whole shape')
    return { mask: subtractMasks(source.base, maskFromShape(negative.shape, w, h)), shape }
  }, [])

  const recalculatePaint = useCallback(async (
    source: PaintCalibrationSource,
    cfg: PaintConfig,
    vector: TraceOutlineSettings,
    isCurrent: () => boolean,
  ): Promise<boolean> => {
    const img = imgCanvas.current
    if (!img || !isCurrent()) return false
    const resolved = await resolvePaintMask(source, cfg, vector, img.width, img.height, isCurrent)
    if (!resolved || !isCurrent()) return false
    if (!maskArea(resolved.mask)) {
      setStatus('⚠️ Paint calibration produced an empty shape — current shape kept')
      return false
    }
    return acceptMask(resolved.mask, undefined, {
      erase: source.erase,
      shapeTruth: !source.erase,
      source: 'paint',
      isCurrent,
      replaceHistory: true,
      // The negative already received the Vector recipe. Do not apply that recipe again to the
      // surviving main shape after subtraction.
      finishSettings: source.erase ? ZERO_SETTINGS : undefined,
      resolvedShape: resolved.shape,
    })
  }, [acceptMask, resolvePaintMask])

  const setPaintCfg = useCallback((patch: Partial<PaintConfig>) => {
    const next = { ...paintCfgRef.current, ...patch }
    paintCfgRef.current = next
    setPaintCfgState(next)
    const source = paintCalibrationRef.current
    if (!source || source.artwork !== artworkGen.current) {
      setStatus('⚙️ Paint settings ready — draw the next Paint shape / erase stroke')
      return
    }
    const tune = ++paintTuneGen.current
    if (paintTuneTimer.current) clearTimeout(paintTuneTimer.current)
    setStatus('⚙️ recalculating the latest Paint stroke…')
    paintTuneTimer.current = setTimeout(() => {
      paintTuneTimer.current = null
      const isCurrent = () => tune === paintTuneGen.current && source.artwork === artworkGen.current && paintCalibrationRef.current === source
      if (!isCurrent()) return
      setBusy(true)
      void recalculatePaint(source, paintCfgRef.current, settingsRef.current, isCurrent)
        .then((ok) => {
          if (ok && isCurrent()) setStatus('⚙️ latest Paint stroke recalculated')
        })
        .catch((error) => {
          if (isCurrent()) setStatus('⚠️ Paint recalculation failed: ' + String((error as Error)?.message ?? error) + ' — current shape kept')
        })
        .finally(() => { if (isCurrent()) setBusy(false) })
    }, 120)
  }, [recalculatePaint])

  const recalculateLatestErase = useCallback((vector: TraceOutlineSettings, success: string): boolean => {
    const source = paintCalibrationRef.current
    if (!source?.erase || source.artwork !== artworkGen.current) return false
    const tune = ++paintTuneGen.current
    if (paintTuneTimer.current) clearTimeout(paintTuneTimer.current)
    setStatus('⚙️ recalculating the latest Paint eraser…')
    paintTuneTimer.current = setTimeout(() => {
      paintTuneTimer.current = null
      const isCurrent = () => tune === paintTuneGen.current && source.artwork === artworkGen.current && paintCalibrationRef.current === source
      if (!isCurrent()) return
      setBusy(true)
      void recalculatePaint(source, paintCfgRef.current, vector, isCurrent)
        .then((ok) => { if (ok && isCurrent()) setStatus(success) })
        .catch((error) => {
          if (isCurrent()) setStatus('⚠️ Paint eraser recalculation failed: ' + String((error as Error)?.message ?? error) + ' — current shape kept')
        })
        .finally(() => { if (isCurrent()) setBusy(false) })
    }, 120)
    return true
  }, [recalculatePaint])

  // ── actions ──────────────────────────────────────────────────────────────────────────────────
  const upload = useCallback(async (file: File) => {
    const request = ++uploadGen.current
    const url = URL.createObjectURL(file)
    const img = new Image(); img.src = url
    let master: HTMLCanvasElement
    let nextDisp: { w: number; h: number }
    try {
      await img.decode()
      const s = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s)
      master = document.createElement('canvas'); master.width = w; master.height = h
      const mctx = master.getContext('2d', { willReadFrequently: true })
      if (!mctx) throw new Error('2D canvas unavailable')
      mctx.drawImage(img, 0, 0, w, h)
      const maxW = Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 40 : 520)
      const k = Math.min(maxW / w, 440 / h, 1)
      nextDisp = { w: Math.round(w * k), h: Math.round(h * k) }
    } catch (e) {
      URL.revokeObjectURL(url)
      if (request === uploadGen.current) setStatus('⚠️ could not open image: ' + String((e as Error)?.message ?? e) + ' — current artwork kept')
      return
    }
    if (request !== uploadGen.current) { URL.revokeObjectURL(url); return }

    const oldUrl = urlRef.current
    artworkGen.current++
    detectGen.current++
    editPrepGen.current++
    cancelSegmentML()
    settleToolQueue()
    settleBakes('full-res bake cancelled: artwork replaced')
    invalidatePaintCalibration()
    finishResolvedRef.current = false
    previewRef.current = false
    disposePrepareAICache()
    maskRef.current = null; dRef.current = null; drawnRef.current = null; shapeRef.current = null; preparedRef.current = null; nativePresegRef.current = null; liveBakeRef.current = null
    boundsRef.current = null
    setOutputSourceSize(null)
    hasCutRef.current = false
    urlRef.current = url
    artworkRef.current = { file, widthPx: img.naturalWidth, heightPx: img.naturalHeight }
    imgCanvas.current = master
    histRef.current = new HistoryStack<Snap>(HISTORY_DEPTH)
    setHistTick((t) => t + 1)
    setBusy(false); setHasCut(false); setMs({})
    setHasImage(true)
    setDisp(nextDisp)
    requestRender()
    setStatus('🖼 image ready — push 🤖 Detect to auto-cut, or brush the object')
    if (oldUrl) URL.revokeObjectURL(oldUrl)
  }, [invalidatePaintCalibration, requestRender, settleBakes, settleToolQueue])

  // AI DETECT — fixed u2netp -> lazy Silueta -> visible flood-fill, on button push only.
  const detect = useCallback(async () => {
    const img = imgCanvas.current, url = urlRef.current
    if (!img || !url) return
    const artwork = artworkGen.current
    const gen = ++detectGen.current
    const isCurrent = () => gen === detectGen.current && artwork === artworkGen.current && urlRef.current === url
    setBusy(true)
    try {
      setStatus('✨ AI magic (u2net · v5.3.1)…')
      const t0 = performance.now()
      const r = await withTimeout(segmentV531(img, img.width, img.height, isCurrent, diagnostics?.setStage), T_DOWNLOAD_MS, 'AI cut')
      if (!isCurrent()) return
      setMs({ cut: Math.round(performance.now() - t0) })
      diagnostics?.setStage('4·prepare+bake')
      // acceptMask returns false on empty cut OR a prepare failure — in both cases it already set a precise ⚠️ status, so do not override it here
      const accepted = await acceptMask(r.mask, r.preseg, { source: 'cutout', isCurrent })
      if (!isCurrent()) return
      if (accepted) invalidatePaintCalibration()
      if (accepted && (r.adapter === 'bg-flood' || r.adapter === 'alpha')) {
        setStatus('⚠️ AI cut unavailable — flood-fill fallback (NO matte: blend has no object layer)')
      }
      diagnostics?.setStage(null)
    } catch (e) {
      if (!isCurrent()) return
      diagnostics?.setStage(null)
      setStatus('⚠️ u2net failed: ' + String((e as Error)?.message ?? '?') + ' — reload the page and Detect again, or brush the object')
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }, [acceptMask, diagnostics, invalidatePaintCalibration])

  // knob cadence: vector ticks re-resolve ONLY; the bake follows at idle (Cadence Law)
  const setTune = useCallback((patch: Partial<TraceOutlineSettings>) => {
    const n = { ...settingsRef.current, ...patch }; settingsRef.current = n; setSettings(n)
    vectorPresetRef.current = null
    setVectorPresetState(null)
    if (outlineSourceRef.current === 'paint') {
      paintSettingsRef.current = n
      paintPresetRef.current = null
    } else {
      cutoutSettingsRef.current = n
      cutoutPresetRef.current = null
    }
    if (recalculateLatestErase(n, '⚙️ latest Paint eraser recalculated')) return
    if (hasCutRef.current) replaceHistory()
    requestAnimationFrame(() => applyFinish())
  }, [applyFinish, recalculateLatestErase, replaceHistory])
  const setVectorPreset = useCallback((name: VectorPresetName) => {
    if (!hasCutRef.current) return
    const next = settingsForVectorPreset(name)
    settingsRef.current = next
    setSettings(next)
    vectorPresetRef.current = name
    setVectorPresetState(name)
    if (outlineSourceRef.current === 'paint') {
      paintSettingsRef.current = next
      paintPresetRef.current = name
    } else {
      cutoutSettingsRef.current = next
      cutoutPresetRef.current = name
    }
    if (recalculateLatestErase(next, `⬡ ${name} vector preset applied to Paint eraser`)) return
    replaceHistory()
    setStatus(`⬡ ${name} vector preset`)
    requestAnimationFrame(() => applyFinish())
  }, [applyFinish, recalculateLatestErase, replaceHistory])
  const setBlendTune = useCallback((patch: Partial<BlendSettings>) => {
    const n = { ...blendRef.current, ...patch }; blendRef.current = n; setBlend(n)
    scheduleBake()
  }, [scheduleBake])

  const setEdgeFinishPx = useCallback((value: number) => {
    const next = Math.max(0, Math.min(12, Math.round(value)))
    edgeFinishRef.current = next
    setEdgeFinishState(next)
    const url = urlRef.current, mask = maskRef.current
    if (!url || !mask || !hasCutRef.current) return
    const artwork = artworkGen.current
    const gen = ++editPrepGen.current
    const source = nativePresegRef.current
    setBusy(true)
    setStatus(`⚙️ calibrating shared edge finish (${next}px)…`)
    const prepared = source
      ? prepareNative(url, source, undefined, next, true)
      : prepareAI(url, mask, undefined, next, true)
    withTimeout(prepared, T_COMPUTE_MS, 'edge calibration')
      .then((result) => {
        if (gen !== editPrepGen.current || artwork !== artworkGen.current) return
        installPrepared(result)
        applyFinish(false)
        scheduleBake(true)
        setBusy(false)
        setStatus(`⚙️ shared u2net/GrabCut edge finish: ${next}px`)
      })
      .catch((error) => {
        if (gen !== editPrepGen.current || artwork !== artworkGen.current) return
        setBusy(false)
        setStatus('⚠️ edge calibration failed: ' + String((error as Error)?.message ?? error))
      })
  }, [applyFinish, installPrepared, scheduleBake])

  // ── tool strokes (gesture capture stays in the shell; orchestration lives here) ──
  // ── THE BRUSH — GrabCut. Paint roughly → OpenCV graph-cut snaps to the real edge and adds it (erase
  // carves). No base → it RECOGNISES the painted shape standalone; a base → it REFINES the cut.
  // No deep model; OpenCV lazy-loads on the first stroke. ──
  const grabCutStroke = useCallback((stroke: (Point & { t: number })[], erase: boolean, brushR: number) => runTool(async (isCurrent) => {
    const img = imgCanvas.current
    if (!img || !isCurrent()) return
    const brushPx = brushR * (img.width / dispWRef.current)
    const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
    // STANDALONE when there is no cut (recognise the painted shape on its own); REFINE when one
    // exists (add/erase the u2net cut). Dan 2026-08-07: GrabCut is a separate brush that does both.
    const base = maskRef.current && hasCutRef.current ? maskRef.current : null
    if (erase && !base) { setStatus('✂️ nothing to erase yet — brush Add over the object to select it first'); requestRender(); return }
    setBusy(true)
    setStatus(base ? (erase ? '✂️ refining the edge…' : '✨ finding the edge…') : '✨ recognising the shape…')
    try {
      const refined = await withTimeout(grabCutRefine(img, base, pts, brushPx, erase), T_COMPUTE_MS, 'grabcut')
      if (!isCurrent()) return
      const before = base ? maskArea(base) : 0, after = maskArea(refined)
      if (after === 0) { setStatus('⚠️ nothing recognised under the brush — paint over the object'); requestRender(); return }
      // NEVER-DESTROY (meta R12-1): an erase that would gut the shape reverts loudly.
      if (erase && after <= before * MIN_ERASE_KEEP_RATIO) { setStatus('✂️ that would erase almost the whole shape — carve a smaller area'); requestRender(); return }
      if (base && before === after) { setStatus(erase ? '✂️ nothing under the stroke to erase — brush over the edge' : '✅ nothing new under the stroke — brush over the missed area'); requestRender(); return }
      const ok = await acceptMask(refined, undefined, { erase, source: 'cutout', isCurrent })
      if (ok && isCurrent()) invalidatePaintCalibration()
      if (ok && isCurrent()) setStatus(base ? (erase ? '✂️ carved to the edge' : '✅ added — snapped to the edge') : '✅ shape recognised — refine, tune, or Save')
    } catch (e) {
      if (isCurrent()) setStatus('⚠️ ' + String((e as Error).message))
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }), [acceptMask, invalidatePaintCalibration, requestRender, runTool])

  const paintStroke = useCallback((stroke: Point[], erase: boolean, brushR: number) => runTool(async (isCurrent) => {
    const img = imgCanvas.current
    if (!img || !isCurrent()) return
    const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
    const brushPx = brushR * (img.width / dispWRef.current)
    const base = maskRef.current && hasCutRef.current ? cloneMask(maskRef.current) : null
    if (erase && !base) { setStatus('✂️ nothing to erase yet — paint a shape first or Detect'); requestRender(); return }
    invalidatePaintCalibration()
    const source: PaintCalibrationSource = { artwork: artworkGen.current, base, baseShape: shapeRef.current, stroke: pts, brushPx, erase }
    // PAINT semantics (Dan): the brush deposits AREA; a closed gesture fills its interior too.
    setBusy(true)
    try {
      const resolved = await resolvePaintMask(source, paintCfgRef.current, settingsRef.current, img.width, img.height, isCurrent)
      if (!resolved || !isCurrent()) return
      const ok = await acceptMask(resolved.mask, undefined, {
        erase,
        shapeTruth: !erase,
        source: erase ? undefined : 'paint',
        isCurrent,
        finishSettings: erase ? ZERO_SETTINGS : undefined,
        resolvedShape: resolved.shape,
      })
      if (ok && isCurrent()) {
        paintCalibrationRef.current = source
        setStatus(base ? (erase ? '✂️ erased — auto-tuned' : '✏️ added — auto-tuned') : '✏️ painted shape created — keep painting, erase, or tune')
      }
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }), [acceptMask, invalidatePaintCalibration, requestRender, resolvePaintMask, runTool])

  // ── vector edit orchestration (nodes/frame) ──
  const isZero = (t: TraceOutlineSettings) => JSON.stringify(t) === JSON.stringify(ZERO_SETTINGS)
  const enterEdit = useCallback((): boolean => {
    const img = imgCanvas.current, shape = shapeRef.current
    if (!img || !shape) return false
    if (!drawnRef.current || drawnRef.current.shape !== shape) {
      // EDIT-GRADE SKELETON (Dan 17:52): LAZY BAKE — the skeleton is shown for editing, but the
      // vector recipe stays LIVE (knobs keep true values) until a real edit commits.
      const editable = editableShape(shape)
      shapeRef.current = editable
      dRef.current = shapePathD(editable)
    }
    setShapeTick((t) => t + 1)
    requestRender()
    return true
  }, [requestRender])
  const editLive = useCallback((next: VShape) => {
    if (drawnRef.current) drawnRef.current = { ...drawnRef.current, shape: next }
    dRef.current = shapePathD(next)
    shapeRef.current = next
    setShapeTick((t) => t + 1) // the overlay's anchors must ride the line (glued)
    requestRender()
  }, [requestRender])
  const editCommit = useCallback((next: VShape) => {
    invalidatePaintCalibration()
    finishResolvedRef.current = false
    const img = imgCanvas.current!
    const ring = shapeRing(next)
    drawnRef.current = { shape: next, ring }
    if (!isZero(settingsRef.current)) {
      // first real edit folds the recipe into the edited base (rebase); knobs then read from zero
      const zero = { ...ZERO_SETTINGS }
      settingsRef.current = zero; setSettings(zero)
      vectorPresetRef.current = 'ZERO'; setVectorPresetState('ZERO')
      if (outlineSourceRef.current === 'paint') {
        paintSettingsRef.current = zero
        paintPresetRef.current = 'ZERO'
      } else {
        cutoutSettingsRef.current = zero
        cutoutPresetRef.current = 'ZERO'
      }
    }
    maskRef.current = maskFromShape(next, img.width, img.height)
    nativePresegRef.current = null
    // ADAPTIVE MATTE (Dan): every shape edit recomputes the matte through the engine so blend/
    // compositing work out of the box on the EDITED shape. Loud on failure, last-edit-wins.
    if (urlRef.current) {
      const artwork = artworkGen.current
      const gen = ++editPrepGen.current
      withTimeout(prepareAI(urlRef.current, maskRef.current, undefined, edgeFinishRef.current, true), T_COMPUTE_MS, 'edit re-prepare')
        .then((p) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current) { installPrepared(p); scheduleBake() }
        })
        .catch((e) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current) setStatus('⚠️ engine re-prepare failed on edit: ' + String((e as Error).message))
        })
    }
    applyFinish()
    pushHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFinish, installPrepared, invalidatePaintCalibration, scheduleBake])
  const nodeInsert = useCallback((pt: { x: number; y: number }): { pi: number; ai: number } | null => {
    const shape = shapeRef.current
    if (!shape || !imgCanvas.current) return null
    const r = insertNode(shape, pt.x, pt.y, nodeTapTol(imgCanvas.current.width))
    if (!r) return null
    editCommit(r.shape)
    return { pi: r.pi, ai: r.ai }
  }, [editCommit])
  const nodeDelete = useCallback((pi: number, ai: number): boolean => {
    if (!shapeRef.current) return false
    const next = deleteNode(shapeRef.current, pi, ai)
    if (!next) return false
    editCommit(next)
    return true
  }, [editCommit])
  const nodeApply = useCallback((base: VShape, pi: number, ai: number, chip: 'radius' | 'curve', value: number) => {
    // ONE adjustment field per call (engine behavior — the shell must not know this): sending
    // radius AND curve together makes the engine's bend rebuild the handles and the corner fillet
    // silently no-op. The shell passes the chip + value; the flow constructs the engine delta.
    editCommit(nodeAdjust(base, pi, ai, chip === 'radius' ? { radius: value } : { curveKnob: value }))
  }, [editCommit])

  // ── history / save ──
  const restore = useCallback(async (s: Snap): Promise<boolean> => {
    const generation = artworkGen.current
    const img = imgCanvas.current, url = urlRef.current
    setBusy(true)
    try {
      const nextMask = s.mask ? { data: s.mask.data.slice(), w: s.mask.w, h: s.mask.h, soft: s.mask.soft?.slice() } : null
      const nextDrawn = s.drawn
      // History owns the exact accepted mask. The drawn vector restores the outline/editor state;
      // it must not be rasterized as a substitute matte or Undo/Redo will drift on every prepare.
      const forMask = nextMask
      const nextPrepared = forMask && img && url
        ? await withTimeout(prepareAI(url, forMask, undefined, edgeFinishRef.current, true), T_COMPUTE_MS, 'restore prepare')
        : null
      if (generation !== artworkGen.current) return false

      artworkGen.current++
      detectGen.current++
      editPrepGen.current++
      cancelSegmentML()
      settleToolQueue()
      settleBakes('full-res bake cancelled: history restored')
      invalidatePaintCalibration()
      maskRef.current = nextMask
      drawnRef.current = nextDrawn
      preparedRef.current = nextPrepared
      nativePresegRef.current = null
      setOutputSourceSize(nextPrepared ? { w: nextPrepared.frontSrc.origCanvas.width, h: nextPrepared.frontSrc.origCanvas.height } : null)
      liveBakeRef.current = null
      outlineSourceRef.current = s.outlineSource
      settingsRef.current = { ...s.settings }; setSettings(settingsRef.current) // meta B3: undo restores the knobs too
      vectorPresetRef.current = s.preset; setVectorPresetState(s.preset)
      if (s.outlineSource === 'paint') {
        paintSettingsRef.current = settingsRef.current
        paintPresetRef.current = s.preset
      } else {
        cutoutSettingsRef.current = settingsRef.current
        cutoutPresetRef.current = s.preset
      }
      blendRef.current = { ...s.blendS }; setBlend(blendRef.current)
      paintCfgRef.current = { ...s.paint }; setPaintCfgState(paintCfgRef.current)
      finishResolvedRef.current = s.finishResolved
      hasCutRef.current = !!(nextMask || nextDrawn)
      setHasCut(hasCutRef.current)
      applyFinish(false)
      scheduleBake(true)
      setBusy(false)
      return true
    } catch (e) {
      if (generation === artworkGen.current) {
        setBusy(false)
        setStatus('⚠️ history restore failed: ' + String((e as Error)?.message ?? e) + ' — current state kept')
      }
      return false
    }
  }, [applyFinish, invalidatePaintCalibration, scheduleBake, settleBakes, settleToolQueue])
  const undo = useCallback(async () => {
    const s = histRef.current.undo()
    if (!s) return
    if (await restore(s)) { setHistTick((t) => t + 1); setStatus('↩ restored previous cut') }
    else histRef.current.redo()
  }, [restore])
  const redo = useCallback(async () => {
    const s = histRef.current.redo()
    if (!s) return
    if (await restore(s)) { setHistTick((t) => t + 1); setStatus('↪ restored next cut') }
    else histRef.current.undo()
  }, [restore])
  const clearAll = useCallback(() => {
    uploadGen.current++
    artworkGen.current++
    detectGen.current++
    editPrepGen.current++
    cancelSegmentML()
    settleToolQueue()
    settleBakes('full-res bake cancelled: cut cleared')
    invalidatePaintCalibration()
    previewRef.current = false
    maskRef.current = null; drawnRef.current = null; preparedRef.current = null; nativePresegRef.current = null
    finishResolvedRef.current = false
    dRef.current = null; boundsRef.current = null; shapeRef.current = null; liveBakeRef.current = null
    setOutputSourceSize(null)
    hasCutRef.current = false
    setBusy(false); setHasCut(false); pushHistory(); requestRender()
    setStatus('🗑 cleared — paint a new shape, or Detect')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidatePaintCalibration, requestRender, settleBakes, settleToolQueue])

  /** await the next COMMITTED full-res bake (requested through the one scheduler + gen token) */
  const awaitFullBake = useCallback((): Promise<void> => new Promise((resolve, reject) => {
    const waiter: FullBakeWaiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const i = fullBakeWaiters.current.indexOf(waiter)
        if (i >= 0) fullBakeWaiters.current.splice(i, 1)
        bakeGen.current++
        bakePending.current = false
        bakeModeRef.current = 'live'
        reject(new ToolTimeout('full-res bake', T_COMPUTE_MS))
      }, T_COMPUTE_MS),
    }
    fullBakeWaiters.current.push(waiter)
    bakeModeRef.current = 'awaited'
    scheduleBake(true)
  }), [scheduleBake])

  /** 👁 Preview enter/exit — enter publishes only after the original-resolution compose settles. */
  const setPreview = useCallback(async (on: boolean): Promise<boolean> => {
    if (!preparedRef.current) return false
    if (!on) {
      previewRef.current = false
      if (fullBakeWaiters.current.length) settleFullBakeWaiters(new Error('full-res bake cancelled: preview closed'))
      bakeModeRef.current = 'live'
      scheduleBake(true)
      return true
    }

    const generation = artworkGen.current
    previewRef.current = true
    setBusy(true)
    setStatus('👁 preparing original-resolution preview…')
    try {
      await awaitFullBake()
    } catch (error) {
      previewRef.current = false
      bakeModeRef.current = 'live'
      if (generation === artworkGen.current) {
        setBusy(false)
        setStatus('⚠️ preview failed: ' + String((error as Error)?.message ?? error))
      }
      return false
    }
    if (generation !== artworkGen.current) { previewRef.current = false; return false }
    if (!liveBakeRef.current) {
      previewRef.current = false
      bakeModeRef.current = 'live'
      setBusy(false)
      setStatus('⚠️ preview failed: output unavailable')
      return false
    }
    setBusy(false)
    setStatus('👁 preview ready — same original-resolution pixels as Save')
    return true
  }, [awaitFullBake, scheduleBake, settleFullBakeWaiters])

  const save = useCallback(async () => {
    const img = imgCanvas.current
    if (!img || !dRef.current || !boundsRef.current || !maskRef.current || !preparedRef.current) return
    const generation = artworkGen.current
    try { await awaitFullBake() }
    catch (e) {
      if (generation === artworkGen.current) {
        setStatus('⚠️ ' + String((e as Error).message))
        if (!previewRef.current) bakeModeRef.current = 'live'
      }
      return
    }
    if (generation !== artworkGen.current) return
    const baked = liveBakeRef.current
    if (!baked) { setStatus('⚠️ Save failed: output unavailable'); return }
    if (!previewRef.current) { bakeModeRef.current = 'live'; scheduleBake() }
    baked.canvas.toBlob((b) => {
      if (!b) {
        if (generation === artworkGen.current) setStatus('⚠️ Save failed: PNG encoding failed')
        return
      }
      if (generation !== artworkGen.current) return
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href)
    })
  }, [awaitFullBake, scheduleBake])

  const exportResult = useCallback(async (): Promise<CutoutResult | null> => {
    const generation = artworkGen.current
    const artwork = artworkRef.current
    const img = imgCanvas.current
    const mask = maskRef.current ? cloneMask(maskRef.current) : null
    const shape = shapeRef.current
    const prepared = preparedRef.current
    if (!artwork || !img || !mask || !shape || !prepared) return null

    const artworkSha256 = await sha256Hex(await artwork.file.arrayBuffer())
    if (generation !== artworkGen.current) return null
    const softLength = mask.soft?.length ?? 0
    const maskBytes = new Uint8Array(12 + mask.data.length + softLength)
    const header = new DataView(maskBytes.buffer)
    header.setUint32(0, mask.w)
    header.setUint32(4, mask.h)
    header.setUint32(8, softLength)
    maskBytes.set(mask.data, 12)
    if (mask.soft) maskBytes.set(mask.soft, 12 + mask.data.length)
    const maskSha256 = await sha256Hex(maskBytes.buffer)
    if (generation !== artworkGen.current) return null

    return buildCutoutResult({
      finalShape: shape,
      maskWidthPx: img.width,
      maskHeightPx: img.height,
      mmPerPx: prepared.spec.mmPerPx * prepared.spec.maskWidthPx / img.width,
      artwork: {
        sha256: artworkSha256,
        byteLength: artwork.file.size,
        mediaType: artwork.file.type || 'application/octet-stream',
        widthPx: artwork.widthPx,
        heightPx: artwork.heightPx,
      },
      mask: {
        sha256: maskSha256,
        widthPx: mask.w,
        heightPx: mask.h,
        hasSoftAlpha: !!mask.soft,
      },
      inputs: {
        version: 'cutout-inputs/v1',
        source: outlineSourceRef.current,
        sourceAdapter: prepared.spec.generator.adapter,
        vectorPreset: vectorPresetRef.current,
        vector: { ...settingsRef.current },
        paint: { ...paintCfgRef.current },
        edgeFinishPx: edgeFinishRef.current,
        blend: { ...blendRef.current },
        outputSource: 'original',
      },
    })
  }, [])

  const canBrush = useCallback((tool: string): boolean => {
    // every brush (paint draw/erase + GrabCut add/erase) needs only an image; node/frame edit do not
    return (tool === 'draw' || tool === 'draw-erase' || tool === 'add' || tool === 'erase') && !!imgCanvas.current
  }, [])

  // Mount diagnostics. Model warm-up is deliberately absent: no measured first-Detect/device-memory
  // evidence justifies keeping an eager worker/session owner.
  const warmup = useCallback(() => {
    // Crash-survivor read: if a prior Detect stamped a stage and never cleared it, the tab crashed
    // there (renderer OOM → Safari auto-reload). Surface WHICH stage so the fix targets the real
    // allocation instead of a guess — then clear it so a later clean load reads 'ready'.
    const crashed = diagnostics?.getLastStage() ?? null
    if (crashed) diagnostics?.setStage(null)
    setStatus(crashed
      ? '⚠️ last operation crashed at stage ' + crashed + ' — report this stage to Kai'
      : 'ready — upload an image')
  }, [diagnostics])

  useEffect(() => () => {
    uploadGen.current++
    artworkGen.current++
    detectGen.current++
    editPrepGen.current++
    cancelSegmentML()
    disposeSegmentML()
    settleToolQueue()
    settleBakes('full-res bake cancelled: cutout flow unmounted')
    invalidatePaintCalibration()
    disposePrepareAICache()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    artworkRef.current = null
    imgCanvas.current = null; maskRef.current = null; drawnRef.current = null; preparedRef.current = null; nativePresegRef.current = null
    finishResolvedRef.current = false
    dRef.current = null; boundsRef.current = null; shapeRef.current = null; liveBakeRef.current = null
  }, [invalidatePaintCalibration, settleBakes, settleToolQueue])

  const view: LabView = { imgCanvas, d: dRef, bounds: boundsRef, shape: shapeRef, mask: maskRef, liveBake: liveBakeRef }

  return {
    state: {
      status, busy, hasCut, hasImage, ms, settings, blend, shapeTick, histTick, disp, paintCfg, edgeFinishPx,
      vectorPreset, outputSourceSize,
      canUndo: histRef.current.canUndo(), canRedo: histRef.current.canRedo(),
    },
    actions: {
      upload, detect, setTune, setBlendTune, setVectorPreset,
      grabCutStroke, paintStroke, canBrush,
      enterEdit, editLive, editCommit, nodeInsert, nodeDelete, nodeApply,
      undo, redo, clearAll, save, exportResult, setDragging, setPreview, warmup, setPaintCfg, setEdgeFinishPx,
    },
    view,
    /** node measurement passthrough for the shell's knob display (pure read, no policy) */
    measureNode,
  }
}
export type { EditMode }
