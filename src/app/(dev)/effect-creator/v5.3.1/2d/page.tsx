'use client'

// 2d/page.tsx — the 2D-FIRST shell (Creator v5.5 · Phase 5 · ADR-S58-CREATE-3D-02 · KAI-9282).
//
// The SECOND route shell (the selector = two route shells; v5.3.1/page.tsx stays the v53 3D-first parity
// baseline). This shell binds `useTwoDFirstFlow` and is 2D-PRIMARY:
//   • It mounts NO 3D scene at startup (departs from v53's always-mounted AdminViewer/EffectViewer). The 2D
//     editor is the surface; upload is light by construction (the flow runs no AI, no 3D at upload).
//   • 3D mounts ONLY while `state.previewing3D` — a deliberate Preview-in-3D (modal): previewIn3D() assembles
//     it from the current spec (the viewer reads committedContourMM from the store), exitPreview() tears it
//     down. Not kept warm; every preview is fresh (no stale-3D in Phase 5).
//   • Done/undo/redo/reset never mount 3D (the flow's no-op restore publisher + Done-no-publish).
//
// TRANSITIONAL: the Preview-in-3D / Back-to-2D affordance here is a dev/transitional control — Phase 6's
// Create Studio dock is the real UI (KAI-9217). This shell reuses the existing descriptor-driven editor +
// surfaces unchanged (a client of the same modules); it is net-new Layer-3 (inv-18-safe — zero engine/
// primitive/service/descriptor/flow edit).

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { UndoIcon, RedoIcon, ExportIcon } from '../user/icons'
import TopBar, { TopBarButton } from '../user/TopBar'
import edStyles from '../user/outline-editor.module.css'
import { toast } from '../ui/Toast'
import { useTwoDFirstFlow } from '../flows/twoDFirstFlow'

// Dynamic imports — no SSR for 3D components (only ever mounted while previewing).
const EffectViewer = dynamic(() => import('../core/EffectViewer'), { ssr: false })
const AdminViewer = dynamic(() => import('../admin/AdminViewer'), { ssr: false })
const TrimCarousel = dynamic(() => import('../user/TrimCarousel'), { ssr: false })
const Toolbar = dynamic(() => import('../user/Toolbar'), { ssr: false })
const FiltersSurface = dynamic(() => import('../user/FiltersSurface'), { ssr: false })
const EditOverlay = dynamic(() => import('../user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('../user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('../user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('../user/GenerateShimmer'), { ssr: false })
const ToastSurface = dynamic(() => import('../ui/Toast'), { ssr: false })
const PerfHUD = dynamic(() => import('../dev/PerfHUD'), { ssr: false })

function TwoDFirstPageInner() {
  const searchParams = useSearchParams()
  const sceneName = searchParams.get('scene')
  const shaped = true
  const templateUrl = sceneName
    ? `/api/dev/scenes/${encodeURIComponent(sceneName)}`
    : '/api/dev/scenes/golden'
  const internalTools = searchParams.get('internal') === '1'

  const notify = useCallback((kind: 'warn' | 'error' | 'info', message: string) => { toast(kind, message) }, [])
  const { state, actions } = useTwoDFirstFlow({ notify })
  const {
    artworkUrl, prepared, preparedFor3D, sessions, editorMode, autoOutline, generating,
    designState, colors, previewing3D,
  } = state
  const { editor: editingOutline, trim: showColors, filter: showFilters } = sessions

  const [isDragging, setIsDragging] = useState(false)

  // §6.1 no-blank-mount nudge — only relevant while a 3D preview is mounted (preparedFor3D set by previewIn3D).
  useEffect(() => {
    if (!preparedFor3D) return
    const fire = () => window.dispatchEvent(new Event('resize'))
    fire()
    const ts = [200, 800, 2000].map((ms) => setTimeout(fire, ms))
    return () => ts.forEach(clearTimeout)
  }, [preparedFor3D])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) actions.upload(file)
  }, [actions])

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
    >
      {previewing3D ? (
        // ── 3D PREVIEW MODE (modal) — mounted ONLY here, fresh from the current spec; torn down on exit ──
        <>
          <AdminViewer
            artworkUrl={artworkUrl}
            designState={designState}
            isEditing={false}
            templateUrl={templateUrl}
          >
            {(config) => (
              <EffectViewer
                config={config}
                artworkUrl={artworkUrl}
                designState={designState}
                isEditing={false}
                shaped={shaped}
                prepared={preparedFor3D ?? undefined}
                onStatus={actions.handleStatus}
                frozen={false}
              />
            )}
          </AdminViewer>
          <div className={`${edStyles.topbarFixed}`}>
            <TopBar
              left={<TopBarButton icon={<UndoIcon />} label="Back to 2D" onClick={actions.exitPreview} />}
              dirty={false}
              onReset={actions.exitPreview}
              right={null}
            />
          </div>
        </>
      ) : (
        // ── 2D MODE (primary) — the editor is the surface; NO 3D scene mounted ──
        <>
          {!artworkUrl && <EmptyState onFile={actions.upload} />}
          {generating && <GenerateShimmer onCancel={actions.cancelMagic} />}

          {showColors ? (
            <TrimCarousel
              backColor={colors.backColor}
              onBackColor={actions.setBackColor}
              onDone={() => actions.commitSession('trim')}
              onCancel={() => actions.revertSession('trim')}
            />
          ) : showFilters ? (
            <FiltersSurface
              onDone={() => actions.commitSession('filter')}
              onCancel={() => actions.revertSession('filter')}
            />
          ) : (
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

          <EditOverlay isDragging={isDragging} />

          {/* The 2D editor — the PRIMARY surface in 2D-first (no scene beneath); the flow opens it at upload */}
          <OutlineEditor
            open={editingOutline}
            openMode={editorMode}
            onMagic={actions.magic}
            imageUrl={artworkUrl}
            defaultBlurPct={prepared ? Math.round((2500 * prepared.frontSrc.defaultBlurPx) / prepared.frontSrc.origCanvas.width) : 0}
            onClose={() => actions.commitSession('editor')}
          />

          {/* Global top bar (undo/redo/reset) — hidden while the editor owns the screen.
              + the TRANSITIONAL Preview-in-3D trigger (Phase-6 dock replaces it): 3D mounts only on this press. */}
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
                  <>
                    {prepared && <TopBarButton icon={<ExportIcon />} label="Preview in 3D" onClick={actions.previewIn3D} />}
                    {internalTools && <TopBarButton icon={<ExportIcon />} label="Export" onClick={onExport} disabled={!prepared} />}
                  </>
                )}
              />
            </div>
          )}
        </>
      )}

      <ToastSurface />
      <PerfHUD />
    </div>
  )
}

export default function EffectCreatorV531TwoDFirstPage() {
  return (
    <Suspense fallback={null}>
      <TwoDFirstPageInner />
    </Suspense>
  )
}
