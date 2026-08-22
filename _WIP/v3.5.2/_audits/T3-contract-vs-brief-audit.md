# v3.5.1 three-law engine — contract-vs-brief audit and code truth at the clean head

Author: s62-kai-lead · 2026-08-22 · method: /o-audit + /o-necessity --review
Code audited: `2c043257` (clean pre-scaling head), checked out to `onemo-next/.claude/worktrees/s62-lead-clean-2c043257`, dev server on :4031, Playwright-driven observation; headless probes via vitest against the same commit (`evidence/probe-2c043257.test.ts`).
Contracts audited in full: `../../v3.5.1/_archive/v3.5.1-engine-rebuild-contract.md` (1,057 lines, original) and `../canon/v3.5.2-master-contract.md` (948 lines, R15 master), plus T1–T4 packets, sub-plan, matrix, commit audit.

## 0. Governing directive set (Dan, verbatim, still live)

1. 08-20 — "centering mode existing and working correctly - what it is missing is just 2 more equal balancing rigid rules - (1) wrap - flap managed tolerance to touching the edges and (2) magnet quantity based scaling - when scale magnet is the next step only following wrapping rule - growing to only next number that snaps and adds at least one more magnet - so each band is essentially range where you can identify every instance where minimum and maximum magnets can fit the shape in wrapped and centered state"
2. 08-20 — "clone centering and build 3rd mode that will become final correct engine mode … as separate module so we can compare and delete centering and prior voting module only when we prove it works"
3. 08-20 — "0 flap means … full tangency with the edge - magnet outer disk line coincides with shape outline edge"
4. 08-20 — modular split: compute (neutral math) / logic (laws, policies, selection) / spec (ruled values) / ui (pure shell) + bridge; "we are not deleting prior tabs and code"
5. 08-19 — "center > pick: smallest size at max count > scale is padded by flap"; "at 0 flap it was showing variants only with 0 flap and this is the law - engine in the bands cannot show by definition the variants that have flap greater"; "vertical pairs must be preferred to horizontal due to the gravity law"
6. 08-21 — "i would not want to touch center for now … all done first Wrap and magnet units tested and final par center repair if required - these all are simple tasks"; "Wrap first nothing else until we prove it is 100% as contract"; ruled B1–B4 horizon; tab label `v3.5.1`.

## 1. Deliverable checklist (atomic, in Dan's terms)

| # | Deliverable |
|---|---|
| D1 | Separate third tab/module cloned from Centre-rules; old tabs untouched; compare, delete later |
| D2 | Clean module split spec / compute / logic / engine / ui(+bridge), no leakage |
| D3 | Centre preserved as-is: 6 modes + 4 governors, rigid parity (node/gap), four placements; repair only if proven needed, last |
| D4 | Wrap: every belt disc within flap; 0 = exact tangency; fixed refuses, auto grants the smallest; no hidden tolerance |
| D5 | Magnet-quantity scaling: per band, every count N at the first size where N is centred AND wrapped; +1 per rung; no count repeats across bands; all qualifying variants listed |
| D6 | Gravity: vertical beats horizontal among otherwise-equal layouts |
| D7 | Every control true to its label; manual/free shows concessions; honesty note accurate |
| D8 | Final: admin picks the centre method per shape and compares; nothing hardcoded per method |

## 2. Contract audit — what each contract prescribes vs the brief

| Clause | Original v3.5.1 (archive) | R15 master (v3.5.2) | Verdict vs brief |
|---|---|---|---|
| §1 Centre/Wrap/Scaling as three rigid laws, no scoring | same | same | KEEP — brief §0.1 |
| §1 "Scale is solved from the contact equation, never searched on a millimetre grid" | present | present | **CUT-drift** — brief asks for "next number that snaps and adds one more magnet" (a walk). Exactness is required only at Wrap (0 = tangency): one touch-solve per rung, not a solver doctrine. This clause is the root of Support B, G1 and both collapses. |
| §6.2 "never decimated, capped or replaced by a mesh inside compute … no MAXV, sampling step" | present | present | **CUT-drift** — forbids the Centre the brief says to keep; contradicts §3/T3 freeze. |
| §7.1b "No centre comes from a mesh"; exact offset arrangements, integrals, medial-axis maxima | mandatory (T1b/T2b) | "approved code option" but text kept verbatim | **CUT** as requirement; keep as reference only. Brief §0.6: do not touch Centre. |
| §7.2 six event families / regime decomposition | mandatory | kept as §7 reference, then made mandatory again by G1 | **CUT** as requirement. Needed only if §1 "never searched" stands. |
| §7.3 cost model + §9.5/T1b phone-budget gate | present | **deleted** | With exact scaling struck, not needed. If exact scaling were ever reinstated, this gate is mandatory — its deletion while keeping the exact requirement is how B1 ran 53–86 s per band unnoticed. |
| 10A Support A (exact reals, witnesses) | T2a mandatory | conditional | KEEP (already live: Wrap) — brief §0.3 |
| 10A Support B (centre/regime) | T2b mandatory | conditional, "no second centre implementation, mesh" | CUT — and G1 violated it by legislating an exact re-implementation of the mesh. |
| §3 T1 clone → T2 re-room → T3 Wrap → Scaling → conditional Centre repair → T4 | T0/T1b/T2a-c sequence | present | KEEP — matches brief §0.2/§0.6 exactly; this is the part that worked. |
| §6.1 BANDS 1–4 | 1–4 | 1–4 | KEEP — **code still carries B5** (`spec.ts:43`, live tab shows B5 chip). Gap. |
| §6.3 six-step candidate choice incl. vertical-over-horizontal and tie sets | present | present | KEEP — brief §0.5; not yet built (see D6). |
| §7.6 manual inspection: parityTrue, centreErrorMM, concessions | present | present | KEEP — brief §0.7; not yet built. |
| §13 "Open decisions — Dan only" | present | **deleted** | Restore one line: "touch tolerance" ruling (see W1). |
| Untangle row: `bandWalk` body may never be reused for scaling | present | present | **CUT** — the walk is the brief's scaling mechanism; only its gate changes. |
| T4 worker/bridge finalisation | T3 mandatory | T4 | OPTIONAL per Dan 08-21 ("t4 may stay in some form"). |

