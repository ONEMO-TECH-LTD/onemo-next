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
//  • The canvas is v1-style PRESENTATION only: image + engine outline + dim-outside scrim, rendered from
//    the composer's display shape. No bake, no compositor call.

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '../effect-creator/v5.3.1/ui/Toast'
import { useTwoDFirstFlow } from '../effect-creator/v5.3.1/flows/twoDFirstFlow'
import { useEditor } from '../effect-creator/v5.3.1/user/editor/useEditor'
import { shapeToSVGPathD } from '@/lib/vector-core'
import PerfHUD from '../effect-creator/v5.3.1/dev/PerfHUD'

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
  const { tools, display, spec, imgW, imgH, subjMatteUrl, blendBlur } = ed.state
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

  // v1 VIEWPORT LAW (Meta refinement): the view adapts to the OUTLINE's full extent — an offset past the
  // frame zooms the view out (the object reads smaller) instead of hiding under the canvas edge; the
  // viewport CSS width stays fixed. Extent from the display shape's anchors (+handles), like v1's bounds.
  const vb = useMemo(() => {
    if (!traced || !display) return { x: 0, y: 0, w: imgW, h: imgH }
    let minX = 0, minY = 0, maxX = imgW, maxY = imgH
    for (const p of display.paths) for (const a of p.anchors) for (const pt of [a.p, a.hIn, a.hOut]) {
      if (!pt) continue
      if (pt.x < minX) minX = pt.x; if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x; if (pt.y > maxY) maxY = pt.y
    }
    const m = Math.max(4, imgW / 100)
    const x = Math.min(0, Math.floor(minX - m)), y = Math.min(0, Math.floor(minY - m))
    return { x, y, w: Math.max(imgW, Math.ceil(maxX + m)) - x, h: Math.max(imgH, Math.ceil(maxY + m)) - y }
  }, [traced, display, imgW, imgH])
  const fillVal = toolById.get('fill')?.value as boolean | undefined

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
          {/* tile/clamp toggle engine state whose only consumer is the compositor — disabled until the
              engine-compose increment lands (their commit would be a silent no-op on this surface). */}
          <button disabled style={chipBtn(fillVal === true, true)} title="engine-compose increment">tile</button>
          <button disabled style={chipBtn(fillVal === false, true)} title="engine-compose increment">clamp</button>
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
          onChange={(e) => { const v = +e.target.value; setDragVal(v); knob.preview(v) }}
          onPointerUp={() => { if (dragVal != null) { knob.commit(dragVal); setDragVal(null) } }}
          onPointerCancel={() => setDragVal(null)}
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
                {/* v1 RENDER BEHAVIOR from engine outputs (EditorCanvas pattern, no old component mounted):
                    blend on → blurred background + the engine's subject matte sharp on top; else the photo. */}
                <defs>
                  <filter id="labBgBlur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation={(blendBlur / 100) * (imgW / 25)} />
                  </filter>
                </defs>
                {artworkUrl && (blendBlur > 0 && subjMatteUrl ? (
                  <>
                    <image href={artworkUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" filter="url(#labBgBlur)" />
                    <image href={subjMatteUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" transform={`translate(0 ${imgH}) scale(1 -1)`} />
                  </>
                ) : (
                  <image href={artworkUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />
                ))}
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
