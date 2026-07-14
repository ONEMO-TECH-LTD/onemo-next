# batch-1 (post-completion hygiene) — @s58-expert META verdict @ ed597a4 (2026-07-09)
Chain 252aef3 (F-A1 + D-1/D-2/D-4/D-5) → ed597a4 (hook dep arrays). Parent 5099f12. QA 17/17 (live toast/retry
proven), lead diff-verified. Method: full diff-read + adversarial completeness checks + grep-traced reachability.

## VERDICT: META PASS — one LOW finding (D-2 incomplete kill). Substance is sound + F-A1 is THOROUGH.

## F-A1 (the behavioral fix) — SOUND + COMPLETE (adversarially verified)
`engineWrite()` helper: checks `r.ok`; on a 404 with non-JSON body (dev-server recompile HTML) waits 1200ms
and retries ONCE (exactly the HMR-eats-the-first-call failure); on failure surfaces the SERVER'S NAMED error
via the toast (`r.clone().json().error`) — so every named 422 refusal the engine produces is now VISIBLE to
the author, not swallowed. Returns Response|null so callers skip the reload on failure.
COMPLETENESS (my adversarial check — all 4 silent paths I named in the original F-A1 finding are converted):
auto-promote (2391) ✓, add-state chip (2414) ✓, the live-preview redirect `void fetch`→`void engineWrite`
(2965) ✓, the I5 board-panel `write()` (4029) ✓. The two other raw editor-write fetches (3322 Publish batch,
3422 inline text-commit) already had their own `r.ok`+toast handling — not silent, correctly untouched.
No remaining fire-and-forget authoring write. ed597a4 (engineWrite in the 3 hook dep arrays) = correct
closure-hygiene. QA's 17/17 with live toast + retry proof corroborates.

## D-4 (walker dedup) — EQUIVALENCE VERIFIED (byte-identical)
`addBooleanPropToComponent`'s inlined fn-finder → `findComponentFn(sf)`. Diffed the removed loop against
findComponentFn: IDENTICAL (FunctionDeclaration cap-name break; VariableStatement arrow cap-name). Zero
behavior change. Sound.

## D-1 — correct, but it's a BEHAVIOR FIX mislabeled as deslop (noted, not a defect)
setConnector's `bind` lookup now matches the PUBLIC name (`propertyName ?? name`), so an already-aliased
switch axis is FOUND and the 409 idempotency refusal fires — previously it keyed on the local name, missed
the alias, and threw the wrong "not a destructured prop" 422. This is the same public-name-matching class as
the later F-M9/F-I5-1 fixes; correct and consistent. Categorization only — it's a fix, not hygiene.

## D-5 (un-export DecomposedRule) — VERIFIED no external refs; `export type`→`type`. Sound.

## FINDING F-B1 (LOW, non-blocking) — D-2 is an INCOMPLETE KILL: dead SERVER variant scope kind left behind
D-2 removed the CLIENT `EditTarget {kind:'variant'}` (zero setters, confirmed) — good. But the SERVER
`ScopedTarget {kind:'variant';name}` (lib.ts:261) + its handlers (`scopedSelector` :530 `.base.<name>`,
`writeScopedDeclaration` :551 name-validation) were LEFT. Grep-traced: ZERO constructors send `{kind:'variant'}`
anywhere in src/ (only the type def remains) — the pre-I2 single-variant write path is fully superseded by the
composite scope, so this server branch is now DEAD CODE. Harmless (an unreachable branch, no bug), but the
cemetery deslop is supposed to clear BOTH halves. FIX (bounded, ~3 lines): drop the union member + the
scopedSelector branch + the :551 validation. Fold-when-convenient (or with the D-5-buttons batch); LOW.

## Disposition
META PASS. F-A1 thorough + complete, D-4/D-1/D-5 sound. One LOW: F-B1 (finish the D-2 kill — dead server
variant scope). Non-blocking → can land in the same consolidated report / a follow-up. Nothing Done — Dan's gate.
