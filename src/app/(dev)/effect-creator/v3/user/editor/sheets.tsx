// editor/sheets — the three tool sheets (Run 2 · G6 decomposition, seam 5): Adjust · Image ·
// Shape, each a pure-props component over the SAME shared-ruler pattern (#35 Apple reference,
// Dan-approved surface — moved verbatim, zero behavior change). Per-tick preview only; commit on
// release (§6.3) is enforced by the handlers the parent passes in.
// Blueprint: v3/blueprint/modules/editor.md.

import { useRef } from 'react'
import type { Dispatch, SetStateAction, ChangeEvent, ReactNode } from 'react'
import type { GlobalAdjustments } from '@/lib/effect/outline-resolve'
import TickBar from '../../ui/TickBar'
import { useOutlineStore, type ImageFx } from '../outlineStore'
import { PARAMETRIC, type ShapeKind } from '../shapes'
import { SHAPE_CHIPS, ShapeChipIcon, DEFAULT_SHAPE_PARAMS } from './chips'
import { RoundIcon, SmoothIcon, BrightnessIcon, ContrastIcon, SaturationIcon, WarmthIcon, MinusIcon, PlusIcon, DiceIcon, BlurIcon, CornerIcon, DetailIcon, SnapIcon, AngleIcon, LineIcon } from '../icons'

// V4: the global Adjust dials are plain 0..100 PRODUCT axes written straight to adjustments.global —
// the engine (resolve / outline-resolve.ts) owns the pct→engine-unit maps, so there are NO engine
// units in the UI (KAI-9028). Detail 100 = full detail (OFF); Smooth/Snap/Angle/Line 0 = OFF.

// KAI-9028 (Dan): every image filter shows ONE uniform 0–100% scale — 0% = the extreme/none end,
// 100% = full to the limit — regardless of the engine range underneath.
const FX_RANGE = { brightness: [50, 150], contrast: [50, 150], saturate: [0, 200], warmth: [0, 100] } as const
type FxKey = keyof typeof FX_RANGE
export const fxToPct = (k: FxKey, v: number) => {
  const [lo, hi] = FX_RANGE[k]
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
}
export const fxFromPct = (k: FxKey, pct: number) => {
  const [lo, hi] = FX_RANGE[k]
  return lo + (pct / 100) * (hi - lo)
}

import styles from '../outline-editor.module.css'

export type AdjustSub = 'radius' | 'curve' | 'detail' | 'smooth' | 'snap' | 'angle' | 'line'

