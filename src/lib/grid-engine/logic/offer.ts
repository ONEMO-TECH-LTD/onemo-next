// grid-engine/logic/offer.ts — SUB 2's judgement half: which answer is THE answer.
//
// Compute says what the material can carry. It says nothing about which of those
// is a product, and it must not: a shape that can hold four points can also hold
// three of them, and both are true facts about the geometry.
//
// Choosing between them is policy, and policy lives here. This file holds no
// geometry and no numbers — it reads what compute measured and applies a rule.

import type { Arrangement, SizeReading } from '../compute/occupancy'

/**
 * THE FULLEST POPULATION the material carries.
 *
 * Dan's ruled law: take the fullest set of points that fits the footprint, never
 * a subset of it. A three-point answer that is simply a four-point answer with
 * one point dropped is not a second offer — it is the same arrangement, weaker.
 *
 * Ties are broken by the arrangement's own identity so the choice is stable
 * across runs rather than depending on the order phases happened to be visited.
 */
export function primaryArrangement(reading: SizeReading | null): Arrangement | null {
  if (!reading || reading.arrangements.length === 0) return null
  return reading.arrangements.reduce((best, candidate) =>
    candidate.count > best.count ||
    (candidate.count === best.count && candidate.signature < best.signature)
      ? candidate
      : best,
  )
}

/**
 * Every arrangement that is not merely a thinning of a richer one.
 *
 * A signature whose points are all contained in another signature's points, at
 * the same relative offset, is that arrangement with magnets removed. What
 * survives are the genuinely distinct layouts the size unlocks — which is what
 * the brief asks a band to return, rather than one answer.
 */
export function distinctOffers(reading: SizeReading | null): readonly Arrangement[] {
  if (!reading) return []
  const sets = reading.arrangements.map((a) => ({ a, points: new Set(a.signature.split(' ')) }))
  return Object.freeze(
    sets
      .filter(({ a, points }) =>
        !sets.some(
          (other) =>
            other.a !== a &&
            other.points.size > points.size &&
            [...points].every((p) => other.points.has(p)),
        ),
      )
      .map(({ a }) => a),
  )
}
