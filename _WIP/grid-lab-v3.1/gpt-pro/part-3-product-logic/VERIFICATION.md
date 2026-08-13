# Part 3 — product logic — verification by @s62-kai-lead

Checks run in this lane on the delivered package, not GPT's claims. Full read of the fork
transcript (1,697 lines) and every package file. Package copied byte-for-byte out of Downloads;
`diff -r` against the extracted archive is empty and no file under `delivery/` was authored here.

## Mechanical — all pass

| check | result |
|---|---|
| manifest `SHA256SUMS` | **43/43 OK** in the repo location |
| own test suite | **15/15 pass** (`node --test ./test/product-logic.test.mjs`) |
| upstream implementations bundled | **none** — no kernel or enumerator source in the tree, as instructed |
| neutrality grep (`winner\|best\|preferred\|optimal\|score\|prefer`) | **zero hits** (only the caller's own `bestToWorst` class list) |
| floats in any decision path | **none** — no `Math.*`, `parseFloat`, `parseInt`; the four `Number()` calls are array indices, each bounds-checked against `MAX_SAFE_INTEGER` first |
| exact comparison | `BigInt` cross-multiplication (`compareRational`), no epsilon anywhere |

## What it actually does, and does well

- **It verifies the layer below rather than trusting it.** Every candidate position must resolve to a
  kernel fact whose `fits` is `true`, and the candidate's copied index and centre must match that
  fact exactly, or it throws `SOURCE_FACT_MISMATCH` / `UNHELD_CANDIDATE_POSITION`. A fabricated or
  drifted candidate cannot pass through this layer silently.
- **It refuses to invent.** Gravity is a caller boolean; wrap and regional support are caller values
  with a caller comparator; bands, escalation and status are explicit caller data. Nothing is
  derived from family, population, size, step width, position count, clearance or coordinates —
  verified by reading `compare.ts` in full, not by trusting the contract.
- **It stops instead of faking an order.** `order.ts` builds tie classes, then proves they are a
  strict weak order: non-transitive ties, inconsistent cross-tier members, or a cycle all raise
  `NonTierableOrderingError`. A tier is never invented to make the output look total.
- **`single` is accepted** as the fifth family, so our local enumerator patch is compatible.

## Findings

### 1. The acceptance oracle was never supplied — this lane's defect, not the package's

The part-3 prompt said *"Attached are decided examples"*. Nothing was attached, and no mechanism
existed for attaching them. GPT reported it plainly (transcript line 1693): no acceptance-oracle
file was present, so it claims no validation against them.

**Consequence: not one of Dan's decided placements has been checked against this ordering.** The 15
tests use synthetic fixtures with hand-set judgements; they prove the mechanism, never conformance
to canon. Writing that oracle is this lane's work — the contract's §8 states it belongs on our side
regardless, since the examples cannot define regions, status or metrics.

### 2. The layer relocates the unsolved problem; it does not reduce it

Every candidate requires a gravity boolean, a tight-wrap value and a regional-support value, or the
call throws `MISSING_INPUT`. So **nothing can be ordered until this lane defines "upper material",
"wraps most closely" and "a mass of the shape" concretely enough to emit a value per candidate** —
precisely the three concepts the canon states only in words. That is correct behaviour under the
brief, and it is the whole remaining product problem, now sharply located.

Status has the same shape: supply a policy and every candidate needs an assignment.

### 3. Ordering cost is quadratic, and real candidate sets are large — measured here

`buildOrdering` runs all-pairs comparisons three times (tie classes, intra-class transitivity,
cross-class consistency), and boundary decisions are all-pairs across each adjacent tier.

| candidates | all tied (1 tier) | all distinct (n tiers) |
|---|---|---|
| 100 | 12 ms | 12 ms |
| 300 | 41 ms | 71 ms |
| 600 | 139 ms | 281 ms |
| 1000 | 394 ms | 739 ms |

The canon harness produced **1,346 candidates for BOT at 236mm at a single anchor and origin**, and
real use multiplies that by sizes and registrations. Against the 16.7 ms phone-frame target this
cannot sit on an interaction path: ordering must be precomputed off the main thread, or the
candidate set must be scoped per size and registration before it is ordered. Not a defect — the
brief never set a budget — but a hard integration constraint to design around.

### 4. Escalation is globally binding

A promotion means the target ranks above **every** candidate in the source band and is applied
before all other rules. Any conflict with another promotion or with the ordinary judgements raises
`NonTierableOrderingError` rather than resolving quietly. Our escalation inputs therefore have to be
globally consistent, not locally reasonable — a real constraint on the spec layer.

### 5. Cosmetic

Every tier carries `sharedMeaning: "unresolved-by-supplied-ordering-rules"`, including
single-member tiers where nothing is unresolved.

## Verdict

**Accepted as delivered on its own terms — and unproven against Dan's canon.** The mechanism is
correct, exact, neutral and honest about what it refuses to decide; the ordering it produces has
never met a single decided example, because none was ever sent. Finding 1 is this lane's to fix
before any conformance claim is made about part 3.
