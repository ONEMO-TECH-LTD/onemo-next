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
import { RoundIcon, SmoothIcon, BlendIcon, BrightnessIcon, ContrastIcon, SaturationIcon, WarmthIcon, MinusIcon, PlusIcon, DiceIcon, MagicIcon, CornerIcon, DetailIcon, SnapIcon, AngleIcon, LineIcon } from '../icons'

// KAI-9033 (v1 recovery): Smooth is the whole-shape SHARP⇄ROUND dial — 0% ≈ the raw trace
// (sharp/angular, v1's 'straighten' end), 100% = maximally round. Angle/Line expose the corner
// and straight-run thresholds on the same 0–100 product scale (KAI-9028: no engine units).
export const smoothPctToPx = (v: number) => 0.5 + (v / 100) * 23.5
export const smoothPxToPct = (px: number) => Math.max(0, Math.min(100, ((px - 0.5) / 23.5) * 100))
export const anglePctToDeg = (v: number) => 15 + (v / 100) * 70
export const angleDegToPct = (deg: number) => Math.max(0, Math.min(100, ((deg - 15) / 70) * 100))
export const linePctToPx = (v: number) => (v / 100) * 80
export const linePxToPct = (px: number) => Math.max(0, Math.min(100, (px / 80) * 100))
export const snapPctToPx = (v: number) => (v / 100) * 20
export const snapPxToPct = (px: number) => Math.max(0, Math.min(100, (px / 20) * 100))

import styles from '../outline-editor.module.css'

export type AdjustSub = 'radius' | 'curve' | 'detail' | 'smooth' | 'snap' | 'angle' | 'line'

