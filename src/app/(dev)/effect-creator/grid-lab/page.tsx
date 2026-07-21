'use client'

// grid-lab — Session 59 magnetic-grid registration bench (2D vector).
// ALL engine shape sources through contourFromShape → computeGrid, rendered true-to-scale:
//   • Presets    — shape-library getShape() (baked vector data)
//   • Generators — generateShapeRing() (blob / clover / daisy / pinwheel)
//   • AI Magic   — image upload → prepareShaped() → u2netp lightweight cut-out → outline
// Every source yields a VShape → mm contour, the same input attachment.ts consumes.

import { useMemo, useRef, useState } from 'react'
import { getShape, hasVectorDef, type VectorShapeKind } from '@/lib/shape-library'
import { type VShape } from '@/lib/vector-core'
import { generateShapeRing, type ShapeKind } from '../v5.3.1/user/shapes'
import { loadImage, prepareShaped } from '../v5.3.1/core/primitives'
import { contourFromShape } from '@/lib/effect/geometry-truth'
import { insetRingMM } from '@/lib/effect/offset'
import type { Contour, Pt } from '@/lib/effect/types'
import { computeGrid, balancedFit, autoGrid, scaleContour, semanticLadder, DEFAULT_LAW, type GridPattern, type MagnetPlan, type GridDensity, type GridMode, type SemanticRung } from '@/lib/effect/grid'

const IMG = 1000
const VP = 440
const FIT = 0.86

const PRESETS: VectorShapeKind[] = ['squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus', 'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie']
const GENS: { k: ShapeKind; label: string }[] = [{ k: 'blob', label: 'Blob' }, { k: 'form', label: 'Clover' }, { k: 'daisy', label: 'Daisy' }, { k: 'pinwheel', label: 'Pinwheel' }]

type Src = 'std' | 'preset' | 'gen' | 'magic'
type StdGeo = 'square' | 'rect' | 'circle' | 'triangle' | 'diamondShape'
type MagicState = { vshape: VShape; maskH: number; adapter: string; imgUrl: string } | null

/** D12–D15 basic geometries, drawn DIRECTLY in mm on the ladder rungs (no normalization pass). */
function stdContour(geo: StdGeo, wMM: number, hMM: number): Contour {
  if (geo === 'circle') {
    const r = wMM / 2, pts: Pt[] = []
    for (let i = 0; i < 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push([r + r * Math.cos(t), r + r * Math.sin(t)]) }
    return { outer: { pts }, holes: [] }
  }
  if (geo === 'triangle') {
    // equilateral, side = rung; anchoring law comes from the engine (mode-driven)
    return { outer: { pts: [[0, 0], [wMM, 0], [wMM / 2, wMM * Math.sqrt(3) / 2]] as Pt[] }, holes: [] }
  }
  if (geo === 'diamondShape') {
    // the square's twin, rotated 45° — vertices on the axes
    return { outer: { pts: [[wMM / 2, 0], [wMM, hMM / 2], [wMM / 2, hMM], [0, hMM / 2]] as Pt[] }, holes: [] }
  }
  return { outer: { pts: [[0, 0], [wMM, 0], [wMM, hMM], [0, hMM]] as Pt[] }, holes: [] } // square / rect
}

function bboxOf(pts: ReadonlyArray<{ x: number; y: number }>) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { if (p.x < a) a = p.x; if (p.x > c) c = p.x; if (p.y < b) b = p.y; if (p.y > d) d = p.y }
  return { w: c - a, h: d - b }
}
/** VShape → mm contour normalized so its longest side = 1mm. Flatten FINELY first (mmPerPx=1 → 0.05px
 *  tolerance = smooth curves), THEN normalize the points — otherwise the tiny mmPerPx blows up the
 *  flatten tolerance and circles/squircles come out faceted. */
function normBase(vs: VShape, maskH: number): Contour | null {
  const c = contourFromShape(vs, { mmPerPx: 1, maskHeightPx: maskH })
  if (!c || c.outer.pts.length < 3) return null
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
  for (const [x, y] of c.outer.pts) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y }
  const L = Math.max(mxx - mnx, mxy - mny, 1)
  return { outer: { pts: c.outer.pts.map(([x, y]) => [x / L, y / L] as Pt) }, holes: [] }
}

