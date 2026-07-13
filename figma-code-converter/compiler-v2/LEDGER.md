# Compiler v2 — Phase Ledger & Gap Register (shared collective state)

> Governing contract: `../C11-CONTRACT-V3.md` sha256 fd8b6c9258c1701bdf265072eb8e50d099359e3c677e34214d7ac936afbc540a
> Builder baseline: commit `f37de9e` (nine legacy truth-fixes + contracts). Legacy lane stays operational (§0.1).
> Run mode (Dan, 2026-07-13, live directive): continuous end-to-end build; phases are FROZEN
> EVIDENCE POINTS reviewed asynchronously by @s58-pixel-3 (QA) and @s58-pixel-meta-qa (Meta);
> REWORK findings enter the rework loop without idling the build; Dan judges the final product,
> Done, and cutover. Evidence discipline (self-review, mutations, honest failures) is NOT waived.

## Governance waiver (narrow, exact)

Dan's newer directive supersedes the per-phase Dan-wait sentence ONLY: this run does not pause
for Dan between phases. NOT waived: frozen phase evidence, Pixel QA handoffs, Meta conformance
review, fail-closed gaps, final Dan sign-off, Done ownership, cutover authorization.

**Current test truth:** 46 pass / 3 failures (missing gitignored golden fixture
`t88thL8hKksSpILgkeGRZ0-4084-25997.nodes.json`) / 0 skips. No phase may be recorded green from
harness-only or REST_ONLY placeholders.

**Gap blocking map:** G-1 (corpus fixtures) blocks P0 exit + P7 gates G0–G13 full-corpus runs.
G-2 (plugin supplement capability) blocks P1 G0 supplement proof and every G1–G5 clearance of
component/mixed-text/mode-override domains. G-3 (dark reference) blocks dark-state G11 promotion
only.

## Ownership
Builder/orchestrator/ledger: Kai (s58). QA structural/gate proof: @s58-pixel-3.
Product/editor/agnosticity challenge: @s58-pixel-meta-qa. Decisions/Done/cutover: Dan only.

## Phase ledger

| Phase | State | Frozen evidence | Notes |
|---|---|---|---|
| P0 continuity/contract/calibration | IN PROGRESS | — | see P0 section |
| P1 evidence capture | pending | — | |
| P2 canonical graphs | pending | — | |
| P3 mother token/component slice | pending | — | |
| P4 mother layout/render slice | pending | — | |
| P5 emitters/security/editability | pending | — | |
| P6 runtime/visual/editor proof | pending | — | |
| P7 corpus & scale | pending | — | |
| P8 studio dual-run | pending | — | |
| P9 cutover | pending | — | Dan-only |

## P0 work items

1. **Baselines separated**: clean broken baseline = `6c36475` (E1–E13 reproduce there);
   operating delta = `f37de9e` (nine truth-fixes reproduce). Replay proof: run legacy convert
   at 6c36475 offline against the pinned Shape cache and assert E1/E7/E9 markers. [pending]
2. **Mother screen pinned**: `Qdb9Kx98afJHxaCGAIxoMC` node `6075:53685` ("Shape") — Dan's
   directive "code and on our screen the result" selects it; version pinned at capture time
   into the P0 manifest. Dark-mode authored reference does not exist → dark state is
   `reference:null` → DIAGNOSTIC_ONLY per §4.5 (honest, logged). [pending]
3. **Hermetic fixtures**: sanitized Shape microfixture set + replacement for the missing
   legacy golden (t88thL8h…) so `npm test` has zero missing-fixture failures. [pending]
4. **fidelity-budgets.json**: synchronized Figma/build pairs at one file version; repeat-run
   noise measured; per-class thresholds published with sample sizes + exclusions. [pending]
5. **Capture operability envelope**: measured wall time/bytes/requests for REST nodes,
   variables payload, svg exports on Shape (local file). Remote-heavy corpus: GAP-1. [pending]
6. **Editor round-trip corpus pinned**: slot-preserving padding/radii edit, token-expression
   segment edit, fragment ownership — spec'd against the react-figma engine contract. [pending]