/** UX-1 progress ring — an arc around a tool circle showing its current value; nothing at zero. */
function ChipRing({ frac }: { frac: number }) {
  const f = Math.max(0, Math.min(1, frac))
  if (f <= 0.005) return null
  const R = 15, C = 2 * Math.PI * R
  return (
    <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden style={{ position: 'absolute', inset: '-5px 0 0 -5px', pointerEvents: 'none' }}>
      <circle cx={17} cy={17} r={R} fill="none" stroke="var(--semantic-bg-brand-solid, #2563eb)" strokeOpacity={0.85}
        strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * f} ${C * (1 - f)}`} transform="rotate(-90 17 17)" />
    </svg>
  )
}

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
export type ImageSub = 'brightness' | 'contrast' | 'saturate' | 'warmth' | 'blend'

/* ADJUST mode (plan A2, Dan's rulings): THREE circles — Radius · Curve · Tune ✦ — one shared
   ruler. Scale is DELETED (the frame owns it, D5); Blend moved to Image mode (#8). Curve is the
   REAL bend tool (tension on the selected anchor, D3); Tune ✦ is the universal fine-tune takeover
   (Detail · Smooth · Snap — Angle/Min-line dropped, D3 round 2) available on EVERY shape class. */
export function AdjustSheet({ cornerMode, adjustSub, setAdjustSub, radiusApplies, maxRadius, radius, setRadius, commitRadius, curveSelected, curveVal, previewCurve, commitCurve, detail, setDetail, previewTune, commitTune, fairParams }: {
  cornerMode: boolean
  adjustSub: AdjustSub
  setAdjustSub: (k: AdjustSub) => void
  /** tier-2 availability (Dan's rule: inapplicable tools GREY, never silent no-op) */
  radiusApplies: boolean
  maxRadius: number
  radius: number
  setRadius: (v: number) => void
  commitRadius: (v: number) => void
  /** Curve acts on the SELECTED anchor (tap one in Points) */
  curveSelected: boolean
  curveVal: number
  previewCurve: (v: number) => void
  commitCurve: (v: number) => void
  detail: number
  setDetail: (v: number) => void
  previewTune: (params: FairTracedRingOpts) => void
  commitTune: (params: FairTracedRingOpts, detailVal?: number) => void
  fairParams: FairTracedRingOpts
}) {
  // KAI-9017/9016 (Dan): the FULL vector toolset as icon chips in ONE row — no Tune ✦ submenu.
  // Angle + Line are RESTORED (his 2026-06-12 pin supersedes the earlier drop ruling). Every
  // fairing dial works on every shape class (D3) — in place, per the shape's lineage (KAI-9032).
  const dials = [
    { k: 'radius' as const, label: cornerMode ? 'Corner' : 'Radius', icon: <CornerIcon />, ring: radiusApplies ? radius / Math.max(maxRadius, 1) : 0 },
    { k: 'curve' as const, label: 'Curve', icon: <RoundIcon />, ring: 0 }, // BezierCurve glyph = the bend tool
    { k: 'detail' as const, label: 'Detail', icon: <DetailIcon />, ring: detail / 100 },
    { k: 'smooth' as const, label: 'Smooth', icon: <SmoothIcon />, ring: smoothPxToPct(fairParams.smoothPx ?? 6) / 100 },
    { k: 'snap' as const, label: 'Snap', icon: <SnapIcon />, ring: snapPxToPct(fairParams.detailPx ?? 4) / 100 },
    { k: 'angle' as const, label: 'Angle', icon: <AngleIcon />, ring: angleDegToPct(fairParams.maxTurnDeg ?? 35) / 100 },
    { k: 'line' as const, label: 'Line', icon: <LineIcon />, ring: linePxToPct(fairParams.minLinePx ?? 50) / 100 },
  ]
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {dials.map((t) => (
          <button
            key={t.k}
            type="button"
            className={`${styles.chip} ${adjustSub === t.k ? styles.chipActive : ''}`}
            onClick={() => setAdjustSub(t.k)}
            aria-pressed={adjustSub === t.k}
            aria-label={t.label}
          >
            <span className={styles.chipIcon} style={{ position: 'relative' }}>{t.icon}<ChipRing frac={t.ring} /></span>
            <span className={styles.chipLabel}>{t.label}</span>
          </button>
        ))}
      </ChipRow>
      <div className={styles.shapeControls}>
        <div className={styles.shapeRow}>
          {/* KAI-9019 + Dan's rulings: no helper text, no empty slot — an inapplicable tool shows
              its ruler GREYED and non-functional until the state makes it real */}
          {adjustSub === 'radius' && (radiusApplies || cornerMode ? (
            <TickBar label={cornerMode ? 'Corner' : 'Radius'} min={0} max={maxRadius} value={Math.min(radius, maxRadius)} onChange={setRadius} onCommit={commitRadius} format={(v) => `${Math.round((v / Math.max(maxRadius, 1)) * 100)}%`} />
          ) : (
            <div className={styles.disabledControl} aria-disabled="true">
              <TickBar label="Radius" min={0} max={100} value={0} onChange={() => {}} onCommit={() => {}} format={(v) => `${Math.round(v)}%`} />
            </div>
          ))}
          {adjustSub === 'curve' && (curveSelected ? (
            <TickBar label="Curve" min={0} max={100} value={curveVal} onChange={previewCurve} onCommit={commitCurve} format={(v) => `${Math.round(v * 2)}%`} />
          ) : (
            <div className={styles.disabledControl} aria-disabled="true">
              <TickBar label="Curve" min={0} max={100} value={50} onChange={() => {}} onCommit={() => {}} format={(v) => `${Math.round(v * 2)}%`} />
            </div>
          ))}
          {adjustSub === 'detail' && (
            <TickBar label="Detail" min={0} max={100} value={detail} onChange={(v) => { setDetail(v); previewTune(fairingFromDetail(v)) }} onCommit={(v) => { setDetail(v); commitTune(fairingFromDetail(v), v) }} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'smooth' && (
            <TickBar label="Smooth" min={0} max={100} value={smoothPxToPct(fairParams.smoothPx ?? 6)} onChange={(v) => previewTune({ ...fairParams, smoothPx: smoothPctToPx(v) })} onCommit={(v) => commitTune({ ...fairParams, smoothPx: smoothPctToPx(v) })} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'snap' && (
            <TickBar label="Snap" min={0} max={100} value={snapPxToPct(fairParams.detailPx ?? 4)} onChange={(v) => previewTune({ ...fairParams, detailPx: snapPctToPx(v) })} onCommit={(v) => commitTune({ ...fairParams, detailPx: snapPctToPx(v) })} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'angle' && (
            <TickBar label="Angle" min={0} max={100} value={angleDegToPct(fairParams.maxTurnDeg ?? 35)} onChange={(v) => previewTune({ ...fairParams, maxTurnDeg: anglePctToDeg(v) })} onCommit={(v) => commitTune({ ...fairParams, maxTurnDeg: anglePctToDeg(v) })} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'line' && (
            <TickBar label="Line" min={0} max={100} value={linePxToPct(fairParams.minLinePx ?? 50)} onChange={(v) => previewTune({ ...fairParams, minLinePx: linePctToPx(v) })} onCommit={(v) => commitTune({ ...fairParams, minLinePx: linePctToPx(v) })} format={(v) => `${Math.round(v)}%`} />
          )}
        </div>
      </div>
    </div>
  )
}

export function ImageSheet({ imageSub, setImageSub, fxDraft, setFxDraft, blendBlur, setBlendBlur, writeBlend }: {
  imageSub: ImageSub
  setImageSub: (k: ImageSub) => void
  fxDraft: ImageFx
  setFxDraft: Dispatch<SetStateAction<ImageFx>>
  /** Blend (#8 — moved here from Adjust): ruler-from-0 IS the on/off switch, no toggle */
  blendBlur: number
  setBlendBlur: Dispatch<SetStateAction<number>>
  writeBlend: (on: boolean, pct: number) => void
}) {
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {([
          { k: 'brightness', label: 'Bright', icon: <BrightnessIcon />, ring: Math.abs(fxDraft.brightness - 100) / 50 },
          { k: 'contrast', label: 'Contrast', icon: <ContrastIcon />, ring: Math.abs(fxDraft.contrast - 100) / 50 },
          { k: 'saturate', label: 'Color', icon: <SaturationIcon />, ring: Math.abs(fxDraft.saturate - 100) / 100 },
          { k: 'warmth', label: 'Warmth', icon: <WarmthIcon />, ring: fxDraft.warmth / 100 },
          { k: 'blend', label: 'Blend', icon: <BlendIcon />, ring: blendBlur / 100 },
        ] as const).map((s) => (
          <button
            key={s.k}
            type="button"
            className={`${styles.chip} ${imageSub === s.k ? styles.chipActive : ''}`}
            onClick={() => setImageSub(s.k)}
            aria-pressed={imageSub === s.k}
            aria-label={s.label}
          >
            <span className={styles.chipIcon} style={{ position: 'relative' }}>{s.icon}<ChipRing frac={s.ring} /></span>
            <span className={styles.chipLabel}>{s.label}</span>
          </button>
        ))}
      </ChipRow>
      {/* Position is a DIRECT GESTURE (plan A2): drag the photo inside the outline, scroll/pinch
          to zoom — the Position button died with the old crop-tool pattern. */}
      <div className={styles.shapeControls}>
        {imageSub === 'blend' ? (
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>Blend</span>
            <TickBar
              label="Blend" min={0} max={100} step={1}
              value={blendBlur}
              onChange={(v) => setBlendBlur(v)}
              onCommit={(v) => { setBlendBlur(v); writeBlend(v > 0, v) }}
              format={(v) => (v === 0 ? 'off' : `${Math.round(v)}%`)}
            />
          </div>
        ) : (
          <div className={styles.shapeRow}>
            <span className={styles.shapeName}>
              {imageSub === 'brightness' ? 'Bright' : imageSub === 'contrast' ? 'Contrast' : imageSub === 'saturate' ? 'Color' : 'Warmth'}
              {/* the photo itself: drag to position · scroll to zoom (gesture, not a control) */}
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
export function ShapeSheet({ shapeKind, pickShape, shapeParams, nudgeParam, previewParam, commitShape, rerollBlob, onUploadShape, onMagic }: {
  shapeKind: ShapeKind | null
  pickShape: (kind: ShapeKind) => void
  shapeParams: typeof DEFAULT_SHAPE_PARAMS
  nudgeParam: (key: 'sides' | 'points' | 'lobes' | 'petals' | 'blades', delta: number, min: number, max: number) => void
  previewParam: (key: 'spikiness' | 'pinch' | 'depth' | 'swirl' | 'waviness', v: number) => void
  commitShape: () => void
  rerollBlob: () => void
  onUploadShape: (e: ChangeEvent<HTMLInputElement>) => void
  /** Magic ✦ trail chip (D7): the auto-cut as a shape SOURCE — same pipeline as the hero door */
  onMagic?: () => void
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
        {onMagic && (
          <button type="button" className={`${styles.chip} ${styles.chipMagic}`} onClick={onMagic} aria-label="Magic auto cut">
            <span className={styles.chipIcon}><MagicIcon /></span>
            <span className={styles.chipLabel}>Magic ✦</span>
          </button>
        )}
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