export default function GridLab() {
  const [src, setSrc] = useState<Src>('std')
  const [geo, setGeo] = useState<StdGeo>('square')
  // rect system A: long side rung → short side rung (< long) → orientation
  const [longMM, setLongMM] = useState(118)
  const [shortMM, setShortMM] = useState(70)
  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape')
  const [preset, setPreset] = useState<VectorShapeKind>('squircle')
  const [gen, setGen] = useState<ShapeKind>('blob')
  const [p1, setP1] = useState(55) // waviness / pinch / depth / swirl
  const [p2, setP2] = useState(7)  // seed / lobes / petals / blades
  const [sides, setSides] = useState(6)
  const [points, setPoints] = useState(5)
  const [sizeMM, setSizeMM] = useState(70)
  const [pitch, setPitch] = useState(48)
  const [pitchAuto, setPitchAuto] = useState(true)
  const [density, setDensity] = useState<GridDensity>('light') // cell count: standard = more cells (48-first), light = fewer (96-first)
  const [pad, setPad] = useState(10)
  const [offsetMM, setOffsetMM] = useState(0)
  const [pattern, setPattern] = useState<GridPattern>('standard')
  const [patternAuto, setPatternAuto] = useState(true) // pattern joins the auto system — same physics search as pitch
  const [plan, setPlan] = useState<MagnetPlan>('all6')
  const [frame, setFrame] = useState(true)
  const [coverage, setCoverage] = useState<'full' | 'perimeter'>('perimeter')
  const [centerMode, setCenterMode] = useState<'centroid' | 'bbox'>('centroid')
  const [maxGrowMM, setMaxGrowMM] = useState(12)

  const [magic, setMagic] = useState<MagicState>(null)
  const [magStatus, setMagStatus] = useState<string>('')   // '', 'downloading-model', 'cutting', 'error:...'
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const loaded = loadImage(f, magic?.imgUrl)
    if (!loaded) { setMagStatus('error:that file is not an image'); return }
    setSrc('magic'); setMagStatus('cutting')
    prepareShaped(loaded.url, undefined, (s) => setMagStatus(s === 'fallback' ? 'cutting (simple fallback)' : s))
      .then((p) => {
        setMagic({ vshape: p.spec.vectorShape, maskH: p.spec.maskHeightPx, adapter: p.spec.generator?.adapter ?? 'cut', imgUrl: loaded.url })
        setMagStatus('')
      })
      .catch((err) => { console.error('[grid-lab] magic failed', err); setMagStatus('error:' + ((err as Error)?.message ?? 'cut failed')) })
  }

  const sizeMax = src === 'preset' ? 310 : 180 // presets reach the full ladder (incl. hidden rungs); random shapes capped 180
  // smallest holdable effect = a SINGLE point: one magnet with its application ring. Under interp A the
  // ring is `pad`mm radius from centre, so a centred magnet needs 2×pad of material → floor = 2×pad (20mm
  // at the default 10mm padding). Tracks the padding slider rather than a hardcoded 40.
  const sizeMin = 2 * pad

  // PER-GEOMETRY standard sizes (Dan): each geometry's rungs are solved numerically from the live
  // recipe (padding/frame/pattern law) — square 70/118/…, circle and triangle their own. Rect derives
  // per-axis from the square ladder.
  // SEMANTIC SIZES: every shape's own T-shirt ladder (2XS=1pt · XS=2 · S=3 · M=4 · L/XL/2XL/3XL …),
  // solved from the live inputs (padding + frame) and the MODE (auto / standard / dice / diamond).
  const gridMode: GridMode = patternAuto ? 'auto' : pattern
  const stdRungs = useMemo<SemanticRung[]>(() => {
    const g: StdGeo = src === 'std' ? (geo === 'rect' ? 'square' : geo) : 'square'
    const mk = (s: number) => stdContour(g, s, s)
    return semanticLadder(mk, { ...DEFAULT_LAW, paddingMM: pad }, gridMode)
  }, [src, geo, pad, gridMode])

  const model = useMemo(() => {
    try {
      const law = { ...DEFAULT_LAW, paddingMM: pad }
      // NO silent per-shape overrides: manual pattern/pitch buttons behave literally; Auto searches
      // pitch × pattern under the one coverage physics (autoGrid) — shape-agnostic by construction.
      const baseCfg0 = { paddingMM: pad, pattern, plan, perimeterOnly: coverage === 'perimeter', center: centerMode, sparseThin: density === 'light' }
      // ── STANDARD GEOMETRIES (D12–D15): drawn directly in mm, each axis snapped to its own rung ──
      if (src === 'std') {
        if (!stdRungs.length) return null
        const nearest = (mm: number, pool: SemanticRung[]) => pool.reduce((b, r) => Math.abs(r.sizeMM - mm) < Math.abs(b.sizeMM - mm) ? r : b)
        // rect (system A): long + short axes each snap the SQUARE's semantic sizes; orientation flips
        const rungL = nearest(longMM, stdRungs)
        const shortPool = stdRungs.filter(r => r.sizeMM < rungL.sizeMM)
        const rungS = shortPool.length ? nearest(shortMM, shortPool) : rungL
        const nearestOwn = nearest(sizeMM, stdRungs)
        const rungW = geo === 'rect' ? (orient === 'landscape' ? rungL : rungS) : nearestOwn
        const rungH = geo === 'rect' ? (orient === 'landscape' ? rungS : rungL) : rungW
        // per-geometry zero-point: the rung size IS the geometry's own solved standard size
        const stdSize = rungW.sizeMM
        const design = stdContour(geo, stdSize, geo === 'rect' ? rungH.sizeMM : stdSize)
        const withMargin = (m: number): Contour => {
          if (Math.abs(m) < 0.01) return design
          const o = insetRingMM(design.outer.pts, m, 'round')
          return o && o.length >= 3 ? { outer: { pts: o }, holes: [] } : design
        }
        const sel = autoGrid(withMargin, baseCfg0, offsetMM, maxGrowMM, { density, pitchMM: pitchAuto ? undefined : pitch, pattern: patternAuto ? undefined : pattern })
        const chosenPitch = sel.pitchMM
        const fit = balancedFit(withMargin, { ...baseCfg0, pitchMM: sel.pitchMM, pattern: sel.pattern }, offsetMM, maxGrowMM)
        const effect = withMargin(fit.sizeMM)
        const eff = Math.round(Math.max(dim(effect, 0), dim(effect, 1)))
        let magDist: number | null = null
        const aps = fit.grid.anchors
        for (let i = 0; i < aps.length; i++) for (let j = i + 1; j < aps.length; j++) {
          const d = Math.hypot(aps[i].p[0] - aps[j].p[0], aps[i].p[1] - aps[j].p[1])
          if (magDist == null || d < magDist) magDist = d
        }
        const ratio = Math.max(rungW.sizeMM, rungH.sizeMM) / Math.min(rungW.sizeMM, rungH.sizeMM)
        const format = geo !== 'rect' ? null : ratio >= 2.5 ? 'strip' : ratio >= 1.6 ? 'panoramic' : 'block'
        return { contour: effect, design, grid: fit.grid, marginMM: fit.sizeMM, grew: fit.grew, effSize: eff, designSize: stdSize, pitch: chosenPitch, patternUsed: sel.pattern, magDist, rung: rungW, rungH, format }
      }
      // base contour normalized so longest side = 1mm (scale-free); scaleContour() sizes it in mm
      let base: Contour | null = null
      if (src === 'magic') {
        if (!magic) return null
        base = normBase(magic.vshape, magic.maskH)
      } else if (src === 'preset' && hasVectorDef(preset)) {
        base = normBase(getShape(preset, IMG, IMG, { sides, points }), IMG)
      } else {
        const params = gen === 'blob' ? { kind: gen, waviness: p1, seed: p2 }
          : gen === 'form' ? { kind: gen, pinch: p1, lobes: p2 }
          : gen === 'daisy' ? { kind: gen, depth: p1, petals: p2 }
          : { kind: gen, swirl: p1, blades: p2 }
        const ring = generateShapeRing(params as Parameters<typeof generateShapeRing>[0], IMG, IMG)
        const bb = bboxOf(ring.map(([x, y]) => ({ x, y }))); const L = Math.max(bb.w, bb.h, 1)
        base = { outer: { pts: ring.map(([x, y]) => [x / L, (IMG - y) / L] as Pt) }, holes: [] }
      }
      if (!base || base.outer.pts.length < 3) return null
      const b = base
      const baseCfg = { paddingMM: pad, pattern, plan, perimeterOnly: coverage === 'perimeter', center: centerMode, sparseThin: density === 'light' }
      // DESIGN stays fixed at the set size. Auto-grow adds an outward MARGIN (offset) around it — the border
      // the magnets' padding uses. Manual "offset" is the starting margin. Total effect = design + 2×margin.
      // random shapes (AI Magic / generators) are capped at 180mm; presets go to 200mm
      // §13 standard mode: the requested size SNAPS to the nearest zero-point rung (70/118/166/214 at
      // pad 10) — free sizes don't exist on the launch ladder. Law inputs (padding/frame) drive the rungs.
      // ADAPTIVE sizing (Dan's law, restored): the slider is CONTINUOUS — free shapes take any size and
      // the engine adapts (auto-margin snaps coverage to the 48-family grid dynamically). The rung
      // buttons are quick-sets for the rigid standard sizes; `rung` below is the nearest reference only.
      const dSize = Math.max(sizeMin, Math.min(sizeMM, src === 'preset' ? 310 : 180))
      const rung = stdRungs.length ? stdRungs.reduce((b, r) => Math.abs(r.sizeMM - dSize) < Math.abs(b.sizeMM - dSize) ? r : b) : { label: '—', points: 0, sizeMM: dSize, visible: true }
      const design = scaleContour(b, dSize)
      const withMargin = (m: number): Contour => {
        if (Math.abs(m) < 0.01) return design
        const o = insetRingMM(design.outer.pts, m, 'round')
        return o && o.length >= 3 ? { outer: { pts: o }, holes: [] } : design
      }
      // proportion-adaptive pitch: coarsest standard (72/48/24) that still holds; else the user's choice
      const sel = autoGrid(withMargin, baseCfg, offsetMM, maxGrowMM, { density, pitchMM: pitchAuto ? undefined : pitch, pattern: patternAuto ? undefined : pattern })
      const chosenPitch = sel.pitchMM
      const fit = balancedFit(withMargin, { ...baseCfg, pitchMM: sel.pitchMM, pattern: sel.pattern }, offsetMM, maxGrowMM)
      const effect = withMargin(fit.sizeMM)
      const eff = Math.round(Math.max(dim(effect, 0), dim(effect, 1)))
      // actual seated magnet distance (closest pair) — shown next to the total + annotated on canvas
      let magDist: number | null = null
      const aps = fit.grid.anchors
      for (let i = 0; i < aps.length; i++) for (let j = i + 1; j < aps.length; j++) {
        const d = Math.hypot(aps[i].p[0] - aps[j].p[0], aps[i].p[1] - aps[j].p[1])
        if (magDist == null || d < magDist) magDist = d
      }
      return { contour: effect, design, grid: fit.grid, marginMM: fit.sizeMM, grew: fit.grew, effSize: eff, designSize: dSize, pitch: chosenPitch, patternUsed: sel.pattern, magDist, rung, rungH: rung, format: null }
    } catch (e) { console.error('[grid-lab] shape build failed', e); return null }
  }, [src, geo, longMM, shortMM, orient, preset, gen, p1, p2, sides, points, sizeMM, pitch, pitchAuto, density, pad, pattern, patternAuto, plan, magic, coverage, offsetMM, centerMode, maxGrowMM, stdRungs])

  const scale = model ? (VP * FIT) / Math.max(dim(model.contour, 0), dim(model.contour, 1)) : 0
  const genParams = {
    blob: [['Waviness', '%'], ['Seed', '']], form: [['Pinch', '%'], ['Lobes', '']],
    daisy: [['Depth', '%'], ['Petals', '']], pinwheel: [['Swirl', '%'], ['Blades', '']],
  } as Record<string, [string, string][]>
  const p2max = gen === 'blob' ? 40 : gen === 'form' ? 8 : gen === 'daisy' ? 12 : 8
  const p2min = gen === 'blob' ? 1 : gen === 'form' ? 1 : gen === 'daisy' ? 5 : 3

  return (
    <div className="gl">
      <style>{CSS}</style>
      <header className="gl-head">
        <h1>Magnetic Grid Lab <span className="gl-tag">s59 · registration engine</span></h1>
        <p>Every engine shape source — presets, generators, and <b>AI image cut-out</b> — through the mm magnetic grid.
          The window is fixed; change the effect's real size and the proportions move. Drawn entirely from millimetres.</p>
      </header>

      <div className="gl-body">
        <section className="gl-card gl-stage">
          <div className="gl-stage-head">
            <span className="gl-eye">Editor viewport · fixed {VP}px</span>
            <span className="gl-eye">{model ? `1mm = ${scale.toFixed(2)} px` : '—'}</span>
          </div>
          <div className="gl-vp">
            {model ? <Stage contour={model.contour} design={model.design} grid={model.grid} frame={frame} />
              : src === 'magic'
                ? <Empty text={magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'} spin={magStatus === 'downloading-model' || magStatus.startsWith('cutting')} />
                : <Empty text="shape unavailable" />}
          </div>
          {model && <Verdict grid={model.grid} />}
          <div className="gl-legend">
            <span><i style={{ background: 'var(--magnet)' }} />6mm magnet</span>
            <span><i style={{ background: 'var(--mag8)' }} />8mm magnet</span>
            <span><i style={{ background: 'var(--margin)' }} />margin band</span>
            <span><i style={{ background: 'var(--grid)', opacity: .55 }} />node · no material</span>
            <span><i style={{ background: 'var(--fail)' }} />flap risk</span>
          </div>
        </section>

        <aside className="gl-controls">
          <div className="gl-card gl-pad">
            <div className="gl-glabel">Shape source</div>
            <div className="gl-seg gl-seg3">
              <button aria-pressed={src === 'std'} onClick={() => setSrc('std')}>Standard</button>
              <button aria-pressed={src === 'preset'} onClick={() => setSrc('preset')}>Presets</button>
              <button aria-pressed={src === 'gen'} onClick={() => setSrc('gen')}>Generators</button>
              <button aria-pressed={src === 'magic'} onClick={() => setSrc('magic')}>AI Magic</button>
            </div>

            {src === 'std' && <div className="gl-field"><span>Geometry</span>
              <div className="gl-seg">
                {([['square', 'Square'], ['diamondShape', 'Diamond'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['triangle', 'Triangle']] as [StdGeo, string][]).map(([g, l]) =>
                  <button key={g} aria-pressed={geo === g} onClick={() => setGeo(g)}>{l}</button>)}
              </div>
            </div>}

            {src === 'preset' && <>
              <label className="gl-field"><span>Preset shape</span>
                <select value={preset} onChange={e => setPreset(e.target.value as VectorShapeKind)}>
                  {PRESETS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              {preset === 'polygon' && <Slider label="Sides" v={sides} set={setSides} min={3} max={12} />}
              {preset === 'star' && <Slider label="Points" v={points} set={setPoints} min={3} max={12} />}
            </>}

            {src === 'gen' && <>
              <div className="gl-seg gl-wrap">
                {GENS.map(g => <button key={g.k} aria-pressed={gen === g.k} onClick={() => { setGen(g.k); setP1(50); setP2(g.k === 'blob' ? 7 : g.k === 'daisy' ? 8 : g.k === 'pinwheel' ? 5 : 4) }}>{g.label}</button>)}
              </div>
              <Slider label={genParams[gen][0][0]} unit={genParams[gen][0][1]} v={p1} set={setP1} min={0} max={100} />
              <Slider label={genParams[gen][1][0]} v={p2} set={setP2} min={p2min} max={p2max} />
            </>}

            {src === 'magic' && <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <button className="gl-upload" onClick={() => fileRef.current?.click()}>
                {magic ? 'Replace image' : 'Upload an image'}
              </button>
              <div className="gl-magic-note">
                {magStatus === 'downloading-model' ? '↓ downloading cut-out model (one time)…'
                  : magStatus.startsWith('cutting') ? '✂ cutting out the subject…'
                    : magStatus.startsWith('error') ? '⚠ ' + magStatus.slice(6)
                      : magic ? `cut by ${magic.adapter} · edit size below`
                        : 'AI removes the background and traces the silhouette — that outline meets the grid.'}
              </div>
            </>}
          </div>

          <div className="gl-card gl-pad">
            {/* SEMANTIC SIZES — the shape's own T-shirt ladder (anchor-count tiers), mode + recipe driven */}
            {!(src === 'std' && geo === 'rect') && <div className="gl-field"><span>Size · {src === 'std' ? 'this shape' : 'square ref'} · {gridMode === 'quincunx' ? 'dice' : gridMode}</span>
              <div className="gl-seg gl-wrap">
                {stdRungs.map(r =>
                  <button key={r.sizeMM} aria-pressed={model?.rung.sizeMM === r.sizeMM}
                    className={r.visible ? undefined : 'gl-hidden-rung'}
                    onClick={() => setSizeMM(r.sizeMM)}
                    title={`${r.points} anchor point${r.points > 1 ? 's' : ''} · ${r.sizeMM}mm${r.visible ? '' : ' · hidden at launch (untested)'}`}>
                    {r.label} {r.sizeMM}{r.visible ? '' : '†'}
                  </button>)}
              </div>
            </div>}
            {src === 'std' && geo === 'rect' && <>
              {/* system A: long side → short side (< long) → orientation */}
              <div className="gl-field"><span>Long side · size</span>
                <div className="gl-seg gl-wrap">
                  {stdRungs.filter(r => r.points >= 2).map(r =>
                    <button key={'L' + r.sizeMM} aria-pressed={Math.max(model?.rung.sizeMM ?? 0, model?.rungH?.sizeMM ?? 0) === r.sizeMM}
                      className={r.visible ? undefined : 'gl-hidden-rung'}
                      onClick={() => setLongMM(r.sizeMM)}
                      title={`${r.points} anchor points · ${r.sizeMM}mm${r.visible ? '' : ' · hidden at launch (untested)'}`}>
                      {r.label} {r.sizeMM}{r.visible ? '' : '†'}
                    </button>)}
                </div>
              </div>
              <div className="gl-field"><span>Short side · size</span>
                <div className="gl-seg gl-wrap">
                  {stdRungs.filter(r => r.sizeMM < Math.max(...stdRungs.filter(q => Math.abs(q.sizeMM - longMM) === Math.min(...stdRungs.map(w => Math.abs(w.sizeMM - longMM)))).map(q => q.sizeMM))).map(r =>
                    <button key={'S' + r.sizeMM} aria-pressed={Math.min(model?.rung.sizeMM ?? 0, model?.rungH?.sizeMM ?? 0) === r.sizeMM}
                      className={r.visible ? undefined : 'gl-hidden-rung'}
                      onClick={() => setShortMM(r.sizeMM)}>
                      {r.label} {r.sizeMM}{r.visible ? '' : '†'}
                    </button>)}
                </div>
              </div>
              <div className="gl-field"><span>Orientation</span>
                <div className="gl-seg">
                  <button aria-pressed={orient === 'landscape'} onClick={() => setOrient('landscape')}>Landscape</button>
                  <button aria-pressed={orient === 'portrait'} onClick={() => setOrient('portrait')}>Portrait</button>
                </div>
              </div>
            </>}
            <Slider label={`Design size · longest side${src !== 'preset' ? ' · max 180' : ''}`} unit="mm" v={Math.max(sizeMin, Math.min(sizeMM, sizeMax))} set={setSizeMM} min={sizeMin} max={sizeMax} />
            <Slider label="Max auto-margin · balance" unit="mm" v={maxGrowMM} set={setMaxGrowMM} min={0} max={80} />
            {model && <div className="gl-total">
              <span className="gl-total-k">Total effect size</span>
              <b className="gl-total-v">{model.effSize}<small> mm</small></b>
              <span className="gl-total-note">{model.marginMM > 0.5 ? `design ${model.designSize}mm + ${Math.round(model.marginMM)}mm margin${model.grew > 0.5 ? ` (+${Math.round(model.grew)} auto)` : ''}` : `design ${model.designSize}mm · no margin`}</span>
              <span className="gl-total-note gl-total-grid">grid {model.pitch}mm{model.magDist != null ? ` · magnets ${Math.round(model.magDist)}mm apart${Math.abs(model.magDist - model.pitch * Math.SQRT2) < 1.5 ? ` · grid diagonal (${model.pitch}×√2)` : Math.abs(model.magDist - model.pitch * Math.SQRT2 / 2) < 1.5 ? ` · dice half-diagonal` : ''}` : ''}</span>
              <span className="gl-total-note">{model.format ? `${model.rung.sizeMM}×${model.rungH.sizeMM} · ${model.format}` : `size ${model.rung.label} · ${model.rung.points} anchor points · ${model.rung.sizeMM}mm`}{model.rung.visible && model.rungH.visible ? '' : ' · HIDDEN (untested)'}</span>
            </div>}
            <div className="gl-field"><span>Grid density · cells</span>
              <div className="gl-seg">
                <button aria-pressed={density === 'standard'} onClick={() => setDensity('standard')} title="48-first — more cells, firmer hold">Standard</button>
                <button aria-pressed={density === 'light'} onClick={() => setDensity('light')} title="96-first — fewer cells, sparse/uncrowded">Light</button>
              </div>
            </div>
            <div className="gl-field"><span>Grid pitch · {pitchAuto && model ? `auto → ${model.pitch}mm` : 'manual'}</span>
              <div className="gl-seg">
                <button aria-pressed={pitchAuto} onClick={() => setPitchAuto(true)}>Auto</button>
                <button aria-pressed={!pitchAuto && pitch === 48} onClick={() => { setPitchAuto(false); setPitch(48) }}>48</button>
                <button aria-pressed={!pitchAuto && pitch === 96} onClick={() => { setPitchAuto(false); setPitch(96) }}>96</button>
              </div>
            </div>
            <Slider label="Magnet padding · per spot · min 10" unit="mm" v={pad} set={setPad} min={10} max={30} />
            <Slider label="Base margin · outward offset" unit="mm" v={offsetMM} set={setOffsetMM} min={-15} max={15} />

            <div className="gl-field"><span>Grid pattern · {patternAuto && model ? `auto → ${model.patternUsed === 'quincunx' ? 'dice-5' : model.patternUsed}` : 'manual'}</span>
              <div className="gl-seg">
                <button aria-pressed={patternAuto} onClick={() => setPatternAuto(true)}>Auto</button>
                {(['standard', 'quincunx', 'diamond'] as GridPattern[]).map(p =>
                  <button key={p} aria-pressed={!patternAuto && pattern === p} onClick={() => { setPatternAuto(false); setPattern(p) }}>{p === 'quincunx' ? 'Dice-5' : p === 'diamond' ? 'Diamond' : 'Standard'}</button>)}
              </div>
            </div>
            <div className="gl-field"><span>Coverage</span>
              <div className="gl-seg">
                {([['full', 'Full grid'], ['perimeter', 'Perimeter belt']] as ['full' | 'perimeter', string][]).map(([c, l]) =>
                  <button key={c} aria-pressed={coverage === c} onClick={() => setCoverage(c)}>{l}</button>)}
              </div>
            </div>
            <div className="gl-field"><span>Grid centering · A/B</span>
              <div className="gl-seg">
                {([['centroid', 'Centroid'], ['bbox', 'Bbox centre']] as ['centroid' | 'bbox', string][]).map(([m, l]) =>
                  <button key={m} aria-pressed={centerMode === m} onClick={() => setCenterMode(m)}>{l}</button>)}
              </div>
            </div>
            <div className="gl-field"><span>Magnet plan</span>
              <div className="gl-seg">
                {([['all6', 'All 6mm'], ['all8', 'All 8mm'], ['corners8', 'Corners 8']] as [MagnetPlan, string][]).map(([p, l]) =>
                  <button key={p} aria-pressed={plan === p} onClick={() => setPlan(p)}>{l}</button>)}
              </div>
            </div>
            <label className="gl-toggle"><span>1 mm frame</span>
              <input type="checkbox" checked={frame} onChange={e => setFrame(e.target.checked)} />
            </label>
          </div>

          {model && <div className="gl-card gl-read">
            <Cell k="Real size" v={`${Math.round(dim(model.contour, 0))}×${Math.round(dim(model.contour, 1))} mm`} />
            <Cell k="Render scale" v={`${scale.toFixed(2)} px/mm`} />
            <Cell k="Pitch · center" v={`${model.grid.pitchCentreMM} mm`} />
            <Cell k="Pitch · edge" v={model.grid.edgeRangeMM[0] === model.grid.edgeRangeMM[1] ? `${model.grid.edgeRangeMM[0]} mm` : `${model.grid.edgeRangeMM[0]}–${model.grid.edgeRangeMM[1]} mm`} />
            <Cell k="Seated magnets" v={String(model.grid.anchors.length)} />
            <Cell k="Pattern" v={model.patternUsed === 'quincunx' ? 'dice-5' : model.patternUsed} />
          </div>}
        </aside>
      </div>
    </div>
  )
}

function cap(s: string) { return s[0].toUpperCase() + s.slice(1) }
function dim(c: Contour, axis: 0 | 1): number {
  let lo = Infinity, hi = -Infinity
  for (const p of c.outer.pts) { if (p[axis] < lo) lo = p[axis]; if (p[axis] > hi) hi = p[axis] }
  return hi - lo
}

const pathFrom = (pp: Pt[]) => 'M ' + pp.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z'
function Stage({ contour, design, grid, frame }: { contour: Contour; design: Contour; grid: ReturnType<typeof computeGrid>; frame: boolean }) {
  const ePts = contour.outer.pts.map(([x, y]) => [x, -y] as Pt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ePts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const w = maxX - minX, h = maxY - minY
  const pad = Math.max(w, h) * 0.09 // room for the edge-to-edge measurement frame + labels
  const vbW = w + 2 * pad, vbH = h + 2 * pad
  const S = (VP * FIT) / Math.max(vbW, vbH)
  const fontMM = pad * 0.5
  const eD = pathFrom(ePts)
  const hasMargin = design !== contour && design.outer.pts.length >= 3
  const dD = hasMargin ? pathFrom(design.outer.pts.map(([x, y]) => [x, -y] as Pt)) : ''
  const fy = (p: Pt): Pt => [p[0], -p[1]]
  const seat = new Set(grid.anchors.map(a => a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2)))
  const hasFlap = grid.flaps.length > 0
  return (
    <svg width={vbW * S} height={vbH * S} viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}>
      {/* faint edge-to-edge frame at the ultimate extent + the real W×H (total effect size) */}
      <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="var(--ink-3)" strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="3 2.2" />
      <text x={minX + w / 2} y={minY - pad * 0.28} fontSize={fontMM} fill="var(--ink-3)" textAnchor="middle" fontFamily="ui-monospace,monospace">{Math.round(w)} mm</text>
      <text x={minX - pad * 0.28} y={minY + h / 2} fontSize={fontMM} fill="var(--ink-3)" textAnchor="middle" fontFamily="ui-monospace,monospace" transform={`rotate(-90 ${minX - pad * 0.28} ${minY + h / 2})`}>{Math.round(h)} mm</text>
      {/* effect = design + margin: fill the whole effect as MARGIN material, then the design on top → the
          margin band shows as the ring between the dashed design outline and the effect edge. */}
      <path d={eD} fill={hasMargin ? 'var(--margin)' : 'var(--suede)'} />
      {hasMargin && <path d={dD} fill="var(--suede)" />}
      {/* frame: red when edges would lift (flap risk), else the 1mm suede edge — no per-vertex ring spam */}
      {frame && <path d={eD} fill="none" stroke={hasFlap ? 'var(--fail)' : 'var(--suede-edge)'} strokeOpacity={hasFlap ? 0.85 : 1} strokeWidth={hasFlap ? 1.5 : 1} strokeLinejoin="round" />}
      {hasMargin && <path d={dD} fill="none" stroke="var(--accent)" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="3 2" />}
      {grid.candidates.filter(c => !seat.has(c[0].toFixed(2) + ',' + c[1].toFixed(2))).map((c, i) => {
        const p = fy(c); return <circle key={'c' + i} cx={p[0]} cy={p[1]} r={1.6} fill="var(--grid)" fillOpacity={0.5} />
      })}
      {/* per-spot application padding ring: magnet radius + padding — the material each magnet needs to bond */}
      {grid.anchors.map((a, i) => { const p = fy(a.p); return <circle key={'ring' + i} cx={p[0]} cy={p[1]} r={grid.applicationPadMM} fill="none" stroke="var(--accent)" strokeOpacity={0.3} strokeWidth={0.5} strokeDasharray="2.5 2.5" /> })}
      {grid.anchors.map((a, i) => {
        const p = fy(a.p)
        return <g key={'a' + i}>
          <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill={a.dia === 8 ? 'var(--mag8)' : 'var(--magnet)'} />
          <circle cx={p[0] - a.dia * 0.12} cy={p[1] - a.dia * 0.12} r={a.dia / 2 * 0.4} fill="var(--magnet-hi)" fillOpacity={0.5} />
        </g>
      })}
      {/* live magnet-distance annotation: dimension line on the CLOSEST seated pair, real mm */}
      {(() => {
        const a = grid.anchors
        if (a.length < 2) return null
        let bi = 0, bj = 1, bd = Infinity
        for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
          const d = Math.hypot(a[i].p[0] - a[j].p[0], a[i].p[1] - a[j].p[1])
          if (d < bd) { bd = d; bi = i; bj = j }
        }
        const p1 = fy(a[bi].p), p2 = fy(a[bj].p)
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2
        return <g>
          {/* dark underlay + white overlay → legible on the dark suede AND the light margin band */}
          <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#000" strokeOpacity={0.5} strokeWidth={1.6} />
          <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#fff" strokeOpacity={0.95} strokeWidth={0.7} strokeDasharray="1.8 1.4" />
          <text x={mx} y={my - 2.4} fontSize={fontMM * 1.05} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={fontMM * 0.22} strokeOpacity={0.65} style={{ paintOrder: 'stroke' }} textAnchor="middle" fontFamily="ui-monospace,monospace">{Math.round(bd)} mm{Math.abs(bd - grid.pitchCentreMM * Math.SQRT2) < 1.5 ? ` · ${grid.pitchCentreMM}×√2` : Math.abs(bd - grid.pitchCentreMM / Math.SQRT2) < 1.5 ? ` · dice ½·${grid.pitchCentreMM}√2` : ''}</text>
        </g>
      })()}
    </svg>
  )
}

