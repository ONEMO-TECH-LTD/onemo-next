// editor/sheets — the three tool sheets (Run 2 · G6 decomposition, seam 5): Adjust · Image ·
// Shape, each a pure-props component over the SAME shared-ruler pattern (#35 Apple reference,
// Dan-approved surface — moved verbatim, zero behavior change). Per-tick preview only; commit on
// release (§6.3) is enforced by the handlers the parent passes in.
// Blueprint: v3/blueprint/modules/editor.md.

import { useRef } from 'react'
import type { Dispatch, SetStateAction, ChangeEvent, ReactNode } from 'react'
import { fairingFromDetail, type FairTracedRingOpts } from '@/lib/outline-core'
import TickBar from '../../ui/TickBar'
import { useOutlineStore, type ImageFx } from '../outlineStore'
import { PARAMETRIC, type ShapeKind } from '../shapes'
import { SHAPE_CHIPS, ShapeChipIcon, DEFAULT_SHAPE_PARAMS } from './chips'
import { RoundIcon, SmoothIcon, ScaleIcon, BlendIcon, TuneIcon, SnapIcon, MinLineIcon, AddPointIcon, AngleIcon, PositionIcon, BrightnessIcon, ContrastIcon, SaturationIcon, WarmthIcon, MinusIcon, PlusIcon, DiceIcon } from '../icons'
import styles from '../outline-editor.module.css'

export type AdjustSub = 'radius' | 'curve' | 'scale' | 'blend' | 'detail' | 'smooth' | 'snap' | 'line' | 'angle'

/** Chip carousel with mouse drag-to-scroll (KAI-8978/F6): touch scrolls natively, but a desktop
 *  mouse drag selected label text and the row's tail (… Upload) was unreachable. A drag past the
 *  tap threshold scrolls the row and swallows the trailing click so chips don't mis-fire. */
function ChipRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; left: number } | null>(null)
  const movedRef = useRef(false)
  return (
    <div
      ref={ref}
      className={styles.chipRow}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') return // touch scrolls natively
        dragRef.current = { x: e.clientX, left: ref.current?.scrollLeft ?? 0 }
        movedRef.current = false
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        const el = ref.current
        if (!d || !el) return
        const dx = e.clientX - d.x
        if (Math.abs(dx) > 4) movedRef.current = true
        if (movedRef.current) el.scrollLeft = d.left - dx
      }}
      onPointerUp={() => { dragRef.current = null }}
      onPointerLeave={() => { dragRef.current = null }}
      onClickCapture={(e) => {
        if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false }
      }}
    >
      {children}
    </div>
  )
}
export type ImageSub = 'position' | 'brightness' | 'contrast' | 'saturate' | 'warmth'

/* #35 ADJUST mode (Apple pattern): circular sub-tools — Radius · Curve · Scale · Blend +
   Tune's five dials when a Magic trace exists — sharing ONE ruler. */
