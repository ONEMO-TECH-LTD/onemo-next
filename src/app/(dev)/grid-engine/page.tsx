'use client'

// grid-engine — the ADMIN UI SHELL. Dan, 2026-08-10: "3rd is admin ui shel neutral canvas that has
// ui separate bridge that wires in the logic unit to drive the engine - ui is for admin testing".
//
// SEPARATION (Dan's law, §1 of _WIP/grid-engine-v3/grid-laws.md):
//   • it imports the SPEC — values — and the BRIDGE. Never the engine directly.
//   • it holds no geometry, no maths, no policy. Every write goes through the spec's guard.
//   • the only state it owns is presentation: which rows are unlocked, and a test fixture.
//
// The canvas is a responsive square inside the page's gutters — it takes its size from the window,
// not from a fixed number. (It was described here as 402 x 402 after the Figma frame it was built
// from, "Prototypes / Control" node 14209:26629 at 402pt; that measurement is the design's, never
// the implementation's.) The studio's visual design comes from Figma; this invents none.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyGridValue,
  isOptionsOnly,
  isSealedInCode,
  LAUNCH_PITCHES_MM,
  limitsFor,
  RELEASED,
  selectPitch,
  selectRegistration,
  type GridKey,
  type GridSystemSpec,
  type WriteRefusal,
} from '@/lib/grid-engine/spec'
import { GridCanvas } from './GridCanvas'
import {
  bandSpan,
  fieldBlockSpan,
  minShapeSpan,
  resizeShape,
  type FieldSummary,
} from '@/lib/grid-engine/bridge'
import { traceCutout, type OutlineUV } from '@/lib/grid-engine/ui/trace-cutout'
import { pinchFactor } from '@/lib/grid-engine/ui/camera'
import styles from './page.module.css'

/** Presentation only — the order and wording of the law rows. */
const ROWS: Array<{ key: GridKey; name: string; unit: string }> = [
  { key: 'pitchMM', name: 'Spacing', unit: 'mm' },
  { key: 'paddingMM', name: 'Padding', unit: 'mm' },
  { key: 'positionsPerAxis', name: 'Rows & columns', unit: '' },
  { key: 'maxSizeMM', name: 'Ceiling', unit: 'mm' },
]

/**
 * A stepper increment for a number field. The SPACING row steps by the lattice, so it comes from the
 * spec rather than being written here — it was the literal 48, the last grid number left in the
 * shell, and the structural guard now refuses it. The rest are plain counting steps.
 */
const stepFor = (key: GridKey, spec: GridSystemSpec): number =>
  key === 'pitchMM' ? spec.grid.basePitchMM : key === 'maxSizeMM' ? 2 : 1

/**
 * The slider's step — presentation only. Its FLOOR and CEILING are not here: the floor is the unit's
 * minimum shape span and the ceiling is the 9x9 grid, both asked for at the point of use, so the
 * control cannot offer a size the unit would refuse to produce.
 */
const SHAPE_STEP_MM = 2

/**
 * A loaded cut-out arrives at FOUR POINTS CENTRED — two magnets across, two down.
 *
 * Dan, 2026-08-11: "By default 4 points must be centerd with cutout", and law 3.1: "perfect shape x
 * grid match is 4 points balanced and symetrically centerd on the shape".
 *
 * The registration is not chosen with it: two across is an EVEN count, and law 9.2 says an even
 * count puts the shape's centre in the gap between magnets — which is what makes the four symmetric.
 */
/** Dan's real cut-outs, kept with the admin bench so the comparison corpus is repeatable. */
const CUTOUT_LIBRARY = [
  'BAT-WOMAN.png',
  'BOT.png',
  'BUTTERFLY.png',
  'DUCK.png',
  'PILL.png',
  'POKE1.png',
  'POKE2.png',
] as const

const DEFAULT_MATCH_MAGNETS = 2
/**
 * And it arrives at BAND 3 on its longest side. Dan, 2026-08-11: "the defaiult image cutout load
 * must be in outline mode and centered to 4 squares in band 3".
 *
 * The band is the SIZE; the match above is the REGISTRATION. They are separate readings of the same
 * load — a band-3 shape holding a four-point match — and law 9.2 is answered by the match's count,
 * not by the band's, so the four stay symmetric about the centre.
 *
 * It is a COUNT and its millimetres come from the unit. Frozen as the literal 120 — which is
 * (3-1)x48 + 2x12 — the shell would go silently wrong the moment the padding changed, against law
 * 4.2: change an input and everything re-derives.
 */
