'use client'

// grid-lab — Session 59 magnetic-grid registration bench (2D vector).
// ALL engine shape sources through contourFromShape → computeGrid, rendered true-to-scale:
//   • Presets    — shape-library getShape() (baked vector data)
//   • Generators — generateShapeRing() (blob / clover / daisy / pinwheel)
//   • AI Magic   — image upload → prepareShaped() → u2netp lightweight cut-out → outline

import { useEffect, useMemo, useRef, useState } from 'react'
import { getShape, hasVectorDef, type VectorShapeKind } from '@/lib/shape-library'
import { type VShape } from '@/lib/vector-core'
import { generateShapeRing, type ShapeKind } from '../v5.3.1/user/shapes'
import { loadImage, prepareShaped } from '../v5.3.1/core/primitives'
import type { Contour, Pt } from '@/lib/effect/types'
import { DEFAULT_PITCH_MM, type BandSnapPoint, type GridResult, type MagnetPlan } from '@/lib/effect/grid-origin'
import { BANDS, FLAP_CEIL_MM, FLAP_FLOOR_MM, FLAP_MM, MIN_EFFECT_MM, PADDING_CEIL_MM, PADDING_FLOOR_MM, PHASE_STEP_FLOOR_MM, PHASE_STEP_MM, RELEASED_PADDING_MM, RELEASED_PITCHES_MM, SNAP_STEP_MM } from '@/lib/effect/grid-origin-spec'
import { fieldSpots, normBaseContour, normGeneratedRing, seatedSpots, sizeRange, type FieldSpot } from '@/lib/effect/grid-origin-bridge'

const IMG = 1000
/** Stage pixel size — element, px/mm scale and header label all derive from it. */
const VP = 640
const FIT = 0.86

const PRESETS: VectorShapeKind[] = ['squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus', 'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie']
const GENS: { k: ShapeKind; label: string; p1: [string, string]; p2: [string, string]; p2min: number; p2max: number; p2start: number }[] = [
  { k: 'blob', label: 'Blob', p1: ['Waviness', '%'], p2: ['Seed', ''], p2min: 1, p2max: 40, p2start: 7 },
  { k: 'form', label: 'Clover', p1: ['Pinch', '%'], p2: ['Lobes', ''], p2min: 1, p2max: 8, p2start: 4 },
  { k: 'daisy', label: 'Daisy', p1: ['Depth', '%'], p2: ['Petals', ''], p2min: 5, p2max: 12, p2start: 8 },
  { k: 'pinwheel', label: 'Pinwheel', p1: ['Swirl', '%'], p2: ['Blades', ''], p2min: 3, p2max: 8, p2start: 5 },
]

type Src = 'preset' | 'gen' | 'magic'
type MagicState = { vshape: VShape; maskH: number; adapter: string; imgUrl: string } | null

/** Admin dial that survives reloads — browser-stored, initialized from the spec default. */
function usePersisted(key: string, initial: number): [number, (n: number) => void] {
  const [v, setV] = useState(initial)
  useEffect(() => {
    const raw = localStorage.getItem('grid-origin.' + key)
    if (raw !== null && Number.isFinite(+raw)) setV(+raw)
  }, [key])
  const set = (n: number) => { setV(n); try { localStorage.setItem('grid-origin.' + key, String(n)) } catch { } }
  return [v, set]
}

