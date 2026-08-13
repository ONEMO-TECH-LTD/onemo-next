Build the engine from your answer as a pure measurement kernel, fully neutral: no product values, no product rules. Our spec layer supplies
  every number at runtime; our logic layer builds on the results.

  Input: one canonical simple polygon; a parameters object (lattice pitch, disc diameter, field extent — all supplied, nothing hardcoded); a
  list of sizes.

  Output: per size, per lattice position: does the full disc fit (centre inside + boundary distance ≥ radius, tangency passes), exact
  clearance, limiting-contact witness. Second function: for two given positions, the straight-capsule fact (strip of disc width fits or not).
  Each size evaluated independently. Everything returned — nothing selected, filtered, ranked, or labelled.

  Implementation: TypeScript, zero dependencies, exact arithmetic via BigInt (integer inputs, rational transforms as numerator/denominator,
  squared comparisons by cross-multiplication). No epsilons; floats only for display. Deterministic, byte-stable.

  Deliverables: contract (md), source, numeric golden fixtures (boundary-exact, near-tangency ±1 unit, winding/translation/start-index
  invariance).

  Forbidden: any policy, selection, ranking, bands, layouts, sparse rules, flap interpretation, hardcoded values, epsilons, silent polygon
  repair.
