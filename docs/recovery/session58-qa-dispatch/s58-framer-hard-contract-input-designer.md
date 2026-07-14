# Hard Contract v0 — Designer/Meta reconciliation input

**Author:** @s58-designer (Kai-Claude) · 2026-07-10
**Reconciled against:** `s58-framer-component-authoring-HARD-CONTRACT-v0.md` (453/453) · `s58-framer-source-architecture-codex.md` (636/636, SHA verified vs contract §0) · `s58-framer-source-architecture-qa-verdict.md` (90/90, PASS) · QA adversarial §10–13 · my acceptance layer (`s58-team-contract-design-acceptance-designer.md`) + extraction ledger.
**Scope:** Meta reconciliation only — no product code, no blueprint edits, no sign-ready claim. Dan signs; no actor closes its own gate.

---

## 1 · Meta verdict on the architecture (the lead's question)

**PASS from the design/acceptance-satisfiability lens.** Every acceptance criterion I own (V1–V10, S1–S9) has a concrete home in the architecture, and the graph model provides the identity hooks my measurements need:

- **"Update Primary" is visually testable** — `VariantFrame.inheritance{linked, overridePropertyIds}` + the §6.1.1 lifecycle (resolve bindings → compile into primary source → reparse → remove propagated memberships) gives an exact probe: override a property on a linked variant, run Update Primary, assert the primary's rendered style changed + the source byte-diff + membership removal. Same shape works for Detach/Reset Overrides. Without `SourcePropertyRef` this criterion was unmeasurable; with it, it's a fixture.
- **Wire/overlay measurements survive** — `InteractionEdge` (stable ID, source/target variant IDs) + sidecar-owned `VariantFrame.frame` geometry means wire endpoints are derivable and assertable against frame rects (S6), and stable edge IDs make add/remove/undo round-trips measurable (my old NodeLayer had no edge identity — that gap is closed).
- **Preview honesty is enforceable** — separate `PreviewSurface` + CompilerAdapter round-trip proof means my S7 criterion (preview renders the ACTUAL compiled component, fingerprint-matched to disk output) is satisfiable by construction, not by convention. Back-restore is covered by the persistent one-canvas edit context (§2 Build).
- **The G1/G2 boundary is right for my gates** — G1 ships no UI, so my only G1 Meta checks are negative/structural (no authoring UI surfaced; geometry-only sidecar moves — consistent with "geometry is editor metadata"). All visual/behavior measurement starts at G2. No conflict.
- **Selection-scoped overlay, delete guard both layers, free-variant lifecycle, alias renames** — all directly supported (invariants 1–5, 11; commands catalog).

**Formal alignment note:** QA §11 correctly rejected the "keep the whole engine" framing that my earlier gap report shared with the expert's blueprint. The architecture's keep/modify/replace audit is source-backed and stronger — my lane accepts the supersession. My E11-era artifacts (NodeLayer audits, corridor routing) are history with **no forward claim**; see conflict C2 for the one place this must be said explicitly.

## 2 · Mapping — acceptance layer → contract gates

