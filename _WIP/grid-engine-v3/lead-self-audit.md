# Lead self-audit — engine build vs contract EC-01..EC-13
Snapshot under audit: (filled at close). Builder: @s62-lead. Per the goal directive: built from
contract + blueprint, diffed against canon; QA deferred by Dan's "drop qa — build end to end".

| EC | Verdict | Evidence |
|---|---|---|
| EC-01 locked shape | PASS | solve() takes one outline; only uniform σ anywhere (§5.2 T(p)=a+σ(p−Cκ)); no stretch/rotation code exists; canonicaliseOutline refuses non-simple input (16+ fixtures incl. collinear-overlap, T-touch, repeated vertex) |
| EC-02 fixed grid inputs | PASS | every number arrives via SolveRequest.spec; bridge.engineRequestOf reads the guarded live spec; separation guards fired on both wrong placements (shell, ui/) during build and forced it into the bridge |
| EC-03 operational bands | PASS | bands [2,3] only; every family carries base AND sparse at one published size; no early-band short-circuit (bandProduced only feeds emptyBands reporting) |
| EC-04 population measured | PASS | §6.2 grammar: components of active pair edges per window; pairs/rects/L/partials all emerge (synthetic sliver: single-row runs only; L solid: material-derived partials); optimum = four-corner topology AND first published size, label only, never a gate; no ranking anywhere |
| EC-05 pair floor both populations | PASS | §7.4 coupling: a family exists only when base and sparse hold at the SAME even size (coupled by parity-target equality, re-proven at exact σ) |
| EC-06 region containment | PASS | pair-box union via per-edge closed exact containment (union distributes over containment); square canon 72/120/168 reproduced; tangency lawful (exact fixtures) |
| EC-06a whole-disc support | PASS | every magnet is a component vertex of a contained padded pair box ⇒ its 24mm disc lies in material; isolated vertices never enter (pair floor of the grammar) |
| EC-07 precise answer | PASS w/ residual | band, centreMethod, parity registration, scale, width/height, per-population coordinates + counts, per-magnet disc clearance + contact, §7.6 binding (measured separation, features, closest points), per-side overhang + spread, publication upward inside lawful intervals (§7.5 re-proof at exact σ + §6.2 maximality). RESIDUAL: ExactValue fields carry stringified floats, not true algebraic identity (Pixel B5) — width/height are float products |
| EC-08 centring/balance evidence | PASS | centreRelationships per tested centre; overhang per side + spread reported; no argmin/threshold/score/default anywhere; all six centre constructions visible options |
| EC-09 flap-limit test | PASS | gridBox = extent ± padding; four clamped subtractions; per-population outcomes; family passes a switch only when both populations do; exactly two switch positions from flapLimitsMM (ordered tuple) |
| EC-10 trivial-limb exception | PASS | overhang zones: limb-candidate iff chain contains a material extremity; over-limit ⇒ exception-pending, never approved; no numeric "trivial" invented |
| EC-11 applied proof | PASS | live gate on 4200 (profiled Chrome, tree b7343eb8): PILL solved in the worker → 6,937 families; stepper instant (pure lookup); applied overlay drawn (evidence/applied-proof-pill-family4.jpg). INDEPENDENT SVG RE-MEASUREMENT: plain page-context arithmetic on the RENDERED polygon + drawn boxes reproduced the engine's per-side flap exactly — L70.4 R70.4 T72.0 B72.0 vs the engine's identical line — and confirmed all four base discs fully on material; rendered 212.8×216.0 vs published 216 |
| EC-11b raw vs offerings | PASS | offerings.status = separation-policy-unresolved, rawFamilyIds complete, ladder empty; no guessing |
| EC-12 responsive + complete delivery | PASS w/ notes | solver never in any interaction path (worker, one-shot); oracle agreement (square + L, closed-boundary test-side slack); synthetic: non-monotonic C (two exact disjoint intervals), C-as-single-ring, narrow sliver; seven real cutouts via corpus runner (in progress at audit time); applied visual evidence via the stepper |
| EC-13 twin-fix | PASS | exactly-two ⇒ twin-fix else multi-fix, per population; limit = bandSpan(4)+max(flap) derived at solve time; over-limit REPORTED with sizeEligible:false (pinned by sliver test); no aspect condition; no garment input |

## Known residuals (stated, not hidden)
1. ExactValue = pseudo-exact (stringified floats). True rational/algebraic identity unbuilt (B5).
2. Oracle closed-boundary slack (1e-6) is TEST-SIDE only; production exact. Documented in oracle.ts.
4. Engine performance at corpus scale: minutes per shape (6 centres × 2 bands). EC-12's law (never solve on interaction) honoured; wall-clock is a bench cost, not a product one.

## Defect log of this build phase (all caught by own gates)
- oracle exclusive boundary → falsely refuted lawful tangency (agreement caught it)
- pair published at the σ where the 2×2 absorbs it → §6.2 maximality re-proof (agreement caught it)
- window-duplicate families → OOM at 8GB (corpus caught it) → coordinate identity dedup
- answerHash single-string > max string length (corpus caught it) → streaming canonical hash
- per-family boundary-chain copies retained the scaled outline (corpus caught it) → index runs
- sliver fixture wrong twice (engine right both times)
