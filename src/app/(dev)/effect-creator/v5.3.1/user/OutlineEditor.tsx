// Effect Creator — 2D outline editor overlay. Phase 4 (blueprint §0.4 / inv 30): a THIN CLIENT. ALL editor
// CONTROLLER logic (the source+adjustments session, the per-tool descriptors, the F8/F12/F16 folds) lives in
// the composer `useEditor`; this component owns ONLY the canvas-interaction layer (gestures / points /
// transforms / view) + binds the composer's {state, actions} + renders the descriptor-driven sheets
// (ToolSheet / PickerSheet). The tools ARE descriptors (editor/descriptors/*); the UI is a swappable client
// of the composer's bridge — old client unplugs, new plugs in, no reskin. No tool logic lives here.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateSelfIntersection, type Vec2Px } from '@/lib/outline-core/math'
import { useOutlineStore } from './outlineStore'
import { toast } from '../ui/Toast'
import { shapeToSVGPathD, flattenShape, insertAnchorCentered, deleteAnchorRefit, type VShape } from '@/lib/vector-core'
import { useCanvasView } from './editor/useCanvasView'
import { useEditorGestures } from './editor/useEditorGestures'
import { EditorCanvas } from './editor/EditorCanvas'
import { type GripId } from './editor/geometry'
import { useEditor } from './editor/useEditor'
import { ToolSheet, PickerSheet, type ToolActions } from './editor/tool-sheet'
import { toolEnabledFromSearch } from './editor/tool-config'
import { UndoIcon, RedoIcon, CheckIcon, CloseIcon, AddPointIcon, DeleteIcon, ShapeIcon, TuneIcon, OutlineIcon, PreviewIcon, PreviewOffIcon, PointsIcon, MagicIcon } from './icons'
import styles from './outline-editor.module.css'
import TopBar, { TopBarButton } from './TopBar'
import Dock, { DockTool } from './Dock'

interface OutlineEditorProps {
  open: boolean
  imageUrl?: string
  onClose: () => void
  /** Structure A (#27): the toolbar's creation modes open THIS editor in that mode. */
  openMode?: 'shape' | 'image' | null
  /** Magic ✦ trail chip — runs the SAME auto-cut the hero shortcut runs; the editor stays open + re-seeds. */
  onMagic?: () => void
  /** KAI-9122: the design's REAL default magic-blend (0–100%) — seeds the blend preview so the 2D matches the 3D. */
  defaultBlurPct?: number
}

const VIEW_W = 1000
const VIEW_H = 1000
// the editor's Image mode shows this subset of the image outlet (§9: the rest re-exposed in Phase 6's client).
const EDITOR_IMAGE_IDS = new Set(['brightness', 'contrast', 'saturate', 'warmth', 'blend'])

