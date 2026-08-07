'use client'

// cutout-lab — cutoutLabFlow: the Layer-2 flow bridge (I1 · KAI-10196 · ARCHITECTURE.md contract).
// ONE compose-function conforming to the flow-contract PATTERN ({ state, actions } — the shell
// binds only to this surface; flows/flow-contract.ts is the reference, not an import: it is typed
// against v5.3.1's DesignState/sceneStore). The flow OWNS ALL POLICY the shell used to carry
// inline: compose cadence (Cadence Law: compositor NEVER called mid-drag; single-flight latched
// bake with real cancellation), auto-blend-on-outgrowth (value-true), history semantics, engine
// selection MEANING + segmentation calls, brush fault degradation, tool-action orchestration,
// perfGesture marks. URL read/write stays a SHELL adapter duty — seg is injected, never read here.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mask, Point } from '@/lib/mask-tools/types'
import type { VShape } from '@/lib/vector-core'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { grabCutRefine } from '@/lib/cutout-grabcut'
import { perfGesture } from '@/app/(dev)/effect-creator/v5.3.1/dev/PerfHUD'
import {
  AUTO_SETTINGS, bakeStickerEngine, BLEND_DEFAULTS, ZERO_SETTINGS, BakeCancelled,
  finishDrawn, finishSpec,
  type BlendSettings, type FinishResult, type OutlineBounds, type TraceOutlineSettings,
} from './finish'
import { maskArea, maskFromShape, PAINT_DEFAULTS, polishMask, solidShapeMask, subtractMasks, swathMask, unionMasks, type PaintConfig } from '@/lib/mask-tools'
import { deleteNode, editableShape, insertNode, measureNode, nodeAdjust, nodeTapTol, shapePathD, shapeRing } from '@/lib/vector-edit'
import { prepareAI, prepareNative } from './finish'
import { segmentV531 } from './v531seg'
import { preloadBen } from '@/lib/effect/segment-ml'
import { HistoryStack } from './history'
import type { EditMode } from './EditorOverlay'

const WORK_MAX = 1024
const BAKE_IDLE_MS = 250 // Cadence Law: compose on release/idle — never per knob tick
// §I2b law 3: EVERY await in a tool path carries a timeout → a hang becomes a visible ⚠️ fault
// with busy released — a stuck-busy lockout is impossible by construction. Downloads get the
// generous ceiling (weights on slow links); compute gets the tight one.
const T_COMPUTE_MS = 30_000
const T_DOWNLOAD_MS = 180_000
class ToolTimeout extends Error { constructor(what: string, ms: number) { super(`${what} timed out after ${Math.round(ms / 1000)}s`) } }
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new ToolTimeout(what, ms)), ms)
    p.then((v) => { clearTimeout(t); res(v) }, (e) => { clearTimeout(t); rej(e) })
  })
}

