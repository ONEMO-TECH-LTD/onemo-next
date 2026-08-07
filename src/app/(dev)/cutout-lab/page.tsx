'use client'

// cutout-lab v2 — the CLEAN SHELL (Dan 2026-08-07 rebuild on clean v5.3.1 98ae0deb).
//
// GROUND RULE: the shell CONFORMS to the bridge, never the reverse. This page binds v5.3.1's own
// `useTwoDFirstFlow` (the flow-contract bridge, built to support any UI) and drives it through its
// native verbs — upload → upload, Detect → magic, knobs → the editor session — exactly as the
// v5.3.1 2d shell does. NO lab flow, NO finish.ts glue, NO re-composited bake: the engine composites
// through the flow's descriptors. Anything the bridge doesn't already expose is DEFERRED to its own
// module increment, never glued in here.
//
// 2D-cutout only: the 3D-preview / trim / filter branches of the 2d shell are dropped (not needed
// for the cutout lab, and the bridge keeps them optional).

import dynamic from 'next/dynamic'
import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { UndoIcon, RedoIcon, ExportIcon } from '../effect-creator/v5.3.1/user/icons'
import TopBar, { TopBarButton } from '../effect-creator/v5.3.1/user/TopBar'
import edStyles from '../effect-creator/v5.3.1/user/outline-editor.module.css'
import { toast } from '../effect-creator/v5.3.1/ui/Toast'
import { useTwoDFirstFlow } from '../effect-creator/v5.3.1/flows/twoDFirstFlow'

const Toolbar = dynamic(() => import('../effect-creator/v5.3.1/user/Toolbar'), { ssr: false })
const EditOverlay = dynamic(() => import('../effect-creator/v5.3.1/user/EditOverlay'), { ssr: false })
const OutlineEditor = dynamic(() => import('../effect-creator/v5.3.1/user/OutlineEditor'), { ssr: false })
const EmptyState = dynamic(() => import('../effect-creator/v5.3.1/user/EmptyState'), { ssr: false })
const GenerateShimmer = dynamic(() => import('../effect-creator/v5.3.1/user/GenerateShimmer'), { ssr: false })
const ToastSurface = dynamic(() => import('../effect-creator/v5.3.1/ui/Toast'), { ssr: false })
const PerfHUD = dynamic(() => import('../effect-creator/v5.3.1/dev/PerfHUD'), { ssr: false })

function CutoutLabInner() {
  const searchParams = useSearchParams()
  const segPresent = !!searchParams.get('seg')
  const internalTools = searchParams.get('internal') === '1'

  const notify = useCallback((kind: 'warn' | 'error' | 'info', message: string) => { toast(kind, message) }, [])
  const { state, actions } = useTwoDFirstFlow({ notify, segPresent })
  const { artworkUrl, prepared, sessions, editorMode, autoOutline, generating, colors } = state
  const editingOutline = sessions.editor

  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
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
      {!artworkUrl && <EmptyState onFile={actions.upload} />}
      {generating && <GenerateShimmer onCancel={actions.cancelMagic} />}

      <Toolbar
        artworkUrl={artworkUrl}
        auto={autoOutline}
        showColors={false}
        onFile={actions.upload}
        onGenerate={actions.magic}
        onToggleColors={() => {}}
        onFilters={() => {}}
        onEditor={() => actions.beginSession('editor', null)}
        editorReady={!!prepared}
      />

      <EditOverlay isDragging={isDragging} />

      {/* The 2D editor — the cutout surface: outline + knobs + blend, driven by the flow's editor
          session. The engine composites through its descriptors; the shell never bakes. */}
      <OutlineEditor
        open={editingOutline}
        openMode={editorMode}
        onMagic={actions.magic}
        imageUrl={artworkUrl}
        defaultBlurPct={prepared ? Math.round((2500 * prepared.frontSrc.defaultBlurPx) / prepared.frontSrc.origCanvas.width) : 0}
        onClose={() => actions.commitSession('editor')}
      />

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
            right={internalTools ? <TopBarButton icon={<ExportIcon />} label="Export" onClick={onExport} disabled={!prepared} /> : null}
          />
        </div>
      )}

      <ToastSurface />
      <PerfHUD />
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
