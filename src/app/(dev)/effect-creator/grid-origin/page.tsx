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
import type { Contour, Pt } from '@/lib/effect/types'
import { computeGrid, fitSizeToGrid, type GridPattern, type MagnetPlan } from '@/lib/effect/grid-origin'
import { RELEASED_PADDING_MM, RELEASED_PITCHES_MM, SNAP_STEP_MM } from '@/lib/effect/grid-origin-spec'
import { fieldSpots, makeSizer, normBaseContour, normGeneratedRing, seatedSpots, sizeRange, type FieldSpot } from '@/lib/effect/grid-origin-bridge'

const IMG = 1000
/** Stage pixel size — element, px/mm scale and header label all derive from it. */
const VP = 640
const FIT = 0.86

const PRESETS: VectorShapeKind[] = ['squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus', 'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie']
const GENS: { k: ShapeKind; label: string }[] = [{ k: 'blob', label: 'Blob' }, { k: 'form', label: 'Clover' }, { k: 'daisy', label: 'Daisy' }, { k: 'pinwheel', label: 'Pinwheel' }]

type Src = 'preset' | 'gen' | 'magic'
type MagicState = { vshape: VShape; maskH: number; adapter: string; imgUrl: string } | null

export default function GridLab() {
  const [src, setSrc] = useState<Src>('preset')
  const [preset, setPreset] = useState<VectorShapeKind>('squircle')
  const [gen, setGen] = useState<ShapeKind>('blob')
  const [p1, setP1] = useState(55) // waviness / pinch / depth / swirl
  const [p2, setP2] = useState(7)  // seed / lobes / petals / blades
  const [sides, setSides] = useState(6)
  const [points, setPoints] = useState(5)
  const [sizeMM, setSizeMM] = useState(70)
  const [pitch, setPitch] = useState(48)
  const [pad, setPad] = useState(RELEASED_PADDING_MM)
  const [offsetMM, setOffsetMM] = useState(0)
  const [pattern, setPattern] = useState<GridPattern>('standard')
  const [plan, setPlan] = useState<MagnetPlan>('all6')
  /** Off: seated spots only. On: every position the shape was judged against. */
  const [showLattice, setShowLattice] = useState(false)
  const [autoFit, setAutoFit] = useState(false)
  /** Snap scan step — admin-tunable for testing; default from spec. */
  const [snapStep, setSnapStep] = useState(SNAP_STEP_MM)
  const [coverage, setCoverage] = useState<'full' | 'perimeter'>('perimeter')

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

  const model = useMemo(() => {
    try {
      // base contour normalized so longest side = 1mm (scale-free); scaleContour() sizes it in mm
      let base: Contour | null = null
      if (src === 'magic') {
        if (!magic) return null
        base = normBaseContour(magic.vshape, magic.maskH)
      } else if (src === 'preset' && hasVectorDef(preset)) {
        base = normBaseContour(getShape(preset, IMG, IMG, { sides, points }), IMG)
      } else {
        const params = gen === 'blob' ? { kind: gen, waviness: p1, seed: p2 }
          : gen === 'form' ? { kind: gen, pinch: p1, lobes: p2 }
          : gen === 'daisy' ? { kind: gen, depth: p1, petals: p2 }
          : { kind: gen, swirl: p1, blades: p2 }
        const ring = generateShapeRing(params as Parameters<typeof generateShapeRing>[0], IMG, IMG)
        base = normGeneratedRing(ring, IMG)
      }
      if (!base || base.outer.pts.length < 3) return null
      const b = base
      const cfg = { pitchMM: pitch, paddingMM: pad, pattern, plan, perimeterOnly: coverage === 'perimeter' }
      // sized(mm): the bridge's sizer — scale + outline offset, no geometry in the shell.
      const sized = makeSizer(b, offsetMM)
      if (autoFit) {
        // Snap climbs to the same 9x9 ceiling the slider offers — its own default stopped at 300.
        const fit = fitSizeToGrid(sized, cfg, sizeMM, { maxMM: sizeRange(pitch, pad).maxMM, step: snapStep })
        return { contour: sized(fit.sizeMM), grid: fit.grid, effSize: fit.sizeMM, snapped: fit.snapped }
      }
      const contour = sized(sizeMM)
      return { contour, grid: computeGrid(contour, cfg), effSize: sizeMM, snapped: false }
    } catch (e) { console.error('[grid-lab] shape build failed', e); return null }
  }, [src, preset, gen, p1, p2, sides, points, sizeMM, pitch, pad, pattern, plan, magic, autoFit, coverage, offsetMM, snapStep])

  // The size range, asked for — floor and ceiling are the bridge's answer, never computed here.
  const { minMM: minSizeMM, maxMM: maxSizeMM } = sizeRange(pitch, pad)

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
            {model ? <Stage contour={model.contour} grid={model.grid} lattice={showLattice} gridPattern={pattern} />
              : src === 'magic'
                ? <Empty text={magStatus.startsWith('error') ? magStatus.slice(6) : magStatus === 'downloading-model' ? 'Downloading the cut-out model…' : magStatus.startsWith('cutting') ? 'Cutting out the shape…' : 'Upload an image to cut its outline'} spin={magStatus === 'downloading-model' || magStatus.startsWith('cutting')} />
                : <Empty text="shape unavailable" />}
          </div>
          {model && <Verdict grid={model.grid} />}
          <div className="gl-legend">
            <span><i style={{ background: 'var(--magnet)' }} />6mm magnet</span>
            <span><i style={{ background: 'var(--mag8)' }} />8mm magnet</span>
            <span><i style={{ background: 'var(--grid)', opacity: .55 }} />node · no material</span>
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
            <label className="gl-toggle"><span>Snap size to grid <small style={{ color: 'var(--ink-3)' }}>· auto-scale to fit</small></span>
              <input type="checkbox" checked={autoFit} onChange={e => setAutoFit(e.target.checked)} /></label>
            {autoFit
              ? <div className="gl-snap">Effect size <b>{model ? model.effSize : '—'} mm</b><span>snapped up the standard ladder to envelop a 4-point cell with padding</span></div>
              : <Slider label="Effect size · longest side" unit="mm" v={sizeMM} set={setSizeMM} min={minSizeMM} max={maxSizeMM} />}
            {autoFit && <Slider label="Snap step" unit="mm" v={snapStep} set={setSnapStep} min={1} max={24} />}
            <div className="gl-field"><span>Grid pitch · released tiers</span>
              <div className="gl-seg">
                {RELEASED_PITCHES_MM.map(({ mm, label }) =>
                  <button key={mm} aria-pressed={pitch === mm} onClick={() => setPitch(mm)}>{label}</button>)}
              </div>
            </div>
            <Slider label="Magnet padding · per spot · min 10" unit="mm" v={pad} set={setPad} min={10} max={30} />
            <Slider label="Outline offset · grow / shrink" unit="mm" v={offsetMM} set={setOffsetMM} min={-15} max={15} />

            <div className="gl-field"><span>Grid pattern</span>
              <div className="gl-seg">
                {(['standard', 'quincunx', 'granular'] as GridPattern[]).map(p =>
                  <button key={p} aria-pressed={pattern === p} onClick={() => setPattern(p)}>{p === 'quincunx' ? 'Dice-5' : cap(p)}</button>)}
              </div>
            </div>
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
          </div>

          {model && <div className="gl-card gl-read">
            <Cell k="Real size" v={`${Math.round(dim(model.contour, 0))}×${Math.round(dim(model.contour, 1))} mm`} />
            <Cell k="Render scale" v={`${scale.toFixed(2)} px/mm`} />
            <Cell k="Pitch · center" v={`${model.grid.pitchCentreMM} mm`} />
            <Cell k="Pitch · edge" v={model.grid.edgeRangeMM[0] === model.grid.edgeRangeMM[1] ? `${model.grid.edgeRangeMM[0]} mm` : `${model.grid.edgeRangeMM[0]}–${model.grid.edgeRangeMM[1]} mm`} />
            <Cell k="Seated magnets" v={String(model.grid.anchors.length)} />
            <Cell k="Pattern" v={pattern === 'quincunx' ? 'dice-5' : pattern} />
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

function Stage({ contour, grid, lattice, gridPattern }: { contour: Contour; grid: ReturnType<typeof computeGrid>; lattice: boolean; gridPattern: GridPattern }) {
  const pts = contour.outer.pts.map(([x, y]) => [x, -y] as Pt)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  const w = maxX - minX, h = maxY - minY, S = (VP * FIT) / Math.max(w, h)
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z'
  const fy = (p: Pt): Pt => [p[0], -p[1]]
  const seat = new Set(grid.anchors.map(a => a.p[0].toFixed(2) + ',' + a.p[1].toFixed(2)))
  const hasFlap = grid.flaps.length > 0

  // Widen the viewBox to the frame at the same scale — the shape keeps its 86% size.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const spanMM = VP / S
  const vx = cx - spanMM / 2, vy = cy - spanMM / 2

  // Spots come from the bridge; the toggle picks field vs seated. This file draws circles.
  const spots: readonly FieldSpot[] = lattice
    ? fieldSpots(grid, gridPattern, { minX: vx, minY: -(vy + spanMM), maxX: vx + spanMM, maxY: -vy })
    : seatedSpots(grid)
  // Rule anchor: any spot is on the lattice, so lines cross at the centres.
  const A0 = spots[0]
  const Afy: [number, number] = A0 ? [A0.x, -A0.y] : [0, 0]

  return (
    <svg width={VP} height={VP} viewBox={`${vx} ${vy} ${spanMM} ${spanMM}`}>
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
  background:var(--panel-2);
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
.gl-field{display:flex;flex-direction:column;gap:8px;font:600 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.gl-field select{font:500 13px var(--sans);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px;cursor:pointer}
.gl-upload{font:600 13px var(--sans);color:#fff;background:var(--accent);border:0;border-radius:10px;padding:11px;cursor:pointer;width:100%}
.gl-upload:hover{filter:brightness(1.05)}
.gl-magic-note{font:11.5px var(--mono);color:var(--ink-2);line-height:1.5}
.gl-snap{font-size:12.5px;color:var(--ink-2)}.gl-snap b{font:600 13px var(--mono);color:var(--ink)}.gl-snap span{display:block;font:11px var(--mono);color:var(--ink-3);margin-top:3px}
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