/** The adapters the flow needs injected (CreatorAdapters precedent — the flow never touches
 *  location/DOM chrome): initial engine from the URL, URL write-back, and a render request the
 *  shell binds to its canvas draw. */
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
  const [ms, setMs] = useState<{ cut?: number; stroke?: number }>({})
  const [settings, setSettings] = useState<TraceOutlineSettings>(AUTO_SETTINGS)
  const [blend, setBlend] = useState<BlendSettings>(BLEND_DEFAULTS)
  const [shapeTick, setShapeTick] = useState(0)
  const [histTick, setHistTick] = useState(0)
  const [disp, setDisp] = useState({ w: 480, h: 360 })
  const [paintCfg, setPaintCfgState] = useState<PaintConfig>(PAINT_DEFAULTS) // Dan: admin-changeable paint-shaper config
  const paintCfgRef = useRef(paintCfg); paintCfgRef.current = paintCfg
  const setPaintCfg = useCallback((patch: Partial<PaintConfig>) => { const n = { ...paintCfgRef.current, ...patch }; paintCfgRef.current = n; setPaintCfgState(n) }, [])

  // ── flow-owned refs (policy + view) ──
  const imgCanvas = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<Mask | null>(null)
  const dRef = useRef<string | null>(null)
  const boundsRef = useRef<OutlineBounds | null>(null)
  const shapeRef = useRef<VShape | null>(null)
  const drawnRef = useRef<{ shape: VShape; ring: { x: number; y: number }[] } | null>(null)
  const preparedRef = useRef<PreparedEffect | null>(null)
  const urlRef = useRef<string | null>(null)
  const lastFileRef = useRef<File | null>(null)
  const liveBakeRef = useRef<{ canvas: HTMLCanvasElement; bounds: OutlineBounds } | null>(null)
  const settingsRef = useRef(settings); settingsRef.current = settings
  const blendRef = useRef(blend); blendRef.current = blend
  const hasCutRef = useRef(false); hasCutRef.current = hasCut
  const wasOutgrownRef = useRef(false)
  const dispWRef = useRef(disp.w); dispWRef.current = disp.w
  const requestRender = adapters.requestRender

  // ── history (pure module, flow-driven) ──
  type Snap = { mask: Mask | null; drawn: { shape: VShape; ring: { x: number; y: number }[] } | null; settings: TraceOutlineSettings; blendS: BlendSettings }
  const histRef = useRef(new HistoryStack<Snap>(30))
  const snapNow = (): Snap => ({
    mask: maskRef.current ? { data: maskRef.current.data.slice(), w: maskRef.current.w, h: maskRef.current.h, soft: maskRef.current.soft?.slice() } : null,
    drawn: drawnRef.current,
    settings: { ...settingsRef.current }, blendS: { ...blendRef.current }, // meta B3: knobs travel with the state
  })
  const pushHistory = () => { histRef.current.push(snapNow()); setHistTick((t) => t + 1) }

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
  const previewRef2 = useRef(false)
  const displayFrontRef = useRef<{ src: PreparedEffect; shim: PreparedEffect } | null>(null)
  const fullBakeWaiters = useRef<(() => void)[]>([])
  const displayPrepared = (p: PreparedEffect): PreparedEffect => {
    if (displayFrontRef.current?.src === p) return displayFrontRef.current.shim
    const { origCanvas, subjCanvas } = p.frontSrc
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1
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
    if (!preparedRef.current || !dRef.current || !boundsRef.current) { liveBakeRef.current = null; requestRender(); return }
    bakeInFlight.current = true
    const gen = ++bakeGen.current
    const mode = bakeModeRef.current
    const [d, bounds] = [dRef.current, boundsRef.current]
    const t0 = performance.now()
    try {
      const src = mode === 'full' ? preparedRef.current : displayPrepared(preparedRef.current)
      const r = await bakeStickerEngine(
        src, d, bounds, imgCanvas.current!.width, imgCanvas.current!.height,
        blendRef.current, () => gen !== bakeGen.current,
      )
      perfGesture(mode === 'full' ? 'bake-full' : 'bake', performance.now() - t0)
      if (gen === bakeGen.current) {
        liveBakeRef.current = { canvas: r.canvas, bounds }
        requestRender()
        if (mode === 'full') { for (const w of fullBakeWaiters.current) w(); fullBakeWaiters.current = [] }
      }
    } catch (e) {
      if (!(e instanceof BakeCancelled)) setStatus('⚠️ compose failed: ' + String((e as Error)?.message ?? e)) // fail LOUD
    }
    bakeInFlight.current = false
    if (bakePending.current) { bakePending.current = false; void runBake() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const scheduleBake = useCallback((immediate = false) => {
    if (bakeTimer.current) clearTimeout(bakeTimer.current)
    if (immediate) { bakeGen.current++; void runBake(); return } // supersede in-flight, compose now
    bakeTimer.current = setTimeout(() => {
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
    const t0 = performance.now()
    const fin: FinishResult | null = drawn && img
      ? finishDrawn(drawn.shape, drawn.ring, img.width, img.height, eff)
      : preparedRef.current ? finishSpec(preparedRef.current, eff, img?.width) : null
    perfGesture('resolve-tick', performance.now() - t0)
    dRef.current = fin?.d ?? null
    boundsRef.current = fin?.bounds ?? null
    shapeRef.current = fin?.shape ?? null
    // AUTO-COMPOSITING ON FRAME EXIT (Dan's law), value-TRUE: entering outgrowth sets the actual
    // blend knob to the engine default — the control reflects what is applied; the user can still
    // re-zero it (their override stands until the next transition into outgrowth).
    const bb = fin?.bounds
    const og = !!(img && bb && (bb.minX < 0 || bb.minY < 0 || bb.maxX > img.width || bb.maxY > img.height))
    if (og && !wasOutgrownRef.current && blendRef.current.blend === 0 && preparedRef.current) {
      const def = Math.round(preparedRef.current.frontSrc.defaultBlendPercent)
      blendRef.current = { ...blendRef.current, blend: def }
      setBlend(blendRef.current)
    }
    wasOutgrownRef.current = og
    setShapeTick((t) => t + 1)
    if (bake) scheduleBake()
    requestRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleBake])

  // ── accept a mask (every tool converges here — EXCEPT editCommit's maskFromShape, which is
  // safe by construction: one closed ring cannot enclose a hole; gated in the probe suite) ──
  const acceptMask = useCallback(async (rawMask: Mask, preseg?: import('@/lib/effect/segment-ml').MLResult, opts?: { erase?: boolean; shapeTruth?: boolean }) => {
    // u2net's matte + every mask are consumed VERBATIM (Dan 2026-08-07: no speculative hole/opacity
    // fixes on the pure path — the EdgeSAM-era guards are deleted with EdgeSAM). Paint sources still
    // get shape-is-truth below (that is geometry the paint tool OWNS, not a guess on a model matte).
    const mask = rawMask
    const img = imgCanvas.current, url = urlRef.current
    if (img && url) {
      try {
        // native preseg (u2net path) passes through VERBATIM — the v5.3.1 bridge, no lab rebuild;
        // model/brush masks (no engine preseg exists) go through the buildPreseg seam.
        const loud = (st: string) => { if (st === 'fallback') setStatus('⚠️ AI cut unavailable — flood-fill fallback (NO matte: blend has no object layer)') }
        const t0 = performance.now()
        // E3 (meta-verified): VALIDATE BEFORE COMMIT — prepare runs first; maskRef/drawnRef mutate
        // only on success. A failed prepare (e.g. an erase that emptied the mask → 'No silhouette
        // found') leaves the last good selection + outline fully live.
        preparedRef.current = await withTimeout(preseg ? prepareNative(url, preseg, loud) : prepareAI(url, mask, loud), T_COMPUTE_MS, 'engine prepare')
        perfGesture('prepare', performance.now() - t0)
      } catch (e) { setStatus('⚠️ engine prepare failed: ' + String((e as Error).message) + ' — selection kept'); return false }
    }
    drawnRef.current = null
    maskRef.current = mask
    setHasCut(true)
    applyFinish()
    // SHAPE-IS-TRUTH (E6/E7/E8) — PAINT-DEPOSIT SOURCES ONLY (Dan device 2026-08-07): the outline
    // is a smoothed ENVELOPE and must never redefine a model's subject; only paint (which OWNS its
    // geometry) normalizes to the resolved outline — islands drop loudly, slivers go solid, the
    // blend band is parallel. The u2net cut + GrabCut refine stay verbatim.
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
      withTimeout(prepareAI(url, norm), T_COMPUTE_MS, 'shape-truth re-prepare')
        .then((p) => { if (gen === editPrepGen.current) { preparedRef.current = p; scheduleBake() } })
        .catch((e) => setStatus('⚠️ engine re-prepare failed: ' + String((e as Error).message)))
    }
    scheduleBake(true) // tool-commit = a compose trigger (Cadence Law), immediate
    pushHistory()
    setStatus(droppedPx > 60
      ? '⚠️ a SEPARATE region was dropped — the one-shape rule keeps only the main shape (bridge it with a connector first)'
      : `✨ done (cut: ${preparedRef.current?.spec.generator.adapter ?? '?'}) — refine, draw, edit, tune, or Save`)
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFinish, scheduleBake])

  // ── actions ──────────────────────────────────────────────────────────────────────────────────
  const upload = useCallback(async (file: File) => {
    lastFileRef.current = file
    maskRef.current = null; dRef.current = null; drawnRef.current = null; shapeRef.current = null; preparedRef.current = null; liveBakeRef.current = null
    setHasCut(false); setMs({})
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    const img = new Image(); img.src = url
    try { await img.decode() } catch (e) { URL.revokeObjectURL(url); setStatus('⚠️ could not open image: ' + String(e)); return }
    const s = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s)
    const master = document.createElement('canvas'); master.width = w; master.height = h
    const mctx = master.getContext('2d', { willReadFrequently: true })!
    mctx.drawImage(img, 0, 0, w, h)
    imgCanvas.current = master
    setHasImage(true)
    const maxW = Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 40 : 520)
    const k = Math.min(maxW / w, 440 / h, 1)
    setDisp({ w: Math.round(w * k), h: Math.round(h * k) })
    setHasCut(false)
    requestRender()
    setStatus('🖼 image ready — push 🤖 Detect to auto-cut, or brush the object')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestRender])

  // AI DETECT — u2net auto-cut on demand (Dan 2026-08-07: runs on button push, not on upload;
  // the weights are prefetched at page open by warmup, so the push is fast).
  const detect = useCallback(async () => {
    const img = imgCanvas.current, url = urlRef.current
    if (!img || !url) return
    setBusy(true)
    // ONE retry before giving up loudly (Dan device: u2net can 'disconnect' on iOS — the loader
    // flashes and no outline appears). The failure must be VISIBLE, never a silent no-op.
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        setStatus(attempt ? '✨ retrying u2net…' : '✨ AI magic (u2net · v5.3.1)…')
        const t0 = performance.now()
        const r = await withTimeout(segmentV531(url, img.width, img.height), T_DOWNLOAD_MS, 'AI cut')
        perfGesture('segment', performance.now() - t0)
        setMs({ cut: Math.round(performance.now() - t0) })
        if (await acceptMask(r.mask, r.preseg)) { setBusy(false); return }
        lastErr = new Error('no silhouette (empty cut)')
      } catch (e) { lastErr = e }
    }
    setStatus('⚠️ u2net produced no cut (' + String((lastErr as Error)?.message ?? '?') + ') — reload the page and Detect again, or brush the object to select it')
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptMask])

  // knob cadence: vector ticks re-resolve ONLY; the bake follows at idle (Cadence Law)
  const setTune = useCallback((patch: Partial<TraceOutlineSettings>) => {
    const n = { ...settingsRef.current, ...patch }; settingsRef.current = n; setSettings(n)
    requestAnimationFrame(() => applyFinish())
  }, [applyFinish])
  const setBlendTune = useCallback((patch: Partial<BlendSettings>) => {
    const n = { ...blendRef.current, ...patch }; blendRef.current = n; setBlend(n)
    scheduleBake()
  }, [scheduleBake])

  // ── tool strokes (gesture capture stays in the shell; orchestration lives here) ──
  // ── THE TOOL QUEUE (Dan device r5: tools were silently DEAD while busy — taps swallowed with
  // zero feedback, reading as 'wand broken / paint not painting'). EVERY tool op runs through one
  // serialized latest-wins queue: an op landing mid-processing queues (visible status), runs right
  // after, and NOTHING is ever dropped. No tool is gated on busy anywhere anymore.
  const toolBusyRef = useRef(false)
  const pendingToolRef = useRef<(() => Promise<void>) | null>(null)
  const runTool = useCallback(async (op: () => Promise<void>) => {
    if (toolBusyRef.current) { pendingToolRef.current = op; setStatus('⏳ finishing the previous edit — your tap is queued'); return }
    toolBusyRef.current = true
    try { await op() } catch (e) { setStatus('⚠️ ' + String((e as Error)?.message ?? e)) }
    toolBusyRef.current = false
    const q = pendingToolRef.current
    if (q) { pendingToolRef.current = null; void runTool(q) }
     
  }, [])
  // ── THE BRUSH — GrabCut refinement (Dan 2026-08-07: EdgeSAM + wand DELETED; u2net is the only
  // cut, GrabCut the only brush). Paint roughly over a missed area → OpenCV graph-cut snaps to the
  // real edge and adds it (erase carves). Deterministic, no deep model, OpenCV lazy-loads on the
  // first stroke. Falls back to a plain painted swath only when there is no base cut to refine. ──
  const grabCutStroke = useCallback((stroke: (Point & { t: number })[], erase: boolean, brushR: number) => runTool(async () => {
    const img = imgCanvas.current
    if (!img) return
    const brushPx = brushR * (img.width / dispWRef.current)
    const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
    // STANDALONE when there is no cut (recognise the painted shape on its own); REFINE when one
    // exists (add/erase the u2net cut). Dan 2026-08-07: GrabCut is a separate brush that does both.
    const base = maskRef.current && hasCutRef.current ? maskRef.current : null
    if (erase && !base) { setStatus('✂️ nothing to erase yet — brush Add over the object to select it first'); requestRender(); return }
    setBusy(true)
    setStatus(base ? (erase ? '✂️ refining the edge…' : '✨ finding the edge…') : '✨ recognising the shape…')
    try {
      const t0 = performance.now()
      const refined = await withTimeout(grabCutRefine(img, base, pts, brushPx, erase), T_COMPUTE_MS, 'grabcut')
      perfGesture('grabcut', performance.now() - t0)
      const before = base ? maskArea(base) : 0, after = maskArea(refined)
      if (after === 0) { setBusy(false); setStatus('⚠️ nothing recognised under the brush — paint over the object'); requestRender(); return }
      // NEVER-DESTROY (meta R12-1): an erase that would gut the shape reverts loudly.
      if (erase && after <= before * 0.1) { setBusy(false); setStatus('✂️ that would erase almost the whole shape — carve a smaller area'); requestRender(); return }
      if (base && before === after) { setBusy(false); setStatus(erase ? '✂️ nothing under the stroke to erase — brush over the edge' : '✅ nothing new under the stroke — brush over the missed area'); requestRender(); return }
      const ok = await acceptMask(refined, undefined, { erase })
      if (ok) setStatus(base ? (erase ? '✂️ carved to the edge' : '✅ added — snapped to the edge') : '✅ shape recognised — refine, tune, or Save')
    } catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    setBusy(false)
  }), [acceptMask, requestRender, runTool])

  const paintStroke = useCallback((stroke: Point[], erase: boolean, brushR: number) => runTool(async () => {
    const img = imgCanvas.current!
    const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
    const brushPx = brushR * (img.width / dispWRef.current)
    // PAINT semantics (Dan): the brush deposits AREA; a closed gesture fills its interior too
    const ts0 = performance.now()
    const painted = swathMask(pts, brushPx, img.width, img.height, paintCfgRef.current)
    perfGesture('swath', performance.now() - ts0)
    if (!maskRef.current || !hasCutRef.current) {
      if (erase) { setStatus('✂️ nothing to erase yet — paint a shape first or Re-detect'); requestRender(); return }
      drawnRef.current = null
      setBusy(true); await acceptMask(polishMask(painted, brushPx, paintCfgRef.current.polishDiv), undefined, { shapeTruth: true }); setBusy(false)
      setStatus('✏️ painted shape created — keep painting, erase, or tune')
      return
    }
    drawnRef.current = null
    const tp1 = performance.now()
    const combined = polishMask(erase ? subtractMasks(maskRef.current, painted) : unionMasks(maskRef.current, painted), brushPx, paintCfgRef.current.polishDiv)
    perfGesture('paint-polish', performance.now() - tp1)
    setBusy(true)
    const ok = await acceptMask(combined, undefined, { erase, shapeTruth: true })
    setBusy(false)
    if (ok) setStatus(erase ? '✂️ erased — auto-tuned' : '✏️ added — auto-tuned')
  }), [acceptMask, requestRender, runTool])

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
  const editPrepGen = useRef(0)
  const editCommit = useCallback((next: VShape) => {
    const img = imgCanvas.current!
    const ring = shapeRing(next)
    drawnRef.current = { shape: next, ring }
    if (!isZero(settingsRef.current)) {
      // first real edit folds the recipe into the edited base (rebase); knobs then read from zero
      const zero = { ...ZERO_SETTINGS }
      settingsRef.current = zero; setSettings(zero)
    }
    const tm0 = performance.now()
    maskRef.current = maskFromShape(next, img.width, img.height)
    perfGesture('mask-from-shape', performance.now() - tm0)
    // ADAPTIVE MATTE (Dan): every shape edit recomputes the matte through the engine so blend/
    // compositing work out of the box on the EDITED shape. Loud on failure, last-edit-wins.
    if (urlRef.current) {
      const gen = ++editPrepGen.current
      withTimeout(prepareAI(urlRef.current, maskRef.current), T_COMPUTE_MS, 'edit re-prepare')
        .then((p) => { if (gen === editPrepGen.current) { preparedRef.current = p; scheduleBake() } })
        .catch((e) => setStatus('⚠️ engine re-prepare failed on edit: ' + String((e as Error).message)))
    }
    applyFinish()
    pushHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFinish, scheduleBake])
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
  const nodeApply = useCallback((base: VShape, pi: number, ai: number, delta: { radius?: number; curveKnob?: number }) => {
    editCommit(nodeAdjust(base, pi, ai, delta))
  }, [editCommit])

  // ── history / save ──
  const restore = useCallback(async (s: Snap) => {
    maskRef.current = s.mask ? { data: s.mask.data.slice(), w: s.mask.w, h: s.mask.h, soft: s.mask.soft?.slice() } : null
    drawnRef.current = s.drawn
    settingsRef.current = { ...s.settings }; setSettings(settingsRef.current) // meta B3: undo restores the knobs too
    blendRef.current = { ...s.blendS }; setBlend(blendRef.current)
    setHasCut(!!(s.mask || s.drawn))
    if (s.mask && !s.drawn && imgCanvas.current && urlRef.current) {
      try { preparedRef.current = await withTimeout(prepareAI(urlRef.current, maskRef.current!), T_COMPUTE_MS, 'restore prepare') } catch { /* keep last prepared */ }
    }
    applyFinish()
    scheduleBake(true)
  }, [applyFinish, scheduleBake])
  const undo = useCallback(async () => { const s = histRef.current.undo(); if (s) { setHistTick((t) => t + 1); await restore(s) } }, [restore])
  const redo = useCallback(async () => { const s = histRef.current.redo(); if (s) { setHistTick((t) => t + 1); await restore(s) } }, [restore])
  const clearAll = useCallback(() => {
    maskRef.current = null; drawnRef.current = null; preparedRef.current = null
    dRef.current = null; boundsRef.current = null; shapeRef.current = null; liveBakeRef.current = null
    setHasCut(false); pushHistory(); requestRender()
    setStatus('🗑 cleared — paint a new shape, or Re-detect')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestRender])

  /** await the next COMMITTED full-res bake (requested through the one scheduler + gen token) */
  const awaitFullBake = useCallback((): Promise<void> => new Promise((res) => {
    fullBakeWaiters.current.push(res)
    bakeModeRef.current = 'full'
    scheduleBake(true)
  }), [scheduleBake])

  /** 👁 Preview enter/exit — a FLOW policy: enter = full-res compose trigger (display-res bake may
   *  show as the interim until it lands); exit = back to the display-res live bake. */
  const setPreview = useCallback((on: boolean) => {
    previewRef2.current = on
    if (!preparedRef.current) return
    bakeModeRef.current = on ? 'full' : 'display'
    scheduleBake(true)
  }, [scheduleBake])

  const save = useCallback(async () => {
    const img = imgCanvas.current
    if (!img || !dRef.current || !boundsRef.current || !maskRef.current || !preparedRef.current) return
    try { await withTimeout(awaitFullBake(), T_COMPUTE_MS, 'full-res bake') }
    catch (e) { setStatus('⚠️ ' + String((e as Error).message)); if (!previewRef2.current) bakeModeRef.current = 'display'; return }
    const baked = liveBakeRef.current
    if (!previewRef2.current) { bakeModeRef.current = 'display'; scheduleBake() } // return to edit-res
    baked?.canvas.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href) })
  }, [awaitFullBake, scheduleBake])

  const canBrush = useCallback((tool: string): boolean => {
    if (tool === 'draw' || tool === 'draw-erase') return !!imgCanvas.current
    // add/erase = the GrabCut brush — works with just an image (recognises standalone, or refines a cut)
    if (tool === 'add' || tool === 'erase') return !!imgCanvas.current
    return false
  }, [])

  // WARM-UP: prefetch u2net weights into the HTTP cache (downloads only — no runtime at open;
  // GrabCut's OpenCV lazy-loads on the first brush stroke).
  const warmup = useCallback(() => {
    preloadBen()
    setStatus('ready — upload an image · ⬇ warming u2net in the background')
  }, [])

  const view: LabView = { imgCanvas, d: dRef, bounds: boundsRef, shape: shapeRef, mask: maskRef, liveBake: liveBakeRef }

  return {
    state: {
      status, busy, hasCut, hasImage, ms, settings, blend, shapeTick, histTick, disp, paintCfg,
      canUndo: histRef.current.canUndo(), canRedo: histRef.current.canRedo(),
      hasFile: !!lastFileRef.current,
    },
    actions: {
      upload, detect, setTune, setBlendTune,
      grabCutStroke, paintStroke, canBrush,
      enterEdit, editLive, editCommit, nodeInsert, nodeDelete, nodeApply,
      undo, redo, clearAll, save, requestBake: scheduleBake, setDragging, setPreview, warmup, setPaintCfg,
    },
    view,
    /** node measurement passthrough for the shell's knob display (pure read, no policy) */
    measureNode,
  }
}
export type { EditMode }
