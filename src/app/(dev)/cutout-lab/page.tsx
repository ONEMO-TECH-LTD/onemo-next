'use client'

// cutout-lab v2 — the FULL v1 BENCH SHELL wired to the clean v5.3.1 bridge (Dan 2026-08-07 rework).
//
// GROUND RULES (Dan + Meta, closed):
//  • ZERO old-creator components render — no OutlineEditor, no Toolbar, no EmptyState, no EditOverlay.
//    The flow's auto-begun editor session is simply never given a surface; upload lands on THIS bench.
//  • The FACE is the v1 page clone: tabs ai/vector/blend/edit · chips · the ONE adaptive knob · canvas ·
//    Upload/Detect/Save/Undo/Redo/Clear/Preview/Mask rows · status line.
//  • Every control drives the BRIDGE: flow verbs (upload/magic/exportSvg/reset) + useEditor's descriptor
//    mechanism (previewTool/commitTool by id) — the brain without its old face. No lab flow, no finish.ts,
//    no tool modules, no parallel logic files.
//  • A control with NO bridge backend yet (AI/paint brushes, mask overlay, preview, nodes/frame) renders
//    PRESENT but disabled in its v1 look — visible truth, not absence.
//  • The canvas is v1-style PRESENTATION: image + engine outline + dim-outside scrim from the composer's
//    display shape. Blend-0 inside the frame = NO compositor call (photo clipped by the outline IS the
//    result — Dan's law). Blend>0 or an outgrown offset = the ENGINE's own 2D compose op
//    (composeEffectArtwork, s59: clamp/tile fill + magic blend) produces the frame; the shell only draws
//    it. Mirror (v1's mosaic glue) stays dead. No bake wrapper, no pad/crop plumbing.

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '../effect-creator/v5.3.1/ui/Toast'
import { useTwoDFirstFlow } from '../effect-creator/v5.3.1/flows/twoDFirstFlow'
import { useEditor } from '../effect-creator/v5.3.1/user/editor/useEditor'
import { shapeToSVGPathD, type VShape } from '@/lib/vector-core'
// the POOL's policy module (session62-task/v1-addon-modules): Dan's laws as tested code — the shell
// BINDS these decisions, it never re-derives them (Meta directive 2026-08-07).
import { BLEND_POLICY_DEFAULTS, neutralNoComposite, outgrown, viewBoxFor, ComposeScheduler, type Bounds } from '@/lib/bridge-compose-policy'
import PerfHUD from '../effect-creator/v5.3.1/dev/PerfHUD'

/** outline extent from the display shape's anchors (+handles) — shell data extraction for the policies. */
function boundsFor(display: VShape | null): Bounds | null {
  if (!display) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of display.paths) for (const a of p.anchors) for (const pt of [a.p, a.hIn, a.hOut]) {
    if (!pt) continue
    if (pt.x < minX) minX = pt.x; if (pt.y < minY) minY = pt.y
    if (pt.x > maxX) maxX = pt.x; if (pt.y > maxY) maxY = pt.y
  }
  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

// ── v1 bench styles (copied verbatim from the v1 shell — presentation only) ──
const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }
const cap: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }
const chipBtn = (active: boolean, disabled = false): React.CSSProperties => ({ ...btn, padding: '4px 10px', fontSize: 12, background: active ? '#0f172a' : '#f1f5f9', color: disabled ? '#9ca3af' : active ? '#fff' : '#0f172a', cursor: disabled ? 'not-allowed' : 'pointer' })

type Tab = 'ai' | 'vector' | 'blend' | 'edit'
const VEC_CHIPS = ['detail', 'offset', 'simplify', 'smooth', 'radius'] as const // v1 vector surface

