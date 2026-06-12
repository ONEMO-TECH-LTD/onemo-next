// TickBar — G12: the ONE shared measuring tick-bar control that replaces every primitive
// input[type=range] in the editor (Dan, with visual reference; blueprint §7 G12).
//
// A MINIMAL ruler of fine vertical ticks whose height/brightness express the value fill · a quiet
// numeric readout · an optional dashed max-limit threshold marker · touch-and-drag ANYWHERE on the
// bar (no thumb to grab) with a magnification effect around the active notch · a haptic pulse per
// notch where the platform exposes haptics. No panel chrome, no label (Dan, 2026-06-10 — final
// look pending Dan's reference shots).
//
// Mechanics ride the §6.3 editor contract: `onChange` fires per tick and must stay VISUAL-ONLY
// cheap-preview in the caller; `onCommit` fires once on release — that's where resolves, document
// applies, undo entries, and 3D pushes belong. Per-gesture cost is reported to the G3 HUD.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { perfGesture } from '../dev/PerfHUD'

interface TickBarProps {
  label: string
  min: number
  max: number
  value: number
  /** per-tick (visual-only preview in the caller — §6.3). */
  onChange: (v: number) => void
  /** once, on release (resolve + apply + undo + 3D push live here — §6.3). */
  onCommit: (v: number) => void
  /** notch step (readout + haptic granularity). */
  step?: number
  /** optional dashed threshold marker (e.g. max safe rounding) drawn at this value. */
  maxLimit?: number
  /** readout formatter (default: rounded integer). */
  format?: (v: number) => string
  disabled?: boolean
}

const TICK_COUNT = 56 // fine ruler density
const MAG_RADIUS = 6 // ticks around the active notch that magnify

export default function TickBar({
  label, min, max, value, onChange, onCommit, step = 1, maxLimit, format, disabled,
}: TickBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const lastNotchRef = useRef<number | null>(null)
  const gestureStartRef = useRef(0)
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max])
  const quant = useCallback((v: number) => clamp(Math.round(v / step) * step), [clamp, step])

  const valueAt = useCallback((clientX: number) => {
    const el = barRef.current
    if (!el) return valueRef.current
    const r = el.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return quant(min + t * (max - min))
  }, [min, max, quant])

  const pulse = useCallback((v: number) => {
    const notch = Math.round(v / step)
    if (lastNotchRef.current !== notch) {
      lastNotchRef.current = notch
      try { navigator.vibrate?.(4) } catch { /* no haptics on this platform */ }
    }
  }, [step])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    gestureStartRef.current = performance.now()
    setActive(true)
    const v = valueAt(e.clientX)
    pulse(v)
    onChange(v)
  }, [disabled, valueAt, onChange, pulse])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!active || disabled) return
    const t0 = performance.now()
    const v = valueAt(e.clientX)
    pulse(v)
    onChange(v)
    const dt = performance.now() - t0
    if (dt > 4) perfGesture(`${label.toLowerCase()}-tick`, dt) // only report non-trivial ticks
  }, [active, disabled, valueAt, onChange, pulse, label])

  const finish = useCallback((e: React.PointerEvent) => {
    if (!active || disabled) return
    setActive(false)
    const v = valueAt(e.clientX)
    const t0 = performance.now()
    onCommit(v)
    perfGesture(`${label.toLowerCase()}-commit`, performance.now() - t0)
    lastNotchRef.current = null
  }, [active, disabled, valueAt, onCommit, label])

  // keyboard accessibility: arrows nudge by step and commit
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return
    let v: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = quant(valueRef.current + step)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = quant(valueRef.current - step)
    if (v !== null) { e.preventDefault(); onChange(v); onCommit(v) }
  }, [disabled, quant, step, onChange, onCommit])

  useEffect(() => () => { lastNotchRef.current = null }, [])

  const frac = max > min ? (clamp(value) - min) / (max - min) : 0
  const activeTick = frac * (TICK_COUNT - 1)
  const limitFrac = maxLimit !== undefined && max > min ? Math.max(0, Math.min(1, (maxLimit - min) / (max - min))) : null
  const readout = format ? format(value) : `${Math.round(value)}`
  // the readout tints accent only when the value has left zero (the old zero-dot + transient
  // pop-up were removed as unsanctioned — KAI-9015)
  const atZero = Math.abs(clamp(value) - Math.max(min, 0)) < step / 2 && min <= 0

  return (
    /* MINIMAL ruler (Dan, 2026-06-10): no panel background, no label text, no heavy readout —
       just the ticks + a quiet value. Awaiting Dan's reference shots for the final look. */
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={onKeyDown}
      style={{
        position: 'relative', flex: 1, minWidth: 0, height: 46,
        cursor: disabled ? 'default' : 'ew-resize',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px',
        touchAction: 'none', userSelect: 'none',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {/* the ruler — barRef lives HERE so pointer→value maps over the tick area, not the panel */}
      <div ref={barRef} style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
        {/* ruler ticks — height/brightness express fill; magnify around the active notch */}
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const filled = i <= activeTick
            const d = Math.abs(i - activeTick)
            const mag = active ? Math.max(0, 1 - d / MAG_RADIUS) : 0
            const major = i % 7 === 0
            const h = (major ? 18 : 11) + mag * 14
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${(i / (TICK_COUNT - 1)) * 100}%`,
                  width: d < 0.5 && active ? 2.5 : 1.5,
                  height: h,
                  transform: 'translateX(-50%)',
                  borderRadius: 1,
                  background: filled
                    ? `rgba(${mag > 0.4 ? '20,24,40' : '52,60,84'},${0.6 + 0.4 * Math.min(1, mag + 0.25)})`
                    : 'rgba(20,24,40,0.18)',
                  transition: active ? 'none' : 'height 120ms ease, background 120ms ease',
                }}
              />
            )
          })}
          {/* dashed max-limit threshold marker */}
          {limitFrac !== null && (
            <span
              aria-hidden
              style={{
                position: 'absolute', left: `${limitFrac * 100}%`, top: 5, bottom: 5, width: 0,
                borderLeft: '2px dashed rgba(214,118,30,0.8)', transform: 'translateX(-50%)',
              }}
            />
          )}
        </div>
      </div>
      {/* quiet numeric readout — accent only when the value has left zero (UX-4) */}
      <span
        style={{
          fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          color: atZero ? '#3a4156' : 'var(--color-bg-brand-solid, #2563eb)',
          minWidth: 44, textAlign: 'right', flexShrink: 0, pointerEvents: 'none',
        }}
      >
        {readout}
      </span>
    </div>
  )
}
