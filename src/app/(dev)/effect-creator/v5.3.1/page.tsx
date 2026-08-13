'use client'

// Effect Creator V3 — composition root. ONE SCENE, ONE ENGINE (blueprint §1).
//
// v5.5: this page is a THIN Layer-3 adapter over the v53 FLOW `useV53Flow()` (flows/v53Flow.ts) — it binds
// only to the flow's `CreatorFlow` { state, actions } (blueprint §5). All orchestration — upload, background
// cut-out, Magic, the global undo/redo/reset history, editor entry, trim/filter sessions, the mm-SVG export
// string — lives in the flow. The page owns ONLY the UI-side concerns the flow injects: notifications
// (toast), the URL/route params, the double-tap editor-entry gesture, the export file-download, and the
// first-paint resize nudge (a viewer concern). (Phase 5 introduces the flow-selector; v53Flow is bound direct.)
//
// The golden scene mounts ONCE per session and STAYS MOUNTED (§6.1) — no phases, no "Finish in 3D".
// Upload builds the standard square instantly; Magic cuts the subject in a worker while the page stays
// alive; the shape editor opens as an overlay with the scene frozen beneath it. There is NO save surface
// this wave (the manufacturing modules stay pure + tested underneath for the future save round).

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { UndoIcon, RedoIcon, ExportIcon } from './user/icons'
import TopBar, { TopBarButton } from './user/TopBar'
import edStyles from './user/outline-editor.module.css'
import { toast } from './ui/Toast'
import { useV53Flow } from './flows/v53Flow'

