'use client'

// grid-origin — the v3.5 magnetic-grid bench (2D vector).
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
import { DEFAULT_PITCH_MM, type BandSnapPoint, type GridResult, type MagnetPlan, type SafeSegment } from '@/lib/effect/grid-origin'
import { AUTO_FLAP_MAX_MM, BANDS, CENTRE_MODE, FLAP_CEIL_MM, FLAP_FLOOR_MM, FLAP_MM, GOVERNOR, MASS_DEPTH_CEIL_MM, MASS_DEPTH_FLOOR_MM, MASS_DEPTH_MM, MIN_EFFECT_MM, PADDING_CEIL_MM, PADDING_FLOOR_MM, PHASE_STEP_FLOOR_MM, PHASE_STEP_MM, POSITIONING, RELEASED_PADDING_MM, RELEASED_PITCHES_MM, SNAP_STEP_MM, VOTING_ORDER } from '@/lib/effect/grid-origin-spec'
import { fieldSpots, normBaseContour, normGeneratedRing, normMaskContour, seatedSpots, sizeRange, type FieldSpot } from '@/lib/effect/grid-origin-bridge'

const IMG = 1024
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

type Src = 'preset' | 'gen' | 'magic' | 'cut'
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
  /** Auto flap micro-module — bands grant themselves only the allowance they need, up to max. */
  const [autoFlapN, setAutoFlapN] = usePersisted('autoFlap', 0)
  const [autoFlapMax, setAutoFlapMax] = usePersisted('autoFlapMax', AUTO_FLAP_MAX_MM)
  /** Placement step dial — how finely the lattice slides under the shape; 1 = continuous panning. */
  const [phaseStep, setPhaseStep] = usePersisted('phaseStep', PHASE_STEP_MM)
  /** Mass depth dial — clearance a region must survive to count as a mass for centring. */
  const [massDepth, setMassDepth] = usePersisted('massDepth', MASS_DEPTH_MM)
  /** Centre-mode switch — which centre drives anchoring and balance. */
  const [centreMode, setCentreMode] = usePersisted('centreMode', CENTRE_MODE)
  /** Positioning law — voting vs centre-rules (parity-locked, no voting). */
  const [positioning, setPositioning] = usePersisted('positioning', POSITIONING)
  /** Governor — which mass rules in Masses mode. */
  const [governor, setGovernor] = usePersisted('governor', GOVERNOR)
  /** Voting dominance order — which force rules the placement vote. */
  const [votingOrder, setVotingOrder] = usePersisted('votingOrder', VOTING_ORDER)
  const [offsetMM, setOffsetMM] = useState(0)
  const [plan, setPlan] = useState<MagnetPlan>('all6')
  /** Off: seated spots only. On: every position the shape was judged against. */
  const [showLattice, setShowLattice] = useState(true)
  /** Faint bounding box with per-side dimensions. */
  const [showBox, setShowBox] = useState(true)
  /** Legal-area islands, coloured + boxed + centre-marked. */
  const [showSegs, setShowSegs] = useState(true)
  /** Coloured fills of the inner (legal) area — off leaves outlines only. */
  const [segFillN, setSegFillN] = usePersisted('segFill', 1)
  /** A band id snaps to that band's fit ladder; 'free' is the continuous slider. */
  const [mode, setMode] = useState<number | 'free'>('free')
  /** Selected step on the band's ladder; null = the band's own pick (smallest size at max count). */
  const [stepSel, setStepSel] = useState<number | null>(null)
  /** Manual scale inside the band's range; null = the ladder rules. */
  const [bandScale, setBandScale] = useState<number | null>(null)
  /** Snap scan step — admin-tunable for testing; default from spec. */
  const [snapStep, setSnapStep] = usePersisted('snapStep', SNAP_STEP_MM)
  /** Manual grid calibration — a forced registration (mm), or null for the engine's auto pick. */
  const [manual, setManual] = useState<{ x: number; y: number } | null>(null)
  const [coverage, setCoverage] = useState<'full' | 'perimeter'>('perimeter')
  /** Per-control enables — off sends that control's field not at all, so spec default rules it. */
  const [enFlapN, setEnFlapN] = usePersisted('en.flap', 1)
  const [enPhaseN, setEnPhaseN] = usePersisted('en.phaseStep', 1)

  /** Baseline handling: "save" stamps the current dials as the working default; "reset" restores
   *  the saved baseline, or spec defaults when none was saved. */
  const saveDefaults = () => {
    try { localStorage.setItem('grid-origin.defaults', JSON.stringify({ pad, flap, phaseStep, massDepth, centreMode, positioning, governor, votingOrder, snapStep, sizeMin, sizeMax })) } catch { }
  }
  const resetDefaults = () => {
    let d = {
      pad: RELEASED_PADDING_MM, flap: FLAP_MM, phaseStep: PHASE_STEP_MM, massDepth: MASS_DEPTH_MM, centreMode: CENTRE_MODE, positioning: POSITIONING, governor: GOVERNOR, votingOrder: VOTING_ORDER, snapStep: SNAP_STEP_MM,
      sizeMin: MIN_EFFECT_MM, sizeMax: sizeRange(RELEASED_PADDING_MM).maxMM,
    }
    try { const raw = localStorage.getItem('grid-origin.defaults'); if (raw) d = { ...d, ...JSON.parse(raw) } } catch { }
    setPad(d.pad); setFlap(d.flap); setPhaseStep(d.phaseStep); setMassDepth(d.massDepth); setCentreMode(d.centreMode); setPositioning(d.positioning); setGovernor(d.governor); setVotingOrder(d.votingOrder); setSnapStep(d.snapStep); setSizeMin(d.sizeMin); setSizeMax(d.sizeMax)
  }

  const [magic, setMagic] = useState<MagicState>(null)
  const [magStatus, setMagStatus] = useState<string>('')   // '', 'downloading-model', 'cutting', 'error:...'
  const fileRef = useRef<HTMLInputElement>(null)

  /** Perf dash — screen instrumentation only: page load, shape generation, AI cut, solve. */
  const [perf, setPerf] = useState<{ loadMs?: number; genMs?: number; cutMs?: number; solveMs?: number }>({})
  const genMsRef = useRef<number | undefined>(undefined)
  const solveSentAt = useRef(0)
  useEffect(() => {
    const report = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav?.duration) setPerf((x) => ({ ...x, loadMs: nav.duration }))
    }
    if (document.readyState === 'complete') report()
    else { window.addEventListener('load', report, { once: true }); return () => window.removeEventListener('load', report) }
  }, [])

  function cutFile(f: File) {
    const loaded = loadImage(f, magic?.imgUrl)
    if (!loaded) { setMagStatus('error:that file is not an image'); return }
    setSrc('magic'); setMagStatus('cutting')
    const t0 = performance.now()
    prepareShaped(loaded.url, undefined, (s) => setMagStatus(s === 'fallback' ? 'cutting (simple fallback)' : s))
      .then((p) => {
        setPerf((x) => ({ ...x, cutMs: performance.now() - t0 }))
        setMagic({ vshape: p.spec.vectorShape, maskH: p.spec.maskHeightPx, adapter: p.spec.generator?.adapter ?? 'cut', imgUrl: loaded.url })
        setMagStatus('')
      })
      .catch((err) => { console.error('[grid-lab] magic failed', err); setMagStatus('error:' + ((err as Error)?.message ?? 'cut failed')) })
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) cutFile(f)
  }

  /** Test libraries — raw images (go through the AI cut) and finished cutouts (traced directly). */
  const [libRaw, setLibRaw] = useState<string[]>([])
  const [libCut, setLibCut] = useState<string[]>([])
  const [libSel, setLibSel] = useState('')
  const [cutSel, setCutSel] = useState('')
  const [cutC, setCutC] = useState<Contour | null>(null)
  const [cutStatus, setCutStatus] = useState('')
  useEffect(() => {
    fetch('/effect-creator/grid-origin/asset-lib?dir=raw').then((r) => r.json()).then((f) => Array.isArray(f) && setLibRaw(f)).catch(() => { })
    fetch('/effect-creator/grid-origin/asset-lib?dir=cut').then((r) => r.json()).then((f) => Array.isArray(f) && setLibCut(f)).catch(() => { })
  }, [])
  async function loadLib(name: string) {
    setSrc('magic'); setMagStatus('cutting')
    try {
      const res = await fetch('/effect-creator/grid-origin/asset-lib/' + encodeURIComponent(name) + '?dir=raw')
      if (!res.ok) throw new Error('not found')
      const blob = await res.blob()
      cutFile(new File([blob], name, { type: blob.type || 'image/png' }))
    } catch { setMagStatus('error:could not load the library image') }
  }
  /** Cutout path: no AI — decode (browser IO), hand the alpha mask to the bridge to trace. */
  async function loadCut(name: string) {
    setSrc('cut'); setCutStatus('tracing')
    const t0 = performance.now()
    try {
      const res = await fetch('/effect-creator/grid-origin/asset-lib/' + encodeURIComponent(name) + '?dir=cut')
      if (!res.ok) throw new Error('not found')
      const bmp = await createImageBitmap(await res.blob())
      const cnv = document.createElement('canvas')
      cnv.width = bmp.width; cnv.height = bmp.height
      const ctx = cnv.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('no canvas')
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      const data = ctx.getImageData(0, 0, cnv.width, cnv.height).data
      const mask = new Uint8Array(cnv.width * cnv.height)
      for (let i = 0; i < mask.length; i++) if (data[i * 4 + 3] > 128) mask[i] = 1
      const c = normMaskContour(mask, cnv.width, cnv.height)
      genMsRef.current = performance.now() - t0
      if (!c) throw new Error('no outline in this image')
      setCutC(c); setCutStatus('')
    } catch (err) { setCutC(null); setCutStatus('error:' + ((err as Error)?.message ?? 'trace failed')) }
  }

  // base contour normalized so longest side = 1mm (scale-free) — cheap, main thread.
  const base = useMemo<Contour | null>(() => {
    const t0 = performance.now()
    try {
      if (src === 'cut') return cutC
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
    finally { genMsRef.current = performance.now() - t0 }
  }, [src, preset, gen, p1, p2, sides, points, magic, cutC])

  // The solve runs in a worker so the page never freezes; the last result stays up while solving.
  type Model = { contour: Contour; grid: GridResult; effSize: number; ladder: BandSnapPoint[]; idx: number; segments: SafeSegment[]; autoFlapMM?: number | null }
  const [model, setModel] = useState<Model | null>(null)
  const [solving, setSolving] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const seqRef = useRef(0)
  /** Newest-only dispatch: one solve in flight, at most one (the latest) queued — a burst of
   *  control changes never builds a backlog the worker has to grind through. */
  const busyRef = useRef(false)
  const queuedRef = useRef<object | null>(null)
  const effSizeRef = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('./solve.worker.ts', import.meta.url))
    workerRef.current = w
    w.onmessage = (e) => {
      if (queuedRef.current) {
        const next = queuedRef.current
        queuedRef.current = null
        solveSentAt.current = performance.now()
        w.postMessage(next)
      } else {
        busyRef.current = false
        setSolving(false)
      }
      if (e.data.id !== seqRef.current) return
      if (e.data.error) console.error('[grid-lab] solve failed', e.data.error)
      setPerf((x) => ({ ...x, solveMs: performance.now() - solveSentAt.current, genMs: genMsRef.current }))
      if (e.data.model) effSizeRef.current = e.data.model.effSize
      setModel(e.data.model)
    }
    return () => { workerRef.current = null; w.terminate() }
  }, [])
  useEffect(() => {
    const w = workerRef.current
    if (!w) return
    if (!base || base.outer.pts.length < 3) { setModel(null); return }
    const cfg = { pitchMM: pitch, paddingMM: pad, ...(enFlapN ? { flapMM: flap } : {}), ...(enPhaseN ? { phaseStepMM: phaseStep } : {}), massDepthMM: massDepth, centreMode, positioning, governor, votingOrder, forcePhaseMM: manual ? [manual.x, manual.y] as Pt : undefined, plan, perimeterOnly: coverage === 'perimeter', circle: src === 'preset' && preset === 'circle' && offsetMM === 0 }
    // Manual in a band (forced registration OR manual band scale): the walk is meaningless —
    // solve that size directly, exactly like free mode, band chip stays active.
    const manualBand = mode !== 'free' && (manual !== null || bandScale !== null)
    const id = ++seqRef.current
    const msg = {
      id, base, offsetMM, cfg,
      mode: manualBand ? 'free' : mode,
      sizeMM: manualBand ? (bandScale ?? effSizeRef.current ?? sizeMM) : sizeMM,
      snapStep, stepSel,
      autoFlapMaxMM: autoFlapN ? autoFlapMax : null,
    }
    if (busyRef.current) { queuedRef.current = msg; setSolving(true); return }
    busyRef.current = true
    setSolving(true)
    solveSentAt.current = performance.now()
    w.postMessage(msg)
  }, [base, src, preset, sizeMM, pitch, pad, flap, phaseStep, massDepth, centreMode, positioning, governor, votingOrder, manual, bandScale, enFlapN, enPhaseN, autoFlapN, autoFlapMax, plan, mode, stepSel, snapStep, coverage, offsetMM])

  const scale = model ? (VP * FIT) / Math.max(dim(model.contour, 0), dim(model.contour, 1)) : 0
  const genDef = GENS.find((g) => g.k === gen) ?? GENS[0]

  return (
    <div className="gl">
      <style>{CSS}</style>
      <header className="gl-head">
        <h1>Magnetic Grid Lab <span className="gl-tag">v3.5</span></h1>
      </header>

      <div className="gl-body">
        <section className="gl-card gl-stage">
          <div className="gl-stage-head">
            <span className="gl-eye gl-perf">
              load <Sec ms={perf.loadMs} />
              {' · '}gen <Sec ms={perf.genMs} />
              {perf.cutMs != null ? <> · cut <Sec ms={perf.cutMs} /></> : null}
              {' · '}solve <Sec ms={perf.solveMs} />
            </span>
            <span className="gl-eye">{model ? `1mm = ${scale.toFixed(2)} px` : '—'}</span>
          </div>
          <div className="gl-vp">
            {solving && <div className="gl-solving"><span className="gl-spin" />solving…</div>}
            {model ? <Stage contour={model.contour} grid={model.grid} lattice={showLattice} box={showBox}
              segments={showSegs ? model.segments : []} segFill={segFillN !== 0}
              marginMM={model.autoFlapMM ?? (enFlapN ? flap : FLAP_MM)}
              onPan={(dx, dy) => setManual((m) => { const bx = m ? m.x : model.grid.phaseMM[0], by = m ? m.y : model.grid.phaseMM[1]; return { x: bx + dx, y: by + dy } })}
              onZoom={(f) => {
                // Pinch = manual scaling. In a band it scales WITHIN the band's range.
                if (mode === 'free') setSizeMM((s) => Math.min(sizeMax, Math.max(sizeMin, s * f)))
                else {
                  const b = BANDS.find((x) => x.id === mode)!
                  setBandScale((s) => Math.min(b.maxMM, Math.max(b.minMM, (s ?? effSizeRef.current ?? b.minMM) * f)))
                }
              }}
              onReset={() => setManual(null)} />
              : src === 'magic'
                ? <Empty text={magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'} spin={magStatus === 'downloading-model' || magStatus.startsWith('cutting')} />
                : src === 'cut'
                  ? <Empty text={cutStatus.startsWith('error') ? cutStatus.slice(6) : cutStatus === 'tracing' ? 'Tracing the outline…' : 'Pick a cutout from the library'} spin={cutStatus === 'tracing'} />
                  : <Empty text="shape unavailable" />}
          </div>
        </section>

        <aside className="gl-controls">
          <Fold title="Shape source">
            <div className="gl-seg gl-seg3">
              <button aria-pressed={src === 'preset'} onClick={() => setSrc('preset')}>Presets</button>
              <button aria-pressed={src === 'gen'} onClick={() => setSrc('gen')}>Generators</button>
              <button aria-pressed={src === 'magic'} onClick={() => setSrc('magic')}>AI Magic</button>
              <button aria-pressed={src === 'cut'} onClick={() => setSrc('cut')}>Cutouts</button>
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

            {src === 'cut' && <>
              <label className="gl-field"><span>Cutout library · no AI, traced directly</span>
                <select value={cutSel} onChange={(e) => { setCutSel(e.target.value); if (e.target.value) loadCut(e.target.value) }}>
                  <option value="">— pick a cutout —</option>
                  {libCut.map((f) => <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>)}
                </select>
              </label>
              <div className="gl-magic-note">
                {cutStatus.startsWith('error') ? '⚠ ' + cutStatus.slice(6)
                  : cutStatus === 'tracing' ? 'tracing the outline…'
                    : cutC ? 'outline traced from the alpha edge · edit size below'
                      : 'finished cutouts — the outline is the image’s own edge, no AI pass.'}
              </div>
            </>}

            {src === 'magic' && <>
              {libRaw.length > 0 && <label className="gl-field"><span>Raw library · goes through the AI cut</span>
                <select value={libSel} onChange={(e) => { setLibSel(e.target.value); if (e.target.value) loadLib(e.target.value) }}>
                  <option value="">— pick an image —</option>
                  {libRaw.map((f) => <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>)}
                </select>
              </label>}
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
          </Fold>

          <Fold title="Grid settings">
            <div className="gl-field"><span>Band · snap ladder</span>
              <div className="gl-seg">
                {BANDS.map((b) =>
                  <button key={b.id} aria-pressed={mode === b.id} onClick={() => { setMode(b.id); setStepSel(null); setManual(null); setBandScale(null) }}>B{b.id}</button>)}
                <button aria-pressed={mode === 'free'} onClick={() => { setMode('free'); setStepSel(null); setManual(null); setBandScale(null) }}>Free</button>
              </div>
            </div>
            {mode !== 'free' && <>
              <div className="gl-snap">
                {manual
                  ? 'manual calibration · double-click the canvas to return to auto'
                  : bandScale !== null
                    ? `manual scale · ${Math.round(bandScale)} mm — tap a step or the band chip to return`
                    : model
                    ? model.ladder.length
                      ? `Fit B${mode}-${model.idx + 1} · ${Math.round(model.effSize)} mm · ${model.grid.anchors.length}⌾ · ${model.ladder.length} holding layouts in band`
                      : 'nothing fully fits at this flap — best seated shown'
                    : '—'}
              </div>
              {model && model.ladder.length > 0 && <div className="gl-steps">
                {model.ladder.map((pt, i) =>
                  <button key={pt.sizeMM} aria-pressed={bandScale === null && i === model.idx} onClick={() => { setStepSel(i); setBandScale(null) }}>
                    <b>B{mode}-{i + 1}</b><span>{pt.sizeMM} mm · {pt.count}⌾</span>
                  </button>)}
              </div>}
              {(() => {
                const b = BANDS.find((x) => x.id === mode)!
                // Dan's law: the band slider SNAPS between the qualifying variants — sizes
                // between rungs fail the selection law and are not stops. Continuous scale
                // exists only in the fallback, where no variant qualifies to snap to.
                if (model && model.ladder.length > 0) {
                  return <Slider label={`Band variant · snaps between the ${model.ladder.length} that qualify`} unit="#"
                    v={model.idx + 1}
                    set={(n) => { setStepSel(Math.min(model.ladder.length, Math.max(1, n)) - 1); setBandScale(null) }}
                    min={1} max={model.ladder.length} />
                }
                return <Slider label={`Band scale · manual within B${mode}`} unit="mm"
                  v={Math.round(bandScale ?? (effSizeRef.current || b.minMM))}
                  set={(n) => setBandScale(Math.min(b.maxMM, Math.max(b.minMM, n)))}
                  min={b.minMM} max={b.maxMM} />
              })()}
              <Slider label="Snap step" unit="mm" v={snapStep} set={setSnapStep} min={SNAP_STEP_MM} max={MIN_EFFECT_MM} />
            </>}
            {mode === 'free' && <Slider label="Effect size · longest side" unit="mm" v={Math.round(sizeMM)} set={setSizeMM} min={sizeMin} max={sizeMax} />}
            {mode === 'free' && <div className="gl-field"><span>Slider limits</span>
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
            </div>}
            <div className="gl-field"><span>Grid pitch · released tiers</span>
              <div className="gl-seg">
                {RELEASED_PITCHES_MM.map(({ mm, label }) =>
                  <button key={mm} aria-pressed={pitch === mm} onClick={() => setPitch(mm)}>{label}</button>)}
              </div>
            </div>
            <Slider label="Magnet padding · per spot" unit="mm" v={pad} set={setPad} min={PADDING_FLOOR_MM} max={PADDING_CEIL_MM} />
            <LabRow on={enFlapN !== 0} set={(b) => setEnFlapN(b ? 1 : 0)}>
              <div className={mode !== 'free' && autoFlapN ? 'gl-lab-off' : undefined}
                title={mode !== 'free' && autoFlapN ? 'auto flap is choosing the allowance' : undefined}>
                <Slider label="Flap allowance · past spot edge" unit="mm" v={flap} set={setFlap} min={FLAP_FLOOR_MM} max={FLAP_CEIL_MM} />
              </div>
            </LabRow>
            <label className="gl-toggle"><span>Auto flap <small style={{ color: 'var(--ink-3)' }}>· {mode === 'free' ? 'shows what this size implies' : 'band grants only what it needs'}{autoFlapN && model?.autoFlapMM != null ? ` — ${mode === 'free' ? 'implies' : 'chose'} ${model.autoFlapMM}mm` : ''}</small></span>
              <input type="checkbox" checked={autoFlapN !== 0} onChange={(e) => setAutoFlapN(e.target.checked ? 1 : 0)} />
            </label>
            {autoFlapN !== 0 &&
              <Slider label="Auto flap · maximum allowance" unit="mm" v={autoFlapMax} set={setAutoFlapMax} min={FLAP_FLOOR_MM} max={FLAP_CEIL_MM} />}
            <div className={positioning === 1 ? 'gl-lab-off' : undefined}
              title={positioning === 1 ? 'inactive under Centre rules — nothing slides' : undefined}>
              <LabRow on={enPhaseN !== 0} set={(b) => setEnPhaseN(b ? 1 : 0)}>
                <Slider label="Placement step · grid slide" unit="mm" v={phaseStep} set={setPhaseStep} min={PHASE_STEP_FLOOR_MM} max={MIN_EFFECT_MM} />
              </LabRow>
            </div>
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
            <label className="gl-toggle"><span>Show bounding box <small style={{ color: 'var(--ink-3)' }}>· size on each side</small></span>
              <input type="checkbox" checked={showBox} onChange={e => setShowBox(e.target.checked)} />
            </label>
            <label className="gl-toggle"><span>Show segments <small style={{ color: 'var(--ink-3)' }}>· legal-area islands</small></span>
              <input type="checkbox" checked={showSegs} onChange={e => setShowSegs(e.target.checked)} />
            </label>
            <div className="gl-seg">
              <button onClick={saveDefaults}>Save as default</button>
              <button onClick={resetDefaults}>Reset to default</button>
            </div>
          </Fold>
        </aside>

        <aside className="gl-centercol">
          <Fold title="Centering">
            <div className="gl-field"><span>Positioning · how the centre is applied</span>
              <div className="gl-seg">
                <button aria-pressed={positioning === 0} onClick={() => setPositioning(0)}>Voting</button>
                <button aria-pressed={positioning === 1} onClick={() => setPositioning(1)}>Centre rules</button>
              </div>
            </div>
            <div className="gl-magic-note">
              {positioning === 0
                ? 'Voting — magnets, coverage and centring compete across every grid slide.'
                : 'Centre rules — the grid locks onto the centre by parity (node or gap ON it); magnets only pick among the 4 parity slides. No voting.'}
            </div>
            <div className="gl-field"><span>Centre mode · what the grid aims at</span>
              <div className="gl-seg gl-wrap">
                {([[0, 'Box'], [1, 'Core'], [2, 'Masses'], [3, 'Weight'], [4, 'Deep'], [5, 'Top']] as [number, string][]).map(([m, l]) =>
                  <button key={m} aria-pressed={centreMode === m} onClick={() => setCentreMode(m)}>{l}</button>)}
              </div>
            </div>
            <div className="gl-magic-note">
              {centreMode === 0 ? 'Box — the bounding box centre; ignores where the material is.'
                : centreMode === 1 ? 'Core — the centre of the whole 12mm legal area, area-weighted.'
                  : centreMode === 2 ? 'Masses — adaptive: every mass centre anchors; the smallest mass holding a magnet governs.'
                    : centreMode === 3 ? 'Weight — the material centroid of the silhouette.'
                      : centreMode === 4 ? 'Deep — the single most buried point of the shape.'
                        : 'Top — the highest mass governs (gravity rule).'}
            </div>
            {centreMode === 2 && <div className="gl-field"><span>Governor · which mass rules</span>
              <div className="gl-seg gl-wrap">
                {([[0, 'Smallest'], [1, 'Deepest'], [2, 'Top'], [3, 'Top-small']] as [number, string][]).map(([g, l]) =>
                  <button key={g} aria-pressed={governor === g} onClick={() => setGovernor(g)}>{l}</button>)}
              </div>
            </div>}
            {(centreMode === 2 || centreMode === 5) &&
              <Slider label="Mass depth · clearance to count" unit="mm" v={massDepth} set={setMassDepth} min={MASS_DEPTH_FLOOR_MM} max={MASS_DEPTH_CEIL_MM} />}
            <div className="gl-legend">
              <div><i className="gl-sw gl-sw-main" /><span><b>Main centre</b> · governs the winning layout</span></div>
              <div><i className="gl-sw" style={{ borderColor: SEG_HUES[0], background: SEG_HUES[0] + '22' }} /><span><b>Island S1</b> · smallest legal area</span></div>
              <div><i className="gl-sw" style={{ borderColor: SEG_HUES[1], background: SEG_HUES[1] + '22' }} /><span><b>Island S2</b> · next larger, per colour</span></div>
              <div><i className="gl-sw gl-sw-dash" style={{ borderColor: SEG_HUES[0] }} /><span><b>Mass at depth</b> · the island&apos;s solid core</span></div>
            </div>
            <label className="gl-toggle"><span>Fill islands <small style={{ color: 'var(--ink-3)' }}>· coloured inner area</small></span>
              <input type="checkbox" checked={segFillN !== 0} onChange={(e) => setSegFillN(e.target.checked ? 1 : 0)} />
            </label>
          </Fold>
          {positioning === 0 && <Fold title="Voting law">
            <div className="gl-magic-note">
              Three forces vote on every placement — magnet count, wrap (least loose material), centring. The order is strict dominance: the top force always wins; the next only breaks its ties.
            </div>
            <div className="gl-field"><span>Priority · which force rules</span>
              <select value={votingOrder} onChange={(e) => setVotingOrder(+e.target.value)}>
                <option value={0}>Magnets &gt; Wrap &gt; Centring (default)</option>
                <option value={1}>Magnets &gt; Centring &gt; Wrap</option>
                <option value={2}>Wrap &gt; Magnets &gt; Centring</option>
                <option value={3}>Centring &gt; Magnets &gt; Wrap</option>
                <option value={4}>Wrap &gt; Centring &gt; Magnets</option>
                <option value={5}>Centring &gt; Wrap &gt; Magnets</option>
              </select>
            </div>
          </Fold>}
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

/** Island tints — screen colours only, one hue per segment, smallest first. */
const SEG_HUES = ['#e0762f', '#7a4ae0', '#2fa864', '#e04a8f', '#2f9fe0']

function Stage({ contour, grid, lattice, box, segments, segFill, marginMM, onPan, onZoom, onReset }: {
  contour: Contour; grid: GridResult; lattice: boolean; box: boolean; segments: SafeSegment[]; segFill: boolean
  marginMM: number
  onPan: (dxMM: number, dyMM: number) => void; onZoom: (f: number) => void; onReset: () => void
}) {
  const pts = contour.outer.pts.map(([x, y]) => [x, -y] as Pt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const w = maxX - minX, h = maxY - minY, S = (VP * FIT) / Math.max(w, h)
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z'
  const fy = (p: Pt): Pt => [p[0], -p[1]]
  const seat = new Set(grid.anchors.map(a => a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2)))

  // Manual calibration gestures — the shape is FROZEN; drag pans the GRID under it (mm, engine
  // y-up), pinch scales the effect size, double-click hands registration back to the engine.
  // MANUAL MEANS NO COMPUTE (Dan's rule): while a gesture is live the grid layers shift as a
  // pure visual transform; ONE solve commits when the gesture ends.
  // px→mm uses the RENDERED size, so gestures stay true when the canvas shrinks on a phone.
  const svgRef = useRef<SVGSVGElement>(null)
  const dragAt = useRef<{ x: number; y: number } | null>(null)
  const [pend, setPend] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const pendRef = useRef(pend)
  pendRef.current = pend
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = () => {
    const p = pendRef.current
    if (p.x || p.y) onPan(p.x, p.y)
    setPend({ x: 0, y: 0 })
  }
  const pxPerMM = (el: Element) => el.getBoundingClientRect().width / (VP / S)
  useEffect(() => {
    // Listen on the viewport wrapper, not the svg — the solving overlay sits above the svg
    // and would otherwise swallow wheel events mid-gesture.
    const svg = svgRef.current
    const el = svg?.parentElement
    if (!svg || !el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const k = pxPerMM(svg)
      if (e.ctrlKey) { onZoom(Math.exp(-e.deltaY * 0.01)); return }
      setPend((p) => ({ x: p.x - e.deltaX / k, y: p.y + e.deltaY / k }))
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(commit, 250)
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
        const k = pxPerMM(e.currentTarget)
        const mx = (e.clientX - dragAt.current.x) / k, my = (e.clientY - dragAt.current.y) / k
        dragAt.current = { x: e.clientX, y: e.clientY }
        setPend((p) => ({ x: p.x + mx, y: p.y - my }))
      }}
      onPointerUp={() => { dragAt.current = null; commit() }}
      onDoubleClick={() => { setPend({ x: 0, y: 0 }); onReset() }}>
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
        {/* Registration dots on every 12mm cell corner — the board's atom, phase-locked to the
            lattice so 12mm steps and centres are always visible. Dot sits at tile centre; the
            pattern origin is shifted half a tile so dots land on the corners unclipped. */}
        <pattern id="gl-dots" width={DEFAULT_PITCH_MM / 4} height={DEFAULT_PITCH_MM / 4}
          patternUnits="userSpaceOnUse" x={Afy[0] - DEFAULT_PITCH_MM / 8} y={Afy[1] - DEFAULT_PITCH_MM / 8}>
          <circle cx={DEFAULT_PITCH_MM / 8} cy={DEFAULT_PITCH_MM / 8} r={0.05} fill="var(--ink)" fillOpacity={0.35} />
        </pattern>
      </defs>
      <rect x={vx} y={vy} width={spanMM} height={spanMM} fill="var(--panel)" />
      {/* Grid-anchored layers shift as one rigid body while a manual gesture is live. */}
      <g transform={pend.x || pend.y ? `translate(${pend.x} ${-pend.y})` : undefined}>
        <rect x={vx - Math.abs(pend.x)} y={vy - Math.abs(pend.y)} width={spanMM + 2 * Math.abs(pend.x)} height={spanMM + 2 * Math.abs(pend.y)} fill="url(#gl-fine)" />
        <rect x={vx - Math.abs(pend.x)} y={vy - Math.abs(pend.y)} width={spanMM + 2 * Math.abs(pend.x)} height={spanMM + 2 * Math.abs(pend.y)} fill="url(#gl-pitch)" />
        <rect x={vx - Math.abs(pend.x)} y={vy - Math.abs(pend.y)} width={spanMM + 2 * Math.abs(pend.x)} height={spanMM + 2 * Math.abs(pend.y)} fill="url(#gl-dots)" />
      </g>
      {/* THE SHAPE IS ITS OUTLINE — a wash and the cut line. */}
      <path d={d} fill="var(--suede)" fillOpacity={0.12} />
      <path d={d} fill="none" stroke="var(--suede-edge)"
        strokeOpacity={0.9} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* Legal-area islands: coloured cells, dashed box, centre cross — engine y-up, drawn y-down. */}
      {segments.map((sg, si) => {
        const hue = SEG_HUES[si % SEG_HUES.length]
        const fs = 11 * spanMM / VP
        return <g key={'sg' + si} style={{ pointerEvents: 'none' }}>
          {sg.rings.map((ring, ri) => {
            const d = 'M ' + ring.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' L ') + ' Z'
            return <path key={ri} d={d} fill={hue} fillOpacity={segFill ? 0.12 : 0} stroke={hue} strokeOpacity={0.85}
              strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          })}
          <rect x={sg.bbox.minX} y={-sg.bbox.maxY} width={sg.bbox.maxX - sg.bbox.minX} height={sg.bbox.maxY - sg.bbox.minY}
            fill="none" stroke={hue} strokeOpacity={0.75} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          {/* Depth masses: the regions surviving the mass-depth probe, each with its own centre. */}
          {sg.masses.map((m, mi) => <g key={'m' + mi}>
            {m.rings.map((ring, ri) => {
              const d = 'M ' + ring.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' L ') + ' Z'
              return <path key={ri} d={d} fill={hue} fillOpacity={segFill ? 0.10 : 0} stroke={hue} strokeOpacity={0.6}
                strokeWidth={0.9} strokeDasharray="3 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            })}
            <circle cx={m.centreMM[0]} cy={-m.centreMM[1]} r={fs * 0.35} fill={hue} />
          </g>)}
        </g>
      })}
      {/* Centring targets. Secondary candidates: small bullseyes in their island's colour.
          THE MAIN CENTRE — the one that governed the winning layout — draws green on top. */}
      {grid.centresMM.map((c, ci) => {
        const isMain = c[0] === grid.centreMainMM[0] && c[1] === grid.centreMainMM[1]
        if (isMain) return null
        const si = segments.findIndex((sg) =>
          c[0] >= sg.bbox.minX && c[0] <= sg.bbox.maxX && c[1] >= sg.bbox.minY && c[1] <= sg.bbox.maxY)
        const hue = si >= 0 ? SEG_HUES[si % SEG_HUES.length] : 'var(--accent)'
        return <g key={'c' + ci} style={{ pointerEvents: 'none' }}>
          <circle cx={c[0]} cy={-c[1]} r={2} fill="none" stroke={hue} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle cx={c[0]} cy={-c[1]} r={0.5} fill={hue} />
        </g>
      })}
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={grid.centreMainMM[0]} cy={-grid.centreMainMM[1]} r={3.2} fill="none" stroke="var(--pass)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <circle cx={grid.centreMainMM[0]} cy={-grid.centreMainMM[1]} r={0.8} fill="var(--pass)" />
      </g>
      {/* Faint bounding box, its dimension written on every side. */}
      {box && <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="var(--ink)"
        strokeOpacity={0.22} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      {box && (() => {
        const fs = 11 * spanMM / VP
        const lbl = { fontSize: fs, fill: 'var(--ink)', fillOpacity: 0.55, fontFamily: 'var(--mono)', fontWeight: 600 } as const
        const wTxt = `${Math.round(w)} mm`, hTxt = `${Math.round(h)} mm`
        return (<g style={{ pointerEvents: 'none' }}>
          <text {...lbl} x={cx} y={minY - fs * 0.6} textAnchor="middle">{wTxt}</text>
          <text {...lbl} x={cx} y={maxY + fs * 1.5} textAnchor="middle">{wTxt}</text>
          <text {...lbl} x={minX - fs * 0.6} y={cy} textAnchor="middle" transform={`rotate(-90 ${minX - fs * 0.6} ${cy})`}>{hTxt}</text>
          <text {...lbl} x={maxX + fs * 0.6} y={cy} textAnchor="middle" transform={`rotate(90 ${maxX + fs * 0.6} ${cy})`}>{hTxt}</text>
        </g>)
      })()}
      {/* Every spot the bridge handed over: faint where empty, accent where a magnet seats. */}
      <g transform={pend.x || pend.y ? `translate(${pend.x} ${-pend.y})` : undefined}>
      {spots.map((sp, i) => {
        // INNER stroke: the line's outer edge sits exactly on the true spot radius, so a
        // tangent disc never reads past the cut line.
        const sw = sp.held ? 0.6 : 0.5
        return <g key={'f' + i}>
          <circle cx={sp.x} cy={-sp.y} r={sp.r - sw / 2}
            fill={sp.held ? 'var(--accent)' : 'var(--ink)'} fillOpacity={sp.held ? 0.10 : 0.04}
            stroke={sp.held ? 'var(--accent)' : 'var(--ink)'} strokeOpacity={sp.held ? 0.55 : 0.25}
            strokeWidth={sw} />
          {/* The allowance made visible — the invisible margin every disc wears under the
              contact law. The edge pressing against THIS ring is what the engine calls fit. */}
          {sp.held && marginMM > 0 &&
            <circle cx={sp.x} cy={-sp.y} r={sp.r + marginMM} fill="var(--mag8)" fillOpacity={0.05}
              stroke="var(--mag8)" strokeOpacity={0.55} strokeWidth={0.4} strokeDasharray="2.4 1.8" />}
        </g>
      })}
      {grid.anchors.map((a, i) => {
        const p = fy(a.p)
        return <g key={'a' + i} opacity={0.5}>
          <circle cx={p[0]} cy={p[1]} r={a.dia / 2} fill={a.dia === 8 ? 'var(--mag8)' : 'var(--magnet)'} />
          <circle cx={p[0] - a.dia * 0.12} cy={p[1] - a.dia * 0.12} r={a.dia / 2 * 0.4} fill="var(--magnet-hi)" fillOpacity={0.5} />
        </g>
      })}
      </g>
    </svg>
  )
}

function Empty({ text, spin }: { text: string; spin?: boolean }) {
  return <div className="gl-empty">{spin && <span className="gl-spin" />}{text}</div>
}
function Slider({ label, v, set, min, max, unit, wide }: { label: string; v: number; set: (n: number) => void; min: number; max: number; unit?: string; wide?: boolean }) {
  const commit = (raw: string) => {
    const n = +raw
    if (Number.isFinite(n)) set(Math.min(max, Math.max(min, Math.round(n))))
  }
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span>
        <span className={wide ? 'gl-num gl-num-wide' : 'gl-num'}>
          <input key={v} type="number" defaultValue={v} min={min} max={max}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          {unit ? <i>{unit}</i> : null}
        </span></div>
      <input type="range" min={min} max={max} value={v} onChange={e => set(+e.target.value)} />
    </label>
  )
}
/** One lab control with its own enable — off drops the control's field, spec default rules. */
function LabRow({ on, set, children }: { on: boolean; set: (b: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="gl-labrow">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <div className={`gl-labrow-body${on ? '' : ' gl-lab-off'}`}>{children}</div>
    </div>
  )
}
/** Perf value in seconds — green when fast, red past the 2s comfort line. */
function Sec({ ms }: { ms?: number }) {
  if (ms == null) return <b>—</b>
  return <b className={ms > 2000 ? 'gl-slow' : ''}>{(ms * 0.001).toFixed(2)}s</b>
}
/** Collapsible card — native details, open by default; collapse the unneeded on a phone. */
function Fold({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="gl-card gl-fold" open>
      <summary>{title}</summary>
      <div className="gl-fold-body">{children}</div>
    </details>
  )
}

const CSS = `
.gl{--bg:#eef1f5;--panel:#fff;--panel-2:#f6f8fb;--line:#dbe1ea;--ink:#18202e;--ink-2:#5a6577;--ink-3:#93a0b3;
  --accent:#2f6bff;--accent-soft:#2f6bff18;--grid:#9fb0cc;--suede:#454952;--suede-edge:#2c2f36;--magnet:#20242c;
  --magnet-hi:#6b7280;--mag8:#c98a12;--pass:#1a9e4b;--fail:#e5484d;--shadow:0 1px 2px #18202e0d,0 10px 26px #18202e0f;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;padding:26px 20px 70px;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme:dark){.gl:not([data-theme]){--bg:#0f141b;--panel:#161c25;--panel-2:#12171f;--line:#232c3a;--ink:#e6edf3;--ink-2:#9aa6b6;--ink-3:#66717f;--accent:#4d84ff;--accent-soft:#4d84ff20;--grid:#3d4a60;--suede:#9aa6ba;--suede-edge:#c9d4e2;--magnet:#0b0e12;--magnet-hi:#4a515c;--shadow:0 1px 2px #0005,0 12px 30px #0006}}
.gl *{box-sizing:border-box}
.gl-head{max-width:1400px;margin:0 auto 20px;text-align:center}
.gl-head h1{font-size:20px;font-weight:640;letter-spacing:-.01em;margin:0 0 5px;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;justify-content:center}
.gl-tag{font:600 11px var(--mono);color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:20px;letter-spacing:.02em}
.gl-head p{color:var(--ink-2);font-size:13.5px;margin:0;max-width:74ch;line-height:1.55}
.gl-body{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:290px minmax(0,1fr) 336px;gap:20px;align-items:start}
.gl-centercol{grid-column:1;grid-row:1}
.gl-stage{grid-column:2;grid-row:1}
.gl-controls{grid-column:3;grid-row:1}
.gl-lab-off{opacity:.4;pointer-events:none}
.gl-labrow{display:flex;gap:9px;align-items:flex-start}
.gl-labrow>input{width:15px;height:15px;accent-color:var(--accent);margin-top:3px;flex:none}
.gl-labrow-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.gl-fold summary{cursor:pointer;list-style:none;padding:14px 18px;font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);display:flex;justify-content:space-between;align-items:center;user-select:none}
.gl-fold summary::-webkit-details-marker{display:none}
.gl-fold summary::after{content:'▾';font-size:11px;transition:transform .15s}
.gl-fold:not([open]) summary::after{transform:rotate(-90deg)}
.gl-fold-body{display:flex;flex-direction:column;gap:15px;padding:2px 18px 18px}
@media (max-width:1100px){.gl-body{grid-template-columns:minmax(0,1fr) 336px}
  .gl-stage{grid-column:1;grid-row:1}.gl-controls{grid-column:2;grid-row:1}.gl-centercol{grid-column:1/-1;grid-row:2}}
@media (max-width:840px){.gl-body{grid-template-columns:1fr}
  .gl-stage{grid-column:1;grid-row:auto}.gl-controls{grid-column:1;grid-row:auto}.gl-centercol{grid-column:1;grid-row:auto}}
.gl-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.gl-pad{padding:18px;display:flex;flex-direction:column;gap:15px}
.gl-stage{padding:20px;display:flex;flex-direction:column;gap:14px}
.gl-stage-head{display:flex;justify-content:space-between;gap:10px}
.gl-eye{font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.gl-vp{aspect-ratio:1;max-width:${VP}px;width:100%;margin:0 auto;display:flex;align-items:center;justify-content:center;
  background:var(--panel-2);position:relative;
  border:1px dashed var(--line);border-radius:12px;overflow:hidden}
.gl-vp svg{width:100%;height:auto;max-width:${VP}px}
@media (max-width:840px){
  .gl{padding:14px 10px 44px}
  .gl-stage{padding:12px}
  .gl-head h1{font-size:17px}
}
.gl-solving{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:8px;
  font:600 12px var(--mono);color:var(--ink-2);background:rgba(127,132,145,.14);backdrop-filter:blur(1px);pointer-events:none}
.gl-empty{display:flex;align-items:center;gap:9px;color:var(--ink-3);font:12.5px var(--mono);text-align:center;padding:20px;max-width:80%}
.gl-spin{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:gspin .8s linear infinite;flex:none}
@keyframes gspin{to{transform:rotate(360deg)}}
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
.gl-slider{display:flex;flex-direction:column;gap:6px}
.gl-slider-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--ink-2)}
.gl-slider-row b{font:600 12.5px var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
.gl-num{display:inline-flex;align-items:center;gap:4px}
.gl-num input{width:54px;font:600 12.5px var(--mono);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
.gl-num-wide input{width:84px}
.gl-num input:focus{outline:none;border-color:var(--accent)}
.gl-num i{font:600 11px var(--mono);font-style:normal;color:var(--ink-3)}
.gl-limits{display:flex;gap:6px}
.gl-limits select{flex:1;min-width:0}
.gl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;background:var(--line);outline:none}
.gl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);box-shadow:0 1px 3px #0003;cursor:pointer}
.gl input[type=range]::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:var(--accent);border:2px solid var(--panel);cursor:pointer}
.gl-toggle{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-2);cursor:pointer}
.gl-toggle input{width:17px;height:17px;accent-color:var(--accent)}
.gl-perf b{color:var(--pass);font-weight:700}
.gl-perf b.gl-slow{color:var(--fail)}
.gl-legend{display:flex;flex-direction:column;gap:7px;font:11.5px var(--sans);color:var(--ink-2);line-height:1.45}
.gl-legend div{display:flex;align-items:flex-start;gap:8px}
.gl-legend .gl-sw{margin-top:1px}
.gl-legend b{color:var(--ink);font-weight:700}
.gl-sw{flex:none;width:13px;height:13px;border-radius:50%;border:2px solid var(--ink-3);background:transparent}
.gl-sw-main{border-color:var(--pass);background:var(--pass)}
.gl-sw-dash{border-style:dashed;background:transparent!important}
.gl-snap{font:600 12px var(--mono);color:var(--ink-2);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px 11px}
.gl-steps{display:flex;flex-wrap:wrap;gap:5px}
.gl-steps button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;font:550 11px var(--sans);color:var(--ink-2);
  background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:6px 9px;cursor:pointer;transition:.12s}
.gl-steps button b{font:700 10.5px var(--mono);letter-spacing:.04em}
.gl-steps button span{font:600 11px var(--mono);font-variant-numeric:tabular-nums}
.gl-steps button:hover{color:var(--ink)}
.gl-steps button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
`
