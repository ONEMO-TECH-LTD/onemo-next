'use client'

// cutout-lab — calibration bench (s62). STATE + RENDER ONLY: AI subs in the cutout-ai worker,
// hand tool in lib/freeshape, finishing/blend/expansion in v5.3.1 via finish.ts glue, vector
// editing gestures in EditorOverlay. Controls are TABS with ONE adaptive knob (Dan item 10).
// Engine select: EdgeSAM (auto+brush) vs u2net (auto only) for on-device comparison (item 7).

import { useCallback, useEffect, useRef, useState } from 'react'
import { CutoutClient } from '@/lib/cutout-ai/client'
import { MODELS } from '@/lib/cutout-ai/registry'
import type { Mask, Point } from '@/lib/cutout-ai/types'
import type { VShape } from '@/lib/vector-core'
import { EditorOverlay, type EditMode } from './EditorOverlay'
import {
  AUTO_SETTINGS, bakeStickerEngine, BLEND_DEFAULTS, ZERO_SETTINGS,
  drawCutout, finishDrawn, finishSpec, maskFromShape, maskOverlay, prepareAI, prepareNative,
  polishMask, shapePathD, shapeRing, subtractMasks, swathMask, unionMasks,
  type BlendSettings, type FillChoice, type FinishResult, type OutlineBounds, type TraceOutlineSettings,
} from './finish'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { segmentV531 } from './v531seg'
import { wandRegion } from '@/lib/cutout-wand'

import { HistoryStack } from './history'
import { BLEND_CHIPS, CHIP_RANGE, VEC_CHIPS, type Tab, type Tool } from './ui-config'

const WORK_MAX = 1024

