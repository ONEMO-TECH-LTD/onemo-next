type GridDensity = 'standard' | 'light'
type GridPattern = 'standard' | 'quincunx' | 'diamond'
type MagnetPlan = 'auto' | 'all6' | 'all8' | 'corners8'
type MarginMode = 'auto' | 'manual'

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
  marginMode: MarginMode
  setMarginMode: (value: MarginMode) => void
  appliedMarginMM: number
  manualMarginMM: number
  setManualMarginMM: (value: number) => void
  minMarginMM: number
  setMinMarginMM: (value: number) => void
  maxMarginMM: number
  setMaxMarginMM: (value: number) => void
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
  roundedSquareRadiusMM: number
  setRoundedSquareRadiusMM: (value: number) => void
  roundedSquareRadiusMaxMM: number
  showRoundedSquareRadius: boolean
  testSizeMM: number
  setTestSizeMM: (value: number) => void
  testSizeMin: number
  testSizeMax: number
  snapToGrid: boolean
  setSnapToGrid: (value: boolean) => void
  snapSizesMM: number[]
  model: GridWorkbenchAdminPanelModel | null
  onSliderInteractionChange: (transient: boolean) => void
}

export function GridWorkbenchAdminPanel({
  pitch, setPitch, pitchAuto, setPitchAuto,
  density, setDensity, pad, setPad,
  marginMode, setMarginMode, appliedMarginMM, manualMarginMM, setManualMarginMM,
  minMarginMM, setMinMarginMM, maxMarginMM, setMaxMarginMM,
  pattern, setPattern,
  patternAuto, setPatternAuto, plan, setPlan, front, setFront, centerMode, setCenterMode,
  roundedSquareRadiusMM, setRoundedSquareRadiusMM, roundedSquareRadiusMaxMM,
  showRoundedSquareRadius,
  testSizeMM, setTestSizeMM, testSizeMin, testSizeMax,
  snapToGrid, setSnapToGrid, snapSizesMM,
  model, onSliderInteractionChange,
}: GridWorkbenchAdminPanelProps) {
  const snapIndex = Math.max(0, snapSizesMM.indexOf(testSizeMM))
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
      <div className="gl-field" data-grid-margin-mode={marginMode}><span>Fit offset mode</span>
        <div className="gl-seg">
          <button aria-pressed={marginMode === 'auto'} onClick={() => setMarginMode('auto')}>Auto</button>
          <button
            aria-pressed={marginMode === 'manual'}
            onClick={() => {
              setManualMarginMM(appliedMarginMM)
              setMarginMode('manual')
            }}
          >Manual</button>
        </div>
      </div>
      <NumberField
        label={marginMode === 'auto' ? 'Applied offset' : 'Manual offset'}
        unit="mm"
        v={marginMode === 'auto' ? appliedMarginMM : manualMarginMM}
        set={setManualMarginMM}
        min={0}
        max={80}
        readOnly={marginMode === 'auto'}
        onInteractionChange={onSliderInteractionChange}
      />
      <NumberField
        label="Minimum auto offset"
        unit="mm"
        v={minMarginMM}
        set={setMinMarginMM}
        min={0}
        max={maxMarginMM}
        disabled={marginMode !== 'auto'}
        onInteractionChange={onSliderInteractionChange}
      />
      <NumberField
        label="Maximum auto offset"
        unit="mm"
        v={maxMarginMM}
        set={setMaxMarginMM}
        min={minMarginMM}
        max={80}
        disabled={marginMode !== 'auto'}
        onInteractionChange={onSliderInteractionChange}
      />
      {showRoundedSquareRadius && <Slider
        label="Rounded-square corner radius"
        unit="mm"
        v={roundedSquareRadiusMM}
        set={setRoundedSquareRadiusMM}
        min={0}
        max={roundedSquareRadiusMaxMM}
        onInteractionChange={onSliderInteractionChange}
      />}
      <label className="gl-toggle"><span>Snap test size to grid</span>
        <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} />
      </label>
      <div data-grid-size-snap={snapToGrid ? 'on' : 'off'}>
        <Slider
          label="Test size · longest side"
          unit="mm"
          v={snapToGrid ? snapIndex : testSizeMM}
          displayV={testSizeMM}
          set={value => {
            const sizeMM = snapToGrid ? snapSizesMM[Math.round(value)] : value
            if (sizeMM != null) setTestSizeMM(sizeMM)
          }}
          min={snapToGrid ? 0 : testSizeMin}
          max={snapToGrid ? Math.max(0, snapSizesMM.length - 1) : testSizeMax}
          onInteractionChange={onSliderInteractionChange}
        />
      </div>

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

function NumberField({ label, v, set, min, max, unit, readOnly = false, disabled = false, onInteractionChange }: {
  label: string
  v: number
  set: (n: number) => void
  min: number
  max: number
  unit?: string
  readOnly?: boolean
  disabled?: boolean
  onInteractionChange: (transient: boolean) => void
}) {
  return (
    <label className="gl-number-field">
      <span>{label}</span>
      <span className="gl-number-input">
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={v}
          readOnly={readOnly}
          disabled={disabled}
          onChange={e => set(+e.target.value)}
          onFocus={() => onInteractionChange(true)}
          onBlur={() => onInteractionChange(false)}
          onKeyDown={e => { if (e.key === 'Enter') onInteractionChange(false) }}
        />
        {unit && <b>{unit}</b>}
      </span>
    </label>
  )
}

function Slider({ label, v, displayV = v, set, min, max, unit, onInteractionChange }: {
  label: string
  v: number
  displayV?: number
  set: (n: number) => void
  min: number
  max: number
  unit?: string
  onInteractionChange: (transient: boolean) => void
}) {
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span><b>{displayV}{unit ? ' ' + unit : ''}</b></div>
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