// Dynamic imports — no SSR for 3D components
const EffectViewer = dynamic(() => import('./core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('./admin/AdminViewer'), { ssr: false })
const TrimCarousel = dynamic(() => import('./user/TrimCarousel'), { ssr: false })
const Toolbar = dynamic(() => import('./user/Toolbar'), { ssr: false })
// KAI-9124: Filters is a STANDALONE hero surface over the live 3D (no longer the 2D editor).
const FiltersSurface = dynamic(() => import('./user/FiltersSurface'), { ssr: false })
const EditOverlay = dynamic(() => import('./user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('./user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('./user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('./user/GenerateShimmer'), { ssr: false })
const ToastSurface = dynamic(() => import('./ui/Toast'), { ssr: false })
const PerfHUD = dynamic(() => import('./dev/PerfHUD'), { ssr: false })

function PrototypePageInner() {
  const searchParams = useSearchParams()
  const sceneName = searchParams.get('scene')
  const shaped = true // the golden scene renders the generated effect mesh (not a GLB)
  const templateUrl = sceneName
    ? `/api/dev/scenes/${encodeURIComponent(sceneName)}`
    : '/api/dev/scenes/golden'

  // KAI-9010: ?internal=1 arms the internal Export tool (dev-only, never product chrome). Derived from
  // the SAME Suspense-coordinated searchParams as ?scene — PrototypePageInner renders client-only
  // (the Suspense fallback is what prerenders), so there is no server/client hydration mismatch to guard
  // (the original useEffect+window dance was for that; unnecessary under this Suspense boundary).
  const internalTools = searchParams.get('internal') === '1'

  // ── THE v53 flow — { state, actions } (CreatorFlow). Notifications are injected UI-side.
  const notify = useCallback((kind: 'warn' | 'error' | 'info', message: string) => { toast(kind, message) }, [])
  const { state, actions } = useV53Flow({ notify })
  const {
    artworkUrl, prepared, preparedFor3D, sessions, editorMode, autoOutline, generating,
    designState, colors,
  } = state
  // DEC-v5-09: the contract exposes keyed `sessions`; the UI (this client) owns its panel vocabulary,
  // derived here from the UX-semantic session ids (editor/trim/filter).
  const { editor: editingOutline, trim: showColors, filter: showFilters } = sessions

  const [isDragging, setIsDragging] = useState(false)

  // §6.1 no-blank-mount, page-level guarantee (measured 2026-06-10): after content arrives the
  // demand-loop scene can sit unpainted until ANY external repaint trigger — a window resize provably
  // paints it. Nudge with a short resize burst whenever the content identity changes. This is a VIEWER
  // concern kept in the page shell over the scene (NOT socket orchestration); it folds into the viewer
  // adapter with the F32 context-loss work.
  useEffect(() => {
    if (!preparedFor3D) return // the nudge is the 3D-paint concern → key on the published-to-viewer state
    const fire = () => window.dispatchEvent(new Event('resize'))
    fire()
    const ts = [200, 800, 2000].map((ms) => setTimeout(fire, ms))
    return () => ts.forEach(clearTimeout)
  }, [preparedFor3D, editingOutline])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) actions.upload(file)
  }, [actions])

  // Editor entry (plan A1): DOUBLE-TAP the object — two clean taps within 350ms. The UI owns the gesture;
  // the socket exposes beginSession('editor'). Single taps and orbit drags do NOTHING.
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const onScenePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('button')) { tapRef.current = null; return }
    tapRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
  }, [])
  const onScenePointerUp = useCallback((e: React.PointerEvent) => {
    const t0 = tapRef.current
    tapRef.current = null
    if (!t0 || !artworkUrl || editingOutline || generating || showColors || showFilters) return
    if ((e.target as Element).closest('button')) return
    const moved = Math.hypot(e.clientX - t0.x, e.clientY - t0.y)
    const clean = moved < 6 && performance.now() - t0.t < 400
    if (!clean) { lastTapRef.current = null; return }
    const prev = lastTapRef.current
    const now = performance.now()
    if (prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
      lastTapRef.current = null
      actions.beginSession('editor', null)
      return
    }
    lastTapRef.current = { x: e.clientX, y: e.clientY, t: now }
  }, [artworkUrl, editingOutline, generating, showColors, showFilters, actions])

  // Export — the socket returns the mm-true SVG cutline STRING; the UI writes the file (injected adapter).
  const onExport = useCallback(async () => {
    const svg = await actions.exportSvg()
    if (!svg) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    a.download = 'onemo-cutline-mm.svg'
    document.body.appendChild(a); a.click(); a.remove()
  }, [actions])

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: colors.bgColor }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onPointerDown={onScenePointerDown}
      onPointerUp={onScenePointerUp}
    >
      {/* ── THE persistent golden scene — mounted once, never unmounted (§6.1). The editor freezes
          (frameloop=never) but never unmounts it. ── */}
      <AdminViewer
        artworkUrl={artworkUrl}
        designState={designState}
        isEditing={false}
        templateUrl={templateUrl}
      >
        {(config) => (
          <>
            <EffectViewer
              config={config}
              artworkUrl={artworkUrl}
              designState={designState}
              isEditing={false}
              shaped={shaped}
              prepared={preparedFor3D ?? undefined}
              onStatus={actions.handleStatus}
              frozen={editingOutline}
            />
          </>
        )}
      </AdminViewer>

      {/* Pre-upload: pearly-glass ONEMO square + load control (over the warming scene) */}
      {!artworkUrl && <EmptyState onFile={actions.upload} />}

      {/* Magic shimmer — page stays responsive (worker); label = the honest wait state (G5) */}
      {generating && <GenerateShimmer onCancel={actions.cancelMagic} />}

      {/* Trim takeover (D-TRIM): tap recolors the 3D back LIVE; ✓ keeps (one history step), ✕ reverts */}
      {showColors ? (
        <TrimCarousel
          backColor={colors.backColor}
          onBackColor={actions.setBackColor}
          onDone={() => actions.commitSession('trim')}
          onCancel={() => actions.revertSession('trim')}
        />
      ) : showFilters ? (
        /* KAI-9124: the standalone Filters hero surface — over the LIVE 3D; ✓ keeps (one step), ✕ reverts */
        <FiltersSurface
          onDone={() => actions.commitSession('filter')}
          onCancel={() => actions.revertSession('filter')}
        />
      ) : (
        /* Creation row (plan A1): Image · Magic · Trim — editing entries live in the top bar + double-tap */
        <Toolbar
          artworkUrl={artworkUrl}
          auto={autoOutline}
          showColors={showColors}
          onFile={actions.upload}
          onGenerate={actions.magic}
          onToggleColors={() => actions.beginSession('trim')}
          onFilters={() => actions.beginSession('filter')}
          onEditor={() => actions.beginSession('editor', null)}
          editorReady={!!prepared}
        />
      )}

      {/* drag-and-drop indicator (upload affordance) */}
      <EditOverlay isDragging={isDragging} />

      {/* The 2D outline editor — an overlay; the scene stays mounted (frozen) beneath it */}
      <OutlineEditor
        open={editingOutline}
        openMode={editorMode}
        onMagic={actions.magic}
        imageUrl={artworkUrl}
        // KAI-9122: the editor's magic-blend preview seeds from the design's REAL default blur (what the
        // 3D shows when bgBlur is untouched) — 0 for the sharp standard square, ~50 for a shaped subject.
        defaultBlurPct={prepared ? Math.round((2500 * prepared.frontSrc.defaultBlurPx) / prepared.frontSrc.origCanvas.width) : 0}
        onClose={() => actions.commitSession('editor')}
      />

      {/* THE GLOBAL TOP BAR — undo/redo LEFT · RESET center only-when-dirty · Export RIGHT (internal only).
          Hidden while the editor owns the screen (it mounts its own). */}
      {!editingOutline && (
        <div className={`${edStyles.topbarFixed}`}>
          <TopBar
            left={(
              <>
                <TopBarButton icon={<UndoIcon />} label="Undo" onClick={actions.undo} disabled={!state.canUndo} />
                <TopBarButton icon={<RedoIcon />} label="Redo" onClick={actions.redo} disabled={!state.canRedo} />
              </>
            )}
            dirty={state.dirty}
            onReset={actions.reset}
            right={(
              /* KAI-9010: Export is internal-only (?internal=1). The hero bar is pills-first now. */
              internalTools ? <TopBarButton icon={<ExportIcon />} label="Export" onClick={onExport} disabled={!prepared} /> : null
            )}
          />
        </div>
      )}

      {/* G4 + G3 — always present */}
      <ToastSurface />
      <PerfHUD />
    </div>
  )
}

export default function EffectCreatorV531Page() {
  return (
    <Suspense fallback={null}>
      <PrototypePageInner />
    </Suspense>
  )
}