export function AdjustSheet({ cornerMode, adjustSub, setAdjustSub, canTune, radiusApplies, maxRadius, radius, setRadius, commitRadius, smoothing, setSmoothing, commitSmoothing, scale, setScale, commitScale, blendOn, setBlendOn, blendBlur, setBlendBlur, writeBlend, detail, setDetail, previewTune, commitTune, fairParams }: {
  cornerMode: boolean
  adjustSub: AdjustSub
  /** tier-2 availability (Dan's rule: inapplicable tools GREY, never silent no-op): Radius acts on
   *  corner anchors — an all-curves shape (typical faired Magic cut) has none until one is selected
   *  or a corner is created. */
  radiusApplies: boolean
  setAdjustSub: (k: AdjustSub) => void
  canTune: boolean
  maxRadius: number
  radius: number
  setRadius: (v: number) => void
  commitRadius: (v: number) => void
  smoothing: number
  setSmoothing: (v: number) => void
  commitSmoothing: (v: number) => void
  scale: number
  setScale: (v: number) => void
  commitScale: (v: number) => void
  blendOn: boolean
  setBlendOn: Dispatch<SetStateAction<boolean>>
  blendBlur: number
  setBlendBlur: Dispatch<SetStateAction<number>>
  writeBlend: (on: boolean, pct: number) => void
  detail: number
  setDetail: (v: number) => void
  previewTune: (params: FairTracedRingOpts) => void
  commitTune: (params: FairTracedRingOpts, detailVal?: number) => void
  fairParams: FairTracedRingOpts
}) {
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {([
          { k: 'radius', label: cornerMode ? 'Corner' : 'Radius', icon: <RoundIcon />, show: true },
          { k: 'curve', label: 'Curve', icon: <SmoothIcon />, show: true },
          { k: 'scale', label: 'Scale', icon: <ScaleIcon />, show: true },
          { k: 'blend', label: 'Blend', icon: <BlendIcon />, show: true },
          { k: 'detail', label: 'Detail', icon: <TuneIcon />, show: canTune },
          { k: 'smooth', label: 'Smooth', icon: <SnapIcon />, show: canTune },
          { k: 'snap', label: 'Snap', icon: <MinLineIcon />, show: canTune },
          { k: 'line', label: 'Min line', icon: <AddPointIcon />, show: canTune },
          { k: 'angle', label: 'Angle', icon: <AngleIcon />, show: canTune },
        ] as const).filter((t) => t.show).map((t) => (
          <button
            key={t.k}
            type="button"
            className={`${styles.chip} ${adjustSub === t.k ? styles.chipActive : ''}`}
            onClick={() => setAdjustSub(t.k)}
            aria-pressed={adjustSub === t.k}
            aria-label={t.label}
          >
            <span className={styles.chipIcon}>{t.icon}</span>
            <span className={styles.chipLabel}>{t.label}</span>
          </button>
        ))}
      </ChipRow>
      <div className={styles.shapeControls}>
        <div className={styles.shapeRow}>
          {adjustSub === 'radius' && (radiusApplies || cornerMode ? (
            <TickBar label={cornerMode ? 'Corner' : 'Radius'} min={0} max={maxRadius} value={Math.min(radius, maxRadius)} onChange={setRadius} onCommit={commitRadius} format={(v) => `${Math.round((v / Math.max(maxRadius, 1)) * 100)}%`} />
          ) : (
            <div className={styles.toolHint}>Radius rounds corners — this shape is all curves. Select a corner point, or sharpen one first.</div>
          ))}
          {adjustSub === 'curve' && (
            <div className={styles.toolHint}>The Curve tool (bend a point, shape a segment) arrives with the new editor controls.</div>
          )}
          {adjustSub === 'scale' && (
            <TickBar label="Scale" min={50} max={150} value={scale} onChange={setScale} onCommit={commitScale} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'blend' && (
            <>
              <button
                type="button"
                className={`${styles.toggleBtn} ${blendOn ? styles.toggleBtnOn : ''}`}
                onClick={() => { const next = !blendOn; setBlendOn(next); writeBlend(next, blendBlur) }}
                aria-pressed={blendOn}
                aria-label="Toggle magic blend"
              >
                {blendOn ? 'On' : 'Off'}
              </button>
              <TickBar label="Blend" min={0} max={100} value={blendBlur} disabled={!blendOn} onChange={setBlendBlur} onCommit={(v) => { setBlendBlur(v); writeBlend(blendOn, v) }} format={(v) => `${Math.round(v)}%`} />
            </>
          )}
          {adjustSub === 'detail' && (
            <TickBar label="Detail" min={0} max={100} value={detail} onChange={(v) => { setDetail(v); previewTune(fairingFromDetail(v)) }} onCommit={(v) => { setDetail(v); commitTune(fairingFromDetail(v), v) }} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'smooth' && (
            <TickBar label="Smooth strength" min={1} max={30} step={0.5} value={fairParams.smoothPx ?? 6} onChange={(v) => previewTune({ ...fairParams, smoothPx: v })} onCommit={(v) => commitTune({ ...fairParams, smoothPx: v })} format={(v) => `${v.toFixed(1)}px`} />
          )}
          {adjustSub === 'snap' && (
            <TickBar label="Line snap band" min={0} max={20} step={0.5} value={fairParams.detailPx ?? 4} onChange={(v) => previewTune({ ...fairParams, detailPx: v })} onCommit={(v) => commitTune({ ...fairParams, detailPx: v })} format={(v) => `${v.toFixed(1)}px`} />
          )}
          {adjustSub === 'line' && (
            <TickBar label="Min line length" min={20} max={200} step={5} value={fairParams.minLinePx ?? 50} onChange={(v) => previewTune({ ...fairParams, minLinePx: v })} onCommit={(v) => commitTune({ ...fairParams, minLinePx: v })} format={(v) => `${Math.round(v)}px`} />
          )}
          {adjustSub === 'angle' && (
            <TickBar label="Sharpest angle" min={10} max={90} step={1} value={fairParams.maxTurnDeg ?? 35} onChange={(v) => previewTune({ ...fairParams, maxTurnDeg: v })} onCommit={(v) => commitTune({ ...fairParams, maxTurnDeg: v })} format={(v) => `${Math.round(v)}°`} />
          )}
        </div>
      </div>
    </div>
  )
}

/* #28 Image tool — Apple-pattern sheet: circular sub-icons, ONE shared ruler below.
   Position = pan/zoom the photo under the cutline; adjustments preview live (CSS filter)
   and bake into the print composite on release (same composeFront → print-faithful). */
export function ImageSheet({ imageSub, setImageSub, art, fxDraft, setFxDraft }: {
  imageSub: ImageSub
  setImageSub: (k: ImageSub) => void
  art: { scale: number }
  fxDraft: ImageFx
  setFxDraft: Dispatch<SetStateAction<ImageFx>>
}) {
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {([
          { k: 'position', label: 'Position', icon: <PositionIcon /> },
          { k: 'brightness', label: 'Bright', icon: <BrightnessIcon /> },
          { k: 'contrast', label: 'Contrast', icon: <ContrastIcon /> },
          { k: 'saturate', label: 'Color', icon: <SaturationIcon /> },
          { k: 'warmth', label: 'Warmth', icon: <WarmthIcon /> },
        ] as const).map((s) => (
          <button
            key={s.k}
            type="button"
            className={`${styles.chip} ${imageSub === s.k ? styles.chipActive : ''}`}
            onClick={() => setImageSub(s.k)}
            aria-pressed={imageSub === s.k}
            aria-label={s.label}
          >
            <span className={styles.chipIcon}>{s.icon}</span>
            <span className={styles.chipLabel}>{s.label}</span>
          </button>
        ))}
      </ChipRow>
      <div className={styles.shapeControls}>
        {imageSub === 'position' ? (
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Zoom</span>
            <TickBar
              label="Photo zoom" min={100} max={400} step={2}
              value={art.scale * 100}
              onChange={(v) => { const st = useOutlineStore.getState(); st.setArtwork({ ...st.artwork, scale: v / 100 }) }}
              onCommit={(v) => { const st = useOutlineStore.getState(); st.setArtwork({ ...st.artwork, scale: v / 100 }) }}
              format={(v) => `${Math.round(v)}%`}
            />
          </div>
        ) : (
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>
              {imageSub === 'brightness' ? 'Bright' : imageSub === 'contrast' ? 'Contrast' : imageSub === 'saturate' ? 'Color' : 'Warmth'}
            </span>
            <TickBar
              label={imageSub}
              min={imageSub === 'saturate' ? 0 : imageSub === 'warmth' ? 0 : 50}
              max={imageSub === 'saturate' ? 200 : imageSub === 'warmth' ? 100 : 150}
              step={1}
              value={fxDraft[imageSub]}
              onChange={(v) => setFxDraft((d) => ({ ...d, [imageSub]: v }))}
              onCommit={(v) => {
                const next = { ...fxDraft, [imageSub]: v }
                setFxDraft(next)
                useOutlineStore.getState().setImageFx(next) // bake → 3D + print recompose
              }}
              format={(v) => (imageSub === 'warmth' ? `${Math.round(v)}` : `${Math.round(v)}%`)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* Shape tool — Dan's board lineup + the form/blob generators; parametric kinds reveal controls */
export function ShapeSheet({ shapeKind, pickShape, shapeParams, nudgeParam, previewParam, commitShape, rerollBlob, onUploadShape }: {
  shapeKind: ShapeKind | null
  pickShape: (kind: ShapeKind) => void
  shapeParams: typeof DEFAULT_SHAPE_PARAMS
  nudgeParam: (key: 'sides' | 'points' | 'lobes' | 'petals' | 'blades', delta: number, min: number, max: number) => void
  previewParam: (key: 'spikiness' | 'pinch' | 'depth' | 'swirl' | 'waviness', v: number) => void
  commitShape: () => void
  rerollBlob: () => void
  onUploadShape: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {SHAPE_CHIPS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            className={`${styles.chip} ${shapeKind === kind ? styles.chipActive : ''}`}
            onClick={() => pickShape(kind)}
            aria-pressed={shapeKind === kind}
            aria-label={label}
          >
            <span className={styles.chipIcon}><ShapeChipIcon kind={kind} /></span>
            <span className={styles.chipLabel}>{label}</span>
          </button>
        ))}
        {/* Run 8 + 10 — ONE upload entry (Dan's "pre made in figma or downloaded" + "image
            shapes vectorised under the hood"); rides the existing chip pattern, no new chrome */}
        <label className={styles.chip} aria-label="Upload a shape (SVG or image)">
          <span className={styles.chipIcon}><PlusIcon /></span>
          <span className={styles.chipLabel}>Upload</span>
          <input type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onUploadShape} />
        </label>
      </ChipRow>
      {shapeKind && PARAMETRIC[shapeKind] && (
        <div className={styles.shapeControls}>
          {shapeKind === 'polygon' && (
            <div className={styles.shapeRow}>
              <span className={styles.shapeName}>Sides</span>
              <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('sides', -1, 3, 12)} aria-label="Fewer sides"><MinusIcon /></button>
              <span className={styles.shapeVal}>{shapeParams.sides}</span>
              <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('sides', 1, 3, 12)} aria-label="More sides"><PlusIcon /></button>
            </div>
          )}
          {shapeKind === 'star' && (
            <>
              <div className={styles.shapeRow}>
                <span className={styles.shapeName}>Points</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('points', -1, 3, 12)} aria-label="Fewer points"><MinusIcon /></button>
                <span className={styles.shapeVal}>{shapeParams.points}</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('points', 1, 3, 12)} aria-label="More points"><PlusIcon /></button>
              </div>
              <div className={styles.shapeRow}>
                <TickBar label="Spike" min={5} max={95} value={shapeParams.spikiness} onChange={(v) => previewParam('spikiness', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
              </div>
            </>
          )}
          {shapeKind === 'daisy' && (
            <>
              <div className={styles.shapeRow}>
                <span className={styles.shapeName}>Petals</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('petals', -1, 5, 12)} aria-label="Fewer petals"><MinusIcon /></button>
                <span className={styles.shapeVal}>{shapeParams.petals}</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('petals', 1, 5, 12)} aria-label="More petals"><PlusIcon /></button>
              </div>
              <div className={styles.shapeRow}>
                <TickBar label="Depth" min={0} max={100} value={shapeParams.depth} onChange={(v) => previewParam('depth', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
              </div>
            </>
          )}
          {shapeKind === 'pinwheel' && (
            <>
              <div className={styles.shapeRow}>
                <span className={styles.shapeName}>Blades</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('blades', -1, 3, 8)} aria-label="Fewer blades"><MinusIcon /></button>
                <span className={styles.shapeVal}>{shapeParams.blades}</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('blades', 1, 3, 8)} aria-label="More blades"><PlusIcon /></button>
              </div>
              <div className={styles.shapeRow}>
                <TickBar label="Swirl" min={0} max={100} value={shapeParams.swirl} onChange={(v) => previewParam('swirl', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
              </div>
            </>
          )}
          {shapeKind === 'form' && (
            <>
              <div className={styles.shapeRow}>
                <span className={styles.shapeName}>Lobes</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('lobes', -1, 1, 8)} aria-label="Fewer lobes"><MinusIcon /></button>
                <span className={styles.shapeVal}>{shapeParams.lobes}</span>
                <button type="button" className={styles.stepBtn} onClick={() => nudgeParam('lobes', 1, 1, 8)} aria-label="More lobes"><PlusIcon /></button>
              </div>
              <div className={styles.shapeRow}>
                <TickBar label="Pinch" min={0} max={100} value={shapeParams.pinch} onChange={(v) => previewParam('pinch', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
              </div>
            </>
          )}
          {shapeKind === 'blob' && (
            <>
              <div className={styles.shapeRow}>
                <TickBar label="Wavy" min={0} max={100} value={shapeParams.waviness} onChange={(v) => previewParam('waviness', v)} onCommit={() => commitShape()} format={(v) => `${Math.round(v)}%`} />
              </div>
              <div className={styles.shapeRow}>
                <button type="button" className={styles.nodeAction} onClick={rerollBlob}>
                  <DiceIcon /><span>New blob</span>
                </button>
              </div>
            </>
          )}
          <div className={styles.shapeHint}>Rotate: twist with two fingers, or drag the handle after selecting all corners</div>
        </div>
      )}
    </div>
  )
}
