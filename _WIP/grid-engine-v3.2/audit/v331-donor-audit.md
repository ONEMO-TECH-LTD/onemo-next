# v3.3.1 AUDIT — better than the v3.2 rollback, or a donor?

**Author:** s62-kai-lead · 2026-08-17
**Directive (Dan):** *"we tried to build it in the other track fixing gpt pro v3.3 build to the v3.3.1
state — we need to find this final build and read the code and audit it to see if it is better than
trying the v3.2 resurrection or if it can be a donor as well for parts."*
**Sources:** both Codex day-files read in full (`grid-qa` 335, `grid-builder` 561) + the build itself.
**Build:** `.codex/worktrees/s62-grid-engine-v331-repair`, branch `session62-task/s62-grid-engine-v331-repair`,
HEAD `dbf31370` *"fix: make saved cutouts certifiably selectable"*, **plus 12 modified files uncommitted**
(287 insertions / 134 deletions).
**Method:** code + transcript audit, read-only. **I did not execute this build** — no solve, no suite,
no benchmark. Every runtime number below is quoted from the two lanes, attributed, not reproduced.

---

## Answer

**Not better as a product path today — and it is the strongest donor available.**
Its central architectural decision is *right where v3.2 is wrong*, and that one part is worth taking
whatever else happens.

No state of v3.3.1 is simultaneously (a) committed, (b) canon-legal on input policy, and
(c) performance-proven. That is the blocker, and it is not a code-quality problem.

---

## 1. The headline: v3.3.1 does NOT have the defect that broke v3.2

v3.2's regression traces to one inversion — the class×band table used as an **exclusive filter**, so a
square-boxed shape can only ever be offered square-framed layouts, and the bat's ruled vertical pair is
never hypothesised. Canon states the opposite five ways (LS §4 step 3 *"capacity, never compulsory"*;
PB §5 *"does not require every node to be populated"*; R3 PD-37; R3 logic §7.3 `1 ≤ n ≤ c`).

**v3.3.1 implements the canon rule.** `reference-profile.ts:20`:

```ts
for(let x=minimumX;x<=5;x++)for(let y=minimumY;y<=5;y++)
```

Permissions carry a **minimum** axis class and admit everything from there upward — `frame ≤ capacity`,
not `frame == capacity`. Concretely, `permission('pair.vertical',['B2','B3','B4','B5'],1,2,0)` admits
the vertical pair at axis classes `(2,2)` — square-like B2. **A square-boxed T can be offered a
vertical pair.** That is precisely the bat case v3.2 forbids.

It also ranks correctly: `patternRank` is 0 for pairs, 1 for L, 2 for `square.4`, consumed at
M05 — so among mechanically tied candidates the pair is preferred over the four-corner square, rather
than the square winning by frame membership.

`patterns-permissions.ts` is 19 lines and holds no geometry policy: permission is **profile data**, not
code. There is even a negative control already written — `logic.test.mjs:263` asserts that removing
the permission removes `pair.vertical` from B2 (2,2).

**This is the single most valuable thing in the build.**

---

## 2. Architecture — genuinely cleaner than v3.2

| | v3.3.1 | v3.2 |
|---|---:|---|
| geometry-compute (src) | 2,099 | — |
| magnetic-logic (src) | 1,305 | — |
| magnetic-next (src) | 88 | — |
| **total engine** | **~3,500** | `structure.ts` 1,877 + `judgement.ts` 1,305 + `spec.ts` 636 + `grid-core.ts` 473 ≈ **4,300** |

- **Compute is genuinely neutral.** I grepped its whole source for `magnet / band / gravity / ONEMO /
  B1 / B2 / strong / marginal` — zero hits. R3 §4.1's prohibition is actually honoured. v3.2's split
  is blurrier: product vocabulary reaches into the descriptor layer.
- **Mechanics are data, not code.** M01–M10 live in the profile with descriptor ids, tolerances and
  tolerance *rules* (`Q`, `Q_TIMES_AREA`, `Q_AND_CENTROID_SQUARED`); `mechanics.ts` is 59 lines that
  only maps policy → descriptor. v3.2 hardcodes the order in the selector.
- **A fulfilment chain exists** — ManufacturingSpec creation, a verifier, and a server-side
  verification round-trip that the seven-shape gate actually exercises. **v3.2 has none of this**, and
  PB §19 / R3 §9 require it.
- Immutable hashed profiles, deterministic Compute/Logic artifact hashes.
- **Honest about its own gaps:** `productionReady:false`, `b1Guarantee:'ONLY_WHEN_LAWFUL_IN_B1'`
  (PD-36 unresolved), and six written `engineeringAssumptions` naming the 96 mm population, the
  unresolved PD-17/PD-19 values, sub-quantum policy, zero physical tolerances and the missing Batwoman
  vector. That is better provenance discipline than v3.2 shipped with.

---

## 3. Defects it SHARES with v3.2 — so neither wins on these

- **Balance is a centroid distance.** `M07_BALANCE → ANCHOR_CENTROID_BALANCE_V1`
  (`mechanics.ts:30`). Same conflict as v3.2 and the same root cause: both implement R3's descriptor
  registry, which sits *below* canon. LS §2 P8 rules balance as *flap evened on all sides
  simultaneously*; PB §11 adds *"the geometric centroid is evidence, not the placement rule."*
- **No canon-family gate.** The seven-shape acceptance test asserts only
  `status === 'OFFERED'`, `centres.length > 0`, and `verify → valid:true`
  (`authority-boundaries.test.ts:57-65`). **It never checks which family came back.** Identical blind
  spot to v3.2: "is this certified" instead of "is this the answer Dan ruled". `canon-gate.test.ts`
  exists in the tree but belongs to v3.2 and is not wired to this engine.
