'use client'

// editor/EditorCanvas.tsx — RENDER OVERLAY (R8 — Creator v5 monolith split, seam 4).
//
// The SVG canvas that renders THE vector truth over the flat cut-out image: the photo (with live
// magic-blend + image-fx + pan/zoom preview), the scrim, the true-curve path, the on-demand anchor
// skeleton + Bézier handles, the rotate handle, the frame lock chip, and the crop stretch grips. It is
// PURELY PRESENTATIONAL: every input is a prop (the display VShape, the view, the flags, and the
// gesture handlers from useEditorGestures). It writes NO store and derives NO second geometry truth —
// all the live-transform / crop-box / filter strings are pure derivations of its props. Swap-test:
// replace this component, the editor renders the same pixels from the same props.

import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { VShape } from '@/lib/vector-core'
import type { Vec2Px } from '@/lib/outline-core/math'
import type { CanvasView } from './useCanvasView'
import type { GripId } from './geometry'
import type { ImageFx } from '../outlineStore'
import type { DesignState } from '../../types'
import styles from '../outline-editor.module.css'

type BBox = { minX: number; minY: number; maxX: number; maxY: number }

// Rotate glyph (Phosphor ArrowClockwise, 256-box) drawn inside the rotate handle — white on the brand grip.
const ROTATE_GLYPH_D = 'M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z'

interface EditorCanvasProps { // KAI-9066: module-internal (the consumer passes props structurally; no external import)
  svgRef: { readonly current: SVGSVGElement | null }
  view: CanvasView
  imgW: number
  imgH: number
  imageUrl?: string
  subjMatteUrl: string | null
  art: DesignState
  fxDraft: ImageFx
  blendBlur: number
  vshape: VShape | null
  vDisplay: VShape | null
  pathD: string
  hitRing: Vec2Px[]
  hitBBox: BBox
  hasIssues: boolean
  nodeR: number
  preview: boolean
  showAnchors: boolean
  selVA: number | null
  allSelected: boolean
  frameLocked: boolean
  rotateLive: { deg: number; cx: number; cy: number } | null
  moveLive: { dx: number; dy: number } | null
  stretchLive: { sx: number; sy: number; ax: number; ay: number } | null
  shapePreview: string | null
  nodeInteractedRef: { current: boolean }
  setFrameLocked: Dispatch<SetStateAction<boolean>>
  // gesture handlers (from useEditorGestures)
  onSurfacePointerDown: (e: ReactPointerEvent) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onSurfaceClick: (e: ReactMouseEvent) => void
  onSurfaceWheel: (e: ReactWheelEvent) => void
  onVAnchorDown: (i: number) => (e: ReactPointerEvent) => void
  onVHandleDown: (i: number, kind: 'hIn' | 'hOut') => (e: ReactPointerEvent) => void
  onVAnchorDouble: (i: number) => (e: ReactMouseEvent) => void
  beginStretch: (which: GripId) => (e: ReactPointerEvent) => void
  moveStretch: (e: ReactPointerEvent) => void
  endStretch: () => void
  beginRotateHandle: (e: ReactPointerEvent) => void
}

