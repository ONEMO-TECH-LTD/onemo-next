type GridDensity = 'standard' | 'light'
type GridPattern = 'standard' | 'quincunx' | 'diamond'
type MagnetPlan = 'auto' | 'all6' | 'all8' | 'corners8'

interface GridWorkbenchAdminPanelModel {
  pitch: number
  patternUsed: string
}

export interface GridWorkbenchAdminPanelProps {
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
  pitch, setPitch, pitchAuto, setPitchAuto,
  density, setDensity, pad, setPad, offsetMM, setOffsetMM, pattern, setPattern,
  patternAuto, setPatternAuto, plan, setPlan, front, setFront, centerMode, setCenterMode,
  maxGrowMM, setMaxGrowMM, model, onSliderInteractionChange,
}: GridWorkbenchAdminPanelProps) {
  return <>
    <div className="gl-card gl-pad">
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
