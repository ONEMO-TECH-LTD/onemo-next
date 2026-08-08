'use client'

// cutout-lab v2 — the CLEAN SHELL (render + gesture ONLY, Meta F1). Structure:
//   engine (v5.3.1, byte-clean) < tool modules (pool) < bridge flow (useTwoDFirstFlow + useEditor +
//   ./flow-bindings) < THIS page.
// Laws live in the pool (bridge-compose-policy · bridge-paint-flow · bridge-tool-commit ·
// bridge-tool-queue · bridge-control-surface); pixels live in the engine (composeEffectArtwork ·
// prepareAI); orchestration lives in ./flow-bindings; this file renders the v1 bench face and maps
// gestures. Blend-0 = photo clipped by the outline (no compositor call); tool outcomes surface on
// the STATUS LINE (v1 truth) + toast.

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '../effect-creator/v5.3.1/ui/Toast'
import { useTwoDFirstFlow } from '../effect-creator/v5.3.1/flows/twoDFirstFlow'
import { useEditor } from '../effect-creator/v5.3.1/user/editor/useEditor'
import { shapeToSVGPathD, type VShape } from '@/lib/vector-core'
import { viewBoxFor } from '@/lib/bridge-compose-policy'
import { VEC_CHIPS, CHIP_RANGE, type Tab, type Tool, detailKnobToEngine, detailEngineToKnob } from '@/lib/bridge-control-surface'
import { maskOverlay, drawCutout, saveStickerPng } from '@/lib/shell-render'
// NODES/FRAME increment — pool modules: math (tool-node-math), budgeted skeleton + live-drag
// semantics (shell-edit-live over bridge-node-override).
import {
  insertNode, deleteNode, nodeAdjust, measureNode, nodeTapTol,
  hitAnchor, moveAnchor, frameScaleFactors, scaleShape, shapeBounds, frameGrips, hitGrip,
} from '@/lib/tool-node-math'
import { enterEditShape, NODE_MODE_DEFAULT, type NodeMode } from '@/lib/shell-edit-live'
import { usePaintBinding, useComposeBinding, useControlBehaviors, type LabNotify } from './flow-bindings'
import { PAINT_DEFAULTS, type PaintConfig } from '@/lib/tool-paint-math'
import PerfHUD from '../effect-creator/v5.3.1/dev/PerfHUD'

// ── v1 bench styles (presentation only) ──
const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
const cap: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }
const chipBtn = (active: boolean, disabled = false): React.CSSProperties => ({ ...btn, padding: '4px 10px', fontSize: 12, background: active ? '#0f172a' : '#f1f5f9', color: disabled ? '#9ca3af' : active ? '#fff' : '#0f172a', cursor: disabled ? 'not-allowed' : 'pointer' })