## 3. Code audit at `2c043257` — evidence

| # | Criterion | Evidence | Verdict |
|---|---|---|---|
| D1 | Isolated third tab, old tabs untouched | `page.tsx` diff vs donor `8d17780c` = +42/−10, selector shell only; `LawPanel.tsx` 872 lines, own worker `law.worker.ts`, own namespace `magnetic-grid.compare.v1.*`; 7 donor files byte-identical (`git diff 8d17780c HEAD -- <donors>` empty; separation test "keeps all seven comparator donors byte-identical" PASS). Live: Voting \| Centre rules \| v3.5.1 selector renders; zero console/page errors across 4 interactions. | PASS |
| D2 | Module split | `spec.ts` types/constants only; `logic.ts:10` imports only `compareExactToRational` from compute; `engine.ts` no JSX, orchestration + sampled walk; separation guard 6/6 PASS at this head (27/27 overall). Sampled `bandWalk` still in engine by plan (untangle map: delete at scaling). | PASS |
| D3 | Centre preserved, all policies | Probe B: Law `computeGrid` vs legacy `computeGrid(positioning:1)` — phase, anchors, centreMainMM **equal on all 9 policies** for squircle@72 and heart@108. `centre-freeze.test` PASS. Live free squircle 72 masses/smallest: centre on the body centre, 4 magnets, 8 tangency dots (`evidence/law-free-squircle72.png`). | PASS |
| D4a | Wrap exact tangency at flap 0 | `contact-root.ts:120-207` exact rational distance per belt disc to every segment; `logic.ts:109-138` fixed/auto verdict with `compareExactToRational`; witnesses certified `identity.ts:91`. `wrap.test` 8/8 PASS (square24 lawful 4 witnesses; square24.1 refused; diamond18 auto = 18/√2−12 exact; cap refusal typed). Live: squircle 72 "Wrap lawful · requires 0.000000mm". | PASS |
| D4b | No hidden tolerance / controls true | Live diamond B1 flap 0: "Wrap refused · requires 0.300636mm · allowed 0.000000mm", no layout shown (`evidence/law-B1-diamond-box.png`) — correct rigid behaviour. | PASS |
| **W1** | Seat legality and Wrap agree at tangency | **FAIL (defect).** Seat legality uses the donor 1 µm quantum (`seat.ts:359-375` `QUANTUM=0.001`, `holds` equality); Wrap uses exact IEEE bit rationals with no quantum (`contact-root.ts:32`). They disagree by float noise: (a) Weight mode squircle 72 flap 0: centroid 49.99999999999999 → `NO_WRAPPED_LAYOUT_IN_BAND/invalid-seat`, req exact 0 — **live screenshot shows the layout refused and magnets hidden** (`evidence/law-free-squircle72-weight.png`) while Box mode at [50,50] is lawful; (b) shape-library square 25 @ pitch 24: req = −1/2^50 ≈ −8.9e-16, refused invalid-seat — Meta's "−0.000000mm". Product-visible spurious refusals at flap 0. | FAIL |
| D5 | Scaling per magnet count | **Not built.** Live tab: "Scaling not implemented · diagnostic candidate only". Existing `bandWalk` (`engine.ts:169-206`) under the exact gate, probe C: square → 1@24, 4@72, 8@120, 12@168 (correct, <1.1 s/band); diamond → no rung in any band at flap 0 (contact sizes irrational; bisection refines the *seat* transition to 0.05 mm, exact Wrap then refuses a 0.01 mm gap); squircle → 1@24, 4@72, then B3 none, **B4 none although at 168 mm count 8 is lawful** (8 was marked "seen" in B3 where it seated unwrapped — ownership by first seat, not first lawful); squircle B3/B4/B5 take 53/72/86 s. | FAIL |
| D6 | Gravity tie rule | `chooseCentrePlacement` (`logic.ts:93-106`) orders by seats > canon > excess; no orientation rule; no tie set returned. | FAIL |
| D7a | Manual/free concessions | `computeGrid` forced-phase branch (`engine.ts:92-101`) sets no `parityTrue`/`centreErrorMM`; UI shows Wrap verdict only. | PARTIAL |
| D7b | Band horizon B1–B4 | `spec.ts:43` B5 = 216–264; live tab shows B5 chip. Dan ruled B1–B4. | FAIL (1 line) |
| D7c | Honesty note | "Centre + Wrap … Scaling is not implemented yet." | PASS |
| D8 | Centre method is an admin toggle, nothing per-method | Compute measures all branches (`centre-evidence.ts:248-267`); logic selects (`logic.ts:62-73`); scaling must consume `centreMainMM` opaquely. | PASS (by design; scaling not built) |

