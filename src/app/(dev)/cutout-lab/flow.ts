'use client'

// cutout-lab — cutoutLabFlow: the Layer-2 flow bridge (I1 · KAI-10196 · ARCHITECTURE.md contract).
// ONE compose-function conforming to the flow-contract PATTERN ({ state, actions } — the shell
// binds only to this surface; flows/flow-contract.ts is the reference, not an import: it is typed
// against v5.3.1's DesignState/sceneStore). The flow OWNS ALL POLICY the shell used to carry
// inline: compose cadence (Cadence Law: compositor NEVER called mid-drag; single-flight latched
// bake with real cancellation), history semantics, the u2net
// cut + GrabCut/paint tool orchestration. The shell only renders + captures
// gestures + calls these actions.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mask, Point } from '@/lib/mask-tools/types'
import type { VShape } from '@/lib/vector-core'
import type { PreparedEffectBase } from '@/lib/effect/prepare-effect'
import { grabCutRefine } from '@/lib/cutout-grabcut'
import {
  AUTO_SETTINGS, bakeStickerEngine, BLEND_DEFAULTS, ZERO_SETTINGS, BakeCancelled,
  disposePrepareAICache, EDGE_FINISH_DEFAULT, finishDrawn, finishSpec,
  type BlendSettings, type FinishResult, type OutlineBounds, type TraceOutlineSettings,
} from './finish'
import { maskArea, maskFromShape, PAINT_DEFAULTS, polishMask, solidShapeMask, subtractMasks, swathMask, unionMasks, type PaintConfig } from '@/lib/mask-tools'
import { deleteNode, editableShape, insertNode, measureNode, nodeAdjust, nodeTapTol, shapePathD, shapeRing } from '@/lib/vector-edit'
import { prepareAI, prepareNative } from './finish'
import { segmentV531, crashStage, lastCrashStage } from './v531seg'
import { cancelSegmentML, disposeSegmentML, type MLResult } from '@/lib/effect/segment-ml'
import { HistoryStack } from './history'
import type { EditMode } from './EditorOverlay'

const WORK_MAX = 1024
const BAKE_IDLE_MS = 250 // Cadence Law: compose on release/idle — never per knob tick
// §I2b law 3: EVERY await in a tool path carries a timeout → a hang becomes a visible ⚠️ fault
// with busy released — a stuck-busy lockout is impossible by construction. Downloads get the
// generous ceiling (weights on slow links); compute gets the tight one.
const T_COMPUTE_MS = 30_000
const T_DOWNLOAD_MS = 180_000
const HISTORY_DEPTH = 30          // undo/redo ring size
const MAX_DPR = 3                 // display-res bake DPR cap (memory floor)
const MIN_DROPPED_REGION_PX = 60  // shape-truth: >this many dropped px = a disconnected region, warn
const MIN_ERASE_KEEP_RATIO = 0.1  // never-destroy: an erase leaving <this fraction of the shape reverts
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
  stroke: { x: number; y: number }[]
  brushPx: number
  erase: boolean
}

const cloneMask = (mask: Mask): Mask => ({ data: mask.data.slice(), w: mask.w, h: mask.h, soft: mask.soft?.slice() })

function paintMask(source: PaintCalibrationSource, cfg: PaintConfig, w: number, h: number): Mask {
  const painted = swathMask(source.stroke, source.brushPx, w, h, cfg)
  const combined = source.base
    ? source.erase ? subtractMasks(source.base, painted) : unionMasks(source.base, painted)
    : painted
  return polishMask(combined, source.brushPx, cfg.polishStrength)
}

/** The adapters the flow needs injected (CreatorAdapters precedent — the flow never touches
 *  location/DOM chrome): a render request the shell binds to its canvas draw. */
