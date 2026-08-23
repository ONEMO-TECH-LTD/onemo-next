// magnet-grid.ts — the magnet grid for a cut-out shape. Nothing else.
//
// ONE OPERATION:  give it an outline, it returns the sizes that shape can be
//                 offered at, and where the magnets sit at each one.
//
// THE LAW IT OBEYS (grid-laws.md, Dan):
//   1.1  one lattice, 48mm centre to centre
//   1.5  the grid is rigid — it never deforms; the whole lattice translates as one body
//   1.6  no off-grid placement
//   2.1  padding is 10mm FROM THE MAGNET CENTRE — each magnet owns a 20mm spot
//   2.2  10mm is a hard floor, and exactly 10mm is legal
//   2.4  checked per magnet against the real outline, not per edge
//   2.5  padding circles never overlap
//   3.1  the grid defines the size — not the size the grid
//   3.2  no invented sizes
//   3.23 published sizes are whole and EVEN, rounded UP
//   3.24 the population creates the size; population identity is 2-D
//        "there is NO maximality rule"
//   4.7c the mode is the magnet mask: Standard = every magnet, Light = the boundary ring
//   4.7d spacing is its own control; the mask never implies it
//   8.7  no hardcoded values — every number arrives as an input
//   Dan, 2026-08-09: "scale is the only part must be applied" — uniform scale, no margin band.
//
// WHAT IT DOES NOT DO: it does not stretch the outline, it does not search for a size,
// it does not rank by magnet count, and it does not decide anything the law leaves open.

export type Pt = [number, number]
export interface Ring { pts: Pt[] }
export interface Outline { outer: Ring; holes: Ring[] }

/** Every number the engine uses. None of them live in the code. */
export interface GridLaw {
  pitchMM: number         // 48 or 96 — the admin's own control
  paddingMM: number       // 10 — from the magnet centre
  maxSizeMM: number       // 310
  toleranceMM: number     // 0.05 — the manufacturing tolerance the sizes are reported on
  /** Optional: the lattice translations to consider. Omit for the default candidate set.
   *  Which translation a shape ships with is O3 — an open ruling, not a value this file owns. */
  phasesMM?: number[]
}

export type Mask = 'standard' | 'light'

export interface Rung {
  /** Published longest side, whole and even. */
  sizeMM: number
  /** The exact wrap before even-millimetre publication. */
  exactMM: number
  /** Magnet centres in mm, origin at the shape's top-left. */
  magnets: Pt[]
  /** Magnets under the Light mask — the population's boundary ring. */
  rimMagnets: Pt[]
  /** Lattice offset that produced this population. */
  phaseMM: Pt
}

// ── geometry ────────────────────────────────────────────────────────────────

function inRing(p: Pt, ring: ReadonlyArray<Pt>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distToRing(p: Pt, ring: ReadonlyArray<Pt>): number {
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]
    const [bx, by] = ring[i]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2))
    const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))
    if (d < best) best = d
  }
  return best
}

/**
 * How much room a point has inside the shape. Positive inside, negative outside.
 * A hole is not material: a point inside a hole is outside the shape (law 7.10 — holes are
 * physical cut-outs), and its distance to the hole rim bounds the room just as the outer edge does.
 */
function roomMM(p: Pt, outline: Outline): number {
  if (!inRing(p, outline.outer.pts)) return -distToRing(p, outline.outer.pts)
  let room = distToRing(p, outline.outer.pts)
  for (const hole of outline.holes) {
    if (inRing(p, hole.pts)) return -distToRing(p, hole.pts)
    room = Math.min(room, distToRing(p, hole.pts))
  }
  return room
}

/** Longest side 1, bounding box centred on the origin. Uniform — proportions are identity. */
export function normalise(outline: Outline): Outline {
  const all = [outline.outer.pts, ...outline.holes.map((h) => h.pts)].flat()
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const longest = Math.max(maxX - minX, maxY - minY)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const map = (r: Ring): Ring => ({ pts: r.pts.map(([x, y]) => [(x - cx) / longest, (y - cy) / longest] as Pt) })
  return { outer: map(outline.outer), holes: outline.holes.map(map) }
}

/** The shape at size S, in mm, still centred on the origin. */
function at(unit: Outline, sizeMM: number): Outline {
  const map = (r: Ring): Ring => ({ pts: r.pts.map(([x, y]) => [x * sizeMM, y * sizeMM] as Pt) })
  return { outer: map(unit.outer), holes: unit.holes.map(map) }
}

// ── the solve ───────────────────────────────────────────────────────────────

/**
 * The smallest size at which THIS magnet seats lawfully.
 *
 * The grid is rigid (1.5) — the magnet does not move. Only the shape scales (Dan, 08-09).
 * Room grows with size, so this has exactly one crossing: bisection finds it, nothing is scanned.
 * Returns null if the magnet never seats within the system's ceiling.
 */