export default function CutoutLab() {
  const [tool, setTool] = useState<Tool>('add')
  const [tab, setTab] = useState<Tab>('ai')
  const [vecChip, setVecChip] = useState<(typeof VEC_CHIPS)[number]>('detail')
  const [blendChip, setBlendChip] = useState<(typeof BLEND_CHIPS)[number]>('blend')
  const [engineSel, setEngineSel] = useState<'edge' | 'u2net'>('edge')
  const [aspectLocked, setAspectLocked] = useState(true)
  const wasOutgrownRef = useRef(false)
  const [brushR, setBrushR] = useState(40)
  const [settings, setSettings] = useState<TraceOutlineSettings>(AUTO_SETTINGS)
  const [blend, setBlend] = useState<BlendSettings>(BLEND_DEFAULTS)
  const [status, setStatus] = useState('ready — upload an image')
  const [busy, setBusy] = useState(false)
  const [hasCut, setHasCut] = useState(false)
  const [edge, setEdge] = useState<'loading' | 'ready' | 'dead'>('loading')
  const [ms, setMs] = useState<{ cut?: number; stroke?: number }>({})
  const [disp, setDisp] = useState({ w: 480, h: 360 })
  const [shapeTick, setShapeTick] = useState(0) // re-render signal for the edit overlay
  const [preview, setPreview] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const previewRef = useRef(false); previewRef.current = preview
  const [overlayOn, setOverlayOn] = useState(false) // default OFF — the tint paints a frame-shaped edge over the live result (Dan 14:29)
  const overlayRef = useRef(true); overlayRef.current = overlayOn

  const client = useRef<CutoutClient | null>(null)
  const imgCanvas = useRef<HTMLCanvasElement | null>(null)
  const viewRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<Mask | null>(null)
  const dRef = useRef<string | null>(null)
  const boundsRef = useRef<OutlineBounds | null>(null)
  const shapeRef = useRef<VShape | null>(null) // resolved shape (edit overlay target)
  const drawnRef = useRef<{ shape: VShape; ring: { x: number; y: number }[] } | null>(null)
  const strokeRef = useRef<(Point & { t: number })[]>([])
  const paintingRef = useRef(false)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const lastFileRef = useRef<File | null>(null)
  const urlRef = useRef<string | null>(null) // object URL kept alive for engine re-prepare
  const preparedRef = useRef<PreparedEffect | null>(null)
  const edgeRef = useRef<'loading' | 'ready' | 'dead'>('loading'); edgeRef.current = edge
  const edgeEncodedRef = useRef(false)
  const settingsRef = useRef(settings); settingsRef.current = settings
  const blendRef = useRef(blend); blendRef.current = blend
  const previewSeq = useRef(0)
  const liveBakeRef = useRef<{ canvas: HTMLCanvasElement; bounds: OutlineBounds } | null>(null)
  const viewBoxRef = useRef({ x: 0, y: 0, w: 1, h: 1 }) // working-view extent (image ∪ outline)
  const bakeSeq = useRef(0)
  const toolRef = useRef(tool); toolRef.current = tool
  const engineSelRef = useRef(engineSel); engineSelRef.current = engineSel
  const hasCutRef = useRef(false); hasCutRef.current = hasCut
  const brushRef = useRef(brushR); brushRef.current = brushR
  type Snap = { mask: Mask | null; drawn: { shape: VShape; ring: { x: number; y: number }[] } | null }
  const histRef = useRef(new HistoryStack<Snap>(30))
  const [histTick, setHistTick] = useState(0)
  const snapNow = (): Snap => ({
    mask: maskRef.current ? { data: maskRef.current.data.slice(), w: maskRef.current.w, h: maskRef.current.h, soft: maskRef.current.soft?.slice() } : null,
    drawn: drawnRef.current,
  })
  const pushHistory = () => { histRef.current.push(snapNow()); setHistTick((t) => t + 1) }
  const restore = async (s: Snap) => {
    maskRef.current = s.mask ? { data: s.mask.data.slice(), w: s.mask.w, h: s.mask.h, soft: s.mask.soft?.slice() } : null
    drawnRef.current = s.drawn
    setHasCut(!!(s.mask || s.drawn))
    if (s.mask && !s.drawn && imgCanvas.current && urlRef.current) {
      try { preparedRef.current = await prepareAI(urlRef.current, maskRef.current!) } catch { /* keep last prepared */ }
    }
    applyFinish()
  }
  const undo = async () => { const s = histRef.current.undo(); if (s) { setHistTick((t) => t + 1); await restore(s) } }
  const redo = async () => { const s = histRef.current.redo(); if (s) { setHistTick((t) => t + 1); await restore(s) } }
  const clearAll = () => {
    maskRef.current = null; drawnRef.current = null; preparedRef.current = null
    dRef.current = null; boundsRef.current = null; shapeRef.current = null
    setHasCut(false); pushHistory(); render()
    setStatus('🗑 cleared — paint a shape with the hand brush, or Re-detect')
  }

  const dispW2 = useRef(disp.w); dispW2.current = disp.w
  const dispRefW = () => dispW2.current
  const recomposeLive = useCallback(() => {
    if (!preparedRef.current || !dRef.current || !boundsRef.current) { liveBakeRef.current = null; return }
    const seq = ++bakeSeq.current
    const [d, bounds] = [dRef.current, boundsRef.current]
    bakeStickerEngine(preparedRef.current, d, bounds, imgCanvas.current!.width, imgCanvas.current!.height, blendRef.current)
      .then((r) => { if (seq === bakeSeq.current) { liveBakeRef.current = { canvas: r.canvas, bounds }; render() } })
      .catch((e) => setStatus('⚠️ compose failed: ' + String((e as Error)?.message ?? e))) // fail LOUD
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const p2w = () => preparedRef.current?.spec.maskWidthPx ?? imgCanvas.current?.width ?? 1
  const p2h = () => preparedRef.current?.spec.maskHeightPx ?? imgCanvas.current?.height ?? 1

  // ── render (draw only) ── ONE canvas: working view, or the baked sticker when Preview is on
  const render = useCallback(() => {
    const view = viewRef.current, img = imgCanvas.current
    if (!view || !img) return
    const ctx0 = view.getContext('2d')!
    if (previewRef.current && dRef.current) {
      // PREVIEW = the SAME bake the editor shows, only cut out (checkerboard instead of the photo).
      // One compositor, one cache — edit/preview divergence is impossible by construction.
      const live = liveBakeRef.current
      if (live) {
        const w = live.canvas.width, h = live.canvas.height
        view.width = w; view.height = h
        const t = 16
        for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) { ctx0.fillStyle = ((x / t + y / t) & 1) ? '#e5e7eb' : '#f8fafc'; ctx0.fillRect(x, y, t, t) }
        ctx0.drawImage(live.canvas, 0, 0)
      } else {
        drawCutout(view, img, dRef.current)
      }
      return
    }
    // VIEW ADAPTS TO THE OUTLINE (Dan 2026-08-06): the working view covers the outline's FULL
    // extent — an offset past the frame zooms the view out (object reads smaller) instead of
    // hiding under the canvas edge. viewport CSS width stays fixed.
    const b0 = boundsRef.current
    const m = b0 ? Math.max(4, img.width / 100) : 0
    const vb = {
      x: Math.min(0, b0 ? Math.floor(b0.minX - m) : 0),
      y: Math.min(0, b0 ? Math.floor(b0.minY - m) : 0),
      w: 0, h: 0,
    }
    vb.w = Math.max(img.width, b0 ? Math.ceil(b0.maxX + m) : 0) - vb.x
    vb.h = Math.max(img.height, b0 ? Math.ceil(b0.maxY + m) : 0) - vb.y
    viewBoxRef.current = vb
    view.width = vb.w; view.height = vb.h
    const ctx = view.getContext('2d')!
    ctx.save()
    ctx.translate(-vb.x, -vb.y)
    ctx.drawImage(img, 0, 0)
    const mask = maskRef.current
    if (mask && overlayRef.current) {
      const tmp = document.createElement('canvas'); tmp.width = mask.w; tmp.height = mask.h
      tmp.getContext('2d')!.putImageData(maskOverlay(mask), 0, 0)
      ctx.drawImage(tmp, 0, 0, img.width, img.height)
    }
    if (dRef.current) {
      // LIVE RESULT (Dan's one-canvas law): the ENGINE-composed sticker drawn in place inside the
      // outline — blend/fill/presets react in real time; the raw image shows only outside, dimmed.
      const live = liveBakeRef.current
      if (live) {
        const b = live.bounds
        ctx.save()
        ctx.clip(new Path2D(dRef.current))
        ctx.drawImage(live.canvas, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY)
        ctx.restore()
      }
      const scrim = new Path2D()
      scrim.rect(vb.x, vb.y, vb.w, vb.h)
      scrim.addPath(new Path2D(dRef.current))
      ctx.save(); ctx.fillStyle = 'rgba(6,8,14,0.55)'; ctx.fill(scrim, 'evenodd'); ctx.restore()
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = Math.max(2, img.width / 400); ctx.stroke(new Path2D(dRef.current))
    }
    const st = strokeRef.current
    if (st.length > 1) {
      const t = toolRef.current
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      if (t === 'draw' || t === 'draw-erase') {
        // PAINT ink (WYSIWYG): the stroke renders at the actual brush width — what you paint is
        // the area that lands. Violet = add, red = erase.
        ctx.strokeStyle = t === 'draw' ? 'rgba(124,58,237,0.45)' : 'rgba(239,68,68,0.45)'
        ctx.lineWidth = Math.max(2, brushRef.current * (viewBoxRef.current.w / disp.w) * 2)
        ctx.beginPath(); ctx.moveTo(st[0].x * img.width, st[0].y * img.height)
        for (const q of st) ctx.lineTo(q.x * img.width, q.y * img.height)
        ctx.stroke()
      } else {
        // AI pointer: COMET TAIL — bright head, tail dissolves in TIME like a keyboard swipe (item 9)
        const col = t === 'add' ? '34,197,94' : '239,68,68'
        const now = performance.now()
        const LIFE = 700 // ms a trail point stays visible
        for (let i = 1; i < st.length; i++) {
          const a = Math.max(0, 1 - (now - (st[i] as { t: number }).t) / LIFE)
          if (a <= 0) continue
          ctx.strokeStyle = `rgba(${col},${(a * 0.9).toFixed(2)})`
          ctx.lineWidth = Math.max(2, brushRef.current * (viewBoxRef.current.w / disp.w) * (0.3 + 0.7 * a))
          ctx.beginPath()
          ctx.moveTo(st[i - 1].x * img.width, st[i - 1].y * img.height)
          ctx.lineTo(st[i].x * img.width, st[i].y * img.height)
          ctx.stroke()
        }
      }
    }
    const cur = cursorRef.current
    if (cur && (hasCutRef.current || toolRef.current === 'draw' || toolRef.current === 'draw-erase')) {
      const t = toolRef.current
      if (t !== 'nodes' && t !== 'frame') {
        ctx.beginPath()
        ctx.arc(cur.x * img.width, cur.y * img.height, brushRef.current * (viewBoxRef.current.w / disp.w), 0, 6.29)
        ctx.lineWidth = Math.max(2, img.width * 0.003)
        ctx.strokeStyle = t === 'add' ? 'rgba(34,197,94,1)' : t === 'draw' ? 'rgba(124,58,237,1)' : 'rgba(239,68,68,1)'
        ctx.stroke()
      }
    }
    ctx.restore() // view-box translate
  }, [disp.w])

  const applyFinish = useCallback(() => {
    const img = imgCanvas.current
    const drawn = drawnRef.current
    const eff = settingsRef.current
    const fin: FinishResult | null = drawn && img
      ? finishDrawn(drawn.shape, drawn.ring, img.width, img.height, eff)
      : preparedRef.current ? finishSpec(preparedRef.current, eff, img?.width) : null
    dRef.current = fin?.d ?? null
    boundsRef.current = fin?.bounds ?? null
    shapeRef.current = fin?.shape ?? null
    // AUTO-COMPOSITING ON FRAME EXIT (Dan's law), value-TRUE: entering outgrowth sets the actual
    // blend knob to the engine default — the control reflects what is applied; the user can still
    // re-zero it (their override stands until the next transition into outgrowth).
    const img2 = imgCanvas.current, bb = fin?.bounds
    const og = !!(img2 && bb && (bb.minX < 0 || bb.minY < 0 || bb.maxX > img2.width || bb.maxY > img2.height))
    if (og && !wasOutgrownRef.current && blendRef.current.blend === 0 && preparedRef.current) {
      const def = Math.round(preparedRef.current.frontSrc.defaultBlendPercent)
      blendRef.current = { ...blendRef.current, blend: def }
      setBlend(blendRef.current)
    }
    wasOutgrownRef.current = og
    setShapeTick((t) => t + 1)
    recomposeLive()
    render()
  }, [render, recomposeLive])

  const acceptMask = useCallback(async (mask: Mask, preseg?: import('@/lib/effect/segment-ml').MLResult) => {
    drawnRef.current = null
    maskRef.current = mask
    const img = imgCanvas.current, url = urlRef.current
    if (img && url) {
      try {
        // native preseg (u2net path) passes through VERBATIM — the v5.3.1 bridge, no lab rebuild;
        // model/brush masks (no engine preseg exists) go through the buildPreseg seam.
        const loud = (st: string) => { if (st === 'fallback') setStatus('⚠️ AI cut unavailable — flood-fill fallback (NO matte: blend has no object layer)') }
        preparedRef.current = await (preseg ? prepareNative(url, preseg, loud) : prepareAI(url, mask, loud))
      } catch (e) { setStatus('⚠️ engine prepare failed: ' + String((e as Error).message)); return }
    }
    setHasCut(true)
    applyFinish()
    pushHistory()
    setStatus(`✨ done (cut: ${preparedRef.current?.spec.generator.adapter ?? '?'}) — brush, draw, edit, tune, or Save`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFinish])

  const edgeFault = useCallback((why: string) => {
    edgeRef.current = 'dead'; setEdge('dead')
    setStatus('⚠️ ' + why + ' — u2net only now')
  }, [])

  useEffect(() => {
    // Default engine = EdgeSAM via the v5.3.1 roster (`?seg=edgesam` — the engine's own swap param).
    const u = new URL(location.href)
    if (!u.searchParams.get('seg')) { u.searchParams.set('seg', 'edgesam'); history.replaceState(null, '', u) }
    else if (u.searchParams.get('seg') !== 'edgesam') { setEngineSel('u2net'); engineSelRef.current = 'u2net' }
    // The cutout-ai worker is the BRUSH add-on only — spawned here, model loaded LAZILY on the first
    // brush stroke (ensureEdge), so exactly one AI runtime is resident until the user steers.
    const c = new CutoutClient()
    client.current = c
    c.onProgress = (loaded, total) => setStatus(`⬇ brush AI ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB…`)
    c.spawn()
    edgeRef.current = 'ready'; setEdge('ready') // 'ready' = available; weights load on first use
    setStatus('ready — upload an image')
    return () => c.dispose()
  }, [])

  // ── upload → auto cut on the SELECTED engine (item 7) ──
  const onFile = useCallback(async (file: File) => {
    lastFileRef.current = file
    maskRef.current = null; dRef.current = null; drawnRef.current = null; shapeRef.current = null; preparedRef.current = null; setHasCut(false); setMs({})
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
    render()
    setBusy(true)
    // ONE pipeline for every engine: the v5.3.1 worker chain, model picked by its own `?seg=`
    // roster parameter (EdgeSAM or the u2netp trio). The cutout-ai worker is brush-only, lazy.
    try {
      setStatus(`✨ AI magic (${engineSelRef.current === 'edge' ? 'EdgeSAM' : 'u2net'} · v5.3.1)…`)
      const t0 = performance.now()
      const r = await segmentV531(url, w, h)
      setMs({ cut: Math.round(performance.now() - t0) })
      await acceptMask(r.mask, r.preseg)
    } catch (e) { setStatus('⚠️ ' + String((e as Error).message)) }
    setBusy(false)
  }, [acceptMask, render])

  const brushLoadedRef = useRef(false)
  const ensureEdge = useCallback(async () => {
    const c = client.current!
    if (!brushLoadedRef.current) {
      setStatus('⬇ loading brush AI (EdgeSAM, one-time)…')
      await c.load(MODELS.edgesam, 'auto')
      brushLoadedRef.current = true
    }
    if (!edgeEncodedRef.current) {
      setStatus('🧠 AI reading the image…')
      const img = imgCanvas.current!
      const px = img.getContext('2d')!.getImageData(0, 0, img.width, img.height)
      await c.encode(px.data, img.width, img.height)
      edgeEncodedRef.current = true
    }
    if (maskRef.current) await c.setBase(maskRef.current)
  }, [])

  // ── pointer strokes (add/erase = AI · draw = freeshape · nodes/frame = overlay's job) ──
  const nrm = (e: React.PointerEvent): Point & { t: number } => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const vb = viewBoxRef.current, img = imgCanvas.current
    const iw = img?.width ?? 1, ih = img?.height ?? 1
    // contain-fit letterbox mapping: the canvas element is a fixed box; the content is centered
    const sc = Math.min(r.width / vb.w, r.height / vb.h)
    const ox = (r.width - vb.w * sc) / 2, oy = (r.height - vb.h * sc) / 2
    return {
      x: (vb.x + (e.clientX - r.left - ox) / sc) / iw,
      y: (vb.y + (e.clientY - r.top - oy) / sc) / ih,
      label: 1, t: performance.now(),
    }
  }
  // comet animation: while painting an AI stroke, keep repainting so the tail dissolves in TIME
  const cometRaf = useRef(0)
  const cometLoop = useCallback(() => {
    if (!paintingRef.current) { cometRaf.current = 0; return }
    render()
    cometRaf.current = requestAnimationFrame(cometLoop)
  }, [render])
  const brushable = () => {
    if (previewRef.current) return false
    const t = toolRef.current
    if (t === 'draw' || t === 'draw-erase' || t === 'wand' || t === 'wand-erase') return !!imgCanvas.current
    if (t === 'add' || t === 'erase') return hasCutRef.current && engineSelRef.current === 'edge' && edgeRef.current === 'ready'
    return false
  }
  const onDown = (e: React.PointerEvent) => {
    if (busy || !brushable()) return
    paintingRef.current = true; cursorRef.current = nrm(e); strokeRef.current = [nrm(e)]
    const t = toolRef.current
    if ((t === 'add' || t === 'erase') && !cometRaf.current) cometRaf.current = requestAnimationFrame(cometLoop)
    render()
  }
  const onMove = (e: React.PointerEvent) => { cursorRef.current = nrm(e); if (paintingRef.current) strokeRef.current.push(nrm(e)); render() }
  const onUp = async () => {
    if (!paintingRef.current) return
    paintingRef.current = false
    const stroke = strokeRef.current; strokeRef.current = []
    if (stroke.length < 1) { render(); return } // a TAP (single point) is a valid smart-fill prompt (Dan)
    if (toolRef.current === 'wand' || toolRef.current === 'wand-erase') {
      // CONTRAST BUCKET (real magic-wand lib): tap → region grown by color tolerance → outline
      // union/subtract. Pure pixels, no AI — the Photoshop bucket Dan asked for.
      const img = imgCanvas.current!
      const erase = toolRef.current === 'wand-erase'
      const p0 = stroke[stroke.length - 1]
      const region = wandRegion(img, p0.x * img.width, p0.y * img.height)
      const brushPx = brushRef.current * (img.width / dispRefW())
      if (!maskRef.current || !hasCutRef.current) {
        if (erase) { setStatus('🪄 nothing to erase yet'); render(); return }
        setBusy(true); await acceptMask(polishMask(region, brushPx)); setBusy(false)
        setStatus('🪄 region filled — tap more, or erase'); return
      }
      const combined = polishMask(erase ? subtractMasks(maskRef.current, region) : unionMasks(maskRef.current, region), brushPx)
      setBusy(true); await acceptMask(combined); setBusy(false)
      setStatus(erase ? '🪄 region erased' : '🪄 region filled')
      return
    }
    if (toolRef.current === 'draw' || toolRef.current === 'draw-erase') {
      const img = imgCanvas.current!
      const erase = toolRef.current === 'draw-erase'
      const pts = stroke.map((p) => ({ x: p.x * img.width, y: p.y * img.height }))
      const brushPx = brushRef.current * (img.width / dispRefW())
      // PAINT semantics (Dan): the brush deposits AREA; a closed gesture fills its interior too
      const painted = swathMask(pts, brushPx, img.width, img.height)
      if (!maskRef.current || !hasCutRef.current) {
        if (erase) { setStatus('✂️ nothing to erase yet — paint a shape first or Re-detect'); render(); return }
        // PURE paint brush (Dan 2026-08-06: shape recognition removed) — the painted area IS the
        // shape; closed loops fill their interior; the engine pipeline auto-tunes the outline.
        drawnRef.current = null
        setBusy(true); await acceptMask(polishMask(painted, brushPx)); setBusy(false)
        setStatus('✏️ painted shape created — keep painting, erase, or tune')
        return
      }
      // existing shape: paint UNIONS in, erase SUBTRACTS — auto-tuned by the engine pipeline
      drawnRef.current = null
      const combined = polishMask(erase ? subtractMasks(maskRef.current, painted) : unionMasks(maskRef.current, painted), brushPx)
      setBusy(true)
      await acceptMask(combined)
      setBusy(false)
      setStatus(erase ? '✂️ erased — auto-tuned' : '✏️ added — auto-tuned')
      return
    }
    setBusy(true)
    try {
      await ensureEdge()
      setStatus(toolRef.current === 'add' ? '🟢 filling…' : '🔴 erasing…')
      const t0 = performance.now()
      const r = toolRef.current === 'add' ? await client.current!.addStroke(stroke) : await client.current!.eraseStroke(stroke)
      setMs((m) => ({ ...m, stroke: Math.round(performance.now() - t0) }))
      await acceptMask(r.mask)
    } catch (e) { edgeFault('brush froze (' + String((e as Error).message) + ')') }
    setBusy(false)
  }

  // ── vector edit (item 8): entering nodes/frame bakes the resolved shape as the editable source ──
  const enterEdit = (m: EditMode) => {
    const img = imgCanvas.current, shape = shapeRef.current
    if (!img || !shape) return
    if (!drawnRef.current || drawnRef.current.shape !== shape) {
      const ring = shapeRing(shape)
      drawnRef.current = { shape, ring }
      const zero = { ...ZERO_SETTINGS }
      settingsRef.current = zero; setSettings(zero) // adjustments fold into the baked source — TRUE zero, not the default recipe
    }
    setTool(m)
    applyFinish()
  }
  const onEditLive = (next: VShape) => {
    if (drawnRef.current) drawnRef.current = { ...drawnRef.current, shape: next }
    dRef.current = shapePathD(next)
    shapeRef.current = next
    render()
  }
  const onEditCommit = (next: VShape) => {
    const img = imgCanvas.current!
    const ring = shapeRing(next)
    drawnRef.current = { shape: next, ring }
    maskRef.current = maskFromShape(next, img.width, img.height)
    if (urlRef.current) prepareAI(urlRef.current, maskRef.current).then((p) => { preparedRef.current = p; render() }).catch(() => {})
    applyFinish()
    pushHistory()
  }

  const redetect = async () => { if (!busy && lastFileRef.current) await onFile(lastFileRef.current) }

  const save = async () => {
    const img = imgCanvas.current
    if (!img || !dRef.current || !boundsRef.current || !maskRef.current) return
    if (!preparedRef.current) return
    const baked = await bakeStickerEngine(preparedRef.current, dRef.current, boundsRef.current, imgCanvas.current!.width, imgCanvas.current!.height, blendRef.current)
    baked.canvas.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cutout.png'; a.click(); URL.revokeObjectURL(a.href) })
  }

  // refs update SYNCHRONOUSLY, then state, then recompute — React runs setState updaters
  // DEFERRED, so a ref write inside the updater races the recompute (the stale-blend bug).
  const setTune = (patch: Partial<TraceOutlineSettings>) => { const n = { ...settingsRef.current, ...patch }; settingsRef.current = n; setSettings(n); requestAnimationFrame(applyFinish) }
  const setBlendTune = (patch: Partial<BlendSettings>) => { const n = { ...blendRef.current, ...patch }; blendRef.current = n; setBlend(n); recomposeLive() }

  // adaptive knob wiring (item 10): one knob, bound to the active tab's chip
  const knob = (() => {
    if (tab === 'vector') {
      const k = vecChip
      const [lo, hi] = CHIP_RANGE[k]
      const value = k === 'detail' ? 100 - settings.detail : settings[k]
      return { label: k === 'detail' ? 'detail (0 = full)' : k, lo, hi, value, set: (v: number) => setTune(k === 'detail' ? { detail: 100 - v } : { [k]: v }) }
    }
    if (tab === 'blend') {
      const k = blendChip
      const [lo, hi] = CHIP_RANGE[k]
      return { label: k, lo, hi, value: blend[k], set: (v: number) => setBlendTune({ [k]: v }) }
    }
    return { label: 'brush size', lo: 1, hi: 120, value: brushR, set: setBrushR } // min 1 (Dan 2026-08-06)
  })()

  const chipBtn = (active: boolean): React.CSSProperties => ({ ...btn, padding: '4px 10px', fontSize: 12, background: active ? '#0f172a' : '#f1f5f9', color: active ? '#fff' : '#0f172a' })
  const editing = tool === 'nodes' || tool === 'frame'

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, textAlign: 'center' }} data-hist={histTick}>Cutout Lab</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <button onClick={save} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={redetect} disabled={busy || !lastFileRef.current} style={btn}>↻ Re-detect</button>
        <button onClick={undo} disabled={busy || !histRef.current.canUndo()} style={btn}>↩ Undo</button>
        <button onClick={redo} disabled={busy || !histRef.current.canRedo()} style={btn}>↪ Redo</button>
        <button onClick={clearAll} disabled={busy || !hasCut} style={btn}>🗑 Clear</button>
        <button onClick={() => { const v = !previewRef.current; previewRef.current = v; setPreview(v); requestAnimationFrame(render) }} disabled={!hasCut}
          style={{ ...btn, background: preview ? '#0f172a' : '#f1f5f9', color: preview ? '#fff' : '#0f172a' }}>{preview ? '👁 Editing view' : '👁 Preview'}</button>
        <button onClick={() => { const v = !overlayRef.current; overlayRef.current = v; setOverlayOn(v); requestAnimationFrame(render) }} disabled={!hasCut}
          style={{ ...btn, background: overlayOn ? '#f1f5f9' : '#0f172a', color: overlayOn ? '#0f172a' : '#fff' }}>{overlayOn ? '🎭 Mask on' : '🎭 Mask off'}</button>
        <span style={{ fontSize: 12, color: '#b45309' }}>{edge === 'loading' ? 'EdgeSAM loading…' : edge === 'dead' ? 'EdgeSAM dead — u2net only' : ''}</span>
      </div>

      {/* TABS (item 10) — chips within, ONE adaptive knob below */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'center' }}>
        {(['ai', 'vector', 'blend', 'edit'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btn, background: tab === t ? '#7c3aed' : '#f1f5f9', color: tab === t ? '#fff' : '#0f172a' }}>
            {t === 'ai' ? '🤖 AI' : t === 'vector' ? '⬡ Vector' : t === 'blend' ? '🎨 Blend' : '✋ Edit'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#475569', minHeight: 34 }}>
        {tab === 'ai' && (<>
          <select value={engineSel} onChange={(e) => {
            const v = e.target.value as 'edge' | 'u2net'
            setEngineSel(v); engineSelRef.current = v
            // MODEL SWAP = the engine's own `?seg=` roster parameter (read by segment-ml's segParam) —
            // both models run through the ONE v5.3.1 worker pipeline; nothing else changes.
            const u = new URL(location.href)
            if (v === 'edge') u.searchParams.set('seg', 'edgesam'); else u.searchParams.delete('seg')
            history.replaceState(null, '', u)
            setStatus(v === 'edge' ? 'EdgeSAM engine (v5.3.1 roster)' : 'u2net engine (v5.3.1 default)')
          }} style={{ ...btn, fontSize: 12 }}>
            <option value="edge">EdgeSAM · auto + brush</option>
            <option value="u2net">u2net · v5.3.1 (auto only)</option>
          </select>
          {(['add', 'erase'] as Tool[]).map((t) => (
            <button key={t} onClick={() => setTool(t)} disabled={engineSel === 'u2net'} style={chipBtn(tool === t)}>{t === 'add' ? '🟢 Add' : '🔴 Erase'}</button>
          ))}
          {engineSel === 'u2net' && <span style={{ color: '#b45309' }}>brush off — auto model; switch engine to steer</span>}
        </>)}
        {tab === 'vector' && (<>
          {VEC_CHIPS.map((k) => (<button key={k} onClick={() => setVecChip(k)} style={chipBtn(vecChip === k)}>{k}</button>))}

        </>)}
        {tab === 'blend' && (<>
          {BLEND_CHIPS.map((k) => (<button key={k} onClick={() => setBlendChip(k)} style={chipBtn(blendChip === k)}>{k}</button>))}
          {(['mirror', 'clamp'] as FillChoice[]).map((f) => (
            <button key={f} onClick={() => setBlendTune({ fill: f })} style={chipBtn(blend.fill === f)}>{f}</button>
          ))}
        </>)}
        {tab === 'edit' && (<>
          <button onClick={() => setTool('draw')} style={chipBtn(tool === 'draw')}>🖌 Paint shape</button>
          <button onClick={() => setTool('draw-erase')} style={chipBtn(tool === 'draw-erase')}>🩹 Paint erase</button>
          <button onClick={() => setTool('wand')} style={chipBtn(tool === 'wand')}>🪄 Wand fill</button>
          <button onClick={() => setTool('wand-erase')} style={chipBtn(tool === 'wand-erase')}>🪄 Wand erase</button>
          <button onClick={() => enterEdit('nodes')} disabled={!shapeRef.current} style={chipBtn(tool === 'nodes')}>⬡ Nodes</button>
          <button onClick={() => enterEdit('frame')} disabled={!shapeRef.current} style={chipBtn(tool === 'frame')}>▣ Frame</button>
          {tool === 'frame' && (
            <button onClick={() => setAspectLocked((v) => !v)} style={chipBtn(aspectLocked)}>{aspectLocked ? '🔒 aspect' : '🔓 aspect'}</button>
          )}
        </>)}
      </div>

      {/* the ONE adaptive knob for the active tab */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700, minWidth: 90 }}>{knob.label}</span>
        <input type="number" min={knob.lo} max={knob.hi} value={knob.value}
          onChange={(e) => knob.set(Math.max(knob.lo, Math.min(knob.hi, Math.round(+e.target.value))))}
          style={{ width: 54, padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
        <input type="range" min={knob.lo} max={knob.hi} step={1} value={knob.value}
          onChange={(e) => knob.set(+e.target.value)} style={{ flex: 1, maxWidth: 420 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div>
          {hasImage && <div style={{ ...cap, textAlign: 'center' }}>{preview ? 'Preview — same result, cut out' : 'Live result — dimmed outside the shape'}</div>}
          {!hasImage && (
            // EMPTY STATE: transparent, icon + upload prompt, centered (no canvas until an image exists)
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: 'min(480px, 86vw)', height: 320, border: '1.5px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer', color: '#64748b', background: 'transparent' }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🖼️</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Upload the image</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          )}
          <div style={{ position: 'relative', width: disp.w, height: disp.h, margin: '0 auto', display: hasImage ? 'block' : 'none' }}>
            {/* FIXED viewport (Dan): the box never grows — the content contain-fits, the object reads smaller */}
            <canvas ref={viewRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              onPointerLeave={() => { cursorRef.current = null; onUp() }}
              onWheel={(e) => { setBrushR((b) => Math.max(1, Math.min(120, Math.round(b - e.deltaY * 0.08)))); requestAnimationFrame(render) }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 8, touchAction: 'none', background: 'transparent', cursor: editing ? 'default' : 'crosshair', display: 'block' }} />
            {editing && !preview && shapeRef.current && imgCanvas.current && shapeTick >= 0 && (
              <EditorOverlay shape={shapeRef.current} imgW={imgCanvas.current.width} imgH={imgCanvas.current.height} view={viewBoxRef.current}
                dispW={disp.w} mode={tool as EditMode} aspectLocked={aspectLocked}
                onEdit={onEditLive} onCommit={onEditCommit} />
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
        <Stat label="magic cut" value={ms.cut != null ? `${ms.cut}ms` : '—'} />
        <Stat label="brush stroke" value={ms.stroke != null ? `${ms.stroke}ms` : '—'} />
      </div>
      <p style={{ marginTop: 12, fontSize: 13, color: '#334155', textAlign: 'center' }}><b>Status:</b> {status}</p>
    </div>
  )
}

const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
const cap: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