function CutoutLabInner() {
  const searchParams = useSearchParams()
  const segPresent = !!searchParams.get('seg')

  const notify = useCallback((kind: 'warn' | 'error' | 'info', message: string) => { toast(kind, message) }, [])

  // ── THE BRIDGE, both layers: the flow (upload/magic/export/reset) + the editor composer (descriptors) ──
  const { state, actions } = useTwoDFirstFlow({ notify, segPresent })
  const { artworkUrl, prepared, hasArtwork, generating } = state

  // useEditor headless — the descriptor brain WITHOUT its old face. Open while an image is prepared; the
  // open-seed effect seeds the source from the flow-written spec. onClose never fires (no Done button here).
  const toolEnabled = useCallback(() => true, [])
  const ed = useEditor({ open: !!prepared, onClose: () => {}, notify, toolEnabled })
  const { tools, display, spec, imgW, imgH } = ed.state
  const { previewTool, commitTool } = ed.actions

  // ── shell-only UI state (v1 clone) ──
  const [tab, setTab] = useState<Tab>('ai')
  const [vecChip, setVecChip] = useState<(typeof VEC_CHIPS)[number]>('detail')
  const [brushR, setBrushR] = useState(15)
  const [dragVal, setDragVal] = useState<number | null>(null) // in-flight slider value: preview while dragging, commit on release

  const toolById = useMemo(() => new Map(tools.map((t) => [t.id, t])), [tools])

  // ── the ONE adaptive knob (v1 mechanism, bridge-driven values) ──
  const knob = (() => {
    const mk = (id: string, label?: string) => {
      const t = toolById.get(id)
      if (!t || t.kind !== 'value' || !t.control) return null
      const c = t.control
      if (c.kind === 'slider') {
        const v = (t.value as number) ?? 0
        if (id === 'detail') { // v1 presentation: detail knob is UI-inverted (0 = full)
          return { label: 'detail (0 = full)', lo: c.min, hi: c.max, value: c.max - v, available: t.available, preview: (x: number) => previewTool(id, c.max - x), commit: (x: number) => commitTool(id, c.max - x) }
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
    return { label: 'brush size', lo: 1, hi: 120, value: brushR, available: true, preview: (v: number) => setBrushR(v), commit: (v: number) => setBrushR(v) }
  })()

  // ── canvas presentation (v1 look): image + engine outline + dim-outside scrim — NO bake ──
  // Meta ruling 2026-08-07: the bridge auto-prepares a 'standard' square at upload — that is STATE, not a
  // cut. The shell draws NO outline unless the generator is a real traced cut: upload = bare photo (v1),
  // the silhouette appears only on Detect.
  const traced = !!spec && spec.generator.adapter !== 'standard'
  const pathD = useMemo(() => { try { return traced && display ? shapeToSVGPathD(display, 2) : '' } catch { return '' } }, [traced, display])

  // v1 VIEWPORT LAW — bound from the pool's policy (viewBoxFor): the view covers the outline's full
  // extent; an offset past the frame zooms the view out; viewport CSS width stays fixed.
  const bounds = useMemo(() => (traced ? boundsFor(display) : null), [traced, display])
  const vb = useMemo(() => viewBoxFor(bounds, imgW, imgH), [bounds, imgW, imgH])
  // fill (tile/clamp): shell-held mirror of the engine's wrapTile — the composer reads wrapTile
  // non-reactively (getState in read()), so a commit alone would not re-render/recompose. The chip
  // writes BOTH: local state (drives the recompose + chip highlight) and the engine state (commitTool,
  // so undo/sessions/3D stay truthful).
  const [fillTile, setFillTile] = useState(false)
  const setFill = useCallback((v: boolean) => { setFillTile(v); commitTool('fill', v) }, [commitTool])
  const blendVal = (toolById.get('blend')?.value as number) ?? 0

  // ── ENGINE COMPOSE bound through the POOL's policies (bridge-compose-policy): blend-0 law +
  // outgrowth law decide WHETHER; ComposeScheduler decides WHEN (never mid-drag, single-flight,
  // latest-wins); the ENGINE's own composeEffectArtwork produces the pixels; the shell only draws.
  // Matteless fallback cuts force blend 0 (v1's no-matte guard) but keep the band fill. ──
  const [composed, setComposed] = useState<{ url: string; x: number; y: number; w: number; h: number } | null>(null)
  const composeInputs = useRef({ traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds })
  composeInputs.current = { traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds }
  const schedRef = useRef<ComposeScheduler | null>(null)
  if (!schedRef.current) {
    schedRef.current = new ComposeScheduler(async (cancelled) => {
      const { traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds } = composeInputs.current
      if (!traced || !display || !prepared || !bounds) { setComposed(null); return }
      const matteless = prepared.spec.generator.adapter === 'alpha' || prepared.spec.generator.adapter === 'bg-flood'
      const blend = matteless ? 0 : blendVal
      // the pool's laws: blend-0 = no compositor UNLESS the outline outgrew the frame
      if (neutralNoComposite({ ...BLEND_POLICY_DEFAULTS, blend }) && !outgrown(bounds, imgW, imgH)) { setComposed(null); return }
      const { origCanvas, subjCanvas } = prepared.frontSrc
      const k = origCanvas.width / imgW
      const texH = origCanvas.height
      // outline bounds mapped to the engine's y-up tex space
      const bUp = { minX: bounds.minX * k, minY: texH - bounds.maxY * k, maxX: bounds.maxX * k, maxY: texH - bounds.minY * k }
      const { composeEffectArtwork } = await import('@/lib/effect/composite')
      if (cancelled()) return
      const { canvas, frame } = await composeEffectArtwork({
        originalCanvas: origCanvas,
        subjectCanvas: subjCanvas,
        outputBoundsPx: bUp,
        blendPercent: blend,
        fillMode: fillTile ? 'tile' : 'clamp',
      })
      if (cancelled()) return
      setComposed({
        url: canvas.toDataURL(),
        x: frame.originX / k,
        y: (texH - (frame.originY + frame.height)) / k, // y-up frame → y-down mask space
        w: frame.width / k,
        h: frame.height / k,
      })
    })
  }
  useEffect(() => { schedRef.current?.schedule() }, [traced, display, prepared, blendVal, fillTile, imgW, imgH, bounds])
  useEffect(() => () => schedRef.current?.cancel(), [])

  const onExport = useCallback(async () => {
    const svg = await actions.exportSvg()
    if (!svg) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    a.download = 'onemo-cutline-mm.svg'
    document.body.appendChild(a); a.click(); a.remove()
  }, [actions])

  // undo/redo: editor-local history first (knob commits land there), then the flow's (Magic/upload steps)
  const canUndo = ed.state.canUndo || state.canUndo
  const canRedo = ed.state.canRedo || state.canRedo
  const onUndo = useCallback(() => { if (ed.state.canUndo) ed.actions.undo(); else void actions.undo() }, [ed.state.canUndo, ed.actions, actions])
  const onRedo = useCallback(() => { if (ed.state.canRedo) ed.actions.redo(); else void actions.redo() }, [ed.state.canRedo, ed.actions, actions])

  const status = generating ? 'Computing…' : prepared ? (pathD ? 'Ready — outline live' : 'Ready') : 'Upload an image to begin'
  const hasCut = !!pathD

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}>
      <PerfHUD />
      <h1 style={{ fontSize: 19, fontWeight: 700, textAlign: 'center' }}>Cutout Lab</h1>

      {/* v1 button row — bridge verbs; Preview/Mask present-but-disabled (no bridge backend yet) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && actions.upload(e.target.files[0])} /></label>
        <button onClick={onExport} disabled={!hasCut} style={{ ...btn, background: hasCut ? '#16a34a' : '#e5e7eb', color: hasCut ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={onUndo} disabled={!canUndo} style={btn}>↩ Undo</button>
        <button onClick={onRedo} disabled={!canRedo} style={btn}>↪ Redo</button>
        <button onClick={() => void actions.reset()} disabled={!hasArtwork} style={btn}>🗑 Clear</button>
        <button disabled style={{ ...btn, color: '#9ca3af' }} title="next increment">👁 Preview</button>
        <button disabled style={{ ...btn, color: '#9ca3af' }} title="next increment">🎭 Mask off</button>
      </div>

      {/* v1 TABS — chips within, ONE adaptive knob below */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'center' }}>
        {(['ai', 'vector', 'blend', 'edit'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setDragVal(null) }} style={{ ...btn, background: tab === t ? '#7c3aed' : '#f1f5f9', color: tab === t ? '#fff' : '#0f172a' }}>
            {t === 'ai' ? '🤖 AI' : t === 'vector' ? '⬡ Vector' : t === 'blend' ? '🎨 Blend' : '✋ Edit'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#475569', minHeight: 34 }}>
        {tab === 'ai' && (<>
          <button onClick={actions.magic} disabled={!hasArtwork || generating} style={{ ...btn, fontSize: 12, background: '#7c3aed', color: '#fff', fontWeight: 700 }}>🤖 Detect</button>
          <span style={{ color: '#94a3b8' }}>· brush:</span>
          <button disabled style={chipBtn(false, true)} title="next increment">🟢 Add</button>
          <button disabled style={chipBtn(false, true)} title="next increment">🔴 Erase</button>
          {hasArtwork && !hasCut && <span style={{ color: '#94a3b8' }}>push Detect to cut with u2net</span>}
        </>)}
        {tab === 'vector' && VEC_CHIPS.map((k) => {
          const t = toolById.get(k)
          return <button key={k} onClick={() => { setVecChip(k); setDragVal(null) }} disabled={!t} style={chipBtn(vecChip === k, !t)}>{k}</button>
        })}
        {tab === 'blend' && (<>
          <button style={chipBtn(true)}>blend</button>
          {/* tile/clamp — the engine compose's fillMode (visible when blend>0 or the offset outgrows the frame) */}
          <button onClick={() => setFill(true)} style={chipBtn(fillTile)}>tile</button>
          <button onClick={() => setFill(false)} style={chipBtn(!fillTile)}>clamp</button>
        </>)}
        {tab === 'edit' && (<>
          <button disabled style={chipBtn(false, true)} title="next increment">🖌 Paint shape</button>
          <button disabled style={chipBtn(false, true)} title="next increment">🩹 Paint erase</button>
          <button disabled style={chipBtn(false, true)} title="next increment">⬡ Nodes</button>
          <button disabled style={chipBtn(false, true)} title="next increment">▣ Frame</button>
        </>)}
      </div>

      {/* the ONE adaptive knob — previews while dragging (dragVal), commits on release (the descriptor F8 contract) */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 12, color: '#475569' }}>
        <span style={{ fontWeight: 700, minWidth: 90 }}>{knob.label}</span>
        <input type="number" min={knob.lo} max={knob.hi} value={Math.round(dragVal ?? knob.value)} disabled={!knob.available}
          onChange={(e) => { setDragVal(null); knob.commit(Math.max(knob.lo, Math.min(knob.hi, Math.round(+e.target.value)))) }}
          style={{ width: 54, padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
        <input type="range" min={knob.lo} max={knob.hi} step={1} value={Math.round(dragVal ?? knob.value)} disabled={!knob.available}
          onPointerDown={() => schedRef.current?.setDragging(true)}
          onChange={(e) => { const v = +e.target.value; setDragVal(v); knob.preview(v) }}
          onPointerUp={() => { if (dragVal != null) { knob.commit(dragVal); setDragVal(null) } schedRef.current?.setDragging(false) }}
          onPointerCancel={() => { setDragVal(null); schedRef.current?.setDragging(false) }}
          style={{ flex: 1, maxWidth: 420 }} />
        {!knob.available && <span style={{ color: '#94a3b8' }}>n/a for this shape</span>}
      </div>

      {/* canvas — v1 look: image + engine outline + dim outside (evenodd scrim). Presentation only. */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div>
          {hasArtwork && <div style={{ ...cap, textAlign: 'center' }}>{hasCut ? 'Live result — dimmed outside the shape' : 'Loaded — push 🤖 Detect to cut'}</div>}
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
              <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: '100%', display: 'block', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {/* v1 RENDER: raw photo as the base (dimmed outside the shape by the scrim); when the
                    ENGINE has composed a frame (blend>0 / outgrown offset), it draws INSIDE the outline
                    on top — live result inside, raw image outside, one clip, no shell compositing. */}
                <defs>
                  {pathD && <clipPath id="labClip"><path d={pathD} /></clipPath>}
                </defs>
                {artworkUrl && <image href={artworkUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />}
                {composed && pathD && (
                  <g clipPath="url(#labClip)">
                    <image href={composed.url} x={composed.x} y={composed.y} width={composed.w} height={composed.h} preserveAspectRatio="none"
                      transform={`translate(0 ${composed.y * 2 + composed.h}) scale(1 -1)`} />
                  </g>
                )}
                {pathD && (<>
                  <path d={`M${vb.x} ${vb.y}H${vb.x + vb.w}V${vb.y + vb.h}H${vb.x}Z ${pathD}`} fill="rgba(6,8,14,0.55)" fillRule="evenodd" />
                  <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={Math.max(2, imgW / 400)} />
                </>)}
              </svg>
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 13, color: '#334155', textAlign: 'center' }}><b>Status:</b> {status}</p>
      <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>disabled controls (brushes · paint · nodes · frame · preview · mask) land in the next increments — spec {spec ? '✓' : '—'}</p>
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
