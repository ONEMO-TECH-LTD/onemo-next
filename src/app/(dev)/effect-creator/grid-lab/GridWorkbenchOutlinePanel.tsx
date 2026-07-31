import type { OffsetJoin } from '@/lib/effect/offset'
import type { ArtworkFillMode } from '@/lib/effect/composite'

export interface GridWorkbenchOutlineValues {
  detail: number
  offset: number
  radius: number
  curve: number
  simplify: number
  smooth: number
  straighten: number
}

type OutlineValueKey = keyof GridWorkbenchOutlineValues

export interface GridWorkbenchOutlinePanelProps {
  values: GridWorkbenchOutlineValues
  offsetJoin: OffsetJoin
  blendPercent: number
  fillMode: ArtworkFillMode
  setValue: (key: OutlineValueKey, value: number) => void
  setOffsetJoin: (value: OffsetJoin) => void
  setBlendPercent: (value: number) => void
  setFillMode: (value: ArtworkFillMode) => void
  onSliderInteractionChange: (transient: boolean) => void
}

export function GridWorkbenchOutlinePanel({
  values,
  offsetJoin,
  blendPercent,
  fillMode,
  setValue,
  setOffsetJoin,
  setBlendPercent,
  setFillMode,
  onSliderInteractionChange,
}: GridWorkbenchOutlinePanelProps) {
  return (
    <div className="gl-card gl-pad" data-v531-outline-controls="engine-only">
      <div className="gl-glabel">Outline vector · v5.3.1 engine</div>
      <div className="gl-outline-grid">
        <Slider label="Detail" v={values.detail} set={(v) => setValue('detail', v)} onInteractionChange={onSliderInteractionChange} />
        <Slider label="Vector offset" v={values.offset} set={(v) => setValue('offset', v)} onInteractionChange={onSliderInteractionChange} />
        <Slider label="Radius" v={values.radius} set={(v) => setValue('radius', v)} onInteractionChange={onSliderInteractionChange} />
        <Slider label="Curve" v={values.curve} set={(v) => setValue('curve', v)} onInteractionChange={onSliderInteractionChange} />
        <Slider label="Simplify" v={values.simplify} set={(v) => setValue('simplify', v)} onInteractionChange={onSliderInteractionChange} />
        <Slider label="Smooth" v={values.smooth} set={(v) => setValue('smooth', v)} onInteractionChange={onSliderInteractionChange} />
        <Slider label="Straighten" v={values.straighten} set={(v) => setValue('straighten', v)} onInteractionChange={onSliderInteractionChange} />
      </div>
      <div className="gl-field"><span>Vector offset join</span>
        <div className="gl-seg">
          {([['round', 'Round'], ['sharp', 'Sharp'], ['bevel', 'Bevel']] as [OffsetJoin, string][]).map(([join, label]) =>
            <button key={join} aria-pressed={offsetJoin === join} onClick={() => setOffsetJoin(join)}>{label}</button>)}
        </div>
      </div>
      <div className="gl-glabel">Image blend · v5.3.1 engine</div>
      <div className="gl-outline-grid">
        <Slider label="Blend" v={blendPercent} set={setBlendPercent} onInteractionChange={onSliderInteractionChange} />
      </div>
      <div className="gl-field"><span>Fill outside image</span>
        <div className="gl-seg">
          {([['clamp', 'Clamp'], ['tile', 'Tile']] as [ArtworkFillMode, string][]).map(([mode, label]) =>
            <button key={mode} aria-pressed={fillMode === mode} onClick={() => setFillMode(mode)}>{label}</button>)}
        </div>
      </div>
    </div>
  )
}

const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

function Slider({ label, v, set, onInteractionChange }: {
  label: string
  v: number
  set: (n: number) => void
  onInteractionChange: (transient: boolean) => void
}) {
  const commit = (value: string) => {
    onInteractionChange(false)
    set(+value)
  }
  return (
    <label className="gl-slider">
      <div className="gl-slider-row"><span>{label}</span><b>{v}%</b></div>
      <input
        key={`${label}-${v}`}
        type="range"
        min={0}
        max={100}
        defaultValue={v}
        onPointerDown={() => onInteractionChange(true)}
        onPointerUp={e => commit(e.currentTarget.value)}
        onPointerCancel={e => {
          e.currentTarget.value = String(v)
          onInteractionChange(false)
        }}
        onKeyDown={e => { if (SLIDER_KEYS.has(e.key)) onInteractionChange(true) }}
        onKeyUp={e => { if (SLIDER_KEYS.has(e.key)) commit(e.currentTarget.value) }}
        onBlur={e => commit(e.currentTarget.value)}
      />
    </label>
  )
}