### V1–V10 (visual invariants) → contract §7 + G2/G5
All ten are present in §7 "Visual invariants" (verified line-by-line: zero-Framer-tokens, one-accent, Phosphor-only, DS Option B, chips, ghost pills, solid/dashed selection grammar, wire stroke/geometry, DS type/spacing, semantic parity). Gate placement: **G2** measures the subset it ships (selection, ghosts, breadcrumb — per G2's own AC); **G5** runs the full V1–V10 sweep. The named tests (grep/computed-style sweep = 0 hits, icon inventory, token hash) live in my acceptance doc, which §0 binds — no duplication needed.

### S1–S9 (measured semantics) → contract §7 + phase gates
| Mine | Contract §7 row | Gate |
|---|---|---|
| S1 selection ladder | "Selection ladder…" | G2 |
| S2 overlay iff variant selected | "Overlay visibility…" | G2 (re-probed with wires at G3) |
| S3 inspector structure | "Inspector structure…" | G2 (variant) / G4 (instance section) |
| S4 interaction row + popover params | "Interaction row anatomy…" | G3 |
| S5 context menus + guards | "Context menus…" | G2 (create) / G4 (component+instance) |
| S6 wire geometry | "Wire geometry measured…" | G3 |
| S7 preview honesty + Back-restore | "Preview runs actual compiled…" | G3 |
| S8 variant lifecycle | "Variant lifecycle…" | G2 |
| S9 delete guard UI+engine | "Delete guard…" | G4 |

**S3 amendment (evidence moved):** my original S3 pinned "Transition FIRST: ⚡ Spring." QA's authenticated pass proved the Transition property exposes **Instant · Ease · Spring-Time · Spring-Physics** (contract §6, TransitionSpec). My inspector measurement updates to the 4-kind vocabulary; spring-form ambiguity (old U5) is **resolved** — both parameterizations are real and the model carries both.

### U1–U8 (uncertainties) → contract §6 unverified + G0
| Mine | Contract disposition | Status |
|---|---|---|
| U1 New Event vocab | Excluded from v1 (invariant 12) | ✓ resolved-by-deferral (stronger than my hand-check) |
| U2 ▶ badge matrix | §6 unverified "exact badge matrix" | ⚠ M1 below — not named in G0's gate list |
| U3 connector drag-pickup | G0 required before G2/G3 if handle path built | ✓ |
| U4 Hover/Pressed creation + auto-wire | G0 required before G2/G3 | ✓ |
| U5 spring parametrization | TransitionSpec both forms | ✓ resolved by QA evidence |
| U6 straight-wire overlap policy | absent | ⚠ M4 below |
| U7 resize-handle count | QA testids: 8 handles + rotate | ✓ resolved, dropped |
| U8 drag-insert | G0 before G4 + Dan decision #2 | ✓ |

### Geometry/screenshot/a11y evidence + Meta bar → contract §7 "Meta evidence required"
All seven of my evidence rules are present (execution-backed probes only, screenshot+zoom archived, UI→write→re-read→byte-diff, both-states probing, auditable QA, two-repo cleanliness incl. untracked, U-items closed before phase). ✓ No loss in translation.

## 3 · Conflicts (each with disposition)

- **C1 — "Keep the engine" (my gap report + expert blueprint) vs architecture replace-the-authoring-model.** Resolved in the architecture's favor; my lane concedes formally (§1 above). No live conflict.
- **C2 — Zero-crossing wire criterion (my E11 closure ledger) vs straight-wire law.** My E11-era acceptance measured corridor routing "zero crossings vs all 9 frame rects." Under the observed straight-wire contract, **crossings are permitted** — the G3 measurement is *straightness + endpoints-on-edges + arrowhead-at-target + selection-scoping*, NOT crossing avoidance. Flagging explicitly so nobody resurrects orthogonal routing to satisfy a dead ledger. (My U6 stays open only as an observation item: whether Framer mitigates overlap in adverse layouts — product-decision fodder, not a build blocker.)
- **C3 — My P0 "kill bugs first" vs contract dropping P0.** My gap report ordered crash/latency/insert fixes first; QA §11 and the phase law correctly subordinate that (no throwaway-board stabilization; G1 Foundation first). I align. **Residual for Dan's awareness:** the current editor's crash-on-select stays live until the G2 canvas replaces the board — acceptable since build is blocked anyway, but it should be a conscious accept, not an accident.
- **C4 — Latency targets.** My layer had the blueprint's `<1s`; QA §12.7 proposes measured p95 budgets (warm ≤500ms, cold ≤2s, preview ≤1s, 20 warm runs); contract §14.5 leaves budgets to Dan. Disposition: adopt QA's protocol *as the measurement method* now; numbers stay Dan's decision #5.

## 4 · Missing clauses (recommend folding before Dan signs — none block my verdict)

- **M1 — Badge matrix absent from G0's named gates.** §6 lists it unverified, but G0 only names Hover/Pressed + drag items. G3's "play badge tracks effective interaction" AC will cite badge behavior — add "badge matrix ({selected} × {has-interaction})" to G0-required-before-G3, or mark it explicit PRODUCT DECISION (we define our own badge rule). My evidence: badge seen on a zero-interaction variant while selected — the confirmed-minimum wording "in the tested state" is honest but thin to build a visual rule on.
- **M2 — Ease curve names.** QA verdict names `easing: string` UNVERIFIED (raw value preserved, compiler validation blocked). Same treatment as M1: add to G0-before-G3 as an extraction item (open the Ease editor, record the curve vocabulary), else Ease authoring UI has no defined option set.
- **M3 — Accessibility floor is G5-only.** My layer required the a11y floor (accessible names on icon-only controls, visible focus, Escape dismissal) **per shipped surface per phase**. Retrofitting a11y at G5 over three phases of shipped UI is the expensive order. Recommend one line in G2–G4: "a11y floor applies to every surface this phase ships."
- **M4 — One-line wire-supersession note in G3.** Record that straight-wire law supersedes all prior E11 routing acceptance (C2) so the contract itself, not tribal memory, kills the old criterion.

## 5 · What I need as Meta before Dan review (unchanged, now gate-mapped)

Per phase: execution-backed probes (geometry/computed-style/DOM in every relevant state), screenshot+zoom pairs archived, UI→engine→re-read→byte-diff round-trip per authoring surface, auditable QA ledger, two-repo cleanliness incl. untracked, and that phase's G0/U-items closed **before** its AC freeze. G1 specifically: my check is structural-negative (no authoring UI, sidecar-only geometry, no semantic variant commands) — matching the QA verdict's H3 condition.

---
**Bottom line for the lead:** architecture supports every designer acceptance criterion — Meta reconciliation **clears from my lane** with M1–M4 as recommended folds and C2/C3 as explicit supersessions. Not sign-ready language: that's Dan's gate, and decisions #1–#5 in §14 are still his.

---

# ADDENDUM (QA-requested format) — explicit verdicts, P→G mapping, expert-input cross-check

*Added 2026-07-10 after reading `s58-framer-hard-contract-input-expert.md` (129/129 — the expert's G0 live-closure pass).*

## A1 · Explicit verdicts vs the PASSED architecture

- **V1–V10: PASS** — all ten representable and measurable under the architecture; no invariant depends on anything the graph/projection model can't provide. (V7 solid/dashed selection grammar and V8 wire rendering are pure UI on top of stable IDs + sidecar geometry — supported.)
- **S1–S9: PASS with one amendment** — S3 updated to the 4-kind Transition vocabulary (Instant · Ease · Spring-Time · Spring-Physics; old U5 resolved). S4/S6/S7/S9 are *strengthened* by the architecture (stable edge IDs, geometry ownership, round-trip proof, dual-layer delete guard).
- **P0–P6 (my per-phase acceptance): SUPERSEDED by G0–G5 — mapping below; no acceptance content lost.**

## A2 · P0–P6 → G0–G5 mapping

| My phase (acceptance layer) | Contract gate | Notes |
|---|---|---|
| P0 bug triage (crash/latency/insert) | **dropped** | No G equivalent — old board retires instead of stabilizing (C3: crash-on-select stays live until G2; Dan's conscious accept). My P0 latency-measurement protocol survives as the G2 entry-latency probe. |
| — (no P equivalent) | **G0** | Evidence closure — absorbs my U-items + expert's manual-pass list. |
| — (no P equivalent) | **G1** | Foundation, no UI — my Meta check is structural-negative only (no authoring UI, sidecar-only geometry, no semantic variant commands). |
| P1 infinite canvas + edit-in-place + breadcrumb + inspector | **G2** | Screenshot pair, breadcrumb-in-top-bar geometry, zoom/pan persistence, S1/S2 probes. |
| P2 free variants | **G2** | S8 lifecycle probes; no-fixed-state-list DOM assert. |
| P3 connectors | **G3** | S4 vocabulary probe (exactly five), S6 straight-wire geometry, S2 re-probe with wires. |
| P4 play/preview | **G3** | Contract merges preview into G3 — fine; S7 probes unchanged. |
| P5 assets/folders/instances/insert | **G4** | S5(component/instance menus) + S9 both-layer delete guard, Replace scopes on ≥2 instances. |
| P6 visual parity | **G5** | Full V1–V10 sweep + token/icon/parity reports; ONEMO skin still applies per-slice during G2–G4 (contract §7 holds throughout, G5 is the sweep). |

## A3 · Stale U-items — resolved against expert G0 results

| Item | Status now |
|---|---|
| U1 New Event | Deferred from v1 (contract inv. 12) — CLOSED for v1 |
| **U2 ▶ badge** | **RESOLVED by expert G0 pass**: badge tracks an *effective* interaction (gone on reset, back on undo — OBSERVED); my zero-interaction sighting explained as a transient selected state. M1 downgrades to a single confirm in the manual pass — no longer a recommended fold. |
| U3 drag-pickup | **CLOSED by expert 2nd G0 pass** (2026-07-11 contract correction): canvas-handle drag creates the interaction + opens the trigger/Delay popover — OBSERVED |
| U4 Hover/Pressed creation + auto-wire | **CLOSED by expert 2nd G0 pass**: named state frame + **implicit straight state wire — NOT an explicit Set Variant edge**. Meta consequence: my S6 wire probes must distinguish explicit interaction wires (edge-ID-backed) from implicit state wires (no edge entity) — two overlay populations, both selection-scoped |
| U5 spring forms | RESOLVED (4-kind TransitionSpec) — replaced by **M2: Ease curve-name vocabulary still UNVERIFIED** (QA constraint; add to G0-before-G3) |
| U6 wire overlap policy | Downgraded to product-decision observation (C2: crossings permitted under straight-wire law) |
| U7 handle count | RESOLVED (8 + rotate, QA testids) |
| U8 drag-insert | OPEN → G0 + Dan §14.2/#2; **note the expert's stronger finding: even menu-Insert produced no instance under harness — my earlier "menu-insert confirmed" covered the menu item's existence only, not end-to-end. Aligned: BOTH insert paths are unverified end-to-end → G4 blocker.** |

## A4 · New conflict found in the expert's input (flag for QA/lead)

**C5 — Expert §E "G1" fidelity row breaches the contract's G1 boundary.** The expert's acceptance table asserts for G1: "variant override → Update Primary propagates; compiler emits flat variant-IDs + alias map; type-aware round-trip." Those are **semantic variant/compiler behaviors — G2 territory** under the contract's phase law ("G1 may not persist semantic create/rename/duplicate/delete variant commands") and the QA verdict's H3 condition ("provided implementation follows the G1/G2 boundary exactly"). The assertions themselves are right — they're at the wrong gate. Fix: move the expert's G1 row content to G2. If left as-is, the assembled package carries an internal contradiction on the exact boundary QA conditioned its PASS on.

> **⟡ RESOLVED (2026-07-11 self-review):** C5 is corrected in the current contract — status line records "EXPERT C5 CORRECTED"; semantic variant/compiler acceptance moved from G1 to G2 (contract §0.5, §13). Closed.

Everything else in the expert's input converges with mine (trigger vocab, straight wires, override-membership-not-values, no line/col identity, badge rule now closed, @fc-* seeding, no auto-flatten).

## A5 · Remaining Dan blockers (consolidated — refreshed 2026-07-11 vs corrected contract)

1. §14.1 — manual G0 pass now covers **ONE item only: asset-to-canvas insert end-to-end** (menu + drag; the harness cannot fire panel-to-iframe HTML5 DnD). Hover/Pressed creation and drag-pickup are closed by the expert's second pass. Alternative: spec insert as an explicit PRODUCT DECISION.
2. §14.2 — drag-insert parity vs product choice (expert leans menu-primary; my acceptance layer works either way — G4 ACs adjust to the decision).
3. §14.3 — whether any later Builder run may expand beyond G1-Foundation before G1 is fully QA/Meta/Dan accepted.
4. §14.4 — legacy multi-axis conversion UX surface.
5. §14.5 — performance budgets (adopt QA's p95 protocol as method; numbers Dan's).
6. Explicit build-start authorization (current contract: package assembly/verification approved; G1 build start NOT yet authorized).
7. C3 conscious accept: crash-on-select remains in the current editor until G2 replaces the board.

## A6 · Self-review vs corrected contract (2026-07-11, lead-requested)

- Re-read the corrected contract in full-diff areas (status, §0, §6, §11-G0, §13, §14). **My doc carried no reference to the old overclaimed status language** (it never quoted the status line; all "no sign-ready claim" framing remains accurate against the corrected text).
- Stale rows in my own addendum found and fixed above: U3/U4 (now closed — with the implicit-state-wire semantic folded into my S6 measurement note), C5 (resolved), A5 blocker list (refreshed to insert-only + corrected §14.3 wording).
- M-fold status vs corrected contract: **M1** soft-covered (badge rule now OBSERVED; matrix beyond it remains in §6 unverified — acceptable). **M2 (Ease curve-name vocabulary) is still absent from the contract's unverified list** — QA's own verdict flags `easing: string` UNVERIFIED; keep M2 in the package as the one live extraction gap before G3 Ease authoring UI. **M3** (per-phase a11y) and **M4** (straight-wire supersession note in G3) not folded into contract text — travel as recommended-not-blocking per lead. No change to my PASS.
- Artifact-trail hygiene: `blueprint-review-designer` + `gap-report-designer` archived as superseded — **confirmed correct** (the review targeted the now-dead blueprint; the gap report is fully absorbed by the acceptance layer + contract §7). Live set: acceptance layer (contract-bound §0), this Meta input, extraction ledger (evidence). E11.2 audit ledger stays as history only (its zero-crossing criterion is explicitly dead per C2).