- **Persistence is measured on the wrong axis** — `clearanceSurplusLevelsMm:[0,4,8,12]` with
  `majorMinPersistenceLevels:2`, i.e. survival across *clearance levels*. PB §8 means across nearby
  **sizes**.

---

## 4. Defects specific to v3.3.1

- **The pattern library cannot express half the canon table.** It holds the PB §10 starting nine
  (single, both pairs, four L variants, row.3, column.3, square.4, t.top1-bottom3). **Missing:**
  the diagonal pair (pill B2, ✅ ruled), the diagonal 3-chain (pill B3, ✅ ruled *preferred*), and
  rect 48×96 four-corners-with-mid-row-skipped (duck B3, ✅ ruled). Those families are not merely
  unselected — they are **not instantiable**. Canon permits the library to grow (PB §21.4 is open),
  so this is a gap rather than a violation, but it caps what the engine can ever return.
- **`forceLargestComponentMajor: true`** — a profile switch that promotes the biggest component to
  MAJOR regardless of PB §8's five properties. That is the "substitute a tractable thing" pattern.
- **The structural graph is a 6 mm sampled cell grid** (`components.ts:87-89`) with
  `definiteLevels`/`possibleLevels` per cell from `clearance ± errorEnvelope`. It is *honest* sampling
  — uncertainty is carried, `topologyCertified` gates what may be claimed, and legality stays exact
  via `discContainedExact`, which is defensible under PB §7.3. But it is what left all seven shapes
  structurally indeterminate for most of the day, and QA rejected two successive attempts to certify
  topology from it (endpoint-count matching; Square/Miter join bounds whose required inclusions could
  not be proven).
- **No raster-input seam exists in the contract.** Saved shapes are 3,796–10,836 vertices against a
  4,096 cap. Every preparation route tried was rejected: 1 mm simplification changed governed geometry;
  the canonical `engineCopy ∩ raw` intersection failed the exact subset check (29 outside fragments);
  and the route that finally worked reuses v3.2's `engineOutline`, which Dan flagged as cross-version
  scope creep at 11:53. **That reuse is in the uncommitted diff, not in `dbf31370`.**

---

## 5. State — the practical blocker

| | committed `dbf31370` | uncommitted on top |
|---|---|---|
| Input preparation | its own RDP 1 mm + inward inflate | **v3.2 `engineOutline` reuse — Dan-flagged scope creep** |
| Topology authority | all-cells-definite gate — **QA-rejected as unsound** | persistent-inner-core — QA-accepted |
| Seven shapes | 8/8 focused, per builder | 7/7 OFFERED + bind + server-verify, **294 s total** |
| Performance | benchmark never completed | PILL cold **20.62 s → 1.473 s**; suite 84/84 |

Two things nobody has: the seven shapes have **never been re-run on the optimised code**, and the
official benchmark **has not completed once today** — interrupted twice at 5+ minutes CPU-bound.

Per-shape times before the optimisation (builder's table): Bat 26.5 s · Duck 23.5 s · Butterfly 70.3 s
· Bot 67.8 s · PILL 21.7 s · POKE1 34.0 s · POKE2 50.0 s.

The profile is unambiguous about where the cost is: certified placement, not preparation or structure
— `adaptiveFeasibleTranslations` 17,627 ms inclusive of a 19,938 ms solve; structural evidence 73 ms.
The fix that produced the 14× win was *"take at most one deterministic exact witness from certified
INSIDE boxes; inspect boundary boxes only when no INSIDE witness exists."*

---

## 6. Head-to-head on what Dan actually measures

| | v3.2 rollback | v3.3.1 |
|---|---|---|
| Canon families | **12–14 of 14 measured** (14/14 pre-T1 base, 12/14 wired) | **unmeasured** — gate only checks that *something* was offered |
| Speed, seven shapes | **35 s** (wired variant) | 294 s pre-optimisation; unknown after |
| Frame rule | **wrong** — exclusive filter | **right** — `frame ≤ capacity` |
| Fulfilment chain | absent | **present and exercised** |
| Compute neutrality | partial | **clean** |
| Input seam | works (Studio copy is its own ruled path) | **unresolved** |

On the metric that matters — *does it return the layouts Dan ruled, fast* — the v3.2 rollback has
measured evidence and v3.3.1 has none. On architecture, v3.3.1 is the better-built engine.

---

## 7. Recommendation

**Continue the v3.2 rollback as the product path.** It is measured against the canon families, it is
fast, and its remaining defect list is short and known.

**Take five things from v3.3.1 as donor parts**, in value order:

1. **The permission model** — data-driven `frame ≤ capacity` with `patternRank`. This is the exact
   fix v3.2's regression needs, already written, already carrying a negative control. Highest value
   by a distance.
2. **The adaptive-feasibility witness fix** — one exact witness from certified INSIDE boxes, boundary
   boxes only when none exists. 14× on the same class of work v3.2's continuous feasibility performs.
3. **ManufacturingSpec + verifier + server round-trip** — v3.2 has no fulfilment chain and canon
   requires one.
4. **Mechanics as profile data** (M01–M10 with tolerance rules) — makes the ranking order auditable
   and versionable instead of hardcoded.
5. **The Compute/Logic neutrality boundary** as the pattern to hold v3.2's split to.

**Do not take:** the sampled structural hierarchy, `forceLargestComponentMajor`, the centroid balance
descriptor, or the input-preparation boundary (unresolved in both directions).

**One thing worth saying plainly:** neither engine has ever been gated on the canon families. v3.3.1's
acceptance test asks whether *an* offer exists; v3.2's asked whether the answer was *certified*. That
gate is still the missing piece on both tracks, and it is cheap next to either engine.