function CutoutLabInner() {
  const searchParams = useSearchParams()
  const segPresent = !!searchParams.get('seg')
  const admin = searchParams.get('admin') === '1' // ?admin=1 → paint-shaper calibration panel

  // paint-shaper factors — PAINT_DEFAULTS in prod; admin-tunable so the tool calibrates without a
  // code change (Dan 2026-08-07). Owned as a typed value by tool-paint-math, held here, applied by
  // the paint binding — no logic in the UI.
  const [paintCfg, setPaintCfg] = useState<PaintConfig>(PAINT_DEFAULTS)

  // notify → the v1 STATUS LINE + toast (outcomes are never silent). The message describes the LAST
  // action, so it is cleared the moment a new one starts — a stale warning must never masquerade as
  // the current state.
  const [msg, setMsg] = useState<string | null>(null)
  const notify = useCallback<LabNotify>((kind, message) => { setMsg(message); toast(kind, message) }, [])
  const clearMsg = useCallback(() => setMsg(null), [])

  // ── THE BRIDGE, both layers: the flow (upload/magic/export/reset) + the editor composer (descriptors) ──
  const { state, actions } = useTwoDFirstFlow({ notify, segPresent })
  const { artworkUrl, prepared, hasArtwork, generating } = state

  // useEditor headless — the descriptor brain WITHOUT its old face (zero old-creator components).
  const toolEnabled = useCallback(() => true, [])
  const ed = useEditor({ open: !!prepared, onClose: () => {}, notify, toolEnabled })
  const { tools, display, spec, imgW, imgH } = ed.state
  const { previewTool, commitTool } = ed.actions

  // ── shell-only UI state (v1 clone) ──
  const [tab, setTab] = useState<Tab>('ai')
  const [tool, setTool] = useState<Tool>('draw')
  const [vecChip, setVecChip] = useState<(typeof VEC_CHIPS)[number]>('detail')
  const [brushR, setBrushR] = useState(15)
  const [dragVal, setDragVal] = useState<number | null>(null) // in-flight slider value: preview while dragging, commit on release
  const [overlayOn, setOverlayOn] = useState(false) // 🎭 mask tint (default OFF, v1)
  const [preview, setPreview] = useState(false)     // 👁 sticker preview (checkerboard + clipped photo)

  // ── NODES/FRAME edit state (shell = selection + live shape; math from the pool) ──
  const [editShape, setEditShape] = useState<VShape | null>(null)
  const [nodeMode, setNodeMode] = useState<NodeMode>(NODE_MODE_DEFAULT)
  const [selNode, setSelNode] = useState<{ pi: number; ai: number } | null>(null)
  const [nodeChip, setNodeChip] = useState<'radius' | 'curve'>('radius')
  const [nodeAdj, setNodeAdj] = useState({ radius: 0, curve: 0 })
  const [aspectLocked, setAspectLocked] = useState(true)
  const [nodeBase, setNodeBase] = useState<VShape | null>(null)
  const editDragRef = useRef<
    | { kind: 'node'; pi: number; ai: number; orig: VShape; moved: boolean }
    | { kind: 'frame'; origin: { x: number; y: number }; corner: { x: number; y: number }; orig: VShape; moved: boolean }
    | null
  >(null)

  const toolById = useMemo(() => new Map(tools.map((t) => [t.id, t])), [tools])

  // Meta ruling: the bridge's auto-prepared 'standard' square is STATE, not a cut — the shell draws
  // NO outline unless the generator is a real traced cut. Upload = bare photo; silhouette on Detect.
  const traced = !!spec && spec.generator.adapter !== 'standard'
  const editing = tool === 'nodes' || tool === 'frame'
  // while a node/frame edit is live, the LOCAL edit shape is the drawn truth (shell-edit-live pairing);
  // commits re-enter through the seam and update the bridge display.
  const liveShape = editing && editShape ? editShape : display
  const pathD = useMemo(() => { try { return traced && liveShape ? shapeToSVGPathD(liveShape, 2) : '' } catch { return '' } }, [traced, liveShape])
  const bounds = useMemo(() => (traced ? shapeBounds(liveShape) : null), [traced, liveShape])
  const vb = useMemo(() => viewBoxFor(bounds, imgW, imgH), [bounds, imgW, imgH])

  // fill (tile/clamp): shell-held mirror of the engine's wrapTile — the composer reads wrapTile
  // non-reactively, so the shell mirror drives the recompose; commitTool keeps engine state truthful.
  const blendVal = (toolById.get('blend')?.value as number) ?? 0

  // ── FLOW BINDINGS (the flow layer, ./flow-bindings): paint + engine compose ──
  const paint = usePaintBinding({ artworkUrl, spec, display, traced, imgW, imgH, notify, paintCfg })
  const { baseMask, paintPrepared } = paint.state
  const effectivePrepared = paintPrepared ?? prepared
  const compose = useComposeBinding({ traced, display, prepared: effectivePrepared, blendVal, imgW, imgH, bounds })
  const composed = compose.composed
  // control-surface behaviors: AUTO_KNOBS once per upload's first cut · value-true auto-blend on outgrowth
  useControlBehaviors({
    traced, artworkUrl, bounds, imgW, imgH, blendVal,
    engineDefaultBlend: effectivePrepared?.frontSrc.defaultBlendPercent ?? 0,
    commitTool, notify,
  })

  // the photo as a canvas — input for the AI brush (GrabCut) and the sticker preview
  const [displayCanvas, setDisplayCanvas] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => { // y-down photo canvas for drawCutout, rebuilt per upload
    if (!artworkUrl) { setDisplayCanvas(null); return }
    let dead = false
    const img = new Image(); img.src = artworkUrl
    img.onload = () => { // load-event, not decode() — decode() can hang on large blobs
      if (dead) return
      const c = document.createElement('canvas'); c.width = imgW; c.height = imgH
      c.getContext('2d')!.drawImage(img, 0, 0, imgW, imgH)
      setDisplayCanvas(c)
    }
    return () => { dead = true }
  }, [artworkUrl, imgW, imgH])

  // ── gesture capture (shell duty): svg client point → mask space via the svg's own CTM ──
  const svgRef = useRef<SVGSVGElement>(null)
  const [strokeLive, setStrokeLive] = useState<{ x: number; y: number }[]>([])
  const strokeRef = useRef<{ x: number; y: number }[]>([])
  const paintingRef = useRef(false)
  const toMaskPt = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return null
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }, [])
  const paintTool = tool === 'draw' || tool === 'draw-erase'
  const aiTool = tool === 'add' || tool === 'erase'
  const strokeTool = paintTool || aiTool

  // ── node/frame mode enter/exit (active chip toggles OUT; landing mode = drag — v1 law) ──
  const exitEdit = useCallback(() => { setEditShape(null); setSelNode(null); setTool('draw') }, [])
  const enterEdit = useCallback((m: 'nodes' | 'frame') => {
    if (tool === m) { exitEdit(); return }
    if (!display) return
    setEditShape(enterEditShape(display, null)) // budgeted skeleton (bridge-node-override) — never the raw dense ring
    setNodeMode(NODE_MODE_DEFAULT)
    setSelNode(null)
    setTool(m)
  }, [tool, display, exitEdit])
  const selectNode = useCallback((sel: { pi: number; ai: number } | null, shape: VShape | null) => {
    setSelNode(sel)
    setNodeBase(shape)
    setNodeAdj(sel && shape ? measureNode(shape, sel.pi, sel.ai) : { radius: 0, curve: 0 })
  }, [])

  const onCanvasDown = useCallback((e: React.PointerEvent) => {
    if (!hasArtwork || preview) return
    const p = toMaskPt(e); if (!p) return
    clearMsg() // a new gesture supersedes the previous outcome
    if (strokeTool) {
      paintingRef.current = true; strokeRef.current = [p]; setStrokeLive([p])
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }
    if (tool === 'nodes' && editShape) {
      const tol = nodeTapTol(imgW) * 1.6
      const hit = hitAnchor(editShape, p, tol)
      if (nodeMode === 'delete') {
        if (hit) {
          const next = deleteNode(editShape, hit.pi, hit.ai)
          if (!next) { notify('warn', 'a shape needs at least 3 points'); return }
          setEditShape(next); selectNode(null, null)
          paint.actions.shapeCommit(next, 'point deleted — outline updated')
        }
        return
      }
      if (nodeMode === 'add') {
        if (!hit) {
          const ins = insertNode(editShape, p.x, p.y, tol)
          if (!ins) { notify('warn', 'tap ON the outline to add a point'); return }
          setEditShape(ins.shape); selectNode({ pi: ins.pi, ai: ins.ai }, ins.shape)
          paint.actions.shapeCommit(ins.shape, 'point added — outline updated')
        }
        return
      }
      // move (default): grab a node to drag; empty tap only deselects — never inserts (v1 mobile law)
      if (hit) {
        selectNode(hit, editShape)
        editDragRef.current = { kind: 'node', pi: hit.pi, ai: hit.ai, orig: editShape, moved: false }
      } else selectNode(null, null)
      return
    }
    if (tool === 'frame' && editShape && bounds) {
      // corner grips: grab the nearest bbox corner within a finger radius; opposite corner = origin
      const hit = hitGrip(bounds, p, nodeTapTol(imgW) * 2.2)
      if (hit) editDragRef.current = { kind: 'frame', corner: hit.corner, origin: hit.origin, orig: editShape, moved: false }
    }
  }, [hasArtwork, preview, toMaskPt, paintTool, tool, editShape, nodeMode, imgW, bounds, notify, selectNode, paint.actions])

  const onCanvasMove = useCallback((e: React.PointerEvent) => {
    const p = toMaskPt(e); if (!p) return
    if (paintingRef.current) {
      strokeRef.current.push(p); setStrokeLive([...strokeRef.current])
      return
    }
    const drag = editDragRef.current
    if (!drag) return
    drag.moved = true
    if (drag.kind === 'node') {
      const { pi, ai, orig } = drag
      const a0 = orig.paths[pi].anchors[ai]
      setEditShape(moveAnchor(orig, pi, ai, p.x - a0.p.x, p.y - a0.p.y))
      return
    }
    // frame: scale about the opposite corner — factors + transform are the tool module's
    const { origin, corner, orig } = drag
    const { sx, sy } = frameScaleFactors(origin, corner, p, aspectLocked)
    setEditShape(scaleShape(orig, origin, sx, sy))
  }, [toMaskPt, aspectLocked])

  const onCanvasUp = useCallback(() => {
    if (paintingRef.current) {
      paintingRef.current = false
      const stroke = strokeRef.current; strokeRef.current = []
      setStrokeLive([])
      if (stroke.length > 0) {
        if (aiTool && displayCanvas) paint.actions.grabCutStroke(stroke, tool === 'erase', brushR, displayCanvas)
        else if (paintTool) paint.actions.strokeCommit(stroke, tool === 'draw-erase', brushR)
      }
      return
    }
    const drag = editDragRef.current
    editDragRef.current = null
    if (drag?.moved && editShape) paint.actions.shapeCommit(editShape, drag.kind === 'node' ? 'point moved — outline updated' : 'frame scaled — outline updated')
  }, [paint.actions, tool, brushR, editShape, aiTool, paintTool, displayCanvas])

  // 🎭 mask tint (shell-render.maskOverlay) + 👁 preview (shell-render.drawCutout)
  const overlayUrl = useMemo(() => {
    if (!overlayOn || !baseMask) return null
    const c = document.createElement('canvas'); c.width = baseMask.w; c.height = baseMask.h
    c.getContext('2d')!.putImageData(maskOverlay(baseMask, tool === 'draw-erase' || tool === 'erase' ? 'erase' : 'add'), 0, 0)
    return c.toDataURL()
  }, [overlayOn, baseMask, tool])
  const previewUrl = useMemo(() => {
    if (!preview || !displayCanvas || !pathD) return null
    const c = document.createElement('canvas')
    drawCutout(c, displayCanvas, pathD)
    return c.toDataURL()
  }, [preview, displayCanvas, pathD])

  // ── the ONE adaptive knob (v1 mechanism; values resolved by the bridge's descriptor session) ──
  const knob = (() => {
    const mk = (id: string, label?: string) => {
      const t = toolById.get(id)
      if (!t || t.kind !== 'value' || !t.control) return null
      const c = t.control
      if (c.kind === 'slider') {
        const v = (t.value as number) ?? 0
        if (id === 'detail') { // detail is UI-inverted (0 = full) — the ONE mapping lives in bridge-control-surface
          return { label: 'detail (0 = full)', lo: c.min, hi: c.max, value: detailEngineToKnob(v), available: t.available, preview: (x: number) => previewTool(id, detailKnobToEngine(x)), commit: (x: number) => commitTool(id, detailKnobToEngine(x)) }
        }
        return { label: label ?? id, lo: c.min, hi: c.max, value: v, available: t.available, preview: (x: number) => previewTool(id, x), commit: (x: number) => commitTool(id, x) }
      }
      if (c.kind === 'slider-enum') {
        const val = (t.value as { pct: number; join: string }) ?? { pct: 0, join: 'sharp' }
        return { label: label ?? id, lo: c.min, hi: c.max, value: val.pct, available: t.available, preview: (x: number) => previewTool(id, { ...val, pct: x }), commit: (x: number) => commitTool(id, { ...val, pct: x }) }
      }
      return null
    }
    if (tab === 'vector') { const k = mk(vecChip); if (k) return k }
    if (tab === 'blend') { const k = mk('blend'); if (k) return k }
    // per-node knobs (v1): selected anchor + radius/curve chips — pool math (nodeAdjust/measureNode),
    // committed through the same seam on release.
    if (tool === 'nodes' && nodeMode === 'move' && selNode && nodeBase) {
      const apply = (adj: { radius: number; curve: number }, commit: boolean) => {
        setNodeAdj(adj)
        const next = nodeAdjust(nodeBase, selNode.pi, selNode.ai, nodeChip === 'radius' ? { radius: adj.radius } : { curveKnob: adj.curve })
        setEditShape(next)
        if (commit) paint.actions.shapeCommit(next, `node ${nodeChip} set — outline updated`)
      }
      const [lo, hi] = nodeChip === 'radius' ? CHIP_RANGE.nodeRadius : CHIP_RANGE.nodeCurve
      const value = nodeChip === 'radius' ? nodeAdj.radius : nodeAdj.curve
      return { label: `node ${nodeChip}`, lo, hi, value, available: true, preview: (v: number) => apply(nodeChip === 'radius' ? { ...nodeAdj, radius: v } : { ...nodeAdj, curve: v }, false), commit: (v: number) => apply(nodeChip === 'radius' ? { ...nodeAdj, radius: v } : { ...nodeAdj, curve: v }, true) }
    }
    return { label: 'brush size', lo: 1, hi: 120, value: brushR, available: true, preview: (v: number) => setBrushR(v), commit: (v: number) => setBrushR(v) }
  })()

  // 💾 Save = the STICKER: the photo (+ engine-composed band when blend is engaged) clipped to the
  // outline, transparent outside, as a PNG. The compose frame is already the engine's output; this
  // only rasterizes what the canvas shows. blend-0 = the raw photo clipped, no compositor.
  const download = (blob: Blob, name: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href)
  }
  const onSave = useCallback(async () => {
    if (!displayCanvas || !pathD) return
    setMsg('Saving…')
    const blob = await saveStickerPng(displayCanvas, pathD, imgW, imgH, composed)
    if (!blob) { setMsg('⚠️ could not encode the sticker'); return }
    download(blob, 'onemo-sticker.png')
    setMsg('Saved onemo-sticker.png')
  }, [displayCanvas, pathD, imgW, imgH, composed])
  // ⤓ Cutline = the manufacturing vector (mm-space SVG) — a separate artifact, kept.
  const onExportSvg = useCallback(async () => {
    const svg = await actions.exportSvg()
    if (!svg) return
    download(new Blob([svg], { type: 'image/svg+xml' }), 'onemo-cutline-mm.svg')
  }, [actions])

  // undo/redo: editor-local history first (knob + tool commits land there), then the flow's
  const canUndo = ed.state.canUndo || state.canUndo
  const canRedo = ed.state.canRedo || state.canRedo
  const onUndo = useCallback(() => { if (ed.state.canUndo) ed.actions.undo(); else void actions.undo() }, [ed.state.canUndo, ed.actions, actions])
  const onRedo = useCallback(() => { if (ed.state.canRedo) ed.actions.redo(); else void actions.redo() }, [ed.state.canRedo, ed.actions, actions])

  const hasCut = !!pathD
  const status = msg ?? (generating ? 'Computing…' : prepared ? (hasCut ? 'Ready — outline live' : 'Ready') : 'Upload an image to begin')

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <PerfHUD />
      <h1 style={{ fontSize: 19, fontWeight: 700, textAlign: 'center' }}>Cutout Lab</h1>

      {admin && (
        <div style={{ position: 'fixed', top: 8, left: 8, zIndex: 20, background: '#0f172a', color: '#e2e8f0', padding: 10, borderRadius: 8, fontSize: 11, width: 210 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Paint-shaper config</div>
          {([
            ['swathMult', 'stroke width ×', 0.5, 6, 0.1],
            ['polishDiv', 'smoothing ÷', 1, 12, 0.5],
            ['closeFrac', 'loop-close frac', 0.05, 0.6, 0.01],
          ] as [keyof PaintConfig, string, number, number, number][]).map(([key, label, min, max, step]) => (
            <label key={key} style={{ display: 'block', marginBottom: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span>{paintCfg[key]}</span></span>
              <input type="range" min={min} max={max} step={step} value={paintCfg[key]}
                onChange={(e) => setPaintCfg((c) => ({ ...c, [key]: Number(e.target.value) }))}
                style={{ width: '100%' }} />
            </label>
          ))}
          <button onClick={() => setPaintCfg(PAINT_DEFAULTS)} style={{ ...btn, padding: '3px 8px', fontSize: 11, width: '100%' }}>reset</button>
        </div>
      )}

      {/* v1 button row — bridge verbs + tool toggles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) { setMsg(null); actions.upload(e.target.files[0]) } }} /></label>
        <button onClick={onSave} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={onExportSvg} disabled={!hasCut} style={btn}>⤓ Cutline</button>
        <button onClick={onUndo} disabled={!canUndo} style={btn}>↩ Undo</button>
        <button onClick={onRedo} disabled={!canRedo} style={btn}>↪ Redo</button>
        <button onClick={() => { paint.actions.invalidate(); setMsg(null); void actions.reset() }} disabled={!hasArtwork} style={btn}>🗑 Clear</button>
        <button onClick={() => setPreview((v) => !v)} disabled={!hasCut}
          style={{ ...btn, background: preview ? '#0f172a' : '#f1f5f9', color: preview ? '#fff' : '#0f172a' }}>{preview ? '👁 Editing view' : '👁 Preview'}</button>
        <button onClick={() => setOverlayOn((v) => !v)} disabled={!baseMask}
          style={{ ...btn, background: overlayOn ? '#f1f5f9' : '#0f172a', color: overlayOn ? '#0f172a' : '#fff' }}>{overlayOn ? '🎭 Mask on' : '🎭 Mask off'}</button>
      </div>

      {/* v1 TABS — chips within, ONE adaptive knob below */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'center' }}>
        {(['ai', 'vector', 'blend', 'edit'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setDragVal(null); clearMsg() }} style={{ ...btn, background: tab === t ? '#7c3aed' : '#f1f5f9', color: tab === t ? '#fff' : '#0f172a' }}>
            {t === 'ai' ? '🤖 AI' : t === 'vector' ? '⬡ Vector' : t === 'blend' ? '🎨 Blend' : '✋ Edit'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#475569', minHeight: 34 }}>
        {tab === 'ai' && (<>
          <button onClick={() => { setMsg(null); actions.magic() }} disabled={!hasArtwork || generating} style={{ ...btn, fontSize: 12, background: '#7c3aed', color: '#fff', fontWeight: 700 }}>🤖 Detect</button>
          <span style={{ color: '#94a3b8' }}>· brush:</span>
          <button onClick={() => { exitEdit(); setTool('add'); clearMsg() }} disabled={!hasArtwork} style={chipBtn(tool === 'add', !hasArtwork)}>🟢 Add</button>
          <button onClick={() => { exitEdit(); setTool('erase'); clearMsg() }} disabled={!hasArtwork} style={chipBtn(tool === 'erase', !hasArtwork)}>🔴 Erase</button>
          {hasArtwork && !hasCut && <span style={{ color: '#94a3b8' }}>push Detect, or brush 🟢 Add over the object</span>}
        </>)}
        {tab === 'vector' && VEC_CHIPS.map((k) => {
          const t = toolById.get(k)
          return <button key={k} onClick={() => { setVecChip(k); setDragVal(null); clearMsg() }} disabled={!t} style={chipBtn(vecChip === k, !t)}>{k}</button>
        })}
        {tab === 'blend' && (
          // Clamp is the DEFAULT and the only fill (Dan 2026-08-08: "clamp is default … no mirror").
          // Mirror = tile flipped; neither is wanted — the out-of-frame band always clamp-extends.
          <button style={chipBtn(true)}>blend</button>
        )}
        {tab === 'edit' && (<>
          <button onClick={() => { exitEdit(); setTool('draw'); clearMsg() }} disabled={!hasArtwork} style={chipBtn(tool === 'draw', !hasArtwork)}>🖌 Paint shape</button>
          <button onClick={() => { exitEdit(); setTool('draw-erase'); clearMsg() }} disabled={!hasArtwork} style={chipBtn(tool === 'draw-erase', !hasArtwork)}>🩹 Paint erase</button>
          {tool === 'nodes' && (<>
            <span style={{ color: '#94a3b8' }}>nodes:</span>
            {([['move', '✥ Drag'], ['add', '➕ Add'], ['delete', '➖ Delete']] as [NodeMode, string][]).map(([m, label]) => (
              <button key={m} onClick={() => { setNodeMode(m); if (m !== 'move') selectNode(null, null) }} style={chipBtn(nodeMode === m)}>{label}</button>
            ))}
            {nodeMode === 'move' && selNode && (<>
              <span style={{ color: '#94a3b8' }}>shape:</span>
              {(['radius', 'curve'] as const).map((k) => (
                <button key={k} onClick={() => setNodeChip(k)} style={chipBtn(nodeChip === k)}>{k}</button>
              ))}
              <button onClick={() => selectNode(null, null)} style={chipBtn(false)}>✕</button>
            </>)}
          </>)}
          <button onClick={() => { clearMsg(); enterEdit('nodes') }} disabled={!hasCut} style={chipBtn(tool === 'nodes', !hasCut)}>⬡ Nodes</button>
          <button onClick={() => { clearMsg(); enterEdit('frame') }} disabled={!hasCut} style={chipBtn(tool === 'frame', !hasCut)}>▣ Frame</button>
          {tool === 'frame' && (
            <button onClick={() => setAspectLocked((v) => !v)} style={chipBtn(aspectLocked)}>{aspectLocked ? '🔒 aspect' : '🔓 aspect'}</button>
          )}
        </>)}
      </div>

      {/* the ONE adaptive knob — previews while dragging (dragVal), commits on release */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700, minWidth: 90 }}>{knob.label}</span>
        <input type="number" min={knob.lo} max={knob.hi} value={Math.round(dragVal ?? knob.value)} disabled={!knob.available}
          onChange={(e) => { setDragVal(null); knob.commit(Math.max(knob.lo, Math.min(knob.hi, Math.round(+e.target.value)))) }}
          style={{ width: 54, padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
        <input type="range" min={knob.lo} max={knob.hi} step={1} value={Math.round(dragVal ?? knob.value)} disabled={!knob.available}
          onPointerDown={() => compose.setDragging(true)}
          onChange={(e) => { const v = +e.target.value; setDragVal(v); knob.preview(v) }}
          onPointerUp={() => { if (dragVal != null) { knob.commit(dragVal); setDragVal(null) } compose.setDragging(false) }}
          onPointerCancel={() => { setDragVal(null); compose.setDragging(false) }}
          style={{ flex: 1, maxWidth: 420 }} />
        {!knob.available && <span style={{ color: '#94a3b8' }}>n/a for this shape</span>}
      </div>

      {/* canvas — v1 look: photo base, ENGINE-composed frame inside the outline when engaged,
          dim-outside scrim, mask tint on top, sticker preview, live paint ink. */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div>
          {hasArtwork && <div style={{ ...cap, textAlign: 'center' }}>{preview ? 'Preview — same result, cut out' : hasCut ? 'Live result — dimmed outside the shape' : 'Loaded — push 🤖 Detect to cut, or paint a shape'}</div>}
          {!hasArtwork && (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: 'min(480px, 86vw)', height: 320, border: '1.5px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer', color: '#64748b', background: 'transparent' }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🖼️</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Upload the image</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && actions.upload(e.target.files[0])} />
            </label>
          )}
          {hasArtwork && (
            <div style={{ position: 'relative', width: 'min(480px, 86vw)', margin: '0 auto' }}>
              {generating && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.55)', backdropFilter: 'blur(2px)', borderRadius: 8, pointerEvents: 'none', fontSize: 13, fontWeight: 600, color: '#475569' }}>Computing…</div>
              )}
              {/* FIXED viewport (v1 law): the BOX never grows or reflows — it locks to the image aspect;
                  a growing view-box contain-fits inside it. */}
              <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
                onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp} onPointerLeave={onCanvasUp}
                style={{ width: '100%', aspectRatio: `${imgW} / ${imgH}`, display: 'block', border: '1px solid #e2e8f0', borderRadius: 8, touchAction: strokeTool || editing ? 'none' : 'auto', cursor: strokeTool && hasArtwork ? 'crosshair' : 'default' }}>
                <defs>
                  {pathD && <clipPath id="labClip"><path d={pathD} /></clipPath>}
                </defs>
                {artworkUrl && !preview && <image href={artworkUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />}
                {composed && pathD && !preview && (
                  <g clipPath="url(#labClip)">
                    <image href={composed.url} x={composed.x} y={composed.y} width={composed.w} height={composed.h} preserveAspectRatio="none"
                      transform={`translate(0 ${composed.y * 2 + composed.h}) scale(1 -1)`} />
                  </g>
                )}
                {pathD && !preview && (<>
                  <path d={`M${vb.x} ${vb.y}H${vb.x + vb.w}V${vb.y + vb.h}H${vb.x}Z ${pathD}`} fill="rgba(6,8,14,0.55)" fillRule="evenodd" />
                  <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={Math.max(2, imgW / 400)} />
                </>)}
                {/* 🎭 mask tint — on top, always the CURRENT selection (v1 r7 law) */}
                {overlayUrl && !preview && <image href={overlayUrl} x={0} y={0} width={imgW} height={imgH} opacity={0.9} />}
                {/* 👁 preview — shell-render.drawCutout truth (checkerboard + clipped photo) */}
                {previewUrl && <image href={previewUrl} x={0} y={0} width={imgW} height={imgH} />}
                {/* live paint ink (WYSIWYG): violet = add, red = erase, at the actual swath width */}
                {strokeLive.length > 1 && (
                  <polyline points={strokeLive.map((p) => `${p.x},${p.y}`).join(' ')} fill="none"
                    stroke={tool === 'draw-erase' || tool === 'erase' ? 'rgba(239,68,68,0.45)' : tool === 'add' ? 'rgba(34,197,94,0.45)' : 'rgba(124,58,237,0.45)'}
                    strokeWidth={Math.max(2, brushR * paintCfg.swathMult)} strokeLinecap="round" strokeLinejoin="round" />
                )}
                {/* node anchors (⬡ Nodes) — finger-sized dots; selected = filled */}
                {tool === 'nodes' && editShape && !preview && editShape.paths.map((path, pi) => path.anchors.map((a, ai) => (
                  <circle key={`${pi}-${ai}`} cx={a.p.x} cy={a.p.y} r={nodeTapTol(imgW) * 0.8}
                    fill={selNode?.pi === pi && selNode?.ai === ai ? '#2563eb' : 'rgba(255,255,255,0.9)'}
                    stroke="#2563eb" strokeWidth={Math.max(1.5, imgW / 600)} />
                )))}
                {/* frame grips (▣ Frame) — bbox corner handles */}
                {tool === 'frame' && bounds && !preview && frameGrips(bounds).map(({ corner }, i) => (
                  <rect key={i} x={corner.x - nodeTapTol(imgW)} y={corner.y - nodeTapTol(imgW)} width={nodeTapTol(imgW) * 2} height={nodeTapTol(imgW) * 2}
                    fill="rgba(255,255,255,0.9)" stroke="#2563eb" strokeWidth={Math.max(1.5, imgW / 600)} />
                ))}
              </svg>
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 13, color: '#334155', textAlign: 'center' }}><b>Status:</b> {status}</p>
      <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>AI brush = GrabCut (slim provider, loads on first press) · paint · nodes · frame</p>
    </div>
  )
}

export default function CutoutLabV2Page() {
  return (
    <Suspense fallback={null}>
      <CutoutLabInner />
    </Suspense>
  )
}
