// grid-engine/logic/offer.ts — SUB 2's judgement half: which answer is THE answer.
//
// Compute says what the material can carry. It says nothing about which of those
// is a product, and it must not: a shape that can hold four points can also hold
// three of them, and both are true facts about the geometry.
//
// Choosing between them is policy, and policy lives here. This file holds no
// geometry and no numbers — it reads what compute measured and applies a rule.

/**
 * WHAT THIS FILE NEEDS TO SEE, declared here rather than imported.
 *
 * Logic may not reach into compute — a rule that judges answers must not depend
 * on the module that produced them, or the two are one module wearing two names.
 * So the shape of the evidence is stated locally: any reading carrying these
 * fields can be judged, whoever measured it. TypeScript matches by structure, so
 * compute's own records satisfy this without either side knowing the other.
 */
export interface Arrangement {
  /** Translation-independent identity of the held set. */
  readonly signature: string
  /** How many points it holds. */
  readonly count: number
}

export interface SizeReading {
  /** Distinct arrangements the material can carry at one size. */
  readonly arrangements: readonly Arrangement[]
}

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
export function primaryArrangement<A extends Arrangement>(
  reading: { readonly arrangements: readonly A[] } | null,
): A | null {
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
export function distinctOffers<A extends Arrangement>(
  reading: { readonly arrangements: readonly A[] } | null,
): readonly A[] {
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
