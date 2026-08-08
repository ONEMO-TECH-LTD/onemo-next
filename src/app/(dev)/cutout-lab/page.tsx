'use client'

// cutout-lab — the NEUTRAL SHELL (Layer-3, I1 contract: ARCHITECTURE.md). Binds ONLY to
// cutoutLabFlow's { state, actions } — render, gesture capture, coordinate mapping, ink/comet
// drawing, URL adapter duties (?seg read/write). ZERO policy: no compose calls, no cadence,
// no runtime engine imports. The Figma shell (I5) must mount on the same flow unchanged.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point } from '@/lib/mask-tools/types'
import type { VShape } from '@/lib/vector-core'
import { EditorOverlay, type EditMode, type NodeMode } from './EditorOverlay'
import { drawCutout, maskOverlay, type FillChoice } from './finish'
import { useCutoutLabFlow } from './flow'
import { ThinkingOrb } from 'thinking-orbs'
import { BLEND_CHIPS, CHIP_RANGE, VEC_CHIPS, type Tab, type Tool } from './ui-config'

export default function CutoutLab() {
  useEffect(() => {
    const u = new URL(location.href)
    // STRIP STALE ?seg BEFORE warmup (Dan device 2026-08-07): the lab RETIRED the ?seg model
    // selector, but the engine's segParam() still reads it at call time — a pre-pivot tab
    // auto-stamped with ?seg=edgesam reroutes Detect + preloadBen into the deleted 37MB EdgeSAM →
    // iOS OOM → 'no backend'. Clean the param from stale tabs so u2net (default) always runs.
    if (u.searchParams.has('seg')) { u.searchParams.delete('seg'); history.replaceState(null, '', u) }
    // ON-DEVICE CONSOLE (?debug=1): eruda surfaces real device errors (OOM, worker deaths) on the phone.
    if (u.searchParams.get('debug') === '1') void import('eruda').then((e) => e.default.init())
    if (u.searchParams.get('admin') === '1') setAdmin(true)
    flow.actions.warmup() // prefetch u2net weights at page open — the Detect push stays fast
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const renderRef = useRef<() => void>(() => {})
  const requestRender = useCallback(() => renderRef.current(), [])

  // ── THE FLOW (Layer-2) — the shell binds only to this surface ──
  const flow = useCutoutLabFlow({ requestRender })
  const { status, busy, hasCut, hasImage, ms, settings, blend, shapeTick, histTick, disp, canUndo, canRedo, paintCfg } = flow.state
  const { imgCanvas, mask: maskRef, d: dRef, bounds: boundsRef, shape: shapeRef, liveBake: liveBakeRef } = flow.view

  // ── shell-only UI state (presentation + gesture) ──
  const [tool, setTool] = useState<Tool>('add')
  const [tab, setTab] = useState<Tab>('ai')
  const [admin, setAdmin] = useState(false) // ?admin=1 → paint-shaper config panel; set post-mount (no hydration mismatch)
  const [vecChip, setVecChip] = useState<(typeof VEC_CHIPS)[number]>('detail')
  const [blendChip, setBlendChip] = useState<(typeof BLEND_CHIPS)[number]>('blend')
  const [aspectLocked, setAspectLocked] = useState(true)
  // single-node vector editing (Dan 17:57): select an anchor → its radius/curve knobs
  const [selNode, setSelNode] = useState<{ pi: number; ai: number } | null>(null)
  const [nodeChip, setNodeChip] = useState<'radius' | 'curve'>('radius')
  const [nodeMode, setNodeMode] = useState<NodeMode>('move') // Dan: add/delete are selected modes; default = drag
  const [nodeAdj, setNodeAdj] = useState({ radius: 0, curve: 0 })
  const nodeBaseRef = useRef<VShape | null>(null)
  const [brushR, setBrushR] = useState(15) // Dan 2026-08-07
  const [preview, setPreview] = useState(false)
  const previewRef = useRef(false); previewRef.current = preview
  const [overlayOn, setOverlayOn] = useState(false) // default OFF — the tint paints a frame-shaped edge over the live result (Dan 14:29)
  const COMET_LIFE_MS = 700 // ms a comet-trail point stays visible
  const overlayRef = useRef(false); overlayRef.current = overlayOn

  const viewRef = useRef<HTMLCanvasElement>(null)
  const strokeRef = useRef<(Point & { t: number })[]>([])
  const trailRef = useRef<(Point & { t: number })[]>([]) // comet PRESENTATION trail — outlives the stroke (§I2b law 1)
  const paintingRef = useRef(false)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const viewBoxRef = useRef({ x: 0, y: 0, w: 1, h: 1 }) // working-view extent (image ∪ outline)
  const toolRef = useRef(tool); toolRef.current = tool
  const brushRef = useRef(brushR); brushRef.current = brushR


  // ── render (draw only) ── ONE canvas: working view, or the baked sticker when Preview is on
  const render = useCallback(() => {
    const view = viewRef.current, img = imgCanvas.current
    if (!view || !img) return
    const ctx0 = view.getContext('2d')!
    if (previewRef.current && dRef.current) {
      // PREVIEW = the SAME bake the editor shows, only cut out — PURE cutout on transparency, no
      // background (Dan 2026-08-06). One compositor, one cache — divergence impossible by construction.
      const live = liveBakeRef.current
      if (live) {
        const w = live.canvas.width, h = live.canvas.height
        view.width = w; view.height = h
        ctx0.clearRect(0, 0, w, h)
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
    // MASK VIEW ON TOP (Dan device r7: the old under-layer draw left stale green scraps peeking
    // out from beneath the bake — never the current selection). One color by tool mode: green =
    // the selection in add modes, red = the selection in erase modes.
    const mask = maskRef.current
    if (mask && overlayRef.current) {
      const t0 = toolRef.current
      const mode = t0 === 'erase' || t0 === 'draw-erase' ? 'erase' as const : 'add' as const
      const tmp = document.createElement('canvas'); tmp.width = mask.w; tmp.height = mask.h
      tmp.getContext('2d')!.putImageData(maskOverlay(mask, mode), 0, 0)
      ctx.drawImage(tmp, 0, 0, img.width, img.height)
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
      }
    }
    const trail = trailRef.current
    if (trail.length > 1) {
      const t = toolRef.current
      if (t === 'add' || t === 'erase') {
        // AI pointer: COMET TAIL — bright head, tail dissolves in TIME like a keyboard swipe
        // (item 9); §I2b law 1: drawn from the persistent trail so it keeps dissolving through
        // the recognition wait, not frozen by pointer-up.
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        const col = t === 'add' ? '34,197,94' : '239,68,68'
        const now = performance.now()
        for (let i = 1; i < trail.length; i++) {
          const a = Math.max(0, 1 - (now - trail[i].t) / COMET_LIFE_MS)
          if (a <= 0) continue
          ctx.strokeStyle = `rgba(${col},${(a * 0.9).toFixed(2)})`
          ctx.lineWidth = Math.max(2, brushRef.current * (viewBoxRef.current.w / disp.w) * (0.3 + 0.7 * a))
          ctx.beginPath()
          ctx.moveTo(trail[i - 1].x * img.width, trail[i - 1].y * img.height)
          ctx.lineTo(trail[i].x * img.width, trail[i].y * img.height)
          ctx.stroke()
        }
      }
    }
    const cur = cursorRef.current
    if (cur && imgCanvas.current) { // ring for EVERY brush tool once an image exists (post-Clear too)
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
  }, [disp.w, boundsRef, dRef, imgCanvas, liveBakeRef, maskRef]) // refs are stable — listed for lint truth
  useEffect(() => { renderRef.current = render }, [render])
  useEffect(() => { requestAnimationFrame(() => renderRef.current()) }, [tool]) // mask tint follows the tool mode instantly

  // ── gesture capture (shell duty): pointer → normalized stroke → FLOW actions ──
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
      t: performance.now(),
    }
  }
  // comet animation: while painting an AI stroke, keep repainting so the tail dissolves in TIME
  const cometRaf = useRef(0)
  const cometLoop = useCallback(function loop() {
    // §I2b law 1: the fade loop runs until the TRAIL is empty — independent of the stroke ending
    // or a recognition being in flight. Presentation frames never stop for tool work.
    const now = performance.now()
    trailRef.current = trailRef.current.filter((q) => now - q.t < COMET_LIFE_MS)
    if (!paintingRef.current && trailRef.current.length === 0) { cometRaf.current = 0; return }
    render()
    cometRaf.current = requestAnimationFrame(loop)
  }, [render])
  const brushable = () => !previewRef.current && flow.actions.canBrush(toolRef.current)
  const onDown = (e: React.PointerEvent) => {
    // NO tool is gated on busy (Dan device r5: gating silently swallowed taps — 'wand broken,
    // paint not painting'). Every tool captures always; the FLOW's queue serializes execution.
    if (!brushable()) return
    paintingRef.current = true; cursorRef.current = nrm(e); strokeRef.current = [nrm(e)]
    const t = toolRef.current
    if (t === 'add' || t === 'erase') { trailRef.current.push(...strokeRef.current); if (!cometRaf.current) cometRaf.current = requestAnimationFrame(cometLoop) }
    render()
  }
  const onMove = (e: React.PointerEvent) => {
    cursorRef.current = nrm(e)
    if (paintingRef.current) {
      const q = nrm(e)
      strokeRef.current.push(q)
      const t = toolRef.current
      if (t === 'add' || t === 'erase') trailRef.current.push(q)
    }
    render()
  }
  const onUp = async () => {
    if (!paintingRef.current) return
    paintingRef.current = false
    const stroke = strokeRef.current; strokeRef.current = []
    if (stroke.length < 1) { render(); return } // a TAP (single point) is a valid smart-fill prompt (Dan)
    const t = toolRef.current
    if (t === 'draw' || t === 'draw-erase') { await flow.actions.paintStroke(stroke, t === 'draw-erase', brushRef.current); return }
    // THE brush — GrabCut refinement (paint roughly → edge-snapped add/erase on the u2net cut)
    await flow.actions.grabCutStroke(stroke, t === 'erase', brushRef.current)
  }

  // ── vector edit (shell = selection/tool state; orchestration = flow) ──
  const exitEdit = () => { setSelNode(null); setTool('draw') }
  const enterEdit = (m: EditMode) => {
    if (tool === m) { exitEdit(); return } // active chip toggles OUT of edit mode
    if (!flow.actions.enterEdit()) return
    setSelNode(null)
    setNodeMode('move') // always land in drag mode (Dan: the simplest node view is dragging)
    setTool(m)
  }
  const onEditLive = (next: VShape) => flow.actions.editLive(next)
  const onEditCommit = (next: VShape) => flow.actions.editCommit(next)
  const selectNode = (sel: { pi: number; ai: number } | null) => {
    setSelNode(sel)
    nodeBaseRef.current = shapeRef.current
    setNodeAdj(sel && shapeRef.current ? flow.measureNode(shapeRef.current, sel.pi, sel.ai) : { radius: 0, curve: 0 })
  }
  const onNodesTap = (pt: { x: number; y: number }) => {
    const ins = flow.actions.nodeInsert(pt)
    if (ins) selectNode(ins); else selectNode(null)
  }
  const onDeleteNodeAt = (pi: number, ai: number) => {
    if (flow.actions.nodeDelete(pi, ai) && selNode?.pi === pi && selNode?.ai === ai) setSelNode(null)
  }

  const { setTune, setBlendTune } = flow.actions

  // adaptive knob wiring (item 10): one knob, bound to the active tab's chip
  const knob = (() => {
    if (tab === 'vector') {
      const k = vecChip
      const [lo, hi] = CHIP_RANGE[k]
      const value = k === 'detail' ? hi - settings.detail : settings[k] // 'detail' knob is UI-inverted (0 = full)
      return { label: k === 'detail' ? 'detail (0 = full)' : k, lo, hi, value, set: (v: number) => setTune(k === 'detail' ? { detail: hi - v } : { [k]: v }) }
    }
    if (tab === 'blend') {
      const k = blendChip
      const [lo, hi] = CHIP_RANGE[k]
      return { label: k, lo, hi, value: blend[k], set: (v: number) => setBlendTune({ [k]: v }) }
    }
    if (tool === 'nodes' && nodeMode === 'move' && selNode && nodeBaseRef.current) {
      const apply = (adj: { radius: number; curve: number }) => {
        setNodeAdj(adj)
        // pass the selected chip + its value; the flow constructs the engine delta (it owns the
        // radius-vs-curve one-field rule — the shell must not know engine behavior).
        flow.actions.nodeApply(nodeBaseRef.current!, selNode.pi, selNode.ai, nodeChip, nodeChip === 'radius' ? adj.radius : adj.curve)
      }
      const [rLo, rHi] = CHIP_RANGE.nodeRadius, [cLo, cHi] = CHIP_RANGE.nodeCurve
      if (nodeChip === 'radius') return { label: 'node radius', lo: rLo, hi: rHi, value: nodeAdj.radius, set: (v: number) => apply({ ...nodeAdj, radius: v }) }
      return { label: 'node curve', lo: cLo, hi: cHi, value: nodeAdj.curve, set: (v: number) => apply({ ...nodeAdj, curve: v }) }
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
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && flow.actions.upload(e.target.files[0])} /></label>
        <button onClick={flow.actions.save} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={flow.actions.undo} disabled={busy || !canUndo} style={btn}>↩ Undo</button>
        <button onClick={flow.actions.redo} disabled={busy || !canRedo} style={btn}>↪ Redo</button>
        <button onClick={flow.actions.clearAll} disabled={busy || !hasCut} style={btn}>🗑 Clear</button>
        <button onClick={() => { const v = !previewRef.current; previewRef.current = v; setPreview(v); flow.actions.setPreview(v); requestAnimationFrame(render) }} disabled={!hasCut}
          style={{ ...btn, background: preview ? '#0f172a' : '#f1f5f9', color: preview ? '#fff' : '#0f172a' }}>{preview ? '👁 Editing view' : '👁 Preview'}</button>
        <button onClick={() => { const v = !overlayRef.current; overlayRef.current = v; setOverlayOn(v); requestAnimationFrame(render) }} disabled={!hasCut}
          style={{ ...btn, background: overlayOn ? '#f1f5f9' : '#0f172a', color: overlayOn ? '#0f172a' : '#fff' }}>{overlayOn ? '🎭 Mask on' : '🎭 Mask off'}</button>
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
          <button onClick={() => flow.actions.detect()} disabled={!hasImage || busy} style={{ ...btn, fontSize: 12, background: '#7c3aed', color: '#fff', fontWeight: 700 }}>🤖 Detect</button>
          <span style={{ color: '#94a3b8' }}>· brush:</span>
          {(['add', 'erase'] as Tool[]).map((t) => (
            <button key={t} onClick={() => setTool(t)} disabled={!hasImage} style={chipBtn(tool === t)}>{t === 'add' ? '🟢 Add' : '🔴 Erase'}</button>
          ))}
          {hasImage && !hasCut && <span style={{ color: '#94a3b8' }}>push Detect, or brush Add over the object</span>}
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
          {tool === 'nodes' && (<>
            <span style={{ color: '#94a3b8' }}>nodes:</span>
            {([['move', '✥ Drag'], ['add', '➕ Add'], ['delete', '➖ Delete']] as [NodeMode, string][]).map(([m, label]) => (
              <button key={m} onClick={() => { setNodeMode(m); if (m !== 'move') setSelNode(null) }} style={chipBtn(nodeMode === m)}>{label}</button>
            ))}
            {nodeMode === 'move' && selNode && (<>
              <span style={{ color: '#94a3b8' }}>shape:</span>
              {(['radius', 'curve'] as const).map((k) => (
                <button key={k} onClick={() => setNodeChip(k)} style={chipBtn(nodeChip === k)}>{k}</button>
              ))}
              <button onClick={() => setSelNode(null)} style={chipBtn(false)}>✕</button>
            </>)}
          </>)}
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
          onChange={(e) => knob.set(+e.target.value)} style={{ flex: 1, maxWidth: 420 }}
          onPointerDown={() => flow.actions.setDragging(true)} onPointerUp={() => flow.actions.setDragging(false)}
          onPointerCancel={() => flow.actions.setDragging(false)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div>
          {hasImage && <div style={{ ...cap, textAlign: 'center' }}>{preview ? 'Preview — same result, cut out' : 'Live result — dimmed outside the shape'}</div>}
          {!hasImage && (
            // EMPTY STATE: transparent, icon + upload prompt, centered (no canvas until an image exists)
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: 'min(480px, 86vw)', height: 320, border: '1.5px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer', color: '#64748b', background: 'transparent' }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🖼️</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Upload the image</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && flow.actions.upload(e.target.files[0])} />
            </label>
          )}
          <div style={{ position: 'relative', width: disp.w, height: disp.h, margin: '0 auto', display: hasImage ? 'block' : 'none' }}>
            {/* FIRST-CUT LOADER (Dan device r4): the ~2s auto-detection must READ as part of image
                loading — a visible overlay, not a dead pause. Pure presentation. */}
            {busy && !hasCut && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(248,250,252,0.55)', backdropFilter: 'blur(2px)', borderRadius: 8, pointerEvents: 'none' }}>
                <ThinkingOrb state="shaping" size={64} theme="light" aria-label="Computing the cutout" />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Computing…</div>
              </div>
            )}
            {/* FIXED viewport (Dan): the box never grows — the content contain-fits, the object reads smaller */}
            <canvas ref={viewRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              onPointerLeave={() => { cursorRef.current = null; onUp() }}
              onWheel={(e) => { setBrushR((b) => Math.max(1, Math.min(120, Math.round(b - e.deltaY * 0.08)))); requestAnimationFrame(render) }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 8, touchAction: 'none', background: 'transparent', cursor: editing ? 'default' : 'crosshair', display: 'block' }} />
            {editing && !preview && shapeRef.current && imgCanvas.current && shapeTick >= 0 && (
              <EditorOverlay shape={shapeRef.current} imgW={imgCanvas.current.width} imgH={imgCanvas.current.height} view={viewBoxRef.current}
                selected={selNode} showHandles={nodeMode === 'move' && nodeChip === 'curve'} onSelect={selectNode} onTap={onNodesTap}
                nodeMode={nodeMode} onDeleteNode={onDeleteNodeAt}
                mode={tool as EditMode} aspectLocked={aspectLocked}
                onEdit={onEditLive} onCommit={onEditCommit} />
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
        <Stat label="magic cut" value={ms.cut != null ? `${ms.cut}ms` : '—'} />
      </div>
      {admin && (
        <div style={{ marginTop: 16, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b', marginBottom: 8 }}>⚙️ Paint-shaper config (admin)</div>
          {([
            ['swath width', 'swathMult', 0.5, 6, 0.1],
            ['smoothing', 'polishDiv', 1, 12, 0.5],
            ['loop-close', 'closeFrac', 0.05, 0.6, 0.01],
          ] as [string, keyof typeof paintCfg, number, number, number][]).map(([lbl, key, lo, hi, step]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#475569', width: 92 }}>{lbl}</span>
              <input type="range" min={lo} max={hi} step={step} value={paintCfg[key]} onChange={(e) => flow.actions.setPaintCfg({ [key]: Number(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 700, width: 40, textAlign: 'right' }}>{paintCfg[key]}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>affects the 🖌 Paint shape / erase tools live</div>
        </div>
      )}
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
