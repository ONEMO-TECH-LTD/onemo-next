'use client'

// grid-engine — the ADMIN UI SHELL. Dan, 2026-08-10: "3rd is admin ui shel neutral canvas that has
// ui separate bridge that wires in the logic unit to drive the engine - ui is for admin testing".
//
// SEPARATION (Dan's law, §1 of _WIP/grid-engine-v3/grid-laws.md):
//   • it imports the SPEC — values — and will import the BRIDGE. Never the engine directly.
//   • it holds no geometry, no maths, no policy. Every write goes through the spec's guard.
//   • the only state it owns is presentation: which rows are unlocked, and a test fixture.
//
// Built on the studio's own anatomy, measured from Figma "Prototypes / Control" (node 14209:26629)
// at 402pt. Canvas is 402 x 402. The studio's visual design comes from Figma; this invents none.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyGridValue,
  isOptionsOnly,
  isSealedInCode,
  LAUNCH_PITCHES_MM,
  limitsFor,
  RELEASED,
  selectPitch,
  type GridKey,
  type GridSystemSpec,
  type WriteRefusal,
} from '@/lib/grid-engine/spec'
import { GridCanvas } from './GridCanvas'
import {
  bandSpan,
  fieldSpan,
  resizeShape,
  type FieldSummary,
} from '@/lib/grid-engine/bridge'
import { traceCutout, type OutlineUV } from '@/lib/grid-engine/ui/trace-cutout'
import { ZOOM_FIT } from '@/lib/grid-engine/ui/camera'
import styles from './page.module.css'

/** Presentation only — the order and wording of the law rows. */
const ROWS: Array<{ key: GridKey; name: string; step: number; unit: string }> = [
  { key: 'pitchMM', name: 'Spacing', step: 48, unit: 'mm' },
  { key: 'paddingMM', name: 'Padding', step: 1, unit: 'mm' },
  { key: 'positionsPerAxis', name: 'Rows & columns', step: 1, unit: '' },
  { key: 'maxSizeMM', name: 'Ceiling', step: 2, unit: 'mm' },
]

/**
 * The test fixture's own bounds — presentation, not law. The slider sweeps the released size range
 * up to the spec's ceiling; the field will still take a number beyond it, so the viewport can be
 * pushed past what the generator would ever publish.
 */
const SHAPE_MIN_MM = 20
const SHAPE_STEP_MM = 2

/**
 * A loaded cut-out is laid on the canvas at the CLASSIC band — three magnets — on its longest side,
 * so its proportions are untouched (law 2.1a).
 *
 * The band is a COUNT here and its millimetres come from the unit. It used to be the literal 120,
 * which is (3-1)x48 + 2x12 frozen into the shell: change the padding and the shell would have been
 * silently wrong, against law 4.2 (change an input and everything re-derives).
 */
/**
 * A loaded cut-out arrives at FOUR POINTS CENTRED — two magnets across, two down.
 *
 * Dan, 2026-08-11: "By default 4 points must be centerd with cutout", and law 3.1: "perfect shape x
 * grid match is 4 points balanced and symetrically centerd on the shape".
 *
 * The registration is not chosen with it: two across is an EVEN count, and law 9.2 says an even
 * count puts the shape's centre in the gap between magnets — which is what makes the four symmetric.
 */
const DEFAULT_MATCH_MAGNETS = 2
/**
 * And it arrives at BAND 3 on its longest side. Dan, 2026-08-11: "the defaiult image cutout load
 * must be in outline mode and centered to 4 squares in band 3".
 *
 * The band is the SIZE; the match above is the REGISTRATION. They are separate readings of the same
 * load — a band-3 shape holding a four-point match — and law 9.2 is answered by the match's count,
 * not by the band's, so the four stay symmetric about the centre.
 */
const DEFAULT_SIZE_BAND = 3
/**
 * THE THREE BANDS, as counts (law 10.7 — the selector offers 2, 3 and 4; size 1 is coded, not shown).
 * Their millimetres are the SQUARE STANDARD and come from the unit, never from here.
 */
