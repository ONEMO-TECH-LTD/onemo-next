The measurement kernel you delivered is accepted as-is. Do not rewrite it, do not change its behaviour, and keep all 18 of its golden tests passing unchanged.

Now build the layer directly above it: a neutral candidate enumerator.

## What it is

The kernel says which individual lattice positions hold a disc at a given size. That is not yet an answer. A product answer is an *arrangement*: a specific set of lattice positions, at a specific size and registration, that a magnet layout could actually use.

The enumerator turns kernel facts into every lawful arrangement. It measures nothing itself and it decides nothing. It scores nothing, ranks nothing, prunes nothing, and never returns a winner. If two arrangements both exist, both come back.

## Input

- The kernel's measurement document, unchanged, as its only source of geometric truth (positions, held/not, clearances, witnesses; straight-corridor facts where a pattern needs them).
- The arrangement grammar below, supplied as explicit data.
- The released field: 9 × 9 base-lattice positions.

The enumerator performs no geometry of its own. If a pattern needs a geometric fact the kernel does not publish, name the missing fact and stop — do not compute it here and do not infer it.

## The grammar — authoritative, do not extend or substitute

These are product rules, not derivable mathematics. Implement exactly these families, as explicit lattice-index patterns, at **every valid translation and registration inside the field**:

- **single** — one held position.
- **pair** — two held positions that are neighbours on the same lattice: horizontal, vertical, **or diagonal**. A diagonal pair is lawful and introduces no second grid.
- **rectangle corners** — the four corner positions of an axis-aligned rectangle. Its axis steps may be one base step (48 mm) or the sparse step (96 mm), independently per axis. Intermediate rows and columns are simply unused — skipping them is lawful, not a defect.
- **corner triangle** — three of those four corners. The fourth position and any interior positions are optional; their existence never makes them required.
- **full window** — every position of an r × c window.

Rules that apply across all families:

- The 96 mm population is every second position of the same base lattice. It never moves the origin and is never a second grid.
- A band is a size label. It does not constrain which family or which lattice step an arrangement may use: a large size may legitimately be held by a four-corner rectangle on 96 mm steps.
- Never drop an arrangement because another arrangement holds more positions. Magnet count is not an objective here.
- Deduplicate only records that are geometrically identical, under an explicit canonical rule you state.
- If any sentence above admits two materially different formal readings, expose the ambiguity and ask, rather than settling it by preference.

## Output

For every candidate:

- stable canonical ID;
- size and registration it belongs to;
- family (single / pair / rectangle-corners / corner-triangle / full-window) and its lattice steps;
- exact lattice indices and exact millimetre coordinates;
- the kernel facts and witnesses that support it, by reference — never recomputed.

The complete candidate set is returned. Ordering is canonical and deterministic; canonical ordering is not ranking, and nothing may be marked preferred, best, or default.

## Implementation

Same discipline as the kernel: TypeScript, zero dependencies, exact integer/rational arithmetic, no floating point in any identity or validity path, canonical serialization with explicit BigInt handling, byte-identical output for identical input. Enumeration is bounded by the field and the grammar — no arbitrary-subset search, no heuristics, no caching of decisions, only of facts.

## Tests

- Every grammar family produced, on a fixture where it is the correct family.
- Diagonal pairs present; row- and column-skipped rectangle corners present; a corner triangle present without its fourth corner.
- Completeness: on a small hand-computable fixture, the returned set equals the full hand-enumerated set — nothing missing, nothing extra.
- The same held-position set at 48 mm and at 96 mm steps yields the arrangements each step permits, on one origin.
- Determinism: identical input bytes give identical output bytes.
- The kernel's 18 goldens still pass, unchanged.

## Deliverable

One downloadable ZIP attached to this chat, self-contained and buildable on its own, containing the kernel unchanged plus this enumerator, its tests, and a short contract describing the candidate record. Complete files, not fragments.

Nothing about gravity, coverage, tight wrap, escalation, preference or selection belongs in this layer. That is the next layer, and it comes after this one is accepted.
