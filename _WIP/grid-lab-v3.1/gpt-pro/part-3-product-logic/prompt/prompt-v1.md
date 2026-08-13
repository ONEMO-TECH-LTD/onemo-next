The kernel and the enumerator are both accepted as delivered. Do not modify either; their tests must keep passing unchanged inside your package.

Now build the third and final layer: product logic. It consumes the candidate set and orders it. It is the only layer permitted to prefer anything.

## What it does

Input: the enumerator's candidate document, unchanged and immutable, plus the explicit product rules below. It never recomputes geometry, never creates a candidate, never removes one from the raw set, and never hides the raw set. It returns the complete set with an ordering over it, and a reason trace for every judgement it makes.

## The product rules

These are rulings, not derivations. Implement exactly these, and no others.

**Gravity, first.** A hanging cut-out peels from the bottom upward, so an unheld top lets go. Among candidates, those holding the shape's upper material rank above those that do not. A candidate whose held positions cluster low, leaving the top unsupported, is ranked below one that holds the top — even if it holds more positions.

**Tight wrap, second.** Among candidates that satisfy gravity, prefer the one whose material wraps its held positions most closely — least unsupported material extending beyond them. A narrower arrangement that still covers the shape's masses outranks a wider one.

**Regional support.** A candidate may contain every disc correctly and still be wrong: valid positions can cluster in one mass of the shape and leave another unsupported. Regional support is therefore its own judgement and must never be reduced to how many discs are contained, or to how far apart they are.

**Escalation.** When no candidate at a given size supports the shape's masses without leaving one badly unsupported, a fuller arrangement at a larger size may rank above every candidate at the smaller size. Size alone is not a preference in either direction.

**Arrangement class carries across sizes.** The same shape may keep its arrangement class as size grows, with its positions landing on wider steps. A larger size does not imply a larger or denser arrangement.

## The gap you must name, not fill

"The shape's upper material", "wraps most closely" and "a mass of the shape" are product concepts. The candidate document gives you positions, exact clearances, limiting boundary witnesses and step structure — it does not give you a decomposition of the shape into masses, a definition of top, or a wrap measure.

Where a rule above cannot be computed from the supplied facts, do not invent a threshold, a decomposition, or a proxy. Name precisely what is missing, state the smallest additional input that would make the rule computable, and implement the rule as accepting that input explicitly. Compare the smallest defensible candidate definitions if more than one is defensible, attack each with a counterexample, and leave the choice to us.

## Output

The complete candidate set, unchanged, plus:

- a total order over it, deterministic and reproducible from the same inputs;
- for every candidate, the judgements applied to it with the exact values they used;
- for every ordering decision, which rule decided it and why;
- for every candidate ranked below another, the reason.

Nothing is deleted, and no candidate is marked as the answer. Ordering is the output; choosing is ours.

## Implementation

Same discipline as the two accepted layers: TypeScript, zero dependencies, exact arithmetic on the exact values the candidate document carries, no floating point in any comparison that decides an order, canonical serialization, byte-identical output for identical input.

## Tests

- A low cluster loses to a candidate holding the top, on a fixture where both are lawful.
- A narrower arrangement covering the same masses outranks a wider one.
- A candidate whose positions all sit in one mass ranks below one spread across the shape's masses, on a fixture where both contain every disc.
- A fuller arrangement at a larger size outranks every candidate at a smaller size when the smaller ones leave a mass unsupported.
- Identical inputs produce identical bytes; supplied rule inputs changed produce a different, explained order.
- The kernel's 18 and the enumerator's 13 tests still pass, unchanged.

## Deliverable

One downloadable ZIP attached to this chat, self-contained and buildable on its own: the kernel and enumerator unchanged, this layer, its tests, and a short contract stating what inputs each rule requires. Complete files, not fragments.