const BANDS = [2, 3, 4] as const
/** The biggest band offered. The launch view is framed to hold it (Dan: "adapt zoom to the largest size"). */
const LARGEST_BAND = BANDS[BANDS.length - 1]
const CUTOUT_OPACITY = 0.55


const REFUSAL_TEXT: Record<WriteRefusal, string> = {
  'sealed-in-code': 'Sealed in code. Change it in the spec module and release it.',
  'options-only': 'Released options only — pick one, it is never typed in freehand.',
  'not-a-number': 'That is not a number.',
  'out-of-range': 'Outside the value’s allowed range — refused, not clamped.',
}

export default function GridEnginePage() {
  const [spec, setSpec] = useState<GridSystemSpec>(RELEASED)
  const [unlocked, setUnlocked] = useState<ReadonlySet<GridKey>>(new Set())
  const [refused, setRefused] = useState<WriteRefusal | null>(null)
  // NO ZOOM. Dan, 2026-08-11: "the cutout is scaling incorrectly the grid must scale instead and pan
  // - no zoom - the object fits the viewport and static".
  //
  // The shape is static and fills the viewport; the GRID scales underneath it. The camera is derived
  // from the shape's own size, so a bigger band means a bigger shape in millimetres, a wider view,
  // and therefore a finer-looking lattice — while the shape itself never moves on screen.
  //
  // Presentation only: the millimetres are real and shown in the header, the pitch is untouched, and
  // the camera reaches no geometry (law 8.1).
  const [view, setView] = useState<FieldSummary | null>(null)
  const onView = useCallback((r: FieldSummary) => setView(r), [])
  // UI-ONLY test fixture. A stand-in shape so the canvas can be driven before the engine lands —
  // it carries no policy and the unit never sees it.
  //
  // Two ways in, one value: drag the slider to sweep, type for an exact number. The field commits on
  // ENTER or on leaving it, never per keystroke — typing "88" used to land on 8 first and redraw the
  // whole canvas at a size nobody asked for.
  //
  // It is also what the camera reads, with or without a cut-out on the field — see below.
  const [sizeMM, setSizeMM] = useState(() => Math.round(bandSpan(RELEASED, LARGEST_BAND + 1)))
  const [sizeDraft, setSizeDraft] = useState(() =>
    String(Math.round(bandSpan(RELEASED, LARGEST_BAND + 1))),
  )

  /**
   * ONE number for the shape's longest side, and it is the precision instrument: type an exact size
   * or sweep the slider, and the picture follows. It also reads BACK from a handle drag, so the
   * number on screen is always the shape's real size — never a stale fixture (law 5.3).
   */
  const setSize = (next: number) => {
    setSizeMM(next)
    setSizeDraft(String(next))
    setBox((b) => (b ? resizeShape(spec, b, next) : b))
  }

  /** A drag changed the shape; the readout follows it rather than the other way round. */
  const syncSizeFromBox = (b: { w: number; h: number }) => {
    const longest = Math.round(Math.max(b.w, b.h))
    setSizeMM(longest)
    setSizeDraft(String(longest))
  }

  const commitSize = () => {
    const next = Number(sizeDraft)
    if (Number.isFinite(next) && next > 0) setSize(next)
    else setSizeDraft(String(sizeMM))
  }

  // THE CUT-OUT — the picture, laid on the field so the magnets show through it.
  //
  // Presentation only. The shell reads the file and draws it; nothing is traced, measured or handed
  // to the unit. The engine is not involved and does not know a cut-out exists.
  const [cutout, setCutout] = useState<{ url: string; wPx: number; hPx: number } | null>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  /** The silhouette in the picture's own fractions, so it can be drawn against any box. */
  const [outline, setOutline] = useState<OutlineUV | null>(null)
  /** Which face of the cut-out is on: the picture, or its outline alone. */
  const [asOutline, setAsOutline] = useState(false)
  const cutoutInput = useRef<HTMLInputElement>(null)

  const loadCutout = useCallback((file: File) => {
    // Even band -> the shape's centre falls between magnets (law 9.2), so the four sit symmetric
    // about it. This is the count's parity, not a default anyone picked (law 6.5).
    setSpec((sp) => ({ ...sp, registration: DEFAULT_MATCH_MAGNETS % 2 === 0 ? 'gap' : 'point' }))
    // The silhouette is the face it lands on — the picture is there to be switched TO, not from.
    setAsOutline(true)
    void traceCutout(file).then(setOutline)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setCutout({ url, wPx: img.naturalWidth, hPx: img.naturalHeight })
      // Laid on at the default band, longest side, proportions untouched.
      const k = bandSpan(spec, DEFAULT_SIZE_BAND) / Math.max(img.naturalWidth, img.naturalHeight)
      const w = img.naturalWidth * k
      const h = img.naturalHeight * k
      setBox({ x: -w / 2, y: -h / 2, w, h })
      const longest = Math.round(Math.max(w, h))
      setSizeMM(longest)
      setSizeDraft(String(longest))
    }
    img.src = url
  }, [])

  /** Screen pixels to millimetres, off the SVG's own matrix. Screen maths — the shell's own job. */
  /**
   * WHERE THE LATTICE SITS against the shape, in millimetres. Not a camera: this moves the magnets
   * themselves, so it is placement — the shape stays still and the grid comes to meet it.
   */
  const [pan, setPan] = useState<[number, number]>([0, 0])
  /** The surface a pinch is measured on. Same rect the drag uses — one place the canvas reacts. */
  const panSurface = useRef<SVGRectElement>(null)
  /**
   * The whole drag is measured from where it STARTED, never from the last frame.
   *
   * Measuring frame to frame and rounding each step threw away everything under half a millimetre —
   * a slow, careful drag moved nothing at all, because each frame's fraction was rounded to zero and
   * then discarded. Held against the grab point, every fraction survives and the lattice steps
   * cleanly at 1mm (Dan, 2026-08-11: "make it move in 1mm increments").
   */
  const panGrabbedAt = useRef<{ atMM: [number, number]; panMM: [number, number] } | null>(null)

  const toMM = (e: React.PointerEvent<SVGElement>): [number, number] => {
    const svg = e.currentTarget.ownerSVGElement
    const m = svg?.getScreenCTM()
    if (!svg || !m) return [0, 0]
    const p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const u = p.matrixTransform(m.inverse())
    return [u.x, u.y]
  }

  const clearCutout = useCallback(() => {
    setCutout((c) => {
      if (c) URL.revokeObjectURL(c.url)
      return null
    })
    setBox(null)
    setOutline(null)
  }, [])

  // Law rows behave like the fixture: type freely, commit on ENTER or on leaving the field. Writing
  // per keystroke meant every intermediate digit hit the guard and bounced as out-of-range.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const draftFor = (key: GridKey) => drafts[key] ?? String(spec.grid[key])

  const commit = (key: GridKey) => {
    const result = applyGridValue(spec, key, Number(draftFor(key)))
    setRefused(result.refused ?? null)
    if (result.refused) setDrafts((d) => ({ ...d, [key]: String(spec.grid[key]) }))
    else setSpec(result.spec)
  }

  const toggleLock = (key: GridKey) =>
    setUnlocked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /**
   * THE CAMERA, derived from THE SIZE — one quantity, whether a cut-out is on the field or not.
   *
   * It used to branch: the shape's own box when one was loaded, a frozen launch factor otherwise. So
   * with an empty field the camera was a constant, and Dan hit exactly that — "it is not changing
   * with no cutout shown". The size moved and nothing on screen did.
   *
   * There is no branch now. `sizeMM` IS the shape's longest side whenever there is a shape — loading
   * one sets it, and every route that changes it resizes the box through the unit — so reading the
   * size covers both cases and one of them stops being special. With an empty field it is the size
   * the shape WOULD be, which is what makes the grid scale under a pinch with nothing loaded.
   */
  const gridScale = fieldSpan(RELEASED, RELEASED.grid.positionsPerAxis) / Math.max(sizeMM, 1)

  /**
   * THE BIGGEST THE SHAPE MAY BE — the 9x9 grid itself, never a millimetre.
   *
   * Dan, 2026-08-11: "the biggest view must be 9x9 not 310mm", which is law 12.3 applied to this
   * control: the ceiling is a GRID COUNT. So it is the span of a band as wide as the field has
   * positions, computed by the unit — 408mm at nine positions and 12mm padding, and a different
   * number the moment either changes, without a line here moving.
   */
  const maxSpanMM = Math.round(bandSpan(spec, spec.grid.positionsPerAxis))

  /**
   * PINCH THE GRID — the same size the slider sets. Dan, 2026-08-11: "link the pinch gestures on the
   * grid to the resizing same as slider would".
   *
   * It drives `setSize` and nothing else, so there is ONE size and three ways to reach it: the band
   * chips, the slider, the pinch. A second scale living beside the first is how a surface ends up
   * showing a number the shape does not have (law 5.3).
   *
   * The direction follows what the hand is doing to the GRID, not to the shape. Spread the fingers
   * and the grid grows, which means the shape covers less of it — a smaller shape in millimetres.
   * Pinch in and the grid shrinks under a shape that is therefore bigger. The shape itself never
   * changes on screen; only its size in millimetres does, which is the inverted model.
   *
   * Whole millimetres, like every other move, and bounded by the same floor and 9x9 ceiling the
   * slider carries.
   *
   * A trackpad pinch reaches the browser as a wheel event with ctrlKey set. The listener is native
   * and non-passive because preventDefault is required — without it macOS zooms the whole page and
   * the gesture never arrives here at all.
   */
  useEffect(() => {
    const el = panSurface.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const next = Math.round(sizeMM * Math.exp(e.deltaY / 100))
      setSize(Math.min(maxSpanMM, Math.max(SHAPE_MIN_MM, next)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const lockedCount = ROWS.filter(
    (r) => isSealedInCode(r.key) || isOptionsOnly(r.key) || !unlocked.has(r.key),
  ).length

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Grid engine</span>
          <span className={styles.readout}>
            {box ? `${Math.round(box.w)} × ${Math.round(box.h)}mm` : `${sizeMM}mm`}
          </span>
        </div>
      </header>

      <nav className={styles.toolbox}>
        {LAUNCH_PITCHES_MM.map((p) => (
          <button
            key={p}
            type="button"
            className={styles.chip}
            data-on={spec.grid.pitchMM === p}
            onClick={() => {
              const r = selectPitch(spec, p)
              setRefused(r.refused ?? null)
              if (!r.refused) setSpec(r.spec)
            }}
          >
            {p}mm
          </button>
        ))}

        <button
          type="button"
          className={styles.chip}
          data-on={Boolean(cutout)}
          onClick={() => (cutout ? clearCutout() : cutoutInput.current?.click())}
        >
          {cutout ? 'clear' : 'cut-out'}
        </button>
        <input
          ref={cutoutInput}
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) loadCutout(f)
            e.target.value = ''
          }}
          aria-label="Load a cut-out"
        />

        {cutout && (
          <button
            type="button"
            className={styles.chip}
            data-on={asOutline}
            onClick={() => setAsOutline((v) => !v)}
            disabled={!outline}
            title={outline ? undefined : 'no silhouette in that file'}
          >
            outline
          </button>
        )}

        <span className={styles.spacer} />

        {view && (
          <span className={styles.fieldReadout}>
            {view.cols}×{view.rows} · {Math.round(Math.max(view.spanXMM, view.spanYMM))}mm
          </span>
        )}

      </nav>

      <div className={styles.canvas}>
        <GridCanvas
          spec={spec}
          panMM={pan}
          /* THE FIELD IS THE WORLD; the shape lands on it (law 5.1). It must never be framed from
             the shape — driving the extent off the cut-out's box made the whole lattice re-solve and
             the camera re-frame on every drag, so the grid appeared to move under the handles. */
          extentMM={{ x: -sizeMM / 2, y: -sizeMM / 2, w: sizeMM, h: sizeMM }}
          zoom={gridScale}
          onView={onView}
        >
          {/* Drag anywhere on the field to slide the LATTICE against the shape. Whole millimetres,
              like every other move. Drawn first, so it sits beneath the cut-out. */}
          <rect
            ref={panSurface}
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill="transparent"
            style={{ cursor: panGrabbedAt.current ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              panGrabbedAt.current = { atMM: toMM(e), panMM: pan }
            }}
            onPointerMove={(e) => {
              const grab = panGrabbedAt.current
              if (!grab) return
              const [px, py] = toMM(e)
              setPan([
                Math.round(grab.panMM[0] + px - grab.atMM[0]),
                Math.round(grab.panMM[1] + py - grab.atMM[1]),
              ])
            }}
            onPointerUp={(e) => {
              panGrabbedAt.current = null
              e.currentTarget.releasePointerCapture?.(e.pointerId)
            }}
          />
          {cutout && box && (
            /* THE SHAPE IS INVISIBLE TO THE POINTER. Dan, 2026-08-11: "the shape must be invisible to
               dragging even over the shape the canvas must continue to react". It is drawn above the
               drag surface, so without this it swallows the press and the lattice stops following the
               hand exactly where the shape is — the one place you are looking. */
            <g pointerEvents="none">
              {asOutline && outline ? (
                <polygon
                  points={outline
                    .map(([u, v]) => `${box.x + u * box.w},${box.y + v * box.h}`)
                    .join(' ')}
                  fill="rgba(88,194,255,0.08)"
                  stroke="#58c2ff"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <image
                  href={cutout.url}
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  opacity={CUTOUT_OPACITY}
                  preserveAspectRatio="none"
                />
              )}
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                fill="none"
                stroke="#58c2ff"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </GridCanvas>
      </div>

      <section className={styles.bottom}>
        <details className={styles.law}>
          <summary className={styles.lawHead}>
            <svg className={styles.caret} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className={styles.lawHeadText}>Grid law</span>
            <span className={styles.lawCount}>
              🔒 {lockedCount} of {ROWS.length}
            </span>
          </summary>

          <div className={styles.lawBody}>
              {ROWS.map(({ key, name, step, unit }) => {
                const sealed = isSealedInCode(key)
                const optionsOnly = isOptionsOnly(key)
                const fixed = sealed || optionsOnly
                const editable = !fixed && unlocked.has(key)
                const { min, max } = limitsFor(key)
                return (
                  <div key={key} className={styles.row}>
                    <span className={styles.rowName}>{name}</span>
                    {sealed && <span className={styles.sealed}>sealed</span>}
                    {optionsOnly && <span className={styles.sealed}>options</span>}
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      min={min}
                      max={max}
                      step={step}
                      value={draftFor(key)}
                      disabled={!editable}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(key)
                      }}
                      onBlur={() => commit(key)}
                    />
                    <span className={styles.rowUnit}>{unit}</span>
                    <button
                      type="button"
                      className={styles.lock}
                      data-open={editable}
                      disabled={fixed}
                      onClick={() => toggleLock(key)}
                      aria-label={editable ? `Lock ${name}` : `Unlock ${name}`}
                      title={
                        sealed
                          ? 'Sealed in code'
                          : optionsOnly
                            ? 'Released options only — use the chips'
                            : editable
                              ? 'Lock'
                              : 'Unlock to edit'
                      }
                    >
                      {fixed || !editable ? '🔒' : '🔓'}
                    </button>
                  </div>
                )
              })}

            {refused && <p className={styles.refusal}>{REFUSAL_TEXT[refused]}</p>}
          </div>
        </details>

        <div className={styles.fixture}>
          <span className={styles.fixtureName}>Size</span>
          {BANDS.map((n) => {
            const mm = Math.round(bandSpan(spec, n))
            return (
              <button
                key={n}
                type="button"
                className={styles.chip}
                data-on={sizeMM === mm}
                onClick={() => setSize(mm)}
                title={`band ${n} — ${n} magnets across, the square standard`}
              >
                {mm}
              </button>
            )
          })}
          <input
            className={styles.slider}
            type="range"
            min={SHAPE_MIN_MM}
            max={maxSpanMM}
            step={SHAPE_STEP_MM}
            value={Math.min(sizeMM, maxSpanMM)}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Shape size"
          />
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={SHAPE_MIN_MM}
            step={SHAPE_STEP_MM}
            value={sizeDraft}
            onChange={(e) => setSizeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSize()
            }}
            onBlur={commitSize}
          />
          <span className={styles.rowUnit}>mm</span>
        </div>
      </section>
    </div>
  )
}