function Verdict({ grid }: { grid: ReturnType<typeof computeGrid> }) {
  return (
    <div className={`gl-verdict ${grid.ok ? 'ok' : 'bad'}`}>
      <div className="gl-vrow"><span className="gl-dot" /><b>{grid.ok ? `Holds — ${grid.anchors.length} magnets seated, spread across material` : "Won't hold reliably"}</b></div>
      {grid.issues.map((s, i) => <div key={i} className="gl-issue">{s}</div>)}
    </div>
  )
}
function Empty({ text, spin }: { text: string; spin?: boolean }) {
  return <div className="gl-empty">{spin && <span className="gl-spin" />}{text}</div>
}
function Slider({ label, v, set, min, max, unit }: { label: string; v: number; set: (n: number) => void; min: number; max: number; unit?: string }) {
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span><b>{v}{unit ? ' ' + unit : ''}</b></div>
      <input type="range" min={min} max={max} value={v} onChange={e => set(+e.target.value)} />
    </label>
  )
}
function Cell({ k, v }: { k: string; v: string }) { return <div className="gl-cell"><span>{k}</span><b>{v}</b></div> }

const CSS = `
.gl{--bg:#eef1f5;--panel:#fff;--panel-2:#f6f8fb;--line:#dbe1ea;--ink:#18202e;--ink-2:#5a6577;--ink-3:#93a0b3;
  --accent:#2f6bff;--accent-soft:#2f6bff18;--grid:#9fb0cc;--suede:#ccd0d7;--margin:#aeb4bf;--suede-edge:#8a919c;--magnet:#20242c;
  --magnet-hi:#6b7280;--mag8:#c98a12;--pass:#1a9e4b;--fail:#e5484d;--shadow:0 1px 2px #18202e0d,0 10px 26px #18202e0f;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;padding:26px 20px 70px;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme:dark){.gl:not([data-theme]){--bg:#0f141b;--panel:#161c25;--panel-2:#12171f;--line:#232c3a;--ink:#e6edf3;--ink-2:#9aa6b6;--ink-3:#66717f;--accent:#4d84ff;--accent-soft:#4d84ff20;--grid:#3d4a60;--suede:#3a3e46;--margin:#4d535e;--suede-edge:#22262d;--magnet:#0b0e12;--magnet-hi:#4a515c;--shadow:0 1px 2px #0005,0 12px 30px #0006}}
.gl *{box-sizing:border-box}
.gl-head{max-width:1060px;margin:0 auto 20px}
.gl-head h1{font-size:20px;font-weight:640;letter-spacing:-.01em;margin:0 0 5px;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.gl-tag{font:600 11px var(--mono);color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:20px;letter-spacing:.02em}
.gl-head p{color:var(--ink-2);font-size:13.5px;margin:0;max-width:74ch;line-height:1.55}
.gl-body{max-width:1060px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:20px;align-items:start}
@media (max-width:840px){.gl-body{grid-template-columns:1fr}}
.gl-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.gl-pad{padding:18px;display:flex;flex-direction:column;gap:15px}
.gl-stage{padding:20px;display:flex;flex-direction:column;gap:14px}
.gl-stage-head{display:flex;justify-content:space-between;gap:10px}
.gl-eye{font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.gl-vp{aspect-ratio:1;max-width:${VP}px;width:100%;margin:0 auto;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(var(--line) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/22px 22px,var(--panel-2);
  border:1px dashed var(--line);border-radius:12px;overflow:hidden}
.gl-empty{display:flex;align-items:center;gap:9px;color:var(--ink-3);font:12.5px var(--mono);text-align:center;padding:20px;max-width:80%}
.gl-spin{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:gspin .8s linear infinite;flex:none}
@keyframes gspin{to{transform:rotate(360deg)}}
.gl-verdict{padding:10px 13px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);font-size:13px}
.gl-vrow{display:flex;align-items:center;gap:9px}
.gl-dot{width:9px;height:9px;border-radius:50%;flex:none}
.gl-verdict.ok .gl-dot{background:var(--pass)}.gl-verdict.ok b{color:var(--pass)}
.gl-verdict.bad .gl-dot{background:var(--fail)}.gl-verdict.bad b{color:var(--fail)}
.gl-issue{font:11.5px var(--mono);color:var(--ink-2);margin-top:6px;padding-left:18px}
.gl-legend{display:flex;flex-wrap:wrap;gap:13px;font:11px var(--mono);color:var(--ink-2)}
.gl-legend span{display:inline-flex;align-items:center;gap:5px}.gl-legend i{width:10px;height:10px;border-radius:3px}
.gl-controls{display:flex;flex-direction:column;gap:16px}
.gl-glabel{font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.gl-seg{display:flex;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:3px}
.gl-seg3 button,.gl-seg button{flex:1;min-width:0;font:550 12px var(--sans);color:var(--ink-2);background:none;border:0;border-radius:7px;padding:8px 4px;cursor:pointer;transition:.12s;white-space:nowrap}
.gl-seg.gl-wrap{flex-wrap:wrap}.gl-seg.gl-wrap button{min-width:64px}
.gl-seg button:hover{color:var(--ink)}
.gl-seg button[aria-pressed=true]{background:var(--accent);color:#fff;box-shadow:0 1px 2px #0002}
.gl-seg button.gl-hidden-rung{color:var(--mag8);font-style:italic}
.gl-seg button.gl-hidden-rung[aria-pressed=true]{background:var(--mag8);color:#fff;font-style:normal}
.gl-field{display:flex;flex-direction:column;gap:8px;font:600 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-field select{font:500 13px var(--sans);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px;cursor:pointer}
.gl-upload{font:600 13px var(--sans);color:#fff;background:var(--accent);border:0;border-radius:10px;padding:11px;cursor:pointer;width:100%}
.gl-upload:hover{filter:brightness(1.05)}
.gl-magic-note{font:11.5px var(--mono);color:var(--ink-2);line-height:1.5}
.gl-snap{font-size:12.5px;color:var(--ink-2)}.gl-snap b{font:600 13px var(--mono);color:var(--ink)}.gl-snap span{display:block;font:11px var(--mono);color:var(--ink-3);margin-top:3px}
.gl-total{margin:2px 0;padding:13px 15px;background:var(--accent-soft);border:1px solid var(--accent);border-radius:12px;display:flex;flex-direction:column;gap:3px}
.gl-total-k{font:600 10px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
.gl-total-v{font:700 32px var(--mono);color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
.gl-total-v small{font-size:15px;font-weight:600;color:var(--ink-2)}
.gl-total-note{font:11px var(--mono);color:var(--ink-2)}
.gl-slider{display:flex;flex-direction:column;gap:6px}
.gl-slider-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--ink-2)}
.gl-slider-row b{font:600 12.5px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
.gl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;background:var(--line);outline:none}
.gl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);box-shadow:0 1px 3px #0003;cursor:pointer}
.gl input[type=range]::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);cursor:pointer}
.gl-toggle{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-2);cursor:pointer}
.gl-toggle input{width:17px;height:17px;accent-color:var(--accent)}
.gl-read{padding:0;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);overflow:hidden}
.gl-cell{background:var(--panel);padding:11px 14px;display:flex;flex-direction:column;gap:2px}
.gl-cell span{font:10px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-cell b{font:600 14px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
`
