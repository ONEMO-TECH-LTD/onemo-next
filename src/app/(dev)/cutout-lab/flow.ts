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
import { CutoutClient } from '@/lib/cutout-ai/client'
import { MODELS } from '@/lib/cutout-ai/registry'
import type { Mask, Point } from '@/lib/cutout-ai/types'
import type { VShape } from '@/lib/vector-core'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { initWand, WAND_TOLERANCE, wandRegion } from '@/lib/cutout-wand'
import { perfGesture } from '@/app/(dev)/effect-creator/v5.3.1/dev/PerfHUD'
import {
  AUTO_SETTINGS, bakeStickerEngine, BLEND_DEFAULTS, ZERO_SETTINGS, BakeCancelled,
  finishDrawn, finishSpec,
  type BlendSettings, type FinishResult, type OutlineBounds, type TraceOutlineSettings,
} from './finish'
import { fillEnclosedHoles, maskArea, maskFromShape, polishMask, solidShapeMask, subtractMasks, swathMask, unionMasks } from '@/lib/mask-tools'
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

export type EngineSel = 'edge' | 'u2net' | 'none'

/** The adapters the flow needs injected (CreatorAdapters precedent — the flow never touches
 *  location/DOM chrome): initial engine from the URL, URL write-back, and a render request the
 *  shell binds to its canvas draw. */
