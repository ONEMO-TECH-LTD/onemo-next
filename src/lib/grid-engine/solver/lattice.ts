// FIXED LATTICE, PLACEMENT AND PARITY — blueprint §5, and the §6.1 centred run windows.
//
// §5.1: Λbase = { (s·i, s·j) } and Λsparse = Λ(base·sparseFactor) ⊂ Λbase. "The lattice origin and
// points never translate. Switching to sparse hides points; it does not recompute a centre or
// offset." (L7)
//
// §5.2: per-axis parity target — target(k) = 0 for an odd run (centre ON a point), basePitch/2 for
// an even run (centre in the GAP). The offset uses the BASE pitch always, which is what keeps the
// sparse population a strict subset with nothing re-centred. (L6, L7)
//
// §5.3: the ceiling stays a COUNT — fieldSpan = (positionsPerAxis−1)·basePitch + 2·padding; no
// millimetre ceiling crosses the public boundary. (L9)

import type { GridEngineSpec, OperationalBand, PointMM, PopulationSlot } from './contract'

/** §5.2: the parity target for a run of k positions, on the BASE pitch. */
export function parityTarget1D(k: number, basePitchMM: number): number {
  return k % 2 === 1 ? 0 : basePitchMM / 2
}

/** Derived pitch for a population slot — a value from guarded inputs, never a literal (§2.1). */
export function pitchOf(slot: PopulationSlot, spec: GridEngineSpec): number {
  return slot === 'base' ? spec.basePitchMM : spec.basePitchMM * spec.sparseFactor
}

/** §5.3: the count-derived field span; σmax follows from it and the source bbox. */
export function fieldSpanMM(spec: GridEngineSpec): number {
  return (spec.positionsPerAxis - 1) * spec.basePitchMM + 2 * spec.paddingMM
}

/**
 * §6.1: the one-dimensional centred run — run(s,k) = { s·(i − floor((k−1)/2)) : i = 0..k−1 }.
 * At the base pitch this is centred on the parity target: odd runs around 0, even runs around
 * basePitch/2. At the sparse pitch it is a fresh run on Λsparse about the UNCHANGED base-derived
 * target, so even sparse runs are intentionally asymmetric (§6.1: "not a subset of the finite base
 * run"; the accepted even-run asymmetry of §5.2).
 */
export function run1D(pitchMM: number, k: number): number[] {
  const out: number[] = []
  const shift = Math.floor((k - 1) / 2)
  for (let i = 0; i < k; i++) out.push(pitchMM * (i - shift))
  return out
}

export interface Window {
  /** engine-frame lattice points of the r×c centred window for this population */
  readonly points: readonly PointMM[]
  readonly rows: number
  readonly columns: number
  readonly band: OperationalBand
  readonly slot: PopulationSlot
  readonly pitchMM: number
  /** stable id for the inverse index (§7.3) and the disconnected diagnostic (§2.2) */
  readonly windowId: string
}

/**
 * §6.1: for every operational band n and every extent 1 ≤ r,c ≤ n, one centred r×c window per
 * population. "There are only n² centred extent windows per band. Translated windows are excluded…
 * Arbitrary subsets are excluded." Band 4 is not enumerated (EC-03).
 */
export function windowsFor(spec: GridEngineSpec, slot: PopulationSlot): Window[] {
  const pitch = pitchOf(slot, spec)
  const out: Window[] = []
  for (const band of spec.bands) {
    for (let r = 1; r <= band; r++) {
      for (let c = 1; c <= band; c++) {
        const xs = run1D(pitch, c)
        const ys = run1D(pitch, r)
        const points: PointMM[] = []
        for (const y of ys) for (const x of xs) points.push([x, y])
        out.push({
          points,
          rows: r,
          columns: c,
          band,
          slot,
          pitchMM: pitch,
          windowId: `${slot}:b${band}:r${r}c${c}`,
        })
      }
    }
  }
  return out
}

/** §5.2: the 2-D parity target for a window — (target(columns), target(rows)) on the BASE pitch. */
export function parityTargetOf(w: Window, spec: GridEngineSpec): PointMM {
  return [parityTarget1D(w.columns, spec.basePitchMM), parityTarget1D(w.rows, spec.basePitchMM)]
}

/** L6 as data: an even run registers in the gap, an odd run on a point — per axis. */
export function registrationOf(w: Window): { x: 'point' | 'gap'; y: 'point' | 'gap' } {
  return { x: w.columns % 2 === 1 ? 'point' : 'gap', y: w.rows % 2 === 1 ? 'point' : 'gap' }
}
