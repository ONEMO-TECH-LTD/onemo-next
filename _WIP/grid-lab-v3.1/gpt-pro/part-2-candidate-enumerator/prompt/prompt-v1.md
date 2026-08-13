The measurement kernel you delivered is accepted as-is. Do not rewrite it, do not change its behaviour, and keep all 18 of its golden tests passing unchanged.

Now build the layer directly above it: a neutral candidate enumerator.

The kernel reports which individual lattice positions hold a disc at a given size. An arrangement is a *set* of those positions that a magnet layout could use. The enumerator turns kernel facts into every lawful arrangement. It measures nothing and decides nothing: it scores nothing, ranks nothing, prunes nothing, and never returns a winner. If two arrangements both exist, both come back.

## Input

- The kernel's measurement document, unchanged — its only source of geometric truth, including the field it covers.
- The arrangement grammar below, as explicit data.

It performs no geometry of its own. If a pattern needs a fact the kernel does not publish, name the missing fact and stop. Do not compute it here and do not infer it.

## Grammar — authoritative, not to be extended or substituted

Expressed purely in lattice indices. Enumerate on two populations of the one lattice, sharing its origin: the base population (every position) and the sparse population (every second position). Enumerate each family at every placement within the supplied field:

- **single** — one held position.
- **run** — two or more held positions in a straight evenly-spaced line: along an axis, or diagonal with equal step on both axes. Diagonal is lawful and introduces no second lattice.
- **rectangle corners** — the four corners of an axis-aligned rectangle. Each side spans any whole number of population steps, the two sides independently. Positions inside it are simply unused; skipping them is lawful.
- **corner triangle** — exactly three of those four corners. The fourth corner and any interior position are not members of the candidate, and their being held never makes them required.
- **full window** — every position of an r × c block.

Across all families: never drop an arrangement because another holds more positions.

A candidate's identity is its family, its population and steps, and its position set. The same position set may legitimately arise under more than one family — a 1 × 2 full window occupies the same positions as a two-position run, a 2 × 2 full window the same as rectangle corners. Keep every such record; deduplicate only records identical in all three respects.

If any sentence here admits two materially different formal readings, expose the ambiguity instead of settling it by preference.

## Output

Per candidate: stable canonical ID; the size and registration it belongs to; family and its per-axis steps; exact lattice indices and exact coordinates; the supporting kernel facts by reference, never recomputed.

The complete set is returned in a canonical deterministic order. Canonical order is not ranking; nothing may be marked preferred, best or default.

## Implementation

Match the kernel's discipline exactly: TypeScript, zero dependencies, exact arithmetic, no floating point in any identity or validity path, canonical serialization, byte-identical output for identical input. Enumeration is bounded by the supplied field and this grammar — no arbitrary-subset search.

## Tests

- Each family produced on a fixture where it applies.
- A diagonal run of three or more present; rectangle corners whose sides span more than one step present, including a tall narrow one; a corner triangle present while its fourth corner is held.
- Completeness: on a small hand-computable fixture, the returned set equals the hand-enumerated set exactly — nothing missing, nothing extra.
- The same held positions enumerated on the base and sparse populations yield what each permits, on one origin.
- A position set reachable by two families returns both records, distinct by family.
- Identical input bytes produce identical output bytes.
- The kernel's 18 goldens still pass, unchanged.

## Deliverable

One downloadable ZIP attached to this chat, self-contained and buildable on its own: the kernel unchanged, this enumerator, its tests, and a short contract describing the candidate record. Complete files, not fragments.
