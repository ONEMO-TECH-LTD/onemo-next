import type { ChangeEvent, RefObject } from 'react'
import type { VectorShapeKind } from '@/lib/shape-library'
import type { ShapeKind } from '../v5.3.1/user/shapes'

const PRESETS: VectorShapeKind[] = ['squircle', 'square', 'circle', 'pill', 'heart', 'star', 'polygon', 'diamond', 'plus', 'teardrop', 'leaf', 'lens', 'bolt', 'sparkle', 'pinched', 'asterisk', 'bowtie']
const GENS: { k: ShapeKind; label: string }[] = [{ k: 'blob', label: 'Blob' }, { k: 'form', label: 'Clover' }, { k: 'daisy', label: 'Daisy' }, { k: 'pinwheel', label: 'Pinwheel' }]

type Src = 'std' | 'preset' | 'gen' | 'magic'
type StdGeo = 'square' | 'diamondShape' | 'rect' | 'circle' | 'triangle'
type Attachment = 'magnetic' | 'twinfix' | 'velcro'
type GridDensity = 'standard' | 'light'
type GridPattern = 'standard' | 'quincunx' | 'diamond'
type GridMode = 'auto' | GridPattern
type MagnetPlan = 'auto' | 'all6' | 'all8' | 'corners8'

interface SemanticRungView {
  label: string
  points: number
  sizeMM: number
  visible: boolean
}

interface GridWorkbenchPanelModel {
  effSize: number
  marginMM: number
  designSize: number
  grew: number
  pitch: number
  magDist: number | null
  patternUsed: string
  format: string | null
  rung: SemanticRungView
  rungH: SemanticRungView
  grid: { anchors: readonly unknown[] }
}

interface RectangleRungsView {
  longOptions: SemanticRungView[]
  shortOptions: SemanticRungView[]
}

export interface GridWorkbenchPanelProps {
  src: Src
  setSrc: (value: Src) => void
  geo: StdGeo
  setGeo: (value: StdGeo) => void
  setLongMM: (value: number) => void
  setShortMM: (value: number) => void
  orient: 'landscape' | 'portrait'
  setOrient: (value: 'landscape' | 'portrait') => void
  preset: VectorShapeKind
  setPreset: (value: VectorShapeKind) => void
  gen: ShapeKind
  setGen: (value: ShapeKind) => void
  p1: number
  setP1: (value: number) => void
  p2: number
  setP2: (value: number) => void
  sides: number
  setSides: (value: number) => void
  points: number
  setPoints: (value: number) => void
  setSizeMM: (value: number) => void
  pitch: number
  setPitch: (value: number) => void
  pitchAuto: boolean
  setPitchAuto: (value: boolean) => void
  attachment: Attachment
  setAttachment: (value: Attachment) => void
  density: GridDensity
  setDensity: (value: GridDensity) => void
  pad: number
  setPad: (value: number) => void
  offsetMM: number
  setOffsetMM: (value: number) => void
  pattern: GridPattern
  setPattern: (value: GridPattern) => void
  patternAuto: boolean
  setPatternAuto: (value: boolean) => void
  plan: MagnetPlan
  setPlan: (value: MagnetPlan) => void
  front: boolean
  setFront: (value: boolean) => void
  centerMode: 'centroid' | 'bbox'
  setCenterMode: (value: 'centroid' | 'bbox') => void
  maxGrowMM: number
  setMaxGrowMM: (value: number) => void
  magic: { adapter: string } | null
  magStatus: string
  fileRef: RefObject<HTMLInputElement | null>
  onFile: (event: ChangeEvent<HTMLInputElement>) => void
  sizeMax: number
  sizeMin: number
  resolvedSizeMM: number
  maxRungMM: number
  gridMode: GridMode
  stdRungs: SemanticRungView[]
  rectRungs: RectangleRungsView | null
  model: GridWorkbenchPanelModel | null
}