function seatSizeMM(unit: Outline, magnet: Pt, law: GridLaw): number | null {
  // Law 2.2 is CATEGORICAL: no magnet ever sits closer than the padding, and the floor is
  // "never satisfied by a tolerance". The comparison is therefore strict — never relaxed.
  // Exact tangency is LEGAL (2.2: "not closer than 10mm" includes 10mm exactly), and floating
  // point cannot land on it — 212/2 - 96 computes as 9.999999999999998. Comparing strictly is the
  // documented defect F17(b): the engine "accepts 10.0017 and rejects 10.0000", growing shapes
  // that never needed to grow. The allowance below is a REPRESENTATION epsilon scaled to the
  // magnitudes involved, not a tolerance on the floor: it is ~1e-13 mm, far below anything
  // physical, and it admits tangency without admitting a sub-floor seat.
  const representationMM = Math.max(law.maxSizeMM, law.paddingMM) * 8 * Number.EPSILON
  const seats = (sizeMM: number) => roomMM(magnet, at(unit, sizeMM)) >= law.paddingMM - representationMM
  if (!seats(law.maxSizeMM)) return null

  // Room grows with size, so the crossing is unique: bisect to it. This solves the size FOR a
  // given magnet — the inverse of asking which grid fits a candidate size (3.24 / S21). The
  // step count is derived from the tolerance the caller supplied, never baked.
  const steps = Math.ceil(Math.log2(law.maxSizeMM / law.toleranceMM))
  let lo = 0
  let hi = law.maxSizeMM
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2
    if (seats(mid)) hi = mid
    else lo = mid
  }
  // Report on the manufacturing quantum, and only downward if the floor still holds there.
  // This is what keeps an exact 116 from publishing as 118 without ever admitting a sub-floor
  // seat — law 2.2's tangency is accepted, its floor is not moved.
  const snapped = Math.round(hi / law.toleranceMM) * law.toleranceMM
  return seats(snapped) ? snapped : hi
}

/** Publish whole and EVEN, rounded up — the fabric is cut by people (3.23). */
function publish(exactMM: number): number {
  return 2 * Math.ceil(exactMM / 2)
}

/**
 * A magnet is interior only when the population holds its immediate neighbour in all four
 * lattice directions. Light shows what is left — the boundary ring (4.7c).
 */
function boundaryRing(population: ReadonlyArray<Pt>, pitchMM: number): Pt[] {
  const key = ([x, y]: Pt) => `${Math.round(x / pitchMM)},${Math.round(y / pitchMM)}`
  const held = new Set(population.map(key))
  const steps: Pt[] = [[pitchMM, 0], [-pitchMM, 0], [0, pitchMM], [0, -pitchMM]]
  return population.filter((p) =>
    !steps.every(([dx, dy]) => held.has(key([p[0] + dx, p[1] + dy]))))
}

/**
 * CANDIDATE lattice translations — not "the lawful placements". The grid may legally sit anywhere
 * within one cell (1.5, 1.6). This default set is a convenience sweep: centred, half-stepped, and
 * registered against either padded edge. Which translation a shape ships with is O3, and the book
 * says that is Dan's ruling. Supply law.phasesMM to widen, narrow or replace the sweep.
 */
function phaseCandidates(law: GridLaw): number[] {
  // These are CANDIDATE translations, not "the lawful placements" — the lattice may legally sit
  // anywhere within one cell (1.5, 1.6, 4.9's surviving phase search). Which one a shape ships
  // with is O3 and is Dan's ruling. Supply your own set to widen or narrow the sweep.
  if (law.phasesMM) return [...new Set(law.phasesMM)]
  const p = law.pitchMM
  const wrap = (v: number) => ((v % p) + p) % p
  const quantum = law.toleranceMM
  const snap = (v: number) => Math.round(v / quantum) * quantum
  return [...new Set([0, p / 2, wrap(law.paddingMM), wrap(-law.paddingMM)].map(snap))]
}

function latticeWithin(halfSpanMM: number, pitchMM: number, phase: Pt): Pt[] {
  const axis = (offset: number): number[] => {
    const out: number[] = []
    const first = Math.ceil((-halfSpanMM - offset) / pitchMM)
    const last = Math.floor((halfSpanMM - offset) / pitchMM)
    for (let i = first; i <= last; i++) out.push(i * pitchMM + offset)
    return out
  }
  const xs = axis(phase[0])
  const ys = axis(phase[1])
  const out: Pt[] = []
  for (const x of xs) for (const y of ys) out.push([x, y])
  return out
}

/**
 * Identity of a population, so the same thing is never published twice — and so nothing else is
 * hidden. Law 3.24: identity is TWO-DIMENSIONAL and "no population may hide another".
 *
 * The identity is the ABSOLUTE magnet centres, not the lattice indices. Two layouts with the same
 * index pattern at different registrations are DIFFERENT layouts — a 2x2 centred on the shape and
 * a 2x2 offset half a cell put the magnets in different places on the fabric. Keying on indices
 * erased the registration and silently picked one, which is an O3 decision this file must not make.
 */
function populationKey(points: ReadonlyArray<Pt>, quantumMM: number): string {
  return points
    .map(([x, y]) => `${Math.round(x / quantumMM)},${Math.round(y / quantumMM)}`)
    .sort()
    .join(' ')
}