export default function GridLab() {
  const [src, setSrc] = useState<Src>('preset')
  const [preset, setPreset] = useState<VectorShapeKind>('squircle')
  const [gen, setGen] = useState<ShapeKind>('blob')
  const [p1, setP1] = useState(55) // waviness / pinch / depth / swirl
  const [p2, setP2] = useState(7)  // seed / lobes / petals / blades
  const [sides, setSides] = useState(6)
  const [points, setPoints] = useState(5)
  // Opens on the B2 floor — the 72mm square standard (2×2), from spec.
  const [sizeMM, setSizeMM] = useState(BANDS[1].minMM)
  /** Free-slider limits — typed, persisted across reloads. */
  const [sizeMin, setSizeMin] = usePersisted('sizeMin', MIN_EFFECT_MM)
  const [sizeMax, setSizeMax] = usePersisted('sizeMax', sizeRange(RELEASED_PADDING_MM).maxMM)
  const [pitch, setPitch] = useState(DEFAULT_PITCH_MM)
  const [pad, setPad] = usePersisted('pad', RELEASED_PADDING_MM)
  /** Flap allowance dial — how far material may reach past a spot's edge; 0 = edge-to-edge wrap. */
  const [flap, setFlap] = usePersisted('flap', FLAP_MM)
  /** Placement step dial — how finely the lattice slides under the shape; 1 = continuous panning. */
  const [phaseStep, setPhaseStep] = usePersisted('phaseStep', PHASE_STEP_MM)
  const [offsetMM, setOffsetMM] = useState(0)
  const [plan, setPlan] = useState<MagnetPlan>('all6')
  /** Off: seated spots only. On: every position the shape was judged against. */
  const [showLattice, setShowLattice] = useState(true)
  /** A band id snaps to that band's fit ladder; 'free' is the continuous slider. */
  const [mode, setMode] = useState<number | 'free'>('free')
  /** Selected step on the band's ladder; null = the band's own pick (smallest size at max count). */
  const [stepSel, setStepSel] = useState<number | null>(null)
  /** Snap scan step — admin-tunable for testing; default from spec. */
  const [snapStep, setSnapStep] = usePersisted('snapStep', SNAP_STEP_MM)
  /** Manual grid calibration — a forced registration (mm), or null for the engine's auto pick. */
  const [manual, setManual] = useState<{ x: number; y: number } | null>(null)
  const [coverage, setCoverage] = useState<'full' | 'perimeter'>('perimeter')

  /** Baseline handling: "save" stamps the current dials as the working default; "reset" restores
   *  the saved baseline, or spec defaults when none was saved. */
  const saveDefaults = () => {
    try { localStorage.setItem('grid-origin.defaults', JSON.stringify({ pad, flap, phaseStep, snapStep, sizeMin, sizeMax })) } catch { }
  }
  const resetDefaults = () => {
    let d = { pad: RELEASED_PADDING_MM, flap: FLAP_MM, phaseStep: PHASE_STEP_MM, snapStep: SNAP_STEP_MM, sizeMin: MIN_EFFECT_MM, sizeMax: sizeRange(RELEASED_PADDING_MM).maxMM }
    try { const raw = localStorage.getItem('grid-origin.defaults'); if (raw) d = { ...d, ...JSON.parse(raw) } } catch { }
    setPad(d.pad); setFlap(d.flap); setPhaseStep(d.phaseStep); setSnapStep(d.snapStep); setSizeMin(d.sizeMin); setSizeMax(d.sizeMax)
  }

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

  // base contour normalized so longest side = 1mm (scale-free) — cheap, main thread.
  const base = useMemo<Contour | null>(() => {
    try {
      if (src === 'magic') {
        if (!magic) return null
        return normBaseContour(magic.vshape, magic.maskH)
      }
      if (src === 'preset' && hasVectorDef(preset)) {
        return normBaseContour(getShape(preset, IMG, IMG, { sides, points }), IMG)
      }
      const params = gen === 'blob' ? { kind: gen, waviness: p1, seed: p2 }
        : gen === 'form' ? { kind: gen, pinch: p1, lobes: p2 }
          : gen === 'daisy' ? { kind: gen, depth: p1, petals: p2 }
            : { kind: gen, swirl: p1, blades: p2 }
      const ring = generateShapeRing(params as Parameters<typeof generateShapeRing>[0], IMG, IMG)
      return normGeneratedRing(ring, IMG)
    } catch (e) { console.error('[grid-lab] shape build failed', e); return null }
  }, [src, preset, gen, p1, p2, sides, points, magic])

  // The solve runs in a worker so the page never freezes; the last result stays up while solving.
  type Model = { contour: Contour; grid: GridResult; effSize: number; ladder: BandSnapPoint[]; idx: number }
  const [model, setModel] = useState<Model | null>(null)
  const [solving, setSolving] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const seqRef = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('./solve.worker.ts', import.meta.url))
    workerRef.current = w
    w.onmessage = (e) => {
      if (e.data.id !== seqRef.current) return
      if (e.data.error) console.error('[grid-lab] solve failed', e.data.error)
      setModel(e.data.model)
      setSolving(false)
    }
    return () => { workerRef.current = null; w.terminate() }
  }, [])
  useEffect(() => {
    const w = workerRef.current
    if (!w) return
    if (!base || base.outer.pts.length < 3) { setModel(null); return }
    const cfg = { pitchMM: pitch, paddingMM: pad, flapMM: flap, phaseStepMM: phaseStep, forcePhaseMM: manual ? [manual.x, manual.y] as Pt : undefined, plan, perimeterOnly: coverage === 'perimeter', circle: src === 'preset' && preset === 'circle' && offsetMM === 0 }
    const id = ++seqRef.current
    setSolving(true)
    w.postMessage({ id, base, offsetMM, cfg, mode, sizeMM, snapStep, stepSel })
  }, [base, src, preset, sizeMM, pitch, pad, flap, phaseStep, manual, plan, mode, stepSel, coverage, offsetMM, snapStep])

  const scale = model ? (VP * FIT) / Math.max(dim(model.contour, 0), dim(model.contour, 1)) : 0
  const genDef = GENS.find((g) => g.k === gen) ?? GENS[0]

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
            {solving && <div className="gl-solving"><span className="gl-spin" />solving…</div>}
            {model ? <Stage contour={model.contour} grid={model.grid} lattice={showLattice}
              onPan={(dx, dy) => setManual((m) => { const bx = m ? m.x : model.grid.phaseMM[0], by = m ? m.y : model.grid.phaseMM[1]; return { x: bx + dx, y: by + dy } })}
              onZoom={(f) => setSizeMM((s) => Math.min(sizeMax, Math.max(sizeMin, s * f)))}
              onReset={() => setManual(null)} />
              : src === 'magic'
                ? <Empty text={magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'} spin={magStatus === 'downloading-model' || magStatus.startsWith('cutting')} />
                : <Empty text="shape unavailable" />}
          </div>
          {model && <Verdict grid={model.grid} />}
          <div className="gl-legend">
            <span><i style={{ background: 'var(--magnet)' }} />6mm magnet</span>
            <span><i style={{ background: 'var(--mag8)' }} />8mm magnet</span>
            <span><i style={{ background: 'var(--grid)', opacity: .55 }} />spot · no magnet</span>
            <span><i style={{ background: 'var(--fail)' }} />flap risk</span>
          </div>
        </section>

        <aside className="gl-controls">
          <div className="gl-card gl-pad">
            <div className="gl-glabel">Shape source</div>
            <div className="gl-seg gl-seg3">
              <button aria-pressed={src === 'preset'} onClick={() => setSrc('preset')}>Presets</button>
              <button aria-pressed={src === 'gen'} onClick={() => setSrc('gen')}>Generators</button>
              <button aria-pressed={src === 'magic'} onClick={() => setSrc('magic')}>AI Magic</button>
            </div>

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
                {GENS.map(g => <button key={g.k} aria-pressed={gen === g.k} onClick={() => { setGen(g.k); setP1(50); setP2(g.p2start) }}>{g.label}</button>)}
              </div>
              <Slider label={genDef.p1[0]} unit={genDef.p1[1]} v={p1} set={setP1} min={0} max={100} />
              <Slider label={genDef.p2[0]} v={p2} set={setP2} min={genDef.p2min} max={genDef.p2max} />
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
            <div className="gl-field"><span>Band · snaps to fit</span>
              <div className="gl-seg">
                {BANDS.map((b) =>
                  <button key={b.id} aria-pressed={mode === b.id} onClick={() => { setMode(b.id); setStepSel(null); setManual(null) }}>B{b.id}</button>)}
                <button aria-pressed={mode === 'free'} onClick={() => { setMode('free'); setManual(null) }}>Free</button>
              </div>
            </div>
            {mode === 'free'
              ? <>
                  <Slider label="Effect size · longest side" unit="mm" v={Math.round(sizeMM)} set={setSizeMM} min={sizeMin} max={sizeMax} />
                  <div className="gl-field"><span>Slider limits</span>
                    <div className="gl-limits">
                      <span className="gl-num"><i>min</i>
                        <input key={'mn' + sizeMin} type="number" defaultValue={sizeMin}
                          onBlur={(e) => { const n = Math.round(+e.currentTarget.value); if (Number.isFinite(n) && n > 0 && n < sizeMax) { setSizeMin(n); if (sizeMM < n) setSizeMM(n) } }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /></span>
                      <span className="gl-num"><i>max</i>
                        <input key={'mx' + sizeMax} type="number" defaultValue={sizeMax}
                          onBlur={(e) => { const n = Math.round(+e.currentTarget.value); if (Number.isFinite(n) && n > sizeMin) { setSizeMax(n); if (sizeMM > n) setSizeMM(n) } }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /></span>
                    </div>
                  </div>
                </>
              : <>
                  <div className="gl-snap">Fit <b>B{mode}-{model?.ladder.length ? model.idx + 1 : '—'}</b> · <b>{model ? model.effSize : '—'} mm</b>
                    <span>{model?.ladder.length ?? 0} holding layouts in band · {model?.grid.anchors.length ?? 0} magnets{model && !model.ladder.length ? ' · nothing fully fits — best seated shown' : ''}</span></div>
                  {(model?.ladder.length ?? 0) > 0 && <div className="gl-steps">
                    {model!.ladder.map((pt, i) =>
                      <button key={pt.sizeMM + pt.sig} aria-pressed={i === model!.idx}
                        onClick={() => setStepSel(i)}>B{mode}-{i + 1}<em>{pt.sizeMM} mm · {pt.count}⌾</em></button>)}
                  </div>}
                  <Slider label="Snap step" unit="mm" v={snapStep} set={setSnapStep} min={SNAP_STEP_MM} max={MIN_EFFECT_MM} />
                </>}
            <div className="gl-field"><span>Grid pitch · released tiers</span>
              <div className="gl-seg">
                {RELEASED_PITCHES_MM.map(({ mm, label }) =>
                  <button key={mm} aria-pressed={pitch === mm} onClick={() => setPitch(mm)}>{label}</button>)}
              </div>
            </div>
            <Slider label="Magnet padding · per spot" unit="mm" v={pad} set={setPad} min={PADDING_FLOOR_MM} max={PADDING_CEIL_MM} />
            <Slider label="Flap allowance · past spot edge" unit="mm" v={flap} set={setFlap} min={FLAP_FLOOR_MM} max={FLAP_CEIL_MM} />
            <Slider label="Placement step · grid slide" unit="mm" v={phaseStep} set={setPhaseStep} min={PHASE_STEP_FLOOR_MM} max={MIN_EFFECT_MM} />
            <Slider label="Outline offset · grow / shrink" unit="mm" v={offsetMM} set={setOffsetMM} min={-15} max={15} />

            <div className="gl-field"><span>Coverage</span>
              <div className="gl-seg">
                {([['full', 'Full grid'], ['perimeter', 'Perimeter belt']] as ['full' | 'perimeter', string][]).map(([c, l]) =>
                  <button key={c} aria-pressed={coverage === c} onClick={() => setCoverage(c)}>{l}</button>)}
              </div>
            </div>
            <div className="gl-field"><span>Magnet plan</span>
              <div className="gl-seg">
                {([['all6', 'All 6mm'], ['all8', 'All 8mm'], ['corners8', 'Corners 8']] as [MagnetPlan, string][]).map(([p, l]) =>
                  <button key={p} aria-pressed={plan === p} onClick={() => setPlan(p)}>{l}</button>)}
              </div>
            </div>
            <label className="gl-toggle"><span>Show lattice <small style={{ color: 'var(--ink-3)' }}>· every position tried</small></span>
              <input type="checkbox" checked={showLattice} onChange={e => setShowLattice(e.target.checked)} />
            </label>
            <div className="gl-seg">
              <button onClick={saveDefaults}>Save as default</button>
              <button onClick={resetDefaults}>Reset to default</button>
            </div>
          </div>

          {model && <div className="gl-card gl-read">
            <Cell k="Real size" v={`${Math.round(dim(model.contour, 0))}×${Math.round(dim(model.contour, 1))} mm`} />
            <Cell k="Render scale" v={`${scale.toFixed(2)} px/mm`} />
            <Cell k="Pitch · center" v={`${model.grid.pitchCentreMM} mm`} />
            <Cell k="Pitch · edge" v={model.grid.edgeRangeMM[0] === model.grid.edgeRangeMM[1] ? `${model.grid.edgeRangeMM[0]} mm` : `${model.grid.edgeRangeMM[0]}–${model.grid.edgeRangeMM[1]} mm`} />
            <Cell k="Seated magnets" v={String(model.grid.anchors.length)} />
            <Cell k="Registration" v={model.grid.phaseMM.map((n) => n.toFixed(1)).join(' · ') + (manual ? ' manual' : ' auto')} />
          </div>}
        </aside>
      </div>
    </div>
  )
}

function dim(c: Contour, axis: 0 | 1): number {
  let lo = Infinity, hi = -Infinity
  for (const p of c.outer.pts) { if (p[axis] < lo) lo = p[axis]; if (p[axis] > hi) hi = p[axis] }
  return hi - lo
}

function Stage({ contour, grid, lattice, onPan, onZoom, onReset }: {
  contour: Contour; grid: GridResult; lattice: boolean
  onPan: (dxMM: number, dyMM: number) => void; onZoom: (f: number) => void; onReset: () => void
}) {
  const pts = contour.outer.pts.map(([x, y]) => [x, -y] as Pt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const w = maxX - minX, h = maxY - minY, S = (VP * FIT) / Math.max(w, h)
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z'
  const fy = (p: Pt): Pt => [p[0], -p[1]]
  const seat = new Set(grid.anchors.map(a => a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2)))
  const hasFlap = grid.flaps.length > 0

  // Manual calibration gestures — the shape is FROZEN; drag pans the GRID under it (mm, engine
  // y-up), pinch scales the effect size, double-click hands registration back to the engine.
  const svgRef = useRef<SVGSVGElement>(null)
  const dragAt = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) onZoom(Math.exp(-e.deltaY * 0.01))
      else onPan(-e.deltaX / S, e.deltaY / S)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // Widen the viewBox to the frame at the same scale — the shape keeps its 86% size.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const spanMM = VP / S
  const vx = cx - spanMM / 2, vy = cy - spanMM / 2

  // Spots come from the bridge; the toggle picks field vs seated. This file draws circles.
  const spots: readonly FieldSpot[] = lattice
    ? fieldSpots(grid, { minX: vx, minY: -(vy + spanMM), maxX: vx + spanMM, maxY: -vy })
    : seatedSpots(grid)
  // Rule anchor: any spot is on the lattice, so lines cross at the centres.
  const A0 = spots[0]
  const Afy: [number, number] = A0 ? [A0.x, -A0.y] : [0, 0]

  return (
    <svg ref={svgRef} width={VP} height={VP} viewBox={`${vx} ${vy} ${spanMM} ${spanMM}`}
      style={{ cursor: dragAt.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => { dragAt.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId) }}
      onPointerMove={(e) => {
        if (!dragAt.current) return
        const mx = (e.clientX - dragAt.current.x) / S, my = (e.clientY - dragAt.current.y) / S
        dragAt.current = { x: e.clientX, y: e.clientY }
        onPan(mx, -my)
      }}
      onPointerUp={() => { dragAt.current = null }}
      onDoubleClick={onReset}>
      {/* The ground: two-level mm rule anchored on the lattice, so intersections are the centres. */}
      <defs>
        <pattern id="gl-fine" width={grid.pitchCentreMM / 2} height={grid.pitchCentreMM / 2}
          patternUnits="userSpaceOnUse" x={Afy[0]} y={Afy[1]}>
          <path d={`M ${grid.pitchCentreMM / 2} 0 L 0 0 0 ${grid.pitchCentreMM / 2}`}
            fill="none" stroke="var(--ink)" strokeOpacity={0.05} strokeWidth={0.4} />
        </pattern>
        <pattern id="gl-pitch" width={grid.pitchCentreMM} height={grid.pitchCentreMM}
          patternUnits="userSpaceOnUse" x={Afy[0]} y={Afy[1]}>
          <path d={`M ${grid.pitchCentreMM} 0 L 0 0 0 ${grid.pitchCentreMM}`}
            fill="none" stroke="var(--ink)" strokeOpacity={0.10} strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect x={vx} y={vy} width={spanMM} height={spanMM} fill="var(--panel)" />
      <rect x={vx} y={vy} width={spanMM} height={spanMM} fill="url(#gl-fine)" />
      <rect x={vx} y={vy} width={spanMM} height={spanMM} fill="url(#gl-pitch)" />
      {/* THE SHAPE IS ITS OUTLINE — a wash and the cut line; red when edges would lift. */}
      <path d={d} fill="var(--suede)" fillOpacity={0.12} />
      <path d={d} fill="none" stroke={hasFlap ? 'var(--fail)' : 'var(--suede-edge)'}
        strokeOpacity={0.9} strokeWidth={hasFlap ? 1.5 : 1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* Every spot the bridge handed over: faint where empty, accent where a magnet seats. */}
      {spots.map((sp, i) => (
        <circle key={'f' + i} cx={sp.x} cy={-sp.y} r={sp.r}
          fill={sp.held ? 'var(--accent)' : 'var(--ink)'} fillOpacity={sp.held ? 0.10 : 0.04}
          stroke={sp.held ? 'var(--accent)' : 'var(--ink)'} strokeOpacity={sp.held ? 0.55 : 0.25}
          strokeWidth={sp.held ? 0.6 : 0.5} />
      ))}
      {grid.anchors.map((a, i) => {
        const p = fy(a.p)
        return <g key={'a' + i}>
          <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill={a.dia === 8 ? 'var(--mag8)' : 'var(--magnet)'} />
          <circle cx={p[0] - a.dia * 0.12} cy={p[1] - a.dia * 0.12} r={a.dia / 2 * 0.4} fill="var(--magnet-hi)" fillOpacity={0.5} />
        </g>
      })}
    </svg>
  )
}