export default function OutlineEditor({ open, imageUrl, onClose, openMode, onMagic, defaultBlurPct = 0 }: OutlineEditorProps) {
  // ── THE COMPOSER: the editor controller + the descriptor-driven {state, actions}; notify = injected toast ──
  const { state, actions } = useEditor({ open, defaultBlurPct, onClose, notify: toast })
  const { display, selVA, shapePreview, fxDraft, confirmDiscard, canUndo, canRedo } = state
  const setSelVA = actions.setSelVA
  const applyVec = actions.applyVec

  // the resolved display IS the working VShape for the gesture/render layer.
  const vshape = display
  const vshapeRef = useRef<VShape | null>(display)
  useEffect(() => { vshapeRef.current = display }, [display])

  // ── client UI state: which sheet + active chip (the composer owns tool VALUES; the surface owns which
  //    sheet/chip shows) ──
  const [activeAdjust, setActiveAdjust] = useState<'shape' | 'adjust' | 'image' | null>(null)
  const [adjustActiveId, setAdjustActiveId] = useState<string | null>('radius')
  const [imageActiveId, setImageActiveId] = useState<string | null>('brightness')

  // ── canvas-interaction state (the gesture / points / transform layer — stays in the client) ──
  const [preview, setPreview] = useState(false)
  const [showAnchors, setShowAnchors] = useState(true)
  const [allSelected, setAllSelected] = useState(false)
  const [frameLocked, setFrameLocked] = useState(true)
  const [selSeg, setSelSeg] = useState<number | null>(null)
  const [vecLive, setVecLive] = useState<VShape | null>(null)
  const vecLiveRef = useRef<VShape | null>(null)
  useEffect(() => { vecLiveRef.current = vecLive }, [vecLive])
  const [rotateLive, setRotateLive] = useState<{ deg: number; cx: number; cy: number } | null>(null)
  const rotateLiveRef = useRef(rotateLive)
  useEffect(() => { rotateLiveRef.current = rotateLive }, [rotateLive])
  const [moveLive, setMoveLive] = useState<{ dx: number; dy: number } | null>(null)
  const moveLiveRef = useRef(moveLive)
  useEffect(() => { moveLiveRef.current = moveLive }, [moveLive])
  const [stretchLive, setStretchLive] = useState<{ sx: number; sy: number; ax: number; ay: number } | null>(null)
  const stretchRef = useRef<{ which: GripId; ax: number; ay: number; bbox: { minX: number; minY: number; maxX: number; maxY: number }; sx: number; sy: number } | null>(null)
  const [pinching, setPinching] = useState(false)
  const rotateRef = useRef<{ cx: number; cy: number; start: number } | null>(null)
  const moveRef = useRef<{ start: Vec2Px; bbox: { minX: number; minY: number; maxX: number; maxY: number } } | null>(null)
  const pointersRef = useRef<Map<number, Vec2Px>>(new Map())
  const nodeInteractedRef = useRef(false)
  const dragStartRef = useRef<Vec2Px | null>(null)
  const nodeRRef = useRef(11)
  const svgRef = useRef<SVGSVGElement>(null)
  const dimsRef = useRef({ widthPx: VIEW_W, heightPx: VIEW_H })
  const pinchRef = useRef<{ d0: number; scale0: number; c0: Vec2Px } | null>(null)
  const canvasPanRef = useRef<{ startClient: Vec2Px; vx0: number; vy0: number } | null>(null)
  const clientPtsRef = useRef<Map<number, Vec2Px>>(new Map())
  const imgPanRef = useRef<{ startClient: [number, number]; art0: { offsetX: number; offsetY: number; scale: number } } | null>(null)
  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const vecDragRef = useRef<{ kind: 'p' | 'hIn' | 'hOut'; ai: number; orig: VShape; moved: boolean } | null>(null)

  useEffect(() => {
    const sync = () => {
      const sp = useOutlineStore.getState().spec
      if (sp) dimsRef.current = { widthPx: sp.maskWidthPx, heightPx: sp.maskHeightPx }
    }
    sync()
    return useOutlineStore.subscribe(sync)
  }, [])

  const { view, setView, viewRef, screenToContent, originPinning, applyZoom, toViewBox } = useCanvasView(svgRef, dimsRef)
  const spec = useOutlineStore((s) => s.spec)
  const imgW = spec?.maskWidthPx ?? VIEW_W
  const imgH = spec?.maskHeightPx ?? VIEW_H
  const subjMatteUrl = useOutlineStore((s) => s.subjMatteUrl)
  const art = useOutlineStore((s) => s.artwork)
  const bgBlur = useOutlineStore((s) => s.bgBlur)
  // KAI-9122: the canvas blur preview = the live bgBlur as %, or the design's default when null (match the 3D).
  const blendBlur = bgBlur != null ? Math.round(bgBlur * 100) : defaultBlurPct

  // ── tools (runtime-filtered by toolEnabled) + the outlet subsets each sheet renders ──
  const toolEnabled = useMemo(() => toolEnabledFromSearch(typeof window !== 'undefined' ? window.location.search : ''), [])
  const tools = actions.buildTools(toolEnabled)
  const toolActions: ToolActions = actions
  const adjustTools = tools.filter((t) => t.outlet === 'adjust')
  const imageTools = tools.filter((t) => t.outlet === 'image' && EDITOR_IMAGE_IDS.has(t.id))
  const pickerTool = tools.find((t) => t.kind === 'picker' && t.outlet === 'shape')

  // ── render core: vDisplay (a live drag supersedes), the SVG path (a generator morph ring supersedes) ──
  const vDisplay = useMemo(() => (vshape ? (vecLive ?? vshape) : null), [vshape, vecLive])
  const pathD = useMemo(() => {
    if (shapePreview) return shapePreview
    return vDisplay ? shapeToSVGPathD(vDisplay, 2) : ''
  }, [shapePreview, vDisplay])
  const hitRing = useMemo<Vec2Px[]>(() => {
    if (!vDisplay) return []
    try { return flattenShape(vDisplay, 0.5)[0]?.map((pt) => [pt.x, pt.y] as Vec2Px) ?? [] } catch { return [] }
  }, [vDisplay])
  const hitBBox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of hitRing) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
    return { minX, minY, maxX, maxY }
  }, [hitRing])
  const hasIssues = useMemo(() => hitRing.length >= 4 && validateSelfIntersection(hitRing, 'outer').length > 0, [hitRing])

  // ── GESTURE TRANSFORMS (R8 seam 3) — wired with the composer's editing verbs (transformSource/applyVec/setSelVA) ──
  const {
    onVAnchorDown, onVHandleDown, onVAnchorDouble,
    onSurfacePointerDown, onPointerMove, onPointerUp, onSurfaceClick, onSurfaceWheel,
    beginStretch, moveStretch, endStretch, beginRotateHandle,
  } = useEditorGestures({
    svgRef, viewRef, vshapeRef, nodeRRef, vecLiveRef,
    pointersRef, clientPtsRef, dragStartRef, nodeInteractedRef, lastTapRef,
    pinchRef, canvasPanRef, imgPanRef, vecDragRef, rotateRef, rotateLiveRef, moveRef, moveLiveRef, stretchRef,
    toViewBox, screenToContent, originPinning, applyZoom, setView,
    transformSource: actions.transformSource, applyVec,
    setVecLive, setMoveLive, setRotateLive, setStretchLive, setPinching, setAllSelected, setSelVA, setSelSeg, setShowAnchors,
    preview, activeAdjust, showAnchors, frameLocked, imgW, imgH, hitRing, hitBBox,
  })

  // ── node bar (points): add-after / delete / sharpen⇄smooth — canvas-interaction over the composer's applyVec ──
  const onVAddAfter = useCallback(() => {
    const v = vshapeRef.current
    if (!v || selVA === null) return
    applyVec({ paths: [insertAnchorCentered(v.paths[0], selVA), ...v.paths.slice(1)] })
    setSelVA(selVA + 1)
    setShowAnchors(true)
  }, [selVA, applyVec, setSelVA])
  const onVDelete = useCallback(() => {
    const v = vshapeRef.current
    if (!v || selVA === null) return
    if (v.paths[0].anchors.length > 3) applyVec({ paths: [deleteAnchorRefit(v.paths[0], selVA), ...v.paths.slice(1)] })
    setSelVA(null)
  }, [selVA, applyVec, setSelVA])
  const onVToggleCorner = useCallback(() => {
    const v = vshapeRef.current
    if (!v || selVA === null) return
    const anchors = v.paths[0].anchors.map((a) => ({ ...a }))
    const a = anchors[selVA]
    if (!a) return
    if (a.corner) {
      const hIn = a.hIn, hOut = a.hOut
      if (hIn && hOut) {
        const inL = Math.hypot(hIn.x - a.p.x, hIn.y - a.p.y)
        const outL = Math.hypot(hOut.x - a.p.x, hOut.y - a.p.y)
        let tx = (hOut.x - a.p.x) / (outL || 1) - (hIn.x - a.p.x) / (inL || 1)
        let ty = (hOut.y - a.p.y) / (outL || 1) - (hIn.y - a.p.y) / (inL || 1)
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
        anchors[selVA] = { ...a, corner: false, hIn: { x: a.p.x - tx * inL, y: a.p.y - ty * inL }, hOut: { x: a.p.x + tx * outL, y: a.p.y + ty * outL } }
      } else {
        anchors[selVA] = { ...a, corner: false }
      }
    } else {
      anchors[selVA] = { ...a, corner: true }
    }
    applyVec({ paths: [{ anchors }, ...v.paths.slice(1)] })
  }, [selVA, applyVec])

  // ── activeAdjust open-mode (UI): capture the PRE-open committed fact in RENDER (before the composer's seed
  //    effect runs), then the open effect picks the landing sheet — #27 toolbar modes + the choose-a-shape opening. ──
  const prevOpenRef = useRef(false)
  const hadCommittedRef = useRef(false)
  if (open && !prevOpenRef.current) hadCommittedRef.current = !!useOutlineStore.getState().committedShape
  prevOpenRef.current = open

  useEffect(() => {
    if (!open) return
    // canvas/UI session reset (the composer resets the source + tool state)
    setView({ scale: 1, vx: 0, vy: 0 })
    setShowAnchors(false); setPreview(false); setAllSelected(false)
    setVecLive(null); vecDragRef.current = null
    setRotateLive(null); rotateLiveRef.current = null; rotateRef.current = null
    setMoveLive(null); moveLiveRef.current = null; moveRef.current = null
    setStretchLive(null); stretchRef.current = null
    pinchRef.current = null; canvasPanRef.current = null; setPinching(false)
    pointersRef.current.clear(); clientPtsRef.current.clear()
    imgPanRef.current = null
    setSelSeg(null)
    setAdjustActiveId('radius'); setImageActiveId('brightness')
    const isMagic = useOutlineStore.getState().spec?.generator.adapter !== 'standard'
    if (openMode === 'image') setActiveAdjust('image')
    else if (openMode === 'shape') setActiveAdjust('shape')
    else if (isMagic || hadCommittedRef.current) setActiveAdjust('adjust')
    else setActiveAdjust('shape') // pre-Magic standard, nothing committed before open: choose a shape (Dan, 2026-06-10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const nodeR = ((imgW / VIEW_W) * 11) / view.scale
  nodeRRef.current = nodeR

  return (
    <div className={styles.overlay}>
      <TopBar
        leading={<TopBarButton icon={<CloseIcon />} label="Close" onClick={() => actions.onCancel()} />}
        left={(
          <>
            <TopBarButton icon={<UndoIcon />} label="Undo" onClick={actions.undo} disabled={!canUndo} />
            <TopBarButton icon={<RedoIcon />} label="Redo" onClick={actions.redo} disabled={!canRedo} />
          </>
        )}
        dirty={canUndo}
        onReset={actions.onReset}
        right={(
          <>
            <TopBarButton icon={<PointsIcon />} label="Points" active={showAnchors} disabled={preview} onClick={() => { setShowAnchors((v) => !v); setSelVA(null); setAllSelected(false) }} />
            <TopBarButton icon={preview ? <PreviewOffIcon /> : <PreviewIcon />} label={preview ? 'Edit' : 'Preview'} onClick={() => setPreview((v) => !v)} />
            <TopBarButton icon={<CheckIcon />} label="Done" onClick={actions.onDone} primary={canUndo} />
          </>
        )}
      />

      <EditorCanvas
        svgRef={svgRef}
        view={view}
        imgW={imgW}
        imgH={imgH}
        imageUrl={imageUrl}
        subjMatteUrl={subjMatteUrl}
        art={art}
        fxDraft={fxDraft}
        blendBlur={blendBlur}
        vshape={vshape}
        vDisplay={vDisplay}
        pathD={pathD}
        hitRing={hitRing}
        hitBBox={hitBBox}
        hasIssues={hasIssues}
        nodeR={nodeR}
        preview={preview}
        showAnchors={showAnchors}
        selVA={selVA}
        allSelected={allSelected}
        frameLocked={frameLocked}
        rotateLive={rotateLive}
        moveLive={moveLive}
        stretchLive={stretchLive}
        pinching={pinching}
        shapePreview={shapePreview}
        nodeInteractedRef={nodeInteractedRef}
        setFrameLocked={setFrameLocked}
        onSurfacePointerDown={onSurfacePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onSurfaceClick={onSurfaceClick}
        onSurfaceWheel={onSurfaceWheel}
        onVAnchorDown={onVAnchorDown}
        onVHandleDown={onVHandleDown}
        onVAnchorDouble={onVAnchorDouble}
        beginStretch={beginStretch}
        moveStretch={moveStretch}
        endStretch={endStretch}
        beginRotateHandle={beginRotateHandle}
      />

      <div className={styles.bottomDock}>
        <div className={styles.status}>
          {hasIssues ? <span className={styles.warn}>This shape can’t be cut cleanly — fix the crossing</span> : null}
        </div>

        {/* the tool sheets render FROM the descriptors (state.tools) — the UI is a client, knows no tool */}
        {activeAdjust === 'adjust' && <ToolSheet tools={adjustTools} activeId={adjustActiveId} setActiveId={setAdjustActiveId} actions={toolActions} />}
        {activeAdjust === 'image' && <ToolSheet tools={imageTools} activeId={imageActiveId} setActiveId={setImageActiveId} actions={toolActions} />}
        {activeAdjust === 'shape' && pickerTool && <PickerSheet tool={pickerTool} actions={toolActions} />}

        {vshape && selVA !== null && (
          <div className={styles.nodeBar}>
            <button type="button" className={styles.nodeAction} onClick={onVAddAfter}><AddPointIcon /><span>Add point</span></button>
            <button type="button" className={styles.nodeAction} onClick={onVDelete}><DeleteIcon /><span>Delete point</span></button>
            <button type="button" className={styles.nodeAction} onClick={onVToggleCorner}><OutlineIcon /><span>{vshape.paths[0].anchors[selVA]?.corner ? 'Smooth' : 'Sharpen'}</span></button>
          </div>
        )}
        {vshape && selVA === null && selSeg !== null && showAnchors && (
          <div className={styles.nodeBar}>
            <button type="button" className={styles.nodeAction} onClick={() => {
              const v = vshapeRef.current
              if (!v || selSeg === null) return
              applyVec({ paths: [insertAnchorCentered(v.paths[0], selSeg), ...v.paths.slice(1)] })
              setSelVA(selSeg + 1)
              setSelSeg(null)
            }}><AddPointIcon /><span>Add point here</span></button>
          </div>
        )}

        <Dock inline>
          <DockTool icon={<ShapeIcon />} label="Shape" onClick={() => setActiveAdjust((a) => (a === 'shape' ? null : 'shape'))} active={activeAdjust === 'shape'} />
          {onMagic && <DockTool icon={<MagicIcon />} label="Magic" onClick={onMagic} />}
          <DockTool icon={<TuneIcon />} label="Adjust" onClick={() => setActiveAdjust('adjust')} active={activeAdjust === 'adjust'} />
        </Dock>
      </div>

      {confirmDiscard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Discard changes"
          onClick={() => actions.setConfirmDiscard(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(86vw, 320px)', borderRadius: 18, padding: '20px 20px 14px', background: 'var(--color-surface, #fbfbfd)', color: 'var(--color-text-primary, #1c2030)', boxShadow: '0 18px 60px rgba(0,0,0,0.35)', textAlign: 'center', font: '500 15px system-ui, -apple-system, sans-serif' }}
          >
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Discard changes?</div>
            <div style={{ opacity: 0.7, fontSize: 13.5, lineHeight: 1.4, marginBottom: 18 }}>This will undo every edit from this session.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => actions.setConfirmDiscard(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', font: '600 14px system-ui, sans-serif', background: 'rgba(120,124,140,0.16)', color: 'inherit' }}>Keep editing</button>
              <button type="button" onClick={() => actions.onCancel(true)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', font: '600 14px system-ui, sans-serif', background: '#e5484d', color: '#fff' }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