/**
 * THE LADDER.
 *
 * For one lattice placement, every magnet has a size at which it starts to seat. Sort those and
 * the populations fall out in order: each threshold is the moment a new magnet joins, and that
 * exact size is the wrap for the population it creates. The size is never searched for — it is
 * the by-product of the population, which is law 3.1 stated as arithmetic.
 *
 * Occupancy is "what fits, sits": at a given size, the population is every lattice point whose
 * padding circle is inside the shape. Nothing is chosen and nothing is ranked — 3.24 forbids
 * both. Where two placements are lawful, the one that seats a population at the smaller size
 * wins, because the grid defines the size (3.1).
 */
export function magnetLadder(outline: Outline, law: GridLaw): Rung[] {
  const unit = normalise(outline)
  const halfSpan = law.maxSizeMM / 2
  const best = new Map<string, Rung>()

  for (const ox of phaseCandidates(law)) for (const oy of phaseCandidates(law)) {
    const phase: Pt = [ox, oy]
    const thresholds: Array<{ magnet: Pt; sizeMM: number }> = []
    for (const magnet of latticeWithin(halfSpan, law.pitchMM, phase)) {
      const sizeMM = seatSizeMM(unit, magnet, law)
      if (sizeMM != null) thresholds.push({ magnet, sizeMM })
    }
    thresholds.sort((a, b) => a.sizeMM - b.sizeMM)

    const seated: Pt[] = []
    for (let i = 0; i < thresholds.length; i++) {
      seated.push(thresholds[i].magnet)
      // several magnets can arrive at the same size — publish the population, not each magnet
      if (i + 1 < thresholds.length
        && thresholds[i + 1].sizeMM - thresholds[i].sizeMM < law.toleranceMM) continue

      const exactMM = thresholds[i].sizeMM
      const sizeMM = publish(exactMM)
      if (sizeMM > law.maxSizeMM) break

      const population = [...seated]
      const key = populationKey(population, law.toleranceMM)
      const existing = best.get(key)
      if (existing && existing.exactMM <= exactMM) continue
      best.set(key, {
        sizeMM,
        exactMM,
        magnets: population.map(([x, y]) => [x, y] as Pt),
        rimMagnets: boundaryRing(population, law.pitchMM),
        phaseMM: phase,
      })
    }
  }

  // NEVER collapse by published size. Law 3.24: "no population may hide another because a
  // scalar extent or magnet count happens to match." Collapsing here is what returned a
  // two-magnet 68 while the canonical four-magnet 68 existed at another translation.
  // Every distinct population is returned. Which one SHIPS is O3 — Dan's ruling, not this file's.
  return [...best.values()].sort((a, b) =>
    a.sizeMM - b.sizeMM || b.magnets.length - a.magnets.length)
}

/** The magnets a rung actually shows. The mask is the only thing the mode decides (4.7c). */
export function magnetsFor(rung: Rung, mask: Mask): Pt[] {
  return mask === 'light' ? rung.rimMagnets : rung.magnets
}

// ── the O3 decision surface ─────────────────────────────────────────────────
//
// The law leaves ONE thing undecided (Part IV, O3): when several lattice placements are lawful,
// which one the shape ships with. This does not answer it — it LAYS THE OPTIONS OUT so Dan can.
// Every placement below is legal under the book as written.

/** Each lawful lattice placement, kept separate, with the ladder it produces on its own. */
export function laddersByPlacement(
  outline: Outline,
  law: GridLaw,
): Array<{ phaseMM: Pt; rungs: Rung[] }> {
  const unit = normalise(outline)
  const halfSpan = law.maxSizeMM / 2
  const out: Array<{ phaseMM: Pt; rungs: Rung[] }> = []

  for (const ox of phaseCandidates(law)) for (const oy of phaseCandidates(law)) {
    const phase: Pt = [ox, oy]
    const thresholds: Array<{ magnet: Pt; sizeMM: number }> = []
    for (const magnet of latticeWithin(halfSpan, law.pitchMM, phase)) {
      const sizeMM = seatSizeMM(unit, magnet, law)
      if (sizeMM != null) thresholds.push({ magnet, sizeMM })
    }
    thresholds.sort((a, b) => a.sizeMM - b.sizeMM)

    const rungs: Rung[] = []
    const seated: Pt[] = []
    for (let i = 0; i < thresholds.length; i++) {
      seated.push(thresholds[i].magnet)
      if (i + 1 < thresholds.length
        && thresholds[i + 1].sizeMM - thresholds[i].sizeMM < law.toleranceMM) continue
      const exactMM = thresholds[i].sizeMM
      const sizeMM = publish(exactMM)
      if (sizeMM > law.maxSizeMM) break
      const population = [...seated]
      rungs.push({
        sizeMM,
        exactMM,
        magnets: population.map(([x, y]) => [x, y] as Pt),
        rimMagnets: boundaryRing(population, law.pitchMM),
        phaseMM: phase,
      })
    }
    if (rungs.length) out.push({ phaseMM: phase, rungs })
  }
  return out
}

/** The outline in mm at a published size — for drawing it beside its magnets. */
export function outlineAt(outline: Outline, sizeMM: number): Outline {
  return at(normalise(outline), sizeMM)
}