const DEFAULT_SIZE_BAND = 3
/**
 * THE THREE BANDS, as counts (law 10.7 — the selector offers 2, 3 and 4; size 1 is coded, not shown).
 * Their millimetres are the SQUARE STANDARD and come from the unit, never from here.
 */
const BANDS = [2, 3, 4] as const
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
  // ONE SIZE, WHETHER A SHAPE IS LOADED OR NOT. Dan, 2026-08-11: "the scaling and size is different
  // with cutout in and not in — they must behave in the same fucking way".
  //
  // It starts at the default band, so an empty field is already showing the size a cut-out would
  // arrive at. Loading one therefore changes NOTHING about the size or the camera: it puts a shape
  // at the size that was already set. There is no load-time jump because there is no second rule.
  const DEFAULT_SIZE_MM = Math.round(bandSpan(RELEASED, DEFAULT_SIZE_BAND))
  const [sizeMM, setSizeMM] = useState(DEFAULT_SIZE_MM)
  const [sizeDraft, setSizeDraft] = useState(String(DEFAULT_SIZE_MM))
  /**
   * THE SAME SIZE, UNROUNDED — what a gesture accumulates against so nothing under a millimetre is
   * lost between packets. It is not a second size: the shown size is always this one rounded, and
   * any other route that sets the size resets it below.
   */
  const sizeExactMM = useRef(DEFAULT_SIZE_MM)
  /** What a wheel packet does, kept current for a listener that is attached exactly once. */
  const applyPinch = useRef<(factor: number) => void>(() => {})

  /** Slider, chips, typed number, a load: whatever moved the size, the gesture continues from it. */
  useEffect(() => {
    if (Math.round(sizeExactMM.current) !== sizeMM) sizeExactMM.current = sizeMM
  }, [sizeMM])

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

  const commitSize = () => {
    const next = Number(sizeDraft)
    if (Number.isFinite(next) && next > 0) setSize(Math.max(minSpanMM, Math.min(maxSpanMM, next)))
    else setSizeDraft(String(sizeMM))
  }

  // THE CUT-OUT — the picture, laid on the field so the magnets show through it.
  //
  // Presentation only. The shell reads the file and draws it; nothing is traced, measured or handed
  // to the unit. The engine is not involved and does not know a cut-out exists.
  const [cutout, setCutout] = useState<{ url: string } | null>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  /** The silhouette in the picture's own fractions, so it can be drawn against any box. */
  const [outline, setOutline] = useState<OutlineUV | null>(null)
  /** Which face of the cut-out is on: the picture, or its outline alone. */
  const [asOutline, setAsOutline] = useState(false)
  const cutoutInput = useRef<HTMLInputElement>(null)

  /**
   * A cut-out arrives AT THE SIZE THAT IS ALREADY SET — it does not carry a size of its own.
   *
   * It used to scale itself to a band literal here, which is what made an empty field and a loaded
   * one behave differently: the size and therefore the camera jumped the moment a file landed. Now
   * the shape is fitted to `sizeMM`, so loading changes what is on the field and nothing else. Set
   * the size before or after loading; both give the same result.
   *
   * (Plain function, not a memoised one. It reads the live spec and the live size, and the empty
   * dependency list it used to carry meant it read whatever they were on first render.)
   */
  const loadCutout = ((file: File) => {
    // Even match -> the shape's centre falls between magnets (law 9.2), so the four sit symmetric
    // about it. This is the count's parity, not a default anyone picked (law 6.5).
    //
    // Through the GUARD, like every other law value. It used to be a bare setState, which was a
    // second write route into the spec that no guard and no test could see.
    const r = selectRegistration(spec, DEFAULT_MATCH_MAGNETS % 2 === 0 ? 'gap' : 'point')
    setRefused(r.refused ?? null)
    if (!r.refused) setSpec(r.spec)
    // The silhouette is the face it lands on — the picture is there to be switched TO, not from.
    setAsOutline(true)
    void traceCutout(file).then(setOutline)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setCutout({ url })
      // Fitted to the size already on screen, longest side, proportions untouched (law 2.1a).
      const k = sizeMM / Math.max(img.naturalWidth, img.naturalHeight)
      const w = img.naturalWidth * k
      const h = img.naturalHeight * k
      setBox({ x: -w / 2, y: -h / 2, w, h })
    }
    img.src = url
  })

  const loadLibraryCutout = async (name: (typeof CUTOUT_LIBRARY)[number]) => {
    const response = await fetch(`/grid-engine/cutouts/${encodeURIComponent(name)}`)
    if (!response.ok) throw new Error(`Could not load cut-out fixture: ${name}`)
    loadCutout(new File([await response.blob()], name, { type: 'image/png' }))
  }

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

  // Plain function. Hand-memoising it declared an empty dependency list the React Compiler could not
  // reconcile with what it inferred, so it gave up optimising the WHOLE component -- and that bail-out
  // was hidden behind the ref-in-render error until that was fixed. The compiler memoises this.
  const clearCutout = () => {
    setCutout((c) => {
      if (c) URL.revokeObjectURL(c.url)
      return null
    })
    setBox(null)
    setOutline(null)
  }

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
   *
   * THE MARGIN IS NOT HERE. There is exactly one margin in the system and it lives in the engine as
   * the field's own — one magnet spot, 24mm. This scales the magnet BLOCK against the shape, so that
   * margin survives into the view instead of cancelling; a shape at the 9x9 ceiling therefore has
   * 24mm of canvas beyond it, and every smaller shape has the same proportion, which is what keeps
   * it a constant size on screen. No second margin is added on top of it here or anywhere.
   */
  const gridScale = fieldBlockSpan(spec) / Math.max(sizeMM, 1)

  /**
   * THE BIGGEST THE SHAPE MAY BE — the 9x9 grid itself, never a millimetre.
   *
   * Dan, 2026-08-11: "the biggest view must be 9x9 not 310mm", which is law 12.3 applied to this
   * control: the ceiling is a GRID COUNT. So it is the span of a band as wide as the field has
   * positions, computed by the unit — 408mm at nine positions and 12mm padding, and a different
   * number the moment either changes, without a line here moving.
   */
  const maxSpanMM = Math.round(bandSpan(spec, spec.grid.positionsPerAxis))
  /** The unit's own floor. The control offers exactly what the unit will produce, never less. */
  const minSpanMM = Math.round(minShapeSpan(spec))

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
   */
  useEffect(() => {
    applyPinch.current = (factor: number) => {
      // Accumulate against the UNROUNDED size. Rounding each packet threw the fraction away and then
      // discarded it, so a hundred 0.1s moved nothing while one 10 moved thirteen millimetres — the
      // same defect as the drag, in the other gesture.
      const next = sizeExactMM.current * factor
      const held = Math.min(maxSpanMM, Math.max(minSpanMM, next))
      sizeExactMM.current = held
      setSize(Math.round(held))
    }
  })

  // ONE listener, attached once. It used to be re-attached on every render — including every render
  // a pinch caused — because the effect had no dependency list. It reads through the ref above, so
  // it needs no dependencies to stay current.
  //
  // A trackpad pinch reaches the browser as a wheel event with ctrlKey set. The listener is NATIVE
  // and NON-PASSIVE because preventDefault is required — without it macOS zooms the whole page and
  // the gesture never arrives here at all.
  useEffect(() => {
    const el = panSurface.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      applyPinch.current(pinchFactor(e.deltaY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const lockedCount = ROWS.filter(
    (r) => isSealedInCode(r.key) || isOptionsOnly(r.key) || !unlocked.has(r.key),
  ).length

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Grid engine <span style={{ fontSize: 10, opacity: 0.45, fontWeight: 400 }}>build 0963303f</span></span>
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
          {cutout ? 'clear' : 'upload'}
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

        <select
          className={`${styles.input} ${styles.librarySelect}`}
          value=""
          aria-label="Load a saved cut-out"
          onChange={(event) => {
            const name = event.target.value as (typeof CUTOUT_LIBRARY)[number]
            if (name) void loadLibraryCutout(name)
          }}
        >
          <option value="">library</option>
          {CUTOUT_LIBRARY.map((name) => (
            <option key={name} value={name}>{name.replace('.png', '')}</option>
          ))}
        </select>

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
          /* No extent is passed. THE FIELD IS THE WORLD and it frames itself (law 5.1); the shape
             lands on it. Handing in a region built from the shape's size read as the shape defining
             the world, and did nothing besides — every reachable size is under the field's own floor.
             That coupling is what once made the lattice re-solve on every drag. */
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
            className={styles.panSurface}
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
              {ROWS.map(({ key, name, unit }) => {
                const sealed = isSealedInCode(key)
                const optionsOnly = isOptionsOnly(key)
                const fixed = sealed || optionsOnly
                const editable = !fixed && unlocked.has(key)
                const { min, max } = limitsFor(key)
                const step = stepFor(key, spec)
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
            min={minSpanMM}
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
            min={minSpanMM}
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
