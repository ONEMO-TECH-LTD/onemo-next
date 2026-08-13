# Assembled engine — parts 1 + 2, with one local patch

`magnetic-grid-measurement-kernel/` is the delivered kernel, unmodified.
`enumerator/` is the delivered enumerator with ONE correction applied here rather than
sent back to GPT (Dan's call, 2026-08-13: a one-family patch is not worth an hour of
round-trip).

## The correction

The delivery omitted the `single` family and folded a lone held position into the
optional `1 x 1 full-window` case, so a single disc was labelled `full-window` and
vanished entirely when `oneByOne: "exclude"`. Dan's band-1 canon answer is a single
disc, and candidate identity includes the family name, so the label is not cosmetic.

Applied:

- `single` added as the fifth authoritative family (`types.ts`), required in grammar
  validation (`validate.ts`);
- `enumerateSingles` emits one candidate per held position per population, steps (0,0),
  independent of the `oneByOne` rule (`enumerator.ts`);
- the two-held completeness fixture's grammar gained the family and its golden was
  REGENERATED, not hand-edited;
- three test expectations corrected for the new semantics, each justified:
  lone position → `single` alone under exclude, `single` + `full-window` under include;
  two held positions → 2 singles + run + 1x2 window; duplicate sizes → 8 not 4.

## Verified after patching

- enumerator tests 13/13 pass;
- kernel goldens 18/18 pass, kernel untouched;
- direct probe: `exclude` yields `single[0,0]`; `include` yields `single[0,0]` and
  `full-window[0,0]` as distinct records.

Nothing else was changed: no family algorithm, no population handling, no product logic.

## Self-QA after the patch (s62-kai-lead)

Documentation drift found and fixed: the enumerator's CONTRACT.md still declared "exactly
these four family keys", described `oneByOne` as controlling whether a lone position is
emitted at all, and counted "the four algorithms"; README pointed at "four family
definitions". All corrected, and `single` is now specified in the contract as section 4.0.

Adversarial probes against the patch itself, beyond the suite:

- no held positions anywhere: 0 candidates, no phantom single;
- two held positions under base AND sparse populations: exactly four singles, one per
  held position per population, correctly attributed (base:0 base:2 sparse:0 sparse:2);
- a measurement whose only held position is at column 1: exactly one single, at column 1
  — unheld positions never produce one;
- repeated runs byte-identical;
- a single's position carries the kernel fact pointer `/sizes/0/positions/2` and the
  centre copied from that fact (96), not a value reconstructed from indices.

Remaining known deltas from the delivered package, deliberate: the package-level
PACKAGE-SHA256SUMS is not carried into this assembly (the assembly is ours and its files
have legitimately changed); the kernel keeps its own SHA256SUMS and still verifies 59/59.
