// grid-engine/compute/occupancy.ts — the whole algorithm.
//
//   Shrink the shape inward by the safe radius.
//   Lay the fixed lattice over it.
//   Record which lattice points land inside.
//
// The points that land inside ARE the arrangement. Nothing is proposed from a
// list, nothing is matched against a catalogue, nothing is scored. The lattice
// repeats every `pitch`, so sliding it over one pitch-by-pitch square covers
// every distinct way the shape can meet the grid.
//
// Output is evidence, not a decision: for each size, the distinct sets of points
// the material can carry. Which of them is a good product is somebody else's
// question.

import { holds, prepare, scaleRing, type Prepared, type Pt } from './geometry'

/** One lattice point the material holds. Index is on the lattice; mm is real. */
export interface Node {
  readonly i: number
  readonly j: number
  readonly xMM: number
  readonly yMM: number
}

/** Every lattice point held at one phase. */
export function occupancy(
  shape: Prepared,
  pitch: number,
  radius: number,
  phase: Pt,
): Node[] {
  const { box, quantumMM } = shape
  const first = (lo: number, o: number) => Math.ceil((lo - o) / pitch)
  const last = (hi: number, o: number) => Math.floor((hi - o) / pitch)
  const held: Node[] = []
  for (let i = first(box.minX, phase[0]); i <= last(box.maxX, phase[0]); i++) {
    for (let j = first(box.minY, phase[1]); j <= last(box.maxY, phase[1]); j++) {
      const p: Pt = [phase[0] + i * pitch, phase[1] + j * pitch]
      if (holds(shape, p, radius)) {
        held.push({ i, j, xMM: p[0] * quantumMM, yMM: p[1] * quantumMM })
      }
    }
  }
  return held
}

/**
 * The arrangement's identity, independent of where it sits on the lattice.
 *
 * Two magnets one step apart vertically are the same arrangement wherever they
 * are, so the indices are shifted to the minimum corner before naming. This is
 * what makes "distinct arrangement" a measurable fact rather than a judgement.
 */
export function signature(held: readonly Node[]): string {
  if (held.length === 0) return ''
  let minI = Infinity, minJ = Infinity
  for (const n of held) {
    if (n.i < minI) minI = n.i
    if (n.j < minJ) minJ = n.j
  }
  return held
    .map((n) => `${n.i - minI},${n.j - minJ}`)
    .sort()
    .join(' ')
}

/** One distinct arrangement the material can carry at one size. */
export interface Arrangement {
  /** Translation-independent identity of the held set. */
  readonly signature: string
  /** How many points it holds. */
  readonly count: number
  /** A phase at which it occurs, in millimetres. */
  readonly phaseMM: Pt
  /** The held points at that phase. */
  readonly held: readonly Node[]
}

export interface ScanOptions {
  /** Sizes to evaluate, as the shape's longest side in millimetres. */
  readonly sizesMM: readonly number[]
  /** Spacing of the lattice, millimetres. Compute is told it; it is not the
   *  the spec's name for it and must not borrow one — this module has never
   *  heard of a product. */
  readonly latticeMM: number
  /** Safe radius each point requires, millimetres. */
  readonly radiusMM: number
  /**
   * How finely the lattice is slid across one pitch period, in millimetres.
   *
   * This is a SAMPLE of a continuous space, and it is the one approximation in
   * this module: an arrangement that exists only in a phase window narrower
   * than this step can be missed. It is stated here rather than hidden, and it
   * is reported back on every result.
   */
  readonly phaseStepMM: number
  /** Coordinate quantum, millimetres. */
  readonly quantumMM?: number
}

export interface SizeReading {
  readonly sizeMM: number
  /** Distinct arrangements found, richest first. */
  readonly arrangements: readonly Arrangement[]
  /** Phases sampled at this size. */
  readonly phasesSampled: number
}

export interface Scan {
  readonly readings: readonly SizeReading[]
  readonly phaseStepMM: number
  readonly missedWindowBoundMM: number
}

/**
 * Read the occupancy of one outline across sizes.
 *
 * For each size the shape is scaled, then the lattice is slid across one full
 * period and the held set recorded at each phase. Identical arrangements found
 * at different phases collapse to one entry, keeping the first phase seen.
 */
export function scan(ringMM: readonly Pt[], options: ScanOptions): Scan {
  const { sizesMM, latticeMM, radiusMM, phaseStepMM, quantumMM = 0.001 } = options
  if (!(latticeMM > 0) || !(radiusMM > 0) || !(phaseStepMM > 0)) {
    throw new RangeError('pitch, radius and phase step must be positive')
  }
  const pitch = Math.round(latticeMM / quantumMM)
  const radius = Math.round(radiusMM / quantumMM)
  const step = Math.max(1, Math.round(phaseStepMM / quantumMM))

  const readings: SizeReading[] = []
  for (const sizeMM of sizesMM) {
    const shape = prepare(scaleRing(ringMM, sizeMM), quantumMM)
    const found = new Map<string, Arrangement>()
    let phasesSampled = 0
    for (let px = 0; px < pitch; px += step) {
      for (let py = 0; py < pitch; py += step) {
        phasesSampled++
        const held = occupancy(shape, pitch, radius, [px, py])
        if (held.length === 0) continue
        const key = signature(held)
        if (found.has(key)) continue
        found.set(key, {
          signature: key,
          count: held.length,
          phaseMM: [px * quantumMM, py * quantumMM],
          held,
        })
      }
    }
    readings.push({
      sizeMM,
      arrangements: Object.freeze(
        [...found.values()].sort((a, b) => b.count - a.count || (a.signature < b.signature ? -1 : 1)),
      ),
      phasesSampled,
    })
  }
  return {
    readings: Object.freeze(readings),
    phaseStepMM,
    missedWindowBoundMM: phaseStepMM,
  }
}
