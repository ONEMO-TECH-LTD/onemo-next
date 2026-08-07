'use client'

// cutout-lab v2 — the v1 BENCH SHELL, wired to the clean v5.3.1 bridge (Dan 2026-08-07 rebuild on
// pre-session v5.3.1 @ 98ae0deb). Increment 1: the engine wired to the UI, exposing ONLY what the
// engine natively supports.
//
// GROUND RULE (Meta/Dan): the shell CONFORMS to the bridge, never the reverse. This page copies the v1
// bench CHROME (title + the Upload/Detect/Save/Undo/Redo/Clear button row + status) and binds v5.3.1's own
// `useTwoDFirstFlow` through its native verbs — upload → upload, Detect → magic (u2net cut), Save → exportSvg,
// undo/redo, Clear → reset. The editing surface (shape / adjust / blend / nodes) is the bridge's OWN
// `OutlineEditor`, driven by its descriptor mechanism (`useEditor`) — the flow opens it at upload. There is
// NO lab flow, NO finish.ts, NO tool modules, NO cutSource, NO parallel knob path: the engine composites and
// the descriptors edit. Import graph is exactly page → flows / OutlineEditor(→useEditor) / v5.3.1-ui.
//
// Controls the bridge does not yet back are OMITTED (not glued, not approximated) and listed in the goal's
// omission report — they land as their own later increments (per Dan's sequence: verbatim → calibration →
// paint → grabcut). See the omissions comment at the foot of this file.

import dynamic from 'next/dynamic'
import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '../effect-creator/v5.3.1/ui/Toast'
import { useTwoDFirstFlow } from '../effect-creator/v5.3.1/flows/twoDFirstFlow'

const OutlineEditor = dynamic(() => import('../effect-creator/v5.3.1/user/OutlineEditor'), { ssr: false })
const GenerateShimmer = dynamic(() => import('../effect-creator/v5.3.1/user/GenerateShimmer'), { ssr: false })
const EditOverlay = dynamic(() => import('../effect-creator/v5.3.1/user/EditOverlay'), { ssr: false })
const ToastSurface = dynamic(() => import('../effect-creator/v5.3.1/ui/Toast'), { ssr: false })
const PerfHUD = dynamic(() => import('../effect-creator/v5.3.1/dev/PerfHUD'), { ssr: false })

// v1 bench button style (copied verbatim from the v1 shell — presentation only).
const btn: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontWeight: 600 }

function CutoutLabInner() {
  const searchParams = useSearchParams()
  const segPresent = !!searchParams.get('seg')

  const notify = useCallback((kind: 'warn' | 'error' | 'info', message: string) => { toast(kind, message) }, [])
  const { state, actions } = useTwoDFirstFlow({ notify, segPresent })
  const { artworkUrl, prepared, sessions, editorMode, hasArtwork, generating, canUndo, canRedo } = state
  const editingOutline = sessions.editor

  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) actions.upload(file)
  }, [actions])

  // Save → export the mm-true cutline SVG (the socket returns the string; the UI writes the file).
  const onExport = useCallback(async () => {
    const svg = await actions.exportSvg()
    if (!svg) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    a.download = 'onemo-cutline-mm.svg'
    document.body.appendChild(a); a.click(); a.remove()
  }, [actions])

  const status = generating ? 'Computing…'
    : editingOutline ? 'Editing — shape · adjust · blend'
    : prepared ? 'Ready'
    : hasArtwork ? 'Loaded'
    : 'Upload an image to begin'

  return (
    <div
      style={{ maxWidth: 1180, margin: '0 auto', padding: 20, minHeight: '100vh', fontFamily: 'ui-sans-serif, system-ui', color: '#0f172a' }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
    >
      <PerfHUD />
      <h1 style={{ fontSize: 19, fontWeight: 700, textAlign: 'center' }}>Cutout Lab</h1>

      {/* v1 bench button row — every handler wired to a bridge verb */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{ ...btn, cursor: 'pointer', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>⬆ Upload
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && actions.upload(e.target.files[0])} /></label>
        <button onClick={actions.magic} disabled={!hasArtwork || generating} style={{ ...btn, background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}>🤖 Detect</button>
        <button onClick={onExport} disabled={!prepared} style={{ ...btn, background: prepared ? '#16a34a' : '#e5e7eb', color: prepared ? '#fff' : '#9ca3af' }}>💾 Save</button>
        <button onClick={actions.undo} disabled={!canUndo} style={btn}>↩ Undo</button>
        <button onClick={actions.redo} disabled={!canRedo} style={btn}>↪ Redo</button>
        <button onClick={actions.reset} disabled={!hasArtwork} style={btn}>🗑 Clear</button>
      </div>

      {generating && <GenerateShimmer onCancel={actions.cancelMagic} />}

      {/* pre-upload prompt (v1 bench look) — the file input drives the same bridge verb */}
      {!hasArtwork && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: 'min(480px, 86vw)', height: 320, border: '1.5px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer', color: '#64748b', background: 'transparent' }}>
            <span style={{ fontSize: 40, lineHeight: 1 }}>🖼️</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Upload the image</span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && actions.upload(e.target.files[0])} />
          </label>
        </div>
      )}

      <EditOverlay isDragging={isDragging} />

      {/* The editing/canvas surface = the bridge's OWN editor (its EditorCanvas + descriptor sheets, driven by
          useEditor). The flow opens it at upload; Done commits the session. The engine composites — the shell
          never bakes. Magic (Detect) is also reachable inside via the editor's own Magic dock button. */}
      <OutlineEditor
        open={editingOutline}
        openMode={editorMode}
        onMagic={actions.magic}
        imageUrl={artworkUrl}
        defaultBlurPct={prepared ? Math.round((2500 * prepared.frontSrc.defaultBlurPx) / prepared.frontSrc.origCanvas.width) : 0}
        onClose={() => actions.commitSession('editor')}
      />

      <p style={{ marginTop: 12, fontSize: 13, color: '#334155', textAlign: 'center' }}><b>Status:</b> {status}</p>

      <ToastSurface />
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

// ── OMITTED in increment 1 (would need lab code, new glue, or a parallel path to the bridge editor) ──
//  • v1 page-level tabs (ai/vector/blend/edit) + chips + the single adaptive knob — the bridge already
//    delivers shape/adjust/blend/detail/offset/smooth/radius/curve editing through OutlineEditor's own
//    descriptor sheets (useEditor); a page-level knob is a PARALLEL path, so editing is the bridge editor's.
//  • AI brush Add/Erase (grabcut), Paint shape / Paint erase — no bridge tool exists yet (later increments).
//  • Mask on/off overlay, 2D Preview toggle, comet trail, cursor ring — v1 raster-canvas presentation; the
//    bridge editor carries its own Preview.
//  • Admin paint-shaper panel (?admin=1), the "magic cut" ms stat, on-device eruda console, warmup prefetch —
//    v1 lab-flow internals / debug.