export function GridWorkbenchPanel({
  src, setSrc, geo, setGeo, setLongMM, setShortMM, orient, setOrient,
  preset, setPreset, gen, setGen, p1, setP1, p2, setP2, sides, setSides, points, setPoints,
  setSizeMM, pitch, setPitch, pitchAuto, setPitchAuto, attachment, setAttachment,
  density, setDensity, pad, setPad, offsetMM, setOffsetMM, pattern, setPattern,
  patternAuto, setPatternAuto, plan, setPlan, front, setFront, centerMode, setCenterMode,
  maxGrowMM, setMaxGrowMM, magic, magStatus, fileRef, onFile, sizeMax, sizeMin, resolvedSizeMM, maxRungMM,
  gridMode, stdRungs, rectRungs, model,
}: GridWorkbenchPanelProps) {
  const genParams = {
    blob: [['Waviness', '%'], ['Seed', '']], form: [['Pinch', '%'], ['Lobes', '']],
    daisy: [['Depth', '%'], ['Petals', '']], pinwheel: [['Swirl', '%'], ['Blades', '']],
  } as Record<string, [string, string][]>
  const p2max = gen === 'blob' ? 40 : gen === 'form' ? 8 : gen === 'daisy' ? 12 : 8
  const p2min = gen === 'blob' ? 1 : gen === 'form' ? 1 : gen === 'daisy' ? 5 : 3

  return <>
    <div className="gl-card gl-pad">
      <div className="gl-glabel">Shape source</div>
      <div className="gl-seg gl-seg3">
        <button aria-pressed={src === 'std'} onClick={() => setSrc('std')}>Standard</button>
        <button aria-pressed={src === 'preset'} onClick={() => setSrc('preset')}>Presets</button>
        <button aria-pressed={src === 'gen'} onClick={() => setSrc('gen')}>Generators</button>
        <button aria-pressed={src === 'magic'} onClick={() => setSrc('magic')}>AI Magic</button>
      </div>

      {src === 'std' && <div className="gl-field"><span>Geometry</span>
        <div className="gl-seg gl-wrap">
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
      <div className="gl-field"><span>Attachment</span>
        <div className="gl-seg">
          {([['magnetic', 'Magnetic'], ['twinfix', 'Twin-fix'], ['velcro', 'Velcro']] as [Attachment, string][]).map(([a, l]) =>
            <button key={a} aria-pressed={attachment === a} onClick={() => setAttachment(a)}>{l}</button>)}
        </div>
      </div>
      {/* SEMANTIC SIZES — the shape's own T-shirt ladder (anchor-count tiers), mode + recipe driven */}
      {!(src === 'std' && geo === 'rect') && <div className="gl-field"><span>Size · {src === 'std' ? 'this shape' : 'square ref'} · {gridMode === 'quincunx' ? 'dice' : gridMode}</span>
        <div className="gl-seg gl-wrap">
          {!stdRungs.length && <span className="gl-inline-resolving">Resolving…</span>}
          {stdRungs.map(r =>
            <button key={r.sizeMM} aria-pressed={model?.rung.sizeMM === r.sizeMM}
              className={r.visible ? undefined : 'gl-hidden-rung'}
              onClick={() => setSizeMM(r.sizeMM)}
              title={`${r.points} anchor point${r.points > 1 ? 's' : ''}${r.visible ? '' : ' · hidden at launch (untested)'}`}>
              {r.label}{r.visible ? '' : '†'}
            </button>)}
        </div>
      </div>}
      {src === 'std' && geo === 'rect' && <>
        {/* system A: long side → short side (< long) → orientation */}
        <div className="gl-field"><span>Long side · size</span>
          <div className="gl-seg gl-wrap">
            {!rectRungs && <span className="gl-inline-resolving">Resolving…</span>}
            {(rectRungs?.longOptions ?? []).map(r =>
              <button key={'L' + r.sizeMM} aria-pressed={Math.max(model?.rung.sizeMM ?? 0, model?.rungH?.sizeMM ?? 0) === r.sizeMM}
                className={r.visible ? undefined : 'gl-hidden-rung'}
                onClick={() => setLongMM(r.sizeMM)}
                title={`${r.points} anchor points${r.visible ? '' : ' · hidden at launch (untested)'}`}>
                {r.label}{r.visible ? '' : '†'}
              </button>)}
          </div>
        </div>
        <div className="gl-field"><span>Short side · size</span>
          <div className="gl-seg gl-wrap">
            {!rectRungs && <span className="gl-inline-resolving">Resolving…</span>}
            {(rectRungs?.shortOptions ?? []).map(r =>
              <button key={'S' + r.sizeMM} aria-pressed={Math.min(model?.rung.sizeMM ?? 0, model?.rungH?.sizeMM ?? 0) === r.sizeMM}
                className={r.visible ? undefined : 'gl-hidden-rung'}
                onClick={() => setShortMM(r.sizeMM)}>
                {r.label}{r.visible ? '' : '†'}
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
      <Slider label={`Design size · longest side${sizeMax < maxRungMM ? ` · max ${sizeMax}` : ''}`} unit="mm" v={resolvedSizeMM} set={setSizeMM} min={sizeMin} max={sizeMax} />
      <Slider label="Max auto-margin · balance" unit="mm" v={maxGrowMM} set={setMaxGrowMM} min={0} max={80} />
      {model && <div className="gl-total">
        <span className="gl-total-k">Total effect size</span>
        <b className="gl-total-v">{model.effSize}<small> mm</small></b>
        <span className="gl-total-note">{model.marginMM > 0.5 ? `design ${model.designSize}mm + ${Math.round(model.marginMM)}mm margin${model.grew > 0.5 ? ` (+${Math.round(model.grew)} auto)` : ''}` : `design ${model.designSize}mm · no margin`}</span>
        <span className="gl-total-note gl-total-grid">grid {model.pitch}mm{model.magDist != null ? ` · magnets ${Math.round(model.magDist)}mm apart${Math.abs(model.magDist - model.pitch * Math.SQRT2) < 1.5 ? ` · grid diagonal (${model.pitch}×√2)` : Math.abs(model.magDist - model.pitch * Math.SQRT2 / 2) < 1.5 ? ` · dice half-diagonal` : ''}` : ''}</span>
        <span className="gl-total-note">{model.format ? `${model.rung.sizeMM}×${model.rungH.sizeMM} · ${model.format}` : `${model.designSize === model.rung.sizeMM ? 'size' : 'nearest'} ${model.rung.label} · tier ${model.rung.points}pt · seated ${model.grid.anchors.length}`}{model.rung.visible && model.rungH.visible ? '' : ' · HIDDEN (untested)'}</span>
      </div>}
      <div className="gl-field"><span>Density</span>
        <div className="gl-seg">
          <button aria-pressed={density === 'standard'} onClick={() => setDensity('standard')} title="dense — fine grid, full coverage, firmer hold">Standard</button>
          <button aria-pressed={density === 'light'} onClick={() => setDensity('light')} title="sparse — coarse grid, perimeter belt, uncrowded">Light</button>
        </div>
      </div>
      <div className="gl-field"><span>Grid pitch · {pitchAuto && model ? `auto → ${model.pitch}mm` : !pitchAuto && model && model.pitch !== pitch ? `${pitch} → ${model.pitch}mm · dice needs 96` : 'manual'}</span>
        <div className="gl-seg">
          <button aria-pressed={pitchAuto} onClick={() => setPitchAuto(true)}>Auto</button>
          <button aria-pressed={!pitchAuto && (model ? model.pitch === 48 : pitch === 48)} onClick={() => { setPitchAuto(false); setPitch(48) }}>48</button>
          <button aria-pressed={!pitchAuto && (model ? model.pitch === 96 : pitch === 96)} onClick={() => { setPitchAuto(false); setPitch(96) }}>96</button>
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
      <div className="gl-field"><span>Grid centering · A/B</span>
        <div className="gl-seg">
          {([['centroid', 'Centroid'], ['bbox', 'Bbox centre']] as ['centroid' | 'bbox', string][]).map(([m, l]) =>
            <button key={m} aria-pressed={centerMode === m} onClick={() => setCenterMode(m)}>{l}</button>)}
        </div>
      </div>
      <div className="gl-field"><span>Magnet plan</span>
        <div className="gl-seg">
          {([['auto', 'Auto'], ['all6', 'All 6mm'], ['all8', 'All 8mm'], ['corners8', 'Corners 8']] as [MagnetPlan, string][]).map(([p, l]) =>
            <button key={p} aria-pressed={plan === p} onClick={() => setPlan(p)}>{l}</button>)}
        </div>
      </div>
      <label className="gl-toggle"><span>Front face · magnet overlay</span>
        <input type="checkbox" checked={front} onChange={e => setFront(e.target.checked)} />
      </label>
    </div>
  </>
}

function Slider({ label, v, set, min, max, unit }: { label: string; v: number; set: (n: number) => void; min: number; max: number; unit?: string }) {
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span><b>{v}{unit ? ' ' + unit : ''}</b></div>
      <input type="range" min={min} max={max} value={v} onChange={e => set(+e.target.value)} />
    </label>
  )
}