7. **Registry transaction protocol**: §6.1.1 verbatim; lane-scoped generations
   (v2 sandbox namespace only until P9). [no code until P3]

## Gap register (stop-and-collaborate log, Dan's gap protocol)

| # | Gap | Status | Owner/next |
|---|---|---|---|
| G-1 | §14.2 integration corpus needs Figma files that do not exist (editorial, component-library, enterprise, non-ONEMO) | OPEN — corpus harness will be built; fixtures owed; flagged to QA+Meta 2026-07-13 | Kai builds harness; fixture authoring needs Dan/design time |
| G-2 | Live plugin supplement (resolvedVariableModes, styledTextSegments, component defs) may need a plugin rescan Dan-side; Shape's REST evidence provably contains no overrides/mixed-text/instances, so the manifest can prove completeness for Shape without it | OPEN — supplement plane built with honest source-plane marker; live-plugin path needs bridge rescan | Kai; escalate if a non-Shape fixture needs it |
| G-3 | Dark-mode visual promotion impossible without an authored dark reference (§4.5) | OPEN — dark states DIAGNOSTIC_ONLY until Dan authors a dark-mode reference frame | Dan (when he wants dark visually promoted) |

## P0 findings

- **F-P0.1 (2026-07-13): live-screen replay cannot reproduce the E-rows.** Baseline (6c36475)
  convert against TODAY's Shape cache emits clean (119 elements, no baked hex, no invert, no
  rotate) — Dan's Figma-side fixes removed the defect-triggering patterns (single root fill now
  index-aligns by accident; rail rebuilt at 0°). The broken-era input was overwritten by
  refreshes. RESOLUTION: E1–E13 reproduce on the clean baseline via **hermetic microfixtures**
  crafted per E-row (multi-fill root, bound stops, bound effects, bound opacity, per-side
  weights, rotated asymmetric container, mirror matrix, fixed-box text). This merges P0.1 into
  P0.3 and is consistent with Meta's corpus ruling below.

## Meta rulings accepted (2026-07-13)

- **Corpus:** "harness + fixtures owed" is NOT a P0/P7 exit. Missing required fixture = named
  phase failure. P0 stays incomplete until the §14 fixture set exists. Builder route: integration
  fixtures that don't require live-authored Figma content are constructed as **valid synthetic
  REST-schema snapshot fixtures** (non-ONEMO names, component-set page, GRID/mask page, rich-text
  page, enterprise-scale generator); the real ONEMO mother = Shape, pinned live. Live-capture
  (G0) proof runs against the real file; compile-path fixtures run from snapshot directories.
- **Supplement:** `sourcePlane: REST_ONLY` is fail-closed for any fact requiring
  resolvedVariableModes / styledTextSegments / component definitions / overrides /
  plugin-resolved remote variables. The marker grants NO capability; those capability rows stay
  unclear until supplement-backed fixtures prove them. Accepted — no escape hatch.
- **Routing:** adversarial QA = @s58-pixel; Meta = @s58-pixel-meta-qa.
- **§17.0 governance:** Dan's verbatim directive — "execute the v3 contract end 2 end no
  stopping no phase by phase - entire thing … pass to pixel and meta-qa for the final review" —
  is recorded here as the explicit resolution: continuous build, async QA/Meta review at frozen
  evidence, Dan judges the final product. Dan can veto this reading in-session at any time.

## Decisions log

- 2026-07-13 Dan: full end-to-end execution authorized; per-phase Dan pause superseded for this
  run; final review by pixel + meta-qa; /o-deslop mandatory post-build; gaps = stop + collaborate.
- 2026-07-13 Kai (process synthesis, relayed to both lanes): phases = frozen evidence points with
  async QA/Meta review; no build idle; evidence discipline intact.

## Reviewer verdicts & checkpoints (append-only)

- 2026-07-13 Meta: gap ruling accepted (corpus = phase failure not debt; REST_ONLY grants no
  capability; §17.0 narrow waiver recorded). Formal QA not started; Pixel designing gap route.
