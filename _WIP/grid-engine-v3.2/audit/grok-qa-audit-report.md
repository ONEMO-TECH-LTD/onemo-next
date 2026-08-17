# grok-qa audit report — v3.2 current build vs contracted canon vs pre-T1

**Lane:** s62-grok-qa  
**Date:** 2026-08-17  
**Read-only.** No product code edited.

**Judged against (the contract):**
- `canon/FINAL-CONSOLIDATED-PROPOSAL.md` — T0–T9 execution
- `canon/logic-spec-optimum.md` — what a band owes
- `canon/ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture.md` — what the machine is

**Not judged against:** the archived T0 ledger (declared dead), v3.3 architecture (proposal rejects it), lead’s dirty builder tree.

**Trees measured:**
- Pre-T1 3.2: `60656152` — last code state before T1 subtract — own worktree `s62-grok-qa-pre-t1`
- Current T8: `7ab17b83` — own worktree `s62-grok-qa-7ab17b83`, status `?? .scratch/` only
- Same seven canon fixtures, same `solveCutout` door, both runs

---

## Verdict

**PARTIAL as architecture. REGRESSED as a product.**

T0–T8 built the contracted selector (continuous feasible set, certified intervals, lexicographic order, old search deleted, identity, no fallback). That part landed.

The shipped *answers* are worse than the engine this programme was meant to perfect. Before T1, every shape produced an offer in every band, and those offers already matched the logic-spec walkthrough. After T8, four released winners remain and ten released bands are empty. That is not purification. It is policy slop piled on top of a real replacement.

**Necessity — shrink:** exclusive frame-cell matching; P4 default 12 mm as a hard reject; P2 and P7 bound to the same list; extra P7b key; peel budget that forces stop; micron retry that reordered a canon pair; unused flap triplet still in spec.

**Sufficiency — partial:** the contracted architecture is present. The product the briefs *and* the pre-T1 walkthrough both name is not.

---

## 1. Pre-T1 vs now — same door, same shapes

Pre-T1 sweep: ~262 s, an offer on every shape × every band.  
T8 sweep: seconds, hash `bde4be2b6bd57b1e`, 4 CERTIFIED_WINNER / 0 UNRESOLVED / 10 NONE on released bands.

| Shape | Band | Pre-T1 `60656152` | T8 `7ab17b83` | Logic-spec §6 |
|---|---|---|---|---|
| bat | B2 | **pair-v@88** | pair-diag@98 | ✅ vertical pair ~88 |
| bat | B3 | **tee-96@146** | tri-96-up@144 | ✅ tee / 3-corner ~146 |
| duck | B2 | **pair-v@84** | NONE (P4) | ✅ vertical pair ~84 |
| duck | B3 | **rect-48x96@154** | NONE (P4) | ✅ rect 48×96 skip-mid ~152 |
| butterfly | B2 | **pair-h@92** | NONE (P4) | ✅ horizontal wing pair ~92 |
| butterfly | B3 | **square-48@126** | NONE (P4) | ✅ four-in-wings ~126 |
| bot | B2 | **pair-v@98** | NONE (P4) | ✅ vertical pair ~98 |
| bot | B3 | **rect-48x96@144** | NONE (P4) | ✅ narrow four ~144 |
| pill | B2 | pair-antidiag@82 | pair-antidiag@84 | ✅ diagonal pair |
| pill | B3 | run-antidiag-3@138 | run-antidiag-3@134 | ✅ 3-chain |
| poke1 | B2 | standard@76 n=2 | NONE (P4) | ✅ pair ~76 |
| poke1 | B3 | square-48@126 | NONE (P4) | ✅ corner square ~126 |
| poke2 | B2 | pair-v@76 | NONE (P4) | Ⓓ vertical pair |
| poke2 | B3 | run-v-3@124 | NONE (P4) | Ⓓ column run-3 |
| all seven | B1, B4 | an offer each | mostly NONE | B4 Ⓓ / OPEN |

The “wrong” pre-T1 engine was already seating the canon walkthrough. T8 lost those seats.

Unreleased B1/B4 also answered before T1 (bat B1 single@60, bat B4 5pt@172, etc.). They are empty or unreleased-empty now. Same story.

---

## 2. Two inventions that ate the product

Neither is what the three briefs contracted.

### 2.1 Permission cells treat capacity as the only legal frame