/** UX-1 progress ring — an arc around a tool circle showing its current value; nothing at zero. */
function ChipRing({ frac }: { frac: number }) {
  const f = Math.max(0, Math.min(1, frac))
  if (f <= 0.005) return null
  // KAI-9018 (Dan): Apple-like AIR between glyph and ring (24px icon inside a 44px circle),
  // neutral ink — no blue anywhere on indicators.
  const R = 20, C = 2 * Math.PI * R
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden style={{ position: 'absolute', inset: '-10px 0 0 -10px', pointerEvents: 'none' }}>
      <circle cx={22} cy={22} r={R} fill="none" stroke="var(--color-text-primary, #1c2030)" strokeOpacity={0.55}
        strokeWidth={1.5} strokeLinecap="round" strokeDasharray={`${C * f} ${C * (1 - f)}`} transform="rotate(-90 22 22)" />
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

/* ADJUST mode (V4): seven dials on ONE shared ruler — Radius · Curve are LOCAL (per selected anchor,
   reversible to the source corner); Detail · Smooth · Snap · Angle · Line are GLOBAL (independent
   non-destructive axes, every one OFF → exact source). Each dial is a plain 0..100 product value
   written straight to the recipe; resolve() owns the engine maps. Inapplicable tools grey (Dan's rule). */
export function AdjustSheet({ cornerMode, adjustSub, setAdjustSub, radiusApplies, maxRadius, radius, previewRadius, commitRadius, curveSelected, curveVal, previewCurve, commitCurve, global, previewGlobal, commitGlobal }: {
  cornerMode: boolean
  adjustSub: AdjustSub
  setAdjustSub: (k: AdjustSub) => void
  /** tier-2 availability (Dan's rule: inapplicable tools GREY, never silent no-op) */
  radiusApplies: boolean
  maxRadius: number
  radius: number
  previewRadius: (v: number) => void
  commitRadius: (v: number) => void
  /** Curve acts on the SELECTED anchor (tap one in Points) */
  curveSelected: boolean
  curveVal: number
  previewCurve: (v: number) => void
  commitCurve: (v: number) => void
  /** the live global recipe (preview during a drag, else the committed truth) */
  global: GlobalAdjustments
  previewGlobal: (g: GlobalAdjustments) => void
  commitGlobal: (g: GlobalAdjustments) => void
}) {
  // a ring renders only when a dial is engaged (off-state shows nothing). Detail OFF = 100 (full).
  const setG = (k: keyof GlobalAdjustments, v: number): GlobalAdjustments => ({ ...global, [k]: v })
  const dials = [
    { k: 'radius' as const, label: cornerMode ? 'Corner' : 'Radius', icon: <CornerIcon />, ring: radiusApplies && radius > 0 ? radius / Math.max(maxRadius, 1) : 0 },
    { k: 'curve' as const, label: 'Curve', icon: <RoundIcon />, ring: curveSelected && curveVal > 0 ? curveVal / 100 : 0 },
    { k: 'detail' as const, label: 'Detail', icon: <DetailIcon />, ring: (100 - global.detail) / 100 },
    { k: 'smooth' as const, label: 'Smooth', icon: <SmoothIcon />, ring: global.smooth / 100 },
    { k: 'snap' as const, label: 'Snap', icon: <SnapIcon />, ring: global.snap / 100 },
    { k: 'angle' as const, label: 'Angle', icon: <AngleIcon />, ring: global.angle / 100 },
    { k: 'line' as const, label: 'Line', icon: <LineIcon />, ring: global.line / 100 },
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
          {/* an inapplicable tool shows its ruler GREYED and non-functional until the state makes it real */}
          {adjustSub === 'radius' && (radiusApplies || cornerMode ? (
            <TickBar label={cornerMode ? 'Corner' : 'Radius'} min={0} max={maxRadius} value={Math.min(radius, maxRadius)} onChange={previewRadius} onCommit={commitRadius} format={(v) => `${Math.round((v / Math.max(maxRadius, 1)) * 100)}%`} />
          ) : (
            <div className={styles.disabledControl} aria-disabled="true">
              <TickBar label="Radius" min={0} max={100} value={0} onChange={() => {}} onCommit={() => {}} format={(v) => `${Math.round(v)}%`} />
            </div>
          ))}
          {adjustSub === 'curve' && (curveSelected ? (
            <TickBar label="Curve" min={0} max={100} value={curveVal} onChange={previewCurve} onCommit={commitCurve} format={(v) => `${Math.round(v)}%`} />
          ) : (
            <div className={styles.disabledControl} aria-disabled="true">
              <TickBar label="Curve" min={0} max={100} value={0} onChange={() => {}} onCommit={() => {}} format={(v) => `${Math.round(v)}%`} />
            </div>
          ))}
          {adjustSub === 'detail' && (
            // L2 (Dan: "Detail 100% has LESS detail than 0 — reversed"). The slider IS the fidelity
            // value: 100% = MOST detail (tightest Paper-simplify fit → most anchors), lower = simpler. The
            // earlier `100 - detail` inversion read backwards. Engine detailTolPx: 100→0.75px tight fit.
            <TickBar label="Detail" min={0} max={100} value={global.detail} onChange={(v) => previewGlobal(setG('detail', v))} onCommit={(v) => commitGlobal(setG('detail', v))} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'smooth' && (
            <TickBar label="Smooth" min={0} max={100} value={global.smooth} onChange={(v) => previewGlobal(setG('smooth', v))} onCommit={(v) => commitGlobal(setG('smooth', v))} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'snap' && (
            <TickBar label="Snap" min={0} max={100} value={global.snap} onChange={(v) => previewGlobal(setG('snap', v))} onCommit={(v) => commitGlobal(setG('snap', v))} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'angle' && (
            <TickBar label="Angle" min={0} max={100} value={global.angle} onChange={(v) => previewGlobal(setG('angle', v))} onCommit={(v) => commitGlobal(setG('angle', v))} format={(v) => `${Math.round(v)}%`} />
          )}
          {adjustSub === 'line' && (
            <TickBar label="Line" min={0} max={100} value={global.line} onChange={(v) => previewGlobal(setG('line', v))} onCommit={(v) => commitGlobal(setG('line', v))} format={(v) => `${Math.round(v)}%`} />
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
          { k: 'blend', label: 'Blend', icon: <BlurIcon />, ring: blendBlur / 100 }, // KAI-9030: it IS a blur
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
              min={0}
              max={100}
              step={1}
              value={fxToPct(imageSub, fxDraft[imageSub])}
              onChange={(v) => setFxDraft((d) => ({ ...d, [imageSub]: fxFromPct(imageSub, v) }))}
              onCommit={(v) => {
                const next = { ...fxDraft, [imageSub]: fxFromPct(imageSub, v) }
                setFxDraft(next)
                useOutlineStore.getState().setImageFx(next) // bake → 3D + print recompose
              }}
              format={(v) => `${Math.round(v)}%`}
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
  /** Magic ✦ trail chip (D7): the auto-cut as a shape SOURCE — same pipeline as the hero door */
  onMagic?: () => void
}) {
  return (
    <div className={styles.shapeSheet}>
      <ChipRow>
        {/* KAI-9024 (Dan): Upload leads the row — ahead of the presets. ONE upload entry
            (SVG verbatim, images vectorised under the hood), the existing chip pattern. */}
        <label className={styles.chip} aria-label="Upload a shape (SVG or image)">
          <span className={styles.chipIcon}><PlusIcon /></span>
          <span className={styles.chipLabel}>Upload</span>
          <input type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onUploadShape} />
        </label>
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
        </div>
      )}
    </div>
  )
}
