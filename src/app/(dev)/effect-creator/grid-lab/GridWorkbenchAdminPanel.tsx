type GridDensity = 'standard' | 'light'
type GridPattern = 'standard' | 'quincunx' | 'diamond'
type MagnetPlan = 'auto' | 'all6' | 'all8' | 'corners8'
type Src = 'std' | 'preset' | 'gen' | 'magic'
type StdGeo = 'square' | 'diamondShape' | 'rect' | 'circle' | 'triangle'
type GridMode = 'auto' | 'standard' | 'quincunx' | 'diamond'

interface SemanticRungView {
  label: string
  points: number
  sizeMM: number
  visible: boolean
}

interface RectangleRungsView {
  longOptions: SemanticRungView[]
  shortOptions: SemanticRungView[]
}

interface GridWorkbenchAdminPanelModel {
  pitch: number
  patternUsed: string
  rung: SemanticRungView | null
  rungH: SemanticRungView | null
}

export interface GridWorkbenchAdminPanelProps {
  src: Src
  geo: StdGeo
  setLongMM: (value: number) => void
  setShortMM: (value: number) => void
  setSizeMM: (value: number) => void
  gridMode: GridMode
  stdRungs: SemanticRungView[]
  rectRungs: RectangleRungsView | null
  pitch: number
  setPitch: (value: number) => void
  pitchAuto: boolean
  setPitchAuto: (value: boolean) => void
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
  model: GridWorkbenchAdminPanelModel | null
  onSliderInteractionChange: (transient: boolean) => void
}

export function GridWorkbenchAdminPanel({
  src, geo, setLongMM, setShortMM, setSizeMM, gridMode, stdRungs, rectRungs,
  pitch, setPitch, pitchAuto, setPitchAuto,
  density, setDensity, pad, setPad, offsetMM, setOffsetMM, pattern, setPattern,
  patternAuto, setPatternAuto, plan, setPlan, front, setFront, centerMode, setCenterMode,
  maxGrowMM, setMaxGrowMM, model, onSliderInteractionChange,
}: GridWorkbenchAdminPanelProps) {
  const hiddenStdRungs = stdRungs.filter(r => !r.visible)
  const hiddenLongRungs = (rectRungs?.longOptions ?? []).filter(r => !r.visible)
  const hiddenShortRungs = (rectRungs?.shortOptions ?? []).filter(r => !r.visible)

  return <>
    <div className="gl-card gl-pad">
      {!(src === 'std' && geo === 'rect') && (!stdRungs.length || hiddenStdRungs.length > 0) && <div className="gl-field"><span>Size · {src === 'std' ? 'this shape' : 'square ref'} · {gridMode === 'quincunx' ? 'dice' : gridMode}</span>
        <div className="gl-seg gl-wrap">
          {!stdRungs.length && <span className="gl-inline-resolving">Resolving…</span>}
          {hiddenStdRungs.map(r =>
            <button key={r.sizeMM} aria-pressed={model?.rung?.sizeMM === r.sizeMM}
              className={r.visible ? undefined : 'gl-hidden-rung'}
              onClick={() => setSizeMM(r.sizeMM)}
              title={`${r.points} anchor point${r.points > 1 ? 's' : ''}${r.visible ? '' : ' · hidden at launch (untested)'}`}>
              {r.label}{r.visible ? '' : '†'}
            </button>)}
        </div>
      </div>}
      {src === 'std' && geo === 'rect' && <>
        {(!rectRungs || hiddenLongRungs.length > 0) && <div className="gl-field"><span>Long side · size</span>
          <div className="gl-seg gl-wrap">
            {!rectRungs && <span className="gl-inline-resolving">Resolving…</span>}
            {hiddenLongRungs.map(r =>
              <button key={'L' + r.sizeMM} aria-pressed={Math.max(model?.rung?.sizeMM ?? 0, model?.rungH?.sizeMM ?? 0) === r.sizeMM}
                className={r.visible ? undefined : 'gl-hidden-rung'}
                onClick={() => setLongMM(r.sizeMM)}
                title={`${r.points} anchor points${r.visible ? '' : ' · hidden at launch (untested)'}`}>
                {r.label}{r.visible ? '' : '†'}
              </button>)}
          </div>
        </div>}
        {(!rectRungs || hiddenShortRungs.length > 0) && <div className="gl-field"><span>Short side · size</span>
          <div className="gl-seg gl-wrap">
            {!rectRungs && <span className="gl-inline-resolving">Resolving…</span>}
            {hiddenShortRungs.map(r =>
              <button key={'S' + r.sizeMM} aria-pressed={Math.min(model?.rung?.sizeMM ?? 0, model?.rungH?.sizeMM ?? 0) === r.sizeMM}
                className={r.visible ? undefined : 'gl-hidden-rung'}
                onClick={() => setShortMM(r.sizeMM)}>
                {r.label}{r.visible ? '' : '†'}
              </button>)}
          </div>
        </div>}
      </>}
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
      <Slider label="Magnet padding · per spot · min 10" unit="mm" v={pad} set={setPad} min={10} max={30} onInteractionChange={onSliderInteractionChange} />
      <Slider label="Base margin · outward offset" unit="mm" v={offsetMM} set={setOffsetMM} min={-15} max={15} onInteractionChange={onSliderInteractionChange} />
      <Slider label="Max auto-margin · balance" unit="mm" v={maxGrowMM} set={setMaxGrowMM} min={0} max={80} onInteractionChange={onSliderInteractionChange} />

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

const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

function Slider({ label, v, set, min, max, unit, onInteractionChange }: {
  label: string
  v: number
  set: (n: number) => void
  min: number
  max: number
  unit?: string
  onInteractionChange: (transient: boolean) => void
}) {
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span><b>{v}{unit ? ' ' + unit : ''}</b></div>
      <input
        type="range"
        min={min}
        max={max}
        value={v}
        onChange={e => set(+e.target.value)}
        onPointerDown={() => onInteractionChange(true)}
        onPointerUp={() => onInteractionChange(false)}
        onPointerCancel={() => onInteractionChange(false)}
        onLostPointerCapture={() => onInteractionChange(false)}
        onKeyDown={e => { if (SLIDER_KEYS.has(e.key)) onInteractionChange(true) }}
        onKeyUp={e => { if (SLIDER_KEYS.has(e.key)) onInteractionChange(false) }}
        onBlur={() => onInteractionChange(false)}
      />
    </label>
  )
}