export interface LabAdapters {
  /** shell's imperative canvas redraw — the flow calls it after every view-affecting mutation */
  requestRender: () => void
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
  const [settings, setSettings] = useState<TraceOutlineSettings>(AUTO_SETTINGS)
  const [blend, setBlend] = useState<BlendSettings>(BLEND_DEFAULTS)
  const [shapeTick, setShapeTick] = useState(0)
  const [histTick, setHistTick] = useState(0)
  const [disp, setDisp] = useState({ w: 480, h: 360 })
  const [paintCfg, setPaintCfgState] = useState<PaintConfig>(PAINT_DEFAULTS) // Dan: admin-changeable paint-shaper config
  const [edgeFinishPx, setEdgeFinishState] = useState(EDGE_FINISH_DEFAULT)
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
  const liveBakeRef = useRef<{ canvas: HTMLCanvasElement; bounds: OutlineBounds } | null>(null)
  const settingsRef = useRef(settings); settingsRef.current = settings
  const blendRef = useRef(blend); blendRef.current = blend
  const hasCutRef = useRef(false); hasCutRef.current = hasCut
  const dispWRef = useRef(disp.w); dispWRef.current = disp.w
  const requestRender = adapters.requestRender
  const detectGen = useRef(0)
  const artworkGen = useRef(0)
  const uploadGen = useRef(0)
  const editPrepGen = useRef(0)
  const paintTuneGen = useRef(0)
  const paintTuneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paintCalibrationRef = useRef<PaintCalibrationSource | null>(null)
  const invalidatePaintCalibration = useCallback(() => {
    paintTuneGen.current++
    if (paintTuneTimer.current) clearTimeout(paintTuneTimer.current)
    paintTuneTimer.current = null
    paintCalibrationRef.current = null
  }, [])