export interface LabAdapters {
  initialSeg: EngineSel
  onSegChange: (sel: EngineSel) => void
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
  const [edge, setEdge] = useState<'loading' | 'ready' | 'dead'>('loading')
  const [ms, setMs] = useState<{ cut?: number; stroke?: number }>({})
  const [engineSel, setEngineSel] = useState<EngineSel>(adapters.initialSeg)
  const [settings, setSettings] = useState<TraceOutlineSettings>(AUTO_SETTINGS)
  const [blend, setBlend] = useState<BlendSettings>(BLEND_DEFAULTS)
  const [shapeTick, setShapeTick] = useState(0)
  const [histTick, setHistTick] = useState(0)
  const [disp, setDisp] = useState({ w: 480, h: 360 })
  const [wandTol, setWandTolState] = useState(WAND_TOLERANCE) // S2: the wand knob is BRIDGE state — the shell only renders it
  const wandTolRef = useRef(WAND_TOLERANCE)
  const setWandTol = useCallback((v: number) => { wandTolRef.current = v; setWandTolState(v) }, [])

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
  const engineSelRef = useRef(engineSel); engineSelRef.current = engineSel
  const hasCutRef = useRef(false); hasCutRef.current = hasCut
  const edgeRef = useRef<'loading' | 'ready' | 'dead'>('loading'); edgeRef.current = edge
  const wasOutgrownRef = useRef(false)
  const faultNoteRef = useRef<string | null>(null) // R9-3: an edgeFault reason survives the fallback's status churn
  const dispWRef = useRef(disp.w); dispWRef.current = disp.w
  const client = useRef<CutoutClient | null>(null)
  const brushLoadedRef = useRef(false)
  const edgeEncodedRef = useRef(false)
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
    // NO-HOLES LAW (Dan 2026-08-07): every accepted selection is normalized solid — enclosed
    // holes filled (data + soft) so the subject matte never lets the pillow bleed through.
    // micro-hole cap: AI/wand results keep model precision — only dropout-scale enclosed
    // regions (≤0.2% of the image) are filled; paint sources go solid via shape-truth below.
    const mask = fillEnclosedHoles(rawMask, opts?.shapeTruth ? 1 : 0.002)
    // LOUD NO-OP (meta amendment C): with holes refilled, a pure-interior erase changes nothing —
    // say so instead of looking dead ("erase does nothing" class).
    if (opts?.erase && maskRef.current && maskArea(mask) === maskArea(maskRef.current)) {
      // R9-2: two different truths need two different messages — a stroke that removed nothing
      // at all is NOT an interior refill.
      setStatus(maskArea(rawMask) === maskArea(maskRef.current)
        ? '✂️ nothing under the stroke to erase — brush over the shape'
        : '🔒 inside stays solid — erase carves from the edge inward')
      requestRender()
      return false
    }
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
    // SHAPE-IS-TRUTH (E6/E7/E8) — PAINT-DEPOSIT SOURCES ONLY (Dan device 2026-08-07: stamping
    // the outline onto an AI cut included background between legs/arms — the sticker outline is a
    // smoothed ENVELOPE by design and must never redefine a model's precise subject). Paint
    // defines geometry, so there outline ≡ subject is correct: islands drop loudly, slivers go
    // solid, the blend band is parallel. AI + wand results stay verbatim (v5.3.1 matte law);
    // their hole guard is fillEnclosedHoles alone — border-connected concavities are untouched.
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
    const note = faultNoteRef.current ? ` · ⚠️ ${faultNoteRef.current}` : ''
    setStatus(droppedPx > 60
      ? '⚠️ a SEPARATE region was dropped — the one-shape rule keeps only the main shape (bridge it with a connector first)'
      : `✨ done (cut: ${preparedRef.current?.spec.generator.adapter ?? '?'}) — brush, draw, edit, tune, or Save${note}`)
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFinish, scheduleBake])

  // ── fault policy: brush watchdog fault → edge-dead → u2net-only degradation ──
  const edgeFault = useCallback((why: string) => {
    edgeRef.current = 'dead'; setEdge('dead')
    // RELEASE THE CORPSE (Dan device: manual u2net works, the automatic fallback didn't — a failed
    // EdgeSAM init leaves the dead brush worker holding its whole WASM arena, strangling the tab
    // the fallback then runs in; restart 'fixed' it by freeing that memory). Terminate the worker
    // NOW, respawn it empty (no weights) so the memory is back before the fallback cut starts.
    try { client.current?.dispose() } catch { /* already gone */ }
    brushLoadedRef.current = false
    edgeEncodedRef.current = false
    const c = new CutoutClient()
    c.onProgress = (loaded, total) => setStatus(`⬇ brush AI ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB…`)
    c.spawn()
    client.current = c
    faultNoteRef.current = why
    setStatus('⚠️ ' + why + ' — u2net only now')
  }, [])

  // ── brush add-on lifecycle (one AI runtime, lazy weights) ──
  useEffect(() => {
    const c = new CutoutClient()
    client.current = c
    c.onProgress = (loaded, total) => setStatus(`⬇ brush AI ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB…`)
    c.spawn()
    edgeRef.current = 'ready'; setEdge('ready') // 'ready' = available; weights load on first use
    setStatus('ready — upload an image')
    return () => c.dispose()
  }, [])

  const ensureEdge = useCallback(async () => {
    const c = client.current!
    if (!brushLoadedRef.current) {
      setStatus('⬇ loading brush AI (EdgeSAM, one-time)…')
      await withTimeout(c.load(MODELS.edgesam, 'auto'), T_DOWNLOAD_MS, 'brush AI load')
      brushLoadedRef.current = true
    }
    if (!edgeEncodedRef.current) {
      setStatus('🧠 AI reading the image…')
      const img = imgCanvas.current!
      const px = img.getContext('2d')!.getImageData(0, 0, img.width, img.height)
      await withTimeout(c.encode(px.data, img.width, img.height), T_COMPUTE_MS, 'AI encode')
      edgeEncodedRef.current = true
    }
    if (maskRef.current) await withTimeout(c.setBase(maskRef.current), T_COMPUTE_MS, 'AI base sync')
  }, [])

  // ── actions ──────────────────────────────────────────────────────────────────────────────────
  const upload = useCallback(async (file: File) => {
    lastFileRef.current = file
    faultNoteRef.current = null
    maskRef.current = null; dRef.current = null; drawnRef.current = null; shapeRef.current = null; preparedRef.current = null; liveBakeRef.current = null
    setHasCut(false); setMs({})
    edgeEncodedRef.current = false
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
    requestRender()
    // MANUAL MODE (Dan, said three times: the wand is INDEPENDENT — no model may load for it):
    // 'No AI' skips segmentation entirely. The image is ready as-is; wand/paint create the shape.
    if (engineSelRef.current === 'none') {
      setHasCut(false)
      setStatus('🖼 image ready — no AI. Wand-tap or paint to create the shape')
      return
    }
    setBusy(true)
    // ONE-SESSION-ON-PINNED-WASM (meta verdict 2026-08-07, B-on-pin CONFIRMED): Dan's device
    // refuted the dual-lazy config at 6e9cae2b — the FIRST-STROKE DUAL-INIT (brush session init
    // next to the engine's live cut session) is the crash. Edge-mode cut runs through the BRUSH
    // worker's single session on the PINNED pure-wasm runtime (r6b's routing, exonerated: its
    // device failure was the now-deleted webgpu-first probe). The engine worker never runs
    // EdgeSAM; ?seg stays the roster SELECTOR (condition a); u2net/manual stay roster-verbatim
    // (condition e). Edge failure: corpse cleanup runs inside edgeFault BEFORE the loud u2net
    // fallback (condition c).
    try {
      if (engineSelRef.current === 'edge') {
        // R9-3: ONE retry on a fresh worker before the loud fallback — transient load failures
        // (deploy-env flakiness) were silently degrading to u2net on the first hiccup.
        let edgeErr: Error | null = null
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            setStatus(attempt ? '✨ retrying EdgeSAM (fresh worker)…' : '✨ AI magic (EdgeSAM · one session)…')
            const t0 = performance.now()
            await ensureEdge()
            setStatus('✨ recognising…')
            const r = await withTimeout(client.current!.redetect(), T_COMPUTE_MS, 'EdgeSAM detect')
            perfGesture('segment-edge', performance.now() - t0)
            setMs({ cut: Math.round(performance.now() - t0) })
            faultNoteRef.current = null
            await acceptMask(r.mask)
            setBusy(false)
            return
          } catch (e) {
            edgeErr = e as Error
            if (attempt === 0) { // corpse cleanup, then retry once
              try { client.current?.dispose() } catch { /* gone */ }
              brushLoadedRef.current = false; edgeEncodedRef.current = false
              const c = new CutoutClient()
              c.onProgress = (loaded, total) => setStatus(`⬇ brush AI ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB…`)
              c.spawn(); client.current = c
            }
          }
        }
        edgeFault('EdgeSAM failed twice (' + String(edgeErr?.message) + ')')
        engineSelRef.current = 'u2net'; setEngineSel('u2net')
        adapters.onSegChange('u2net') // URL follows through the shell adapter — loud degradation
      }
      setStatus('✨ AI magic (u2net · v5.3.1)…')
      const t0 = performance.now()
      const r = await withTimeout(segmentV531(url, w, h), T_DOWNLOAD_MS, 'AI cut')
      perfGesture('segment', performance.now() - t0)
      setMs({ cut: Math.round(performance.now() - t0) })
      await acceptMask(r.mask, r.preseg)
    } catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptMask, requestRender, ensureEdge, edgeFault])

  const redetect = useCallback(async () => { if (lastFileRef.current) await upload(lastFileRef.current) }, [upload])

  const setEngine = useCallback((v: EngineSel) => {
    setEngineSel(v); engineSelRef.current = v
    adapters.onSegChange(v) // URL write = shell adapter duty, invoked through the injected adapter
    setStatus(v === 'edge' ? 'EdgeSAM engine (v5.3.1 roster)' : v === 'u2net' ? 'u2net engine (v5.3.1 default)' : '🖼 No AI — wand + paint only, no model loads')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  // ── I2f — ONE BRUSH, TWO DRIVERS (Dan verbatim: "unify means delete wand brush keep the
  // engine - re-use brush from sam with wand engine"). The comet brush is THE brush; the driver
  // decides where regions come from: 'sam' = semantic strokes→prompts (aiStroke, unchanged),
  // 'wand' = contrast floods from the stroke's samples (coalesced ≥ brushPx spacing — never per
  // pointer-move). The wand TOOL modes are deleted, not parked. ──
  const driverRef = useRef<'sam' | 'wand'>('sam')
  const [driver, setDriverState] = useState<'sam' | 'wand'>('sam')
  const wandStroke = useCallback((stroke: Point[], erase: boolean, brushR: number) => runTool(async () => {
    const img = imgCanvas.current!
    const brushPx = Math.max(4, brushR * (img.width / dispWRef.current))
    // coalesce the gesture to samples ≥ brushPx apart (a tap = one sample)
    const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
    const samples = [pts[0]]
    for (const p of pts) { const l = samples[samples.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) >= brushPx) samples.push(p) }
    const tw0 = performance.now()
    const region = { data: new Uint8Array(img.width * img.height), w: img.width, h: img.height }
    for (const s of samples) {
      const r = await withTimeout(wandRegion(img, s.x, s.y, wandTolRef.current), T_COMPUTE_MS, 'wand')
      for (let i = 0; i < region.data.length; i++) if (r.data[i]) region.data[i] = 1
    }
    perfGesture('wand-region', performance.now() - tw0)
    if (!maskRef.current || !hasCutRef.current) {
      if (erase) { setStatus('🪄 nothing to erase yet'); requestRender(); return }
      setBusy(true); await acceptMask(polishMask(region, brushPx)); setBusy(false)
      setStatus('🪄 region filled — brush more, or erase'); return
    }
    const tp0 = performance.now()
    if (erase) {
      // NO-HOLES no-op detection BEFORE polish (polish re-rounds edges, so post-polish equality
      // never holds): if the carved pixels are all enclosed, the fill law restores them exactly.
      const carved = subtractMasks(maskRef.current, region)
      if (maskArea(fillEnclosedHoles(carved)) === maskArea(maskRef.current)) {
        setStatus(maskArea(carved) === maskArea(maskRef.current)
          ? '✂️ nothing under the stroke to erase — brush over the shape'
          : '🔒 inside stays solid — erase carves from the edge inward')
        requestRender(); return
      }
    }
    const combined = polishMask(erase ? subtractMasks(maskRef.current, region) : unionMasks(maskRef.current, region), brushPx)
    perfGesture('wand-polish', performance.now() - tp0)
    // ONE-SOLID-SHAPE rule surfaced LOUDLY (Dan device r3: a disconnected wand fill silently
    // vanished at trace — 'operating in weird way'): if the grown region doesn't touch the
    // existing shape, the engine's keep-largest rule will drop it — say so instead of swallowing.
    let disconnected = false
    if (!erase) {
      const base = maskRef.current, w = base.w
      disconnected = true
      outer: for (let i = 0; i < region.data.length; i += 2) { // stride 2 (meta B4: 5 missed thin connectors → false warnings); early-exit keeps it under budget
        if (!region.data[i]) continue
        const x = i % w, y = (i / w) | 0
        for (let dy = -2; dy <= 2 && disconnected; dy++) for (let dx = -2; dx <= 2; dx++) {
          const j = (y + dy) * w + (x + dx)
          if (j >= 0 && j < base.data.length && base.data[j]) { disconnected = false; break outer }
        }
      }
    }
    setBusy(true); const ok = await acceptMask(combined, undefined, { erase }); setBusy(false)
    if (ok) setStatus(erase ? '🪄 region erased'
      : disconnected ? '🪄 filled a SEPARATE region — the one-shape rule drops it unless you bridge it to the main shape (paint a connector)'
      : '🪄 region filled')
  }), [acceptMask, requestRender, runTool])

  const paintStroke = useCallback((stroke: Point[], erase: boolean, brushR: number) => runTool(async () => {
    const img = imgCanvas.current!
    const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
    const brushPx = brushR * (img.width / dispWRef.current)
    // PAINT semantics (Dan): the brush deposits AREA; a closed gesture fills its interior too
    const ts0 = performance.now()
    const painted = swathMask(pts, brushPx, img.width, img.height)
    perfGesture('swath', performance.now() - ts0)
    if (!maskRef.current || !hasCutRef.current) {
      if (erase) { setStatus('✂️ nothing to erase yet — paint a shape first or Re-detect'); requestRender(); return }
      drawnRef.current = null
      setBusy(true); await acceptMask(polishMask(painted, brushPx), undefined, { shapeTruth: true }); setBusy(false)
      setStatus('✏️ painted shape created — keep painting, erase, or tune')
      return
    }
    drawnRef.current = null
    const tp1 = performance.now()
    const combined = polishMask(erase ? subtractMasks(maskRef.current, painted) : unionMasks(maskRef.current, painted), brushPx)
    perfGesture('paint-polish', performance.now() - tp1)
    setBusy(true)
    const ok = await acceptMask(combined, undefined, { erase, shapeTruth: true })
    setBusy(false)
    if (ok) setStatus(erase ? '✂️ erased — auto-tuned' : '✏️ added — auto-tuned')
  }), [acceptMask, requestRender, runTool])

  const brushStroke = useCallback((stroke: (Point & { t: number })[], erase: boolean, brushR: number) => {
    if (driverRef.current === 'wand') return wandStroke(stroke, erase, brushR)
    return aiStroke(stroke, erase, brushR)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const aiStroke = useCallback((stroke: (Point & { t: number })[], erase: boolean, brushR = 12) => runTool(async () => {
    setBusy(true)
    try {
      await ensureEdge()
      setStatus(erase ? '🔴 erasing…' : '🟢 filling…')
      const t0 = performance.now()
      const r = await withTimeout(erase ? client.current!.eraseStroke(stroke, brushR / dispWRef.current) : client.current!.addStroke(stroke), T_COMPUTE_MS, 'AI stroke')
      setMs((m) => ({ ...m, stroke: Math.round(performance.now() - t0) }))
      await acceptMask(r.mask, undefined, { erase })
    } catch (e) {
      // meta audit B1: a recoverable timeout must NOT kill the brush permanently — warn and stay
      // ready for a retry; only real worker deaths flip edge-dead.
      if (String((e as Error).message).includes('timed out')) setStatus('⚠️ ' + String((e as Error).message) + ' — try the stroke again')
      else edgeFault('brush froze (' + String((e as Error).message) + ')')
    }
    setBusy(false)
  }), [acceptMask, edgeFault, ensureEdge, runTool])

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
    // the brush worker must not keep the pre-Clear base — reset it to EMPTY via the existing API
    if (brushLoadedRef.current && imgCanvas.current) {
      const img = imgCanvas.current
      withTimeout(client.current!.setBase({ data: new Uint8Array(img.width * img.height), w: img.width, h: img.height }), T_COMPUTE_MS, 'brush base reset')
        .catch((e) => setStatus('⚠️ ' + String((e as Error).message)))
    }
    setHasCut(false); pushHistory(); requestRender()
    setStatus('🗑 cleared — paint, wand, or comet-brush a new shape, or Re-detect')
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
    // add/erase = THE brush (I2f): wand driver needs only an image (model-free); sam driver needs
    // the promptable engine — an AI stroke CREATES the cut when none exists (Dan's device round:
    // Clear must not kill the comet brush)
    if (tool === 'add' || tool === 'erase') {
      if (!imgCanvas.current) return false
      if (driverRef.current === 'wand') return true
      return engineSelRef.current === 'edge' && edgeRef.current === 'ready'
    }
    return false
  }, [])

  // WARM-UP (Dan device r3 + meta's round-3 finding): called by the SHELL AFTER its ?seg URL
  // write is guaranteed — preloadBen() reads segParam() from the URL at call time, so calling it
  // from the flow's own mount effect on a bare URL warmed the WRONG model (u2netp) while EdgeSAM
  // still downloaded at first cut. The engine preload + the brush model both warm here; the first
  // stroke later pays inference only.
  const warmup = useCallback(() => {
    // R4-PROVEN WARM-UP (meta-confirmed): the ENGINE's own preload (its selected cut model, via
    // preloadBen reading ?seg AFTER the shell writes it) + the brush weights into the HTTP cache.
    // Downloads only — no ORT session, no OpenCV (that instantiates on wand-selector press).
    // Manual mode warms nothing, ever.
    if (engineSelRef.current === 'none') return
    // edge mode: brush weights only (the engine worker never runs EdgeSAM — preloadBen would
    // session-create the wrong thing at open); u2net mode: the engine's own preload.
    if (engineSelRef.current === 'edge') {
      fetch(MODELS.edgesam.enc!).catch(() => {})
      fetch(MODELS.edgesam.dec!).catch(() => {})
    } else {
      preloadBen()
    }
    setStatus('ready — upload an image · ⬇ warming the AI models in the background')
  }, [])

  // SWAP-NOT-STACK (meta-confirmed, ASYMMETRIC by platform truth): entering wand DISPOSES the
  // brush worker (real memory back — worker teardown) and warms OpenCV (user intent = the wand
  // selector press). The reverse CANNOT dispose OpenCV (main-thread Emscripten heap, no teardown —
  // resident for page life); leaving wand re-lazies the brush on the next stroke, where ensureEdge
  // reloads, re-encodes, and re-seeds the base from the current cut (r4 behavior).
  const setDriver = useCallback((d: 'sam' | 'wand') => {
    if (driverRef.current === d) return
    driverRef.current = d
    setDriverState(d)
    if (d === 'wand') {
      // entering the wand driver DISPOSES the brush worker (real memory back) and warms OpenCV
      // (user intent = the driver press; it cannot be torn down once up — §I2d.4 asymmetry)
      if (brushLoadedRef.current || edgeEncodedRef.current) {
        try { client.current?.dispose() } catch { /* gone */ }
        brushLoadedRef.current = false
        edgeEncodedRef.current = false
        const c = new CutoutClient()
        c.onProgress = (loaded, total) => setStatus(`⬇ brush AI ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB…`)
        c.spawn()
        client.current = c
      }
      void initWand().catch(() => { /* first stroke retries loudly through the tool queue */ })
      setStatus('🪄 Wand2 driver — contrast regions, tolerance knob live')
    } else {
      // sam re-lazies on the next stroke (ensureEdge reloads + re-encodes + re-seeds the base)
      setStatus('🧠 SAM driver — semantic regions')
    }
  }, [])

  const view: LabView = { imgCanvas, d: dRef, bounds: boundsRef, shape: shapeRef, mask: maskRef, liveBake: liveBakeRef }

  return {
    state: {
      status, busy, hasCut, hasImage, edge, ms, engineSel, settings, blend, shapeTick, histTick, disp,
      wandTol, driver,
      canUndo: histRef.current.canUndo(), canRedo: histRef.current.canRedo(),
      hasFile: !!lastFileRef.current,
    },
    actions: {
      upload, redetect, setEngine, setTune, setBlendTune,
      brushStroke, paintStroke, canBrush,
      enterEdit, editLive, editCommit, nodeInsert, nodeDelete, nodeApply,
      undo, redo, clearAll, save, requestBake: scheduleBake, setDragging, setPreview, warmup, setDriver, setWandTol,
    },
    view,
    /** node measurement passthrough for the shell's knob display (pure read, no policy) */
    measureNode,
  }
}
export type { EditMode }