function Verdict({ grid }: { grid: GridResult }) {
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
  const commit = (raw: string) => {
    const n = +raw
    if (Number.isFinite(n)) set(Math.min(max, Math.max(min, Math.round(n))))
  }
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span>
        <span className="gl-num">
          <input key={v} type="number" defaultValue={v} min={min} max={max}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          {unit ? <i>{unit}</i> : null}
        </span></div>
      <input type="range" min={min} max={max} value={v} onChange={e => set(+e.target.value)} />
    </label>
  )
}
function Cell({ k, v }: { k: string; v: string }) { return <div className="gl-cell"><span>{k}</span><b>{v}</b></div> }

const CSS = `
.gl{--bg:#eef1f5;--panel:#fff;--panel-2:#f6f8fb;--line:#dbe1ea;--ink:#18202e;--ink-2:#5a6577;--ink-3:#93a0b3;
  --accent:#2f6bff;--accent-soft:#2f6bff18;--grid:#9fb0cc;--suede:#454952;--suede-edge:#2c2f36;--magnet:#20242c;
  --magnet-hi:#6b7280;--mag8:#c98a12;--pass:#1a9e4b;--fail:#e5484d;--shadow:0 1px 2px #18202e0d,0 10px 26px #18202e0f;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;padding:26px 20px 70px;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme:dark){.gl:not([data-theme]){--bg:#0f141b;--panel:#161c25;--panel-2:#12171f;--line:#232c3a;--ink:#e6edf3;--ink-2:#9aa6b6;--ink-3:#66717f;--accent:#4d84ff;--accent-soft:#4d84ff20;--grid:#3d4a60;--suede:#3a3e46;--suede-edge:#22262d;--magnet:#0b0e12;--magnet-hi:#4a515c;--shadow:0 1px 2px #0005,0 12px 30px #0006}}
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
  background:var(--panel-2);position:relative;
  border:1px dashed var(--line);border-radius:12px;overflow:hidden}
.gl-solving{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:8px;
  font:600 12px var(--mono);color:var(--ink-2);background:rgba(127,132,145,.14);backdrop-filter:blur(1px)}
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
.gl-field{display:flex;flex-direction:column;gap:8px;font:600 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-field select{font:500 13px var(--sans);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px;cursor:pointer}
.gl-upload{font:600 13px var(--sans);color:#fff;background:var(--accent);border:0;border-radius:10px;padding:11px;cursor:pointer;width:100%}
.gl-upload:hover{filter:brightness(1.05)}
.gl-magic-note{font:11.5px var(--mono);color:var(--ink-2);line-height:1.5}
.gl-snap{font-size:12.5px;color:var(--ink-2)}.gl-snap b{font:600 13px var(--mono);color:var(--ink)}.gl-snap span{display:block;font:11px var(--mono);color:var(--ink-3);margin-top:3px}
.gl-steps{display:flex;flex-wrap:wrap;gap:4px}
.gl-steps button{font:600 10px var(--mono);color:var(--ink-2);background:var(--panel-2);border:1px solid var(--line);border-radius:7px;padding:4px 7px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px}
.gl-steps button em{font-style:normal;color:var(--ink-3);font-size:9px}
.gl-steps button[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}
.gl-steps button[aria-pressed=true] em{color:#fffc}
.gl-slider{display:flex;flex-direction:column;gap:6px}
.gl-slider-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--ink-2)}
.gl-slider-row b{font:600 12.5px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
.gl-num{display:inline-flex;align-items:center;gap:4px}
.gl-num input{width:54px;font:600 12.5px var(--mono);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
.gl-num input:focus{outline:none;border-color:var(--accent)}
.gl-num i{font:600 11px var(--mono);font-style:normal;color:var(--ink-3)}
.gl-limits{display:flex;gap:6px}
.gl-limits select{flex:1;min-width:0}
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