export function EditorCanvas(props: EditorCanvasProps) {
  const {
    svgRef, view, imgW, imgH, imageUrl, subjMatteUrl, art, fxDraft, blendBlur,
    vshape, vDisplay, pathD, hitRing, hitBBox, hasIssues, nodeR,
    preview, showAnchors, selVA, allSelected, frameLocked, rotateLive, moveLive, stretchLive, shapePreview,
    nodeInteractedRef, setFrameLocked,
    onSurfacePointerDown, onPointerMove, onPointerUp, onSurfaceClick, onSurfaceWheel,
    onVAnchorDown, onVHandleDown, onVAnchorDouble, beginStretch, moveStretch, endStretch, beginRotateHandle,
  } = props

  // Rotate handle — a grip on a short stem off the outline, shown when all anchors are selected.
  // SAFE-AREA (Pixel QA REWORK): the TopBar + bottom dock float over a full-bleed canvas, so a handle
  // placed above an outline whose top sits near the viewBox top renders UNDER the top chrome and can't
  // be grabbed (repro: stretch a tall outline upward, then select-all). Prefer ABOVE; if there's no
  // chrome-safe room above, FLIP below the outline; always clamp the grip inside the visible viewBox so
  // it never hides under the top bar or the bottom dock. Rotation is about the bbox centre regardless.
  let rotHandle: { bx: number; by: number; hy: number } | null = null
  if (allSelected && !preview && hitRing.length) {
    const bx = (hitBBox.minX + hitBBox.maxX) / 2
    const vbTop = view.vy
    const vbH = imgH / view.scale
    const guard = Math.max(nodeR * 6, vbH * 0.08) // chrome-safe inset at top/bottom of the visible canvas
    const aboveHy = hitBBox.minY - nodeR * 4
    if (aboveHy >= vbTop + guard) {
      rotHandle = { bx, by: hitBBox.minY, hy: aboveHy } // room above the outline — default
    } else {
      // tall/stretched outline near the top: flip the handle below, clamped above the bottom dock
      const belowHy = Math.min(hitBBox.maxY + nodeR * 4, vbTop + vbH - guard)
      rotHandle = { bx, by: hitBBox.maxY, hy: belowHy }
    }
  }
  // live direct-manipulation transform on the outline group (stretch / rotate / move) — real-time, no doc rebuild
  const liveXform = stretchLive
    ? `translate(${stretchLive.ax} ${stretchLive.ay}) scale(${stretchLive.sx} ${stretchLive.sy}) translate(${-stretchLive.ax} ${-stretchLive.ay})`
    : rotateLive ? `rotate(${rotateLive.deg} ${rotateLive.cx} ${rotateLive.cy})` : moveLive ? `translate(${moveLive.dx} ${moveLive.dy})` : undefined
  // Crop grips (Dan: iOS-crop reference) — boxy shapes only; grips track the bbox, including the
  // live stretch (rendered OUTSIDE the transformed group so the pill strokes never distort).
  // 6.1: FRAME is the default for EVERY shape (Magic, committed, presets) — grips visible unless
  // Points is active, Preview hides chrome, or a transient morph is mid-flight
  const cropMode = !!vshape && !showAnchors && !preview && !shapePreview
  let cropBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  if (cropMode && hitRing.length) {
    let { minX, minY, maxX, maxY } = hitBBox
    if (stretchLive) {
      const m = (v: number, a: number, s: number) => a + (v - a) * s
      minX = m(minX, stretchLive.ax, stretchLive.sx); maxX = m(maxX, stretchLive.ax, stretchLive.sx)
      minY = m(minY, stretchLive.ay, stretchLive.sy); maxY = m(maxY, stretchLive.ay, stretchLive.sy)
    }
    cropBox = { minX, minY, maxX, maxY }
  }
  // #28: photo pan/zoom preview — mirrors the 3D texture mapping (x = s·X − W(s−1)/2 − ox·W)
  const artXform = art.scale !== 1 || art.offsetX !== 0 || art.offsetY !== 0
    ? `translate(${(-imgW * (art.scale - 1)) / 2 - art.offsetX * imgW} ${(-imgH * (art.scale - 1)) / 2 + art.offsetY * imgH}) scale(${art.scale})`
    : undefined
  const fxFilter = fxDraft.brightness !== 100 || fxDraft.contrast !== 100 || fxDraft.saturate !== 100 || fxDraft.warmth > 0
    ? `brightness(${fxDraft.brightness}%) contrast(${fxDraft.contrast}%) saturate(${fxDraft.saturate}%)${fxDraft.warmth > 0 ? ` sepia(${Math.round(fxDraft.warmth * 0.45)}%)` : ''}`
    : undefined
  // magic-blend live preview in the canvas: blurred photo + sharp subject overlay; blur reacts to intensity
  const showBlend = blendBlur > 0 && !!subjMatteUrl && !!imageUrl // 0 = off (the ruler IS the switch)
  const blendSd = (blendBlur / 100) * (imgW / 25)

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${view.vx} ${view.vy} ${imgW / view.scale} ${imgH / view.scale}`}
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onSurfaceClick}
        onWheel={onSurfaceWheel}
      >
        <defs>
          <filter id="kaiBgBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={blendSd} />
          </filter>
          {/* #24: Preview clips the photo to the cut outline — the final cut-out, no periphery */}
          {preview && pathD && <clipPath id="kaiCutPreview"><path d={pathD} /></clipPath>}
        </defs>
        <g clipPath={preview && pathD ? 'url(#kaiCutPreview)' : undefined}>
        <g transform={artXform} style={fxFilter ? { filter: fxFilter } : undefined}>
        {imageUrl && (showBlend ? (
          // magic blend: blurred full photo + the sharp BEN subject (matte is y-up → flip to editor y-down)
          <>
            <image href={imageUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" filter="url(#kaiBgBlur)" />
            <image href={subjMatteUrl!} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" transform={`translate(0 ${imgH}) scale(1 -1)`} />
          </>
        ) : (
          <image href={imageUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />
        ))}
        </g>
        </g>
        {(
          <>
            {/* scrim dims outside the cut; hidden during a live transform (its hole would lag the move/rotate) */}
            {imageUrl && pathD && !preview && !rotateLive && !moveLive && !stretchLive && (
              <path className={styles.scrim} fillRule="evenodd" d={`M0 0H${imgW}V${imgH}H0Z ${pathD}`} />
            )}
            <g transform={liveXform}>
              {!preview && <path className={`${styles.path} ${hasIssues ? styles.pathError : ''}`} d={pathD} />}
              {/* anchors hidden in Preview (clean result); point work is vector-native below */}
              {/* Run 6 — the vector skeleton: minimal intentional anchors, summoned on demand.
                  The selected anchor reveals its Bézier handles; drags are transient until release. */}
              {!preview && showAnchors && vDisplay && (() => {
                const anchors = vDisplay.paths[0].anchors
                const sel = selVA !== null ? anchors[selVA] : null
                return (
                  <g>
                    {sel && (['hIn', 'hOut'] as const).map((k) => {
                      const h = sel[k]
                      if (!h) return null
                      return (
                        <g key={k}>
                          <line className={styles.rotateStem} x1={sel.p.x} y1={sel.p.y} x2={h.x} y2={h.y} />
                          <circle
                            className={`${styles.node} ${styles.nodeActive}`}
                            cx={h.x} cy={h.y} r={nodeR * 0.62}
                            onPointerDown={onVHandleDown(selVA!, k)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </g>
                      )
                    })}
                    {anchors.map((a, i) => (
                      <circle
                        key={`va${i}`}
                        className={`${styles.node} ${selVA === i ? styles.nodeSelected : ''}`}
                        cx={a.p.x} cy={a.p.y} r={nodeR}
                        onPointerDown={onVAnchorDown(i)}
                        onDoubleClick={onVAnchorDouble(i)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                  </g>
                )
              })()}
              {/* KAI-9014: the twist handle rides ALL-SELECTED in ANY view — Dan tap-selects in
                  frame mode (the default); the old showAnchors gate hid it there */}
              {!preview && rotHandle && (
                <g>
                  <line className={styles.rotateStem} x1={rotHandle.bx} y1={rotHandle.by} x2={rotHandle.bx} y2={rotHandle.hy} />
                  {/* grip is larger than the anchors and carries a rotate glyph */}
                  <circle className={styles.rotateHandle} cx={rotHandle.bx} cy={rotHandle.hy} r={nodeR * 1.7} onPointerDown={beginRotateHandle} onClick={(e) => e.stopPropagation()} />
                  <g transform={`translate(${rotHandle.bx} ${rotHandle.hy}) scale(${nodeR * 0.0095}) translate(-128 -128)`} style={{ pointerEvents: 'none' }}>
                    <path d={ROTATE_GLYPH_D} fill="#fff" />
                  </g>
                </g>
              )}
            </g>
            {/* 6.3: the padlock chip rides the frame — corner pulls SCALE locked / DEFORM unlocked */}
            {!preview && cropBox && !rotateLive && !moveLive && !stretchLive && (
              <g
                transform={`translate(${cropBox.maxX + nodeR * 1.6} ${cropBox.minY - nodeR * 1.6})`}
                onPointerDown={(e) => { e.stopPropagation(); nodeInteractedRef.current = true }}
                onClick={(e) => { e.stopPropagation(); setFrameLocked((v) => !v) }}
                style={{ cursor: 'pointer' }}
                aria-label={frameLocked ? 'Frame locked — corner pull scales' : 'Frame unlocked — corner pull deforms'}
              >
                <circle className={styles.lockChip} r={nodeR * 1.5} />
                <g transform={`scale(${nodeR * 0.09}) translate(-8 -9)`} style={{ pointerEvents: 'none' }}>
                  {/* padlock: body + shackle (open when unlocked) */}
                  <rect x={3} y={8} width={10} height={8} rx={1.6} fill="#fff" />
                  <path d={frameLocked ? 'M5 8 V5.6 A3 3 0 0 1 11 5.6 V8' : 'M5 8 V5.6 A3 3 0 0 1 11 5.6'} fill="none" stroke="#fff" strokeWidth={1.8} />
                </g>
              </g>
            )}
            {/* Crop-style stretch grips — OUTSIDE the live-transform group (the pill strokes must
                never distort); positions track cropBox, which already includes the live stretch. */}
            {!preview && cropBox && !rotateLive && !moveLive && (() => {
              const { minX, minY, maxX, maxY } = cropBox
              const mx = (minX + maxX) / 2, my = (minY + maxY) / 2
              // Apple-crop proportions (Dan's reference): delicate thin strokes, modest arms —
              // the HIT area below keeps the full touch target.
              const arm = Math.min(nodeR * 2.1, (maxX - minX) * 0.18, (maxY - minY) * 0.18)
              const lenH = Math.min(nodeR * 2.4, (maxX - minX) * 0.22)
              const lenV = Math.min(nodeR * 2.4, (maxY - minY) * 0.22)
              const grips: { id: GripId; d: string; cursor: string }[] = [
                { id: 'n', d: `M ${mx - lenH / 2} ${minY} L ${mx + lenH / 2} ${minY}`, cursor: 'ns-resize' },
                { id: 's', d: `M ${mx - lenH / 2} ${maxY} L ${mx + lenH / 2} ${maxY}`, cursor: 'ns-resize' },
                { id: 'w', d: `M ${minX} ${my - lenV / 2} L ${minX} ${my + lenV / 2}`, cursor: 'ew-resize' },
                { id: 'e', d: `M ${maxX} ${my - lenV / 2} L ${maxX} ${my + lenV / 2}`, cursor: 'ew-resize' },
                { id: 'nw', d: `M ${minX + arm} ${minY} L ${minX} ${minY} L ${minX} ${minY + arm}`, cursor: 'nwse-resize' },
                { id: 'ne', d: `M ${maxX - arm} ${minY} L ${maxX} ${minY} L ${maxX} ${minY + arm}`, cursor: 'nesw-resize' },
                { id: 'sw', d: `M ${minX + arm} ${maxY} L ${minX} ${maxY} L ${minX} ${maxY - arm}`, cursor: 'nesw-resize' },
                { id: 'se', d: `M ${maxX - arm} ${maxY} L ${maxX} ${maxY} L ${maxX} ${maxY - arm}`, cursor: 'nwse-resize' },
              ]
              return (
                <g>
                  {grips.map((g) => (
                    <g key={g.id}>
                      {/* Dan 2026-06-17: no backing stroke (gripUnder removed); grip 50% slimmer */}
                      <path className={styles.grip} d={g.d} strokeWidth={nodeR * 0.275} />
                      <path
                        className={styles.gripHit}
                        d={g.d}
                        strokeWidth={nodeR * 3.4}
                        style={{ cursor: g.cursor }}
                        onPointerDown={beginStretch(g.id)}
                        onPointerMove={moveStretch}
                        onPointerUp={endStretch}
                        onPointerCancel={endStretch}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    </g>
                  ))}
                </g>
              )
            })()}
          </>
        )}
      </svg>
    </div>
  )
}