Build/tests at this head: 6 suites / 27 tests PASS; typecheck PASS; production build PASS (Meta, independently); live route observed on :4031 from the named worktree at `2c043257`, zero errors.

## 4. What is required to finish — minimal diff from `2c043257`

| # | Change | Where | Size |
|---|---|---|---|
| S1 | **Scaling law in the walk.** For each band and count N: the rung is the first size where N seats, parity holds AND Wrap is lawful — bisect on *lawfulness*, not on seat count; a count is owned by the band where it first becomes lawful; list every count that qualifies; delete the "below" seat-based exclusion. | `engine.ts bandWalk` | ~80–150 lines |
| S2 | **One exact touch-solve per rung.** At the refined layout, for each belt disc solve the size where its distance to the binding segment equals 12 + allowance (quadratic in size; kernel `sqrtMinusRational`/`compareExactToRational` exists). Rung size = the binding root (exact + decimal); the witness is the certificate. Re-check count/parity at that size; if changed, continue the walk. | `compute/contact-root.ts` (+1 fn), `engine.ts` | ~60–100 lines |
| S3 | **Ruled touch quantum (Dan decision).** One spec constant (proposal: 0.001 mm, the donor's existing seat quantum) applied to anchor/contour coordinates before both seat legality and Wrap, so they agree. Closes W1. Contract currently forbids any quantum — that clause must go. | `spec.ts` (+1), `contact-root.ts` (~5) | ~10 lines |
| S4 | **Cost.** Float prescreen in the walk; exact Wrap only at candidate rungs (today it runs per sampled mm: 53–86 s/band on squircle). | `engine.ts bandWalk` | ~30 lines |
| S5 | **Gravity.** Among equal count + equal required flap: vertical eliminates horizontal; remaining ties returned, not collapsed. | `logic.ts` | ~15 lines |
| S6 | **Manual concessions.** Forced phase reports parityTrue/centreErrorMM + CENTRE/WRAP concessions; UI shows them. | `engine.ts`, `LawPanel.tsx` | ~30 lines |
| S7 | Drop B5 from `BANDS`. | `spec.ts` | 1 line |
| S8 | Honesty note → three laws, after S1–S2 are live and observed. | `LawPanel.tsx` | 2 lines |
| C1 | Contract: strike §1 "never searched…", §6.2 mesh/quantum ban, §7.2 as requirement, Support B, the `bandWalk` no-reuse row; add the S3 ruling; state B1–B4; keep §7 as reference. | master | text |

Not required: Support B / G1 / exact Centre sites (brief §0.6), T4 worker/bridge ownership migration (Dan: may stay), any Centre repair (probe B shows Centre equal to the accepted tab on all policies).

## 5. Verdicts

**Contract (R15 master) vs brief — necessity: shrink:** §1 "never searched" clause · §6.2 mesh/quantum ban · §7.1b/§7.2 as mandatory mechanisms · Support B · untangle row forbidding `bandWalk` reuse · G1 block. **Sufficiency: partial:** no touch-tolerance ruling (W1 has no owner) · B1–B4 horizon not reflected in code · §7.6 manual concessions and §6.3 gravity/tie rule present in text but unbuilt; otherwise the brief's deliverables are all named.

**Code at `2c043257` vs brief — necessity: no unnecessary elements** (sampled walk retained by plan until scaling lands). **Sufficiency: partial:** D5 scaling unbuilt · D6 gravity unbuilt · W1 spurious flap-0 refusals (Weight mode; pitch 24) · B5 present · manual concessions missing.

**Rollback point stands:** `2c043257` — T1, T2, Wrap proven live; S1–S8 above are the whole remaining build; S3 needs Dan's one-line ruling. Proposal: `../_proposals/v3.5.2-1 simplify and complete proposal/s62-kai-lead-simplify-and-complete-proposal.md`.

Evidence: probes `evidence/probe-2c043257.test.ts` (vitest against a checkout of `2c043257`, results inline); live screenshots captured 2026-08-22 on :4031 from that checkout — regenerate with `evidence/shot-law-tab.mjs`.