  // ── history (pure module, flow-driven) ──
  type Snap = { mask: Mask | null; drawn: { shape: VShape; ring: { x: number; y: number }[] } | null; settings: TraceOutlineSettings; blendS: BlendSettings; paint: PaintConfig }
  const histRef = useRef(new HistoryStack<Snap>(HISTORY_DEPTH))
  const snapNow = (): Snap => ({
    mask: maskRef.current ? cloneMask(maskRef.current) : null,
    drawn: drawnRef.current,
    settings: { ...settingsRef.current }, blendS: { ...blendRef.current }, paint: { ...paintCfgRef.current }, // meta B3: knobs travel with the state
  })
  const pushHistory = () => { histRef.current.push(snapNow()); setHistTick((t) => t + 1) }
  const replaceHistory = () => { histRef.current.replaceCurrent(snapNow()); setHistTick((t) => t + 1) }

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
  // ── I2: EDIT-TIME MEMORY FLOOR ── live bakes compose at DISPLAY resolution by feeding a cached
  // display-res frontSrc pair to the SAME bakeStickerEngine (its k-scaling + width-relative blur
  // make it resolution-agnostic — contract §I2; no engine change, no second pipeline). Full res
  // exists only on Save and 👁 Preview, through this ONE scheduler + gen token.
  const bakeModeRef = useRef<'display' | 'full'>('display')
  const previewRef = useRef(false)
  const displayFrontRef = useRef<{ src: PreparedEffectBase; shim: PreparedEffectBase } | null>(null)
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
    bakeModeRef.current = 'display'
    bakeGen.current++
    settleFullBakeWaiters(new Error(reason))
  }, [settleFullBakeWaiters])
  const displayPrepared = (p: PreparedEffectBase): PreparedEffectBase => {
    if (displayFrontRef.current?.src === p) return displayFrontRef.current.shim
    const { origCanvas, subjCanvas } = p.frontSrc
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, MAX_DPR) : 1
    const scale = Math.min(1, (dispWRef.current * dpr) / origCanvas.width)
    let shim = p
    if (scale < 1) {
      const dw = Math.max(1, Math.round(origCanvas.width * scale)), dh = Math.max(1, Math.round(origCanvas.height * scale))
      const so = document.createElement('canvas'); so.width = dw; so.height = dh
      so.getContext('2d')!.drawImage(origCanvas, 0, 0, dw, dh)
      const ss = document.createElement('canvas'); ss.width = dw; ss.height = dh
      ss.getContext('2d')!.drawImage(subjCanvas, 0, 0, dw, dh)
      shim = { ...p, frontSrc: { ...p.frontSrc, origCanvas: so, subjCanvas: ss } }
    }
    displayFrontRef.current = { src: p, shim } // built ONCE per prepare (cache keyed on the prepared ref)
    return shim
  }
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
      const src = mode === 'full' ? preparedRef.current : displayPrepared(preparedRef.current)
      const r = await bakeStickerEngine(
        src, d, bounds, imgCanvas.current!.width, imgCanvas.current!.height,
        blendRef.current, () => gen !== bakeGen.current,
      )
      if (gen === bakeGen.current) {
        liveBakeRef.current = { canvas: r.canvas, bounds }
        requestRender()
        if (mode === 'full') settleFullBakeWaiters()
      }
    } catch (e) {
      if (!(e instanceof BakeCancelled)) {
        const error = e instanceof Error ? e : new Error(String(e))
        if (mode === 'full' && gen === bakeGen.current) settleFullBakeWaiters(error)
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
  const applyFinish = useCallback((bake = true) => {
    const img = imgCanvas.current
    const drawn = drawnRef.current
    const eff = settingsRef.current
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
    opts?: { erase?: boolean; shapeTruth?: boolean; isCurrent?: () => boolean; replaceHistory?: boolean },
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
            ? prepareNative(url, preseg, loud, edgeFinishRef.current)
            : prepareAI(url, mask, loud, edgeFinishRef.current),
          T_COMPUTE_MS,
          'engine prepare',
        )
        if (!isCurrent()) return false
        preparedRef.current = nextPrepared
        nativePresegRef.current = preseg ?? null
      } catch (e) {
        if (isCurrent()) setStatus('⚠️ engine prepare failed: ' + String((e as Error).message) + ' — selection kept')
        return false
      }
    }
    if (!isCurrent()) return false
    editPrepGen.current++
    drawnRef.current = null
    maskRef.current = mask
    hasCutRef.current = true
    setHasCut(true)
    applyFinish()
    // SHAPE-IS-TRUTH (E6/E7/E8) — PAINT-DEPOSIT SOURCES ONLY (Dan device 2026-08-07): the outline
    // is a smoothed ENVELOPE and must never redefine a model's subject; only paint (which OWNS its
    // geometry) normalizes to the resolved outline — islands drop loudly, slivers go solid, the
    // blend band is parallel. u2net and GrabCut raw segmentation truth stays verbatim.
    let droppedPx = 0
    if (opts?.shapeTruth && !preseg && img && url && shapeRef.current) {
      // E8: the subject derives from the resolved geometry AT OFFSET 0 — the Offset knob is the
      // pillow band's outer ring, never part of the subject. Inner blend line = the same
      // auto-tuned smooth shape → the band is parallel by construction, every tool.
      const finZ = preparedRef.current ? finishSpec(preparedRef.current, { ...settingsRef.current, offset: 0 }, img.width) : null
      const zeroShape = finZ?.shape ?? shapeRef.current
      const norm = solidShapeMask(zeroShape, img.width, img.height)
      if (mask.w === norm.w && mask.h === norm.h) {
        for (let i = 0; i < mask.data.length; i++) if (mask.data[i] && !norm.data[i]) droppedPx++
      }
      maskRef.current = norm
      const gen = ++editPrepGen.current
      const artwork = artworkGen.current
      nativePresegRef.current = null
      withTimeout(prepareAI(url, norm, undefined, edgeFinishRef.current), T_COMPUTE_MS, 'shape-truth re-prepare')
        .then((p) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current && isCurrent()) {
            preparedRef.current = p
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
  }, [applyFinish, scheduleBake])

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
      const img = imgCanvas.current
      const isCurrent = () => tune === paintTuneGen.current && source.artwork === artworkGen.current && paintCalibrationRef.current === source
      if (!img || !isCurrent()) return
      const recalculated = paintMask(source, paintCfgRef.current, img.width, img.height)
      if (!maskArea(recalculated)) {
        setStatus('⚠️ Paint calibration produced an empty shape — current shape kept')
        return
      }
      setBusy(true)
      void acceptMask(recalculated, undefined, { erase: source.erase, shapeTruth: true, isCurrent, replaceHistory: true })
        .then((ok) => {
          if (ok && isCurrent()) setStatus('⚙️ latest Paint stroke recalculated')
        })
        .finally(() => { if (isCurrent()) setBusy(false) })
    }, 120)
  }, [acceptMask])

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
    previewRef.current = false
    disposePrepareAICache()
    maskRef.current = null; dRef.current = null; drawnRef.current = null; shapeRef.current = null; preparedRef.current = null; nativePresegRef.current = null; liveBakeRef.current = null
    boundsRef.current = null; displayFrontRef.current = null
    hasCutRef.current = false
    urlRef.current = url
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
      const r = await withTimeout(segmentV531(img, img.width, img.height, isCurrent), T_DOWNLOAD_MS, 'AI cut')
      if (!isCurrent()) return
      setMs({ cut: Math.round(performance.now() - t0) })
      crashStage('4·prepare+bake')                 // lab-layer engine prepare + compose (subject/texture/output)
      // acceptMask returns false on empty cut OR a prepare failure — in both cases it already set a precise ⚠️ status, so do not override it here
      const accepted = await acceptMask(r.mask, r.preseg, { isCurrent })
      if (!isCurrent()) return
      if (accepted) invalidatePaintCalibration()
      if (accepted && (r.adapter === 'bg-flood' || r.adapter === 'alpha')) {
        setStatus('⚠️ AI cut unavailable — flood-fill fallback (NO matte: blend has no object layer)')
      }
      crashStage(null)                             // completed without a renderer crash — clear the breadcrumb
    } catch (e) {
      if (!isCurrent()) return
      crashStage(null)                             // a CAUGHT error means JS survived — not the hard crash we hunt
      setStatus('⚠️ u2net failed: ' + String((e as Error)?.message ?? '?') + ' — reload the page and Detect again, or brush the object')
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }, [acceptMask, invalidatePaintCalibration])

  // knob cadence: vector ticks re-resolve ONLY; the bake follows at idle (Cadence Law)
  const setTune = useCallback((patch: Partial<TraceOutlineSettings>) => {
    const n = { ...settingsRef.current, ...patch }; settingsRef.current = n; setSettings(n)
    requestAnimationFrame(() => applyFinish())
  }, [applyFinish])
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
      ? prepareNative(url, source, undefined, next)
      : prepareAI(url, mask, undefined, next)
    withTimeout(prepared, T_COMPUTE_MS, 'edge calibration')
      .then((result) => {
        if (gen !== editPrepGen.current || artwork !== artworkGen.current) return
        preparedRef.current = result
        displayFrontRef.current = null
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
  }, [applyFinish, scheduleBake])

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
      const ok = await acceptMask(refined, undefined, { erase, isCurrent })
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
    const source: PaintCalibrationSource = { artwork: artworkGen.current, base, stroke: pts, brushPx, erase }
    // PAINT semantics (Dan): the brush deposits AREA; a closed gesture fills its interior too.
    const combined = paintMask(source, paintCfgRef.current, img.width, img.height)
    setBusy(true)
    try {
      const ok = await acceptMask(combined, undefined, { erase, shapeTruth: true, isCurrent })
      if (ok && isCurrent()) {
        paintCalibrationRef.current = source
        setStatus(base ? (erase ? '✂️ erased — auto-tuned' : '✏️ added — auto-tuned') : '✏️ painted shape created — keep painting, erase, or tune')
      }
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }), [acceptMask, invalidatePaintCalibration, requestRender, runTool])

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
    const img = imgCanvas.current!
    const ring = shapeRing(next)
    drawnRef.current = { shape: next, ring }
    if (!isZero(settingsRef.current)) {
      // first real edit folds the recipe into the edited base (rebase); knobs then read from zero
      const zero = { ...ZERO_SETTINGS }
      settingsRef.current = zero; setSettings(zero)
    }
    maskRef.current = maskFromShape(next, img.width, img.height)
    nativePresegRef.current = null
    // ADAPTIVE MATTE (Dan): every shape edit recomputes the matte through the engine so blend/
    // compositing work out of the box on the EDITED shape. Loud on failure, last-edit-wins.
    if (urlRef.current) {
      const artwork = artworkGen.current
      const gen = ++editPrepGen.current
      withTimeout(prepareAI(urlRef.current, maskRef.current, undefined, edgeFinishRef.current), T_COMPUTE_MS, 'edit re-prepare')
        .then((p) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current) { preparedRef.current = p; scheduleBake() }
        })
        .catch((e) => {
          if (gen === editPrepGen.current && artwork === artworkGen.current) setStatus('⚠️ engine re-prepare failed on edit: ' + String((e as Error).message))
        })
    }
    applyFinish()
    pushHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFinish, invalidatePaintCalibration, scheduleBake])
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
      const forMask = nextDrawn ? maskFromShape(nextDrawn.shape, img?.width ?? 1, img?.height ?? 1) : nextMask
      const nextPrepared = forMask && img && url
        ? await withTimeout(prepareAI(url, forMask, undefined, edgeFinishRef.current), T_COMPUTE_MS, 'restore prepare')
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
      displayFrontRef.current = null
      liveBakeRef.current = null
      settingsRef.current = { ...s.settings }; setSettings(settingsRef.current) // meta B3: undo restores the knobs too
      blendRef.current = { ...s.blendS }; setBlend(blendRef.current)
      paintCfgRef.current = { ...s.paint }; setPaintCfgState(paintCfgRef.current)
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
    dRef.current = null; boundsRef.current = null; shapeRef.current = null; liveBakeRef.current = null; displayFrontRef.current = null
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
        bakeModeRef.current = 'display'
        reject(new ToolTimeout('full-res bake', T_COMPUTE_MS))
      }, T_COMPUTE_MS),
    }
    fullBakeWaiters.current.push(waiter)
    bakeModeRef.current = 'full'
    scheduleBake(true)
  }), [scheduleBake])

  /** 👁 Preview enter/exit — a FLOW policy: enter publishes only after the full-res compose settles;
   *  exit returns to the display-res live bake. */
  const setPreview = useCallback(async (on: boolean): Promise<boolean> => {
    if (!preparedRef.current) return false
    if (!on) {
      previewRef.current = false
      if (fullBakeWaiters.current.length) settleFullBakeWaiters(new Error('full-res bake cancelled: preview closed'))
      bakeModeRef.current = 'display'
      scheduleBake(true)
      return true
    }

    const generation = artworkGen.current
    previewRef.current = true
    setBusy(true)
    setStatus('👁 preparing capped preview…')
    try {
      await awaitFullBake()
    } catch (error) {
      previewRef.current = false
      bakeModeRef.current = 'display'
      if (generation === artworkGen.current) {
        setBusy(false)
        setStatus('⚠️ preview failed: ' + String((error as Error)?.message ?? error))
      }
      return false
    }
    if (generation !== artworkGen.current) { previewRef.current = false; return false }
    if (!liveBakeRef.current) {
      previewRef.current = false
      bakeModeRef.current = 'display'
      setBusy(false)
      setStatus('⚠️ preview failed: capped output unavailable')
      return false
    }
    setBusy(false)
    setStatus('👁 preview ready — same capped pixels as Save')
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
        if (!previewRef.current) bakeModeRef.current = 'display'
      }
      return
    }
    if (generation !== artworkGen.current) return
    const baked = liveBakeRef.current
    if (!baked) { setStatus('⚠️ Save failed: capped output unavailable'); return }
    if (!previewRef.current) { bakeModeRef.current = 'display'; scheduleBake() } // return to edit-res
    baked.canvas.toBlob((b) => {
      if (!b) {
        if (generation === artworkGen.current) setStatus('⚠️ Save failed: PNG encoding failed')
        return
      }
      if (generation !== artworkGen.current) return
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href)
    })
  }, [awaitFullBake, scheduleBake])

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
    const crashed = lastCrashStage()
    if (crashed) crashStage(null)
    setStatus(crashed
      ? '⚠️ last Detect crashed at stage ' + crashed + ' — report this stage to Kai'
      : 'ready — upload an image')
  }, [])

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
    imgCanvas.current = null; maskRef.current = null; drawnRef.current = null; preparedRef.current = null; nativePresegRef.current = null
    dRef.current = null; boundsRef.current = null; shapeRef.current = null; liveBakeRef.current = null; displayFrontRef.current = null
  }, [invalidatePaintCalibration, settleBakes, settleToolQueue])

  const view: LabView = { imgCanvas, d: dRef, bounds: boundsRef, shape: shapeRef, mask: maskRef, liveBake: liveBakeRef }

  return {
    state: {
      status, busy, hasCut, hasImage, ms, settings, blend, shapeTick, histTick, disp, paintCfg, edgeFinishPx,
      canUndo: histRef.current.canUndo(), canRedo: histRef.current.canRedo(),
    },
    actions: {
      upload, detect, setTune, setBlendTune,
      grabCutStroke, paintStroke, canBrush,
      enterEdit, editLive, editCommit, nodeInsert, nodeDelete, nodeApply,
      undo, redo, clearAll, save, setDragging, setPreview, warmup, setPaintCfg, setEdgeFinishPx,
    },
    view,
    /** node measurement passthrough for the shell's knob display (pure read, no policy) */
    measureNode,
  }
}
export type { EditMode }
