'use client'

// The instrument's controls and readout. Presentation only: it renders what the hook holds and
// calls back into it. No geometry, no thresholds, no product rule — the policy catalogue comes
// through the bridge from the logic layer, and every number printed came from the engine.

import { POLICIES } from '@/lib/grid-engine/bridge'
import type { MeasurementState } from './useMeasurement'
import styles from './MeasurementPanel.module.css'

export function MeasurementPanel({ measurement }: { measurement: MeasurementState }) {
  const { shapes, shapeName, result, busy, sizeIndex, current, settings } = measurement
  const variants = result?.variants ?? []
  const activeIndex = Math.min(sizeIndex, Math.max(variants.length - 1, 0))

  return (
    <section className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.label}>Cut-out</span>
        {shapes.length === 0 && <span className={styles.muted}>loading saved traces…</span>}
        {shapes.map((name) => (
          <button
            key={name}
            type="button"
            className={styles.chip}
            data-on={shapeName === name || undefined}
            onClick={() => measurement.selectShape(name)}
          >
            {name}
          </button>
        ))}
        {busy && <span className={styles.muted}>measuring…</span>}
        {result?.error && <span className={styles.error}>{result.error}</span>}
      </div>

      {variants.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Size</span>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={variants.length - 1}
            step={1}
            value={activeIndex}
            onChange={(event) => measurement.setSizeIndex(Number(event.target.value))}
            aria-label="Measured size"
          />
          {current && (
            <span className={styles.readout}>
              <strong>{current.variant.sizeMm}mm</strong> · band {current.variant.band} ·{' '}
              {current.variant.runsX}×{current.variant.runsY} ·{' '}
              {current.variant.heldCount} magnet{current.variant.heldCount === 1 ? '' : 's'} held ·{' '}
              {current.variant.widthMm.toFixed(1)} × {current.variant.heightMm.toFixed(1)}mm
              {current.variant.overhangMm &&
                ` · overhang ${current.variant.overhangMm.left.toFixed(0)}/${current.variant.overhangMm.right.toFixed(0)}/${current.variant.overhangMm.bottom.toFixed(0)}/${current.variant.overhangMm.top.toFixed(0)}`}
            </span>
          )}
        </div>
      )}

      {current && current.excludedBy.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Marked</span>
          {current.excludedBy.map((mark) => (
            <span key={mark.id} className={styles.excluded}>
              {mark.id} — {mark.because}
            </span>
          ))}
        </div>
      )}

      <div className={styles.row}>
        <span className={styles.label}>Policies</span>
        {POLICIES.map((policy) => {
          const state = settings[policy.id]
          return (
            <span
              key={policy.id}
              className={styles.policy}
              title={`${policy.says}\n\n${policy.note}`}
            >
              <button
                type="button"
                className={styles.chip}
                data-on={state.enabled || undefined}
                onClick={() => measurement.togglePolicy(policy.id)}
              >
                {policy.label}
              </button>
              {policy.value && state.enabled && (
                <select
                  className={styles.select}
                  value={state.value}
                  onChange={(event) => measurement.setPolicyValue(policy.id, Number(event.target.value))}
                  aria-label={`${policy.label} value`}
                >
                  {policy.value.options.map((option) => (
                    <option key={option} value={option}>
                      {option} {policy.value?.label}
                    </option>
                  ))}
                </select>
              )}
            </span>
          )
        })}
      </div>

      {variants.length > 0 && (
        <div className={styles.strip}>
          {variants.map((entry, index) => (
            <button
              key={`${entry.variant.band}-${entry.variant.sizeMm}-${entry.variant.runsX}x${entry.variant.runsY}`}
              type="button"
              className={styles.tick}
              data-on={index === activeIndex || undefined}
              data-held={entry.variant.heldCount > 0 || undefined}
              data-excluded={entry.excludedBy.length > 0 || undefined}
              onClick={() => measurement.setSizeIndex(index)}
              title={`${entry.variant.sizeMm}mm · band ${entry.variant.band} · ${entry.variant.runsX}×${entry.variant.runsY} · ${entry.variant.heldCount} held${entry.excludedBy.length ? ` · marked by ${entry.excludedBy.map((m) => m.id).join(', ')}` : ''}`}
            >
              {entry.variant.sizeMm}
              <em>{entry.variant.runsX}×{entry.variant.runsY}·{entry.variant.heldCount}</em>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