`templatesForCell` (`judgement.ts`) keeps a template only if its bounding node frame **equals** the cell’s named frame. A 2×2 cell cannot instantiate `pair-v` (1×2) or `pair-h` (2×1).

Logic spec §4 step 3 / §5.2: the square/rect table is a **hypothesis** — “capacity, never compulsory”; free classes inherit, then the material **reduces** (an L drops to 1+2).

What shipped: §5.1 copied into `patternPolicy.cells` and used as an exclusive filter. Bat’s bbox is class 2×2, so only 2×2 templates run. The ruled B2 vertical pair is never hypothesized. `pair-diag` is 2×2, so it is the only pair-shaped thing the cell will admit — and it wins.

The square table was read as a lock.

### 2.2 An open switch shipped at the setting that kills the product

Pre-T1 acceptance: `flapTightMM 12` / `flapMaxMM 28` / `flapLimbMM 40`. The 40 mm limb exception is why duck, bot, butterfly, poke produced.

Those three numbers are still in `spec.ts`. Judgement no longer uses `flapLimbMM` at all. `flapTightMM` / `flapMaxMM` only paint the decorative `SizeVariant.tier`. Refusal is `unsupportedExtent.activeLimitMM = 12` against major-region reach. Five of seven shapes’ released bands die on `EXCESSIVE_UNSUPPORTED_EXTENT`.

Logic spec open register: flap switch 12-vs-24. Product Base §21: numerical unsupported-extent still a later mathematical decision. The plan does not authorise silently swapping the shipped 40 mm limb for a 12 mm hard reject.

Two flap laws, one silent. The silent one is the one that decides.

---

## 3. What the contract asked to add (not slop)

| Plan | Present at `7ab17b83` |
|---|---|
| T4 continuous `F = A ∩ ⋂(C_r − o_i)` | yes — `continuous-feasibility.ts` |
| T5 certified intervals; undecided first-class | yes — `structure.ts` descriptors + `certifiedDominance` |
| T6 Product Base funnel, lex order, no fallback | yes — `APPROVED_ORDER`, machine-readable rejections |
| Independent sizes, complete identity | yes — `SelectorResult` matches PB §19 |
| T8 delete old selector | yes — magnetic call without construction throws; no `targetMagnets` / sweep / growth |
| T9 truthful screen | **no** — chips still keyed band+size+count; empty band says `none` |

Line counts (engine, not tests):

| File | Pre-T1 | T8 |
|---|---:|---:|
| `logic/judgement.ts` | 728 | 1305 |
| `spec.ts` | 475 | 636 |
| `compute/structure.ts` | 212 | 1877 |
| `compute/grid-core.ts` | 1916 | 473 |
| `compute/continuous-feasibility.ts` | — | 309 |

T4/T5 growth and T8 deletion are the contracted shape. The **policy encoding** on top of T6 is what regressed the answers.

---

## 4. Other invented additions (not executable rules in the three briefs)

- **P2 and P7 bound to the same safe-core array** (`judgement.ts` ~738–740). Briefs name two classifications. One list. On every published released offer: P2 `[1,1]`, P7 `[1,1]`, P7b `[0,0]`, masses=1. Those keys cannot separate anyone on this corpus.
- **P7b variance** as its own restrict step. Briefs have P7 distribution and P8 balance. A second P7 key is extra.
- **`peelToleranceMM3: 1`** / 2000 evals. Peel formula is OPEN. The tiny budget is why released-default squares stop at P5 on a segment. Tests then invent `CERTIFYING_P5` (50 / 20000) to make the selector look finished.
- **1 µm exact-witness retry, asymmetric trigger.** Not in the briefs. It is what moved bat B2 off the canon `pair-v@88` onto `pair-diag@98` (and what a dirty-tree probe later flipped back).
- **`candidates: []`** kept as schema. Already conceded; follow-up.
- **B5 cells naming 5×5 with no 5×5 template.** Honest vocabulary gap. Plan parks B5 unless T0 includes it.

---

## 5. Conformance vs the three briefs (T8 bytes)

Verdicts: CONFORMS · PARTIAL · VIOLATES · ABSENT · OPEN.

### Physical / Compute (PB §§2–7, 13)

- 48 mm pitch, 12 mm radius, 24 mm disc, tangency legal, scale-only: **CONFORMS**
- Holes rejected at T4: **CONFORMS**
- Safe core as certified F, not raster: **CONFORMS**
- Hierarchy at caller levels [12, 24]; node class from own clearance: **CONFORMS** (engineering thresholds)
- Even-only size step 2 mm vs “round a selected size up to even”: **PARTIAL**

