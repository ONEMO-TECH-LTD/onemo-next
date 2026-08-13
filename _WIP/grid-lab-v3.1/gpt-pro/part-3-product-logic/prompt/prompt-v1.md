Build the third and final layer: product logic. Deliver **this layer only** — do not include, rebuild or re-version the kernel or the enumerator, and do not run their tests. We hold the accepted copies here; your package must consume their documents, not carry them.

One change to the enumerator since you delivered it, applied on our side: `single` now exists as a fifth candidate family, emitted once per held position with steps `0,0`, independent of the `full-window` `oneByOne` rule. So the families you will see are `single`, `run`, `rectangle-corners`, `corner-triangle`, `full-window`.

## What it does

Inputs, all immutable: the enumerator's candidate document; the kernel measurement document its positions reference by pointer, so exact clearances and limiting witnesses are readable rather than reconstructed; and the explicit product rules and rule inputs below. This layer never recomputes geometry, never creates a candidate, never removes one, and never hides the raw set.

## The product rules

These are rulings, not derivations. Implement exactly these, and no others.

**Gravity, first.** A hanging cut-out peels from the bottom upward, so an unheld top lets go. Candidates holding the shape's upper material rank above those that do not. A candidate whose held positions cluster low, leaving the top unsupported, ranks below one that holds the top — even if it holds more positions.

**Tight wrap, second.** Among candidates that satisfy gravity, prefer the one whose material wraps its held positions most closely — least unsupported material extending beyond them. A narrower arrangement that still covers the shape's masses outranks a wider one.

**Regional support.** A candidate may contain every disc correctly and still be wrong: valid positions can cluster in one mass of the shape and leave another unsupported. Regional support is its own judgement and must never be reduced to how many discs are contained, or how far apart they are. Its precedence against gravity and tight wrap is NOT settled: report it separately for every candidate, and let it affect the order only through an explicitly supplied precedence. Never merge it into another measure to force a single sequence.

**Escalation is per band, not per size.** Bands group sizes; the candidate document does not carry them, so the band of each size and the order of bands are explicit inputs. When no candidate within a band supports the shape's masses well enough, a stronger arrangement in the next band may rank above every candidate in that band. A larger size is not itself a preference. Both halves of that rule — what makes support insufficient, and what makes one arrangement stronger than another — are undefined here and must be supplied; see below.

**Arrangement class carries across sizes.** The same shape may keep its arrangement class as size grows, with its positions landing on wider steps. A larger size does not imply a larger or denser arrangement.

## The gaps you must name, not fill

Some terms above are product concepts the supplied documents cannot compute:

- "the shape's upper material", "wraps most closely" and "a mass of the shape";
- the boundary between a candidate that is preferred, one that is merely acceptable, and one we refuse;
- escalation's trigger — what makes a band's support insufficient — and its target — what makes one arrangement stronger than another, whether that is more positions, wider coverage of the masses, a different family, or something else.

Between them the two documents give positions, families, step structure, exact clearances and limiting boundary witnesses — and nothing else.

For each such term: do not invent a threshold, a decomposition, a proxy or a classification rule. Name precisely what is missing, state the smallest additional input that would make it computable, and implement the rule as accepting that input explicitly. Where more than one definition is defensible, compare the smallest candidates, attack each with a counterexample, and leave the choice to us.

## Output

The complete candidate set, unchanged, plus:

- an ordering expressed as **ranked tiers**: candidates the supplied rules separate occupy distinct tiers in order; candidates the supplied rules cannot separate share a tier. A shared tier is the honest representation of an unresolved comparison and must never be broken by an invented preference. Canonical serialization order is a separate, deterministic concern and carries no meaning.
- for every candidate, its status under the supplied status policy — and if no status policy is supplied, that fact stated rather than guessed.
- for every candidate, the judgements applied to it with the exact values they used, including regional support reported on its own.
- for every tier boundary, which rule decided it and why.

No candidate is deleted and none is marked as the answer. Ordering is the output; choosing is ours.

## Implementation

Same discipline as the accepted layers: TypeScript, zero dependencies, exact arithmetic on the exact values the documents carry, no floating point in any comparison that decides an order, canonical serialization, byte-identical output for identical input.

## Acceptance evidence

Attached are decided examples: for a given shape and size, the arrangement we accept, sometimes with one we consider acceptable-but-lower and one we reject. They are acceptance oracles for ordering only. They do not define the rules, they do not define regions, they do not define status, and they are not inputs to any measurement. Use them to check that a proposed rule set orders as we do, and to falsify one that does not.

## Tests

- A low cluster ranks below a candidate holding the top, on a fixture where both are lawful.
- A narrower arrangement covering the same masses ranks above a wider one.
- A candidate whose positions all sit in one mass ranks below one spread across the shape's masses, on a fixture where both contain every disc.
- A fuller arrangement in the next band outranks every candidate in a band whose members all leave a mass unsupported.
- Two candidates the supplied precedence cannot separate share a tier, and no rule silently orders them.
- Identical inputs produce identical bytes; changed rule inputs produce a different, explained ordering.
- A candidate document is consumed without mutation.

## Deliverable

One downloadable ZIP attached to this chat containing this layer only — source, tests, and a short contract stating exactly which inputs each rule requires and what remains undefined. Complete files, not fragments.
