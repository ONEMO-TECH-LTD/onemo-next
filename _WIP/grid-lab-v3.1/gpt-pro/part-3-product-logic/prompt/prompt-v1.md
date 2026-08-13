The kernel and the enumerator are both accepted as delivered. Do not modify either; their tests must keep passing unchanged inside your package.

Now build the third and final layer: product logic. It consumes the candidate set and orders it. It is the only layer permitted to prefer anything.

## What it does

Inputs, all immutable: the enumerator's candidate document; the kernel measurement document its candidates reference by pointer, so the exact clearances and limiting witnesses behind each position are readable rather than reconstructed; and the explicit product rules and rule inputs below. It never recomputes geometry, never creates a candidate, never removes one, and never hides the raw set.

## The product rules

These are rulings, not derivations. Implement exactly these, and no others.

**Gravity, first.** A hanging cut-out peels from the bottom upward, so an unheld top lets go. Among candidates, those holding the shape's upper material rank above those that do not. A candidate whose held positions cluster low, leaving the top unsupported, is ranked below one that holds the top — even if it holds more positions.

**Tight wrap, second.** Among candidates that satisfy gravity, prefer the one whose material wraps its held positions most closely — least unsupported material extending beyond them. A narrower arrangement that still covers the shape's masses outranks a wider one.

**Regional support.** A candidate may contain every disc correctly and still be wrong: valid positions can cluster in one mass of the shape and leave another unsupported. Regional support is its own judgement and must never be reduced to how many discs are contained, or how far apart they are. Its precedence against gravity and tight wrap is NOT settled: report it separately for every candidate, and let it affect the order only through an explicitly supplied precedence. Never merge it into another measure to obtain a total order.

**Escalation is per band, not per size.** Bands group sizes; the candidate document does not carry them, so the band of each size and the order of bands are explicit inputs. When no candidate within a band supports the shape's masses without leaving one badly unsupported, a fuller arrangement in the next band may rank above every candidate in that band. A larger size is not itself a preference.

**Arrangement class carries across sizes.** The same shape may keep its arrangement class as size grows, with its positions landing on wider steps. A larger size does not imply a larger or denser arrangement.

## The gap you must name, not fill

"The shape's upper material", "wraps most closely" and "a mass of the shape" are product concepts. Between them the two supplied documents give you positions, families, step structure, and — through each position's pointer into the measurement document — exact clearances and limiting boundary witnesses. They do not give you a decomposition of the shape into masses, a definition of top, or a wrap measure.

Where a rule above cannot be computed from the supplied facts, do not invent a threshold, a decomposition, or a proxy. Name precisely what is missing, state the smallest additional input that would make the rule computable, and implement the rule as accepting that input explicitly. Compare the smallest defensible candidate definitions if more than one is defensible, attack each with a counterexample, and leave the choice to us.

## Output

The complete candidate set, unchanged, plus:

- an order over it, deterministic and reproducible from the same inputs, using only the rules whose precedence is supplied;
- for every candidate, its status — preferred, acceptable, or rejected — because an order alone loses the distinction between a lower-ranked lawful answer and one we refuse;
- for every candidate, the judgements applied to it with the exact values they used, including regional support reported on its own;
- for every ordering decision, which rule decided it and why; and for any pair the supplied precedence cannot separate, that fact stated rather than broken by an invented tie-break.

No candidate is marked as the answer. Ordering is the output; choosing is ours.

## Implementation

Same discipline as the two accepted layers: TypeScript, zero dependencies, exact arithmetic on the exact values the candidate document carries, no floating point in any comparison that decides an order, canonical serialization, byte-identical output for identical input.

## Acceptance evidence

Attached are decided examples: for a given shape and size, the arrangement we accept, sometimes with one we consider acceptable-but-lower and one we reject. They are acceptance oracles for ordering only. They do not define the rules, they do not define regions, and they are not inputs to any measurement. Use them to check that a proposed rule set orders as we do, and to falsify one that does not.

## Tests

- A low cluster loses to a candidate holding the top, on a fixture where both are lawful.
- A narrower arrangement covering the same masses outranks a wider one.
- A candidate whose positions all sit in one mass ranks below one spread across the shape's masses, on a fixture where both contain every disc.
- A fuller arrangement in the next band outranks every candidate in a band whose members all leave a mass unsupported.
- A lawful lower-ranked candidate is marked acceptable, not rejected; a refused one is marked rejected and stays in the set.
- Identical inputs produce identical bytes; supplied rule inputs changed produce a different, explained order.
- The kernel's 18 and the enumerator's 13 tests still pass, unchanged.

## Deliverable

One downloadable ZIP attached to this chat, self-contained and buildable on its own: the kernel and enumerator unchanged, this layer, its tests, and a short contract stating what inputs each rule requires. Complete files, not fragments.