### Classification and funnel (PB §§4–6, 18; logic-spec §4–5)

- Axes independent; frames via cells: **CONFORMS** as tables
- No band-count rule / no `targetMagnets`: **CONFORMS**
- B5 exists, no 5×5 template: **PARTIAL**
- Canonical origin constructed; mechanics choose; canonical only if chain complete: **CONFORMS**
- Exact frame-cell filter (no reduction): **VIOLATES** “capacity, never compulsory”
- Logic-spec cross-band out-counting / +24 mm floors: **displaced by the plan (T0)** — code evaluates sizes independently. Not scored as a fail.

### Selection order (PB §11; logic-spec §2)

- Lexicographic; undecided stops later keys: **CONFORMS**
- P1 via construction door: **CONFORMS**
- P2 / P7 exist, degenerate feed: **PARTIAL**
- P3, P4 measure, P5, P8: **CONFORMS** as descriptors
- P6 as admission, not a scored key: **CONFORMS** as a gate; the gate itself is too tight (2.1)
- P9 then snug only inside one arrangement: **CONFORMS**
- P4 active 12 mm: **OPEN** in the briefs, **shipped as reject** — product-killing (2.2)

### Offer / identity / output (PB §12, 19; T9)

- Every size independent; distinct identities; no fallback: **CONFORMS**
- `SelectorResult` carries PB §19 fields: **CONFORMS**
- Bulls-eye on screen; refusal reasons on screen; identity chip keys: **ABSENT** (T9 not in this commit). Empty band still renders `B2: none`.

---

## 6. What flipped since the 16 Aug archive audit

That audit (`99-archive/qa-v3.2-final-conformance-verdict.md`) correctly condemned the *heuristic* engine: 2 mm flood, `better()`, `targetMagnets`, no region graph, ~6 min suite, 91/97.

That engine is gone. Do not reuse that NON-CONFORMANT verdict as if it described `7ab17b83`.

Do not treat “the architecture is now right” as “the product still answers.” The 16 Aug live bench already showed bat B1–B4 offering. Those offers were the walkthrough. They are the thing T8 no longer returns.

---

## 7. Commit range (code only)

```
60656152  pre-T1 3.2 — every shape offers
aef3ee58  docs lane prep
26a8b164  T1 subtract targetMagnets / floors / probes
3b1b4445  fallback comment
5e1b2d97  T2 oracle
8706bb56  T2 adapter
21098ad5  T3 probe
68cadecf  T3 evidence
39064dc3  T4 feasibility
10de186d  T4 seam measure
d4912d89  T5 descriptors
0037d2bf  dead flag / notes
4b0baaaa  T6 funnel + P4 apply + permission cells
8b78db48  T7 P7 mass-graph = safe core (both names)
9a0fddcb  T7 retry
faac108b  T8 delete old selector
7ab17b83  T8 stale text
```

T1 removed condemned *ranking*. T6 put back a stricter, invented *admission* (exact frame cells) and a stricter, unruled *reject* (P4=12). That is how “perfect the original” became “most shapes say none”.

---

## 8. Evidence commands (reproducible)

Pre-T1:

```
cd onemo-next/.claude/worktrees/s62-grok-qa-pre-t1
git rev-parse HEAD   # 60656152e3af1469bb0cab889f880e50e4e762aa
npx vite-node .scratch/pre-t1-sweep.ts
```

T8:

```
cd onemo-next/.claude/worktrees/s62-grok-qa-7ab17b83
git rev-parse HEAD && git status --porcelain
# 7ab17b83…   ?? .scratch/
npx vite-node .scratch/t7-sweep.ts
npx vite-node .scratch/t-conformance-probe.ts
```

T8 suite on this tree: 175/175. Magnetic `computePreparedGrid` without construction throws.

---

## 9. What to do with this (not a plan, a diagnosis)

The architecture replacement is not the defect. The defect is three policy encodings that the briefs either forbid, leave open, or describe as reduction-from-capacity:

1. Unlock templates the cell *can* host, including reductions (pair inside a 2×2 hypothesis).
2. Do not ship 12 mm as the product-killing reject until Dan rules the switch; the pre-T1 limb law is what produced the walkthrough.
3. Stop pointing coverage and distribution at the same one-piece list, or record that those priorities are silent.

Until those three move, “T8 CLEAR” and “product conformant” are different sentences.
