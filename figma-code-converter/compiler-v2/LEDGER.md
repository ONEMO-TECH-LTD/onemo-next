# Compiler v2 — Phase Ledger & Gap Register (shared collective state)

> Governing contract: `../C11-CONTRACT-V3.md` sha256 fd8b6c9258c1701bdf265072eb8e50d099359e3c677e34214d7ac936afbc540a
> Builder baseline: commit `f37de9e` (nine legacy truth-fixes + contracts). Legacy lane stays operational (§0.1).
> Run mode (Dan, 2026-07-13, live directive): continuous end-to-end build; phases are FROZEN
> EVIDENCE POINTS reviewed asynchronously by @s58-pixel (QA) and @s58-pixel-meta-qa (Meta);
> REWORK findings stop ALL dependent downstream work until cleared; only demonstrably
> orthogonal work continues during a rework. Dan judges the final product, Done, and cutover.
> Evidence discipline (self-review, mutations, honest failures) is NOT waived.

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
Builder/orchestrator/ledger: Kai (s58). QA structural/gate proof: @s58-pixel.
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

1. **Baselines separated**: clean broken baseline = `6c36475`; operating delta = `f37de9e`.
   E1–E13 reproduction method = hermetic per-E-row microfixtures run against the baseline
   converter (per finding F-P0.1 — the live-cache replay instruction is WITHDRAWN as
   impossible). [pending — fixture build]
2. **Mother screen selection**: OPEN — §14.2 lists "current Shape screen" AND a separate "one
   real current ONEMO mother screen, selected and version-pinned with Dan at P0; Shape or a
   synthetic fixture cannot substitute for it". Shape stays its own integration fixture and
   Dan's demo target ("code and on our screen the result"); the §14.2 mother needs DAN's
   explicit selection → gap G-4. Dark-mode authored reference does not exist → dark states are
   `reference:null` → DIAGNOSTIC_ONLY per §4.5 (honest, logged). [BLOCKED on G-4]
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
| G-1 | §14.2 integration corpus requires PLUGIN-ORIGIN sanitized evidence packages from live Figma roots (joint route). Synthetic JSON is legal for §14.1 microfixtures/mutations/parser-lowerer tests ONLY — earlier "harness + fixtures owed" and "synthetic integration" statements are WITHDRAWN | OPEN — BLOCKS P0 exit + P7. Needs Dan input #2 (provider + consumer files) | Dan input; Kai builds capture/sanitize tooling |
| G-2 | Plugin supplement capture (resolvedVariableModes, styledTextSegments, component defs) is a REQUIRED capture plane; REST_ONLY/PARTIAL provenance is diagnostic-only and cannot pass G0 or clear supplement-dependent G1–G5 (joint route — earlier "Shape completeness without supplement" claim narrowed accordingly) | OPEN — BLOCKS P1 G0; needs Dan input #3 (bridge rescan at pinned versions) when capture lands | Kai builds; Dan rescan |
| G-3 | Dark-mode visual promotion impossible without an authored dark reference (§4.5) | OPEN — dark states DIAGNOSTIC_ONLY until Dan authors a dark-mode reference frame | Dan (when he wants dark visually promoted) |
| G-4 | §14.2 mother screen must be selected + version-pinned BY DAN; Shape cannot substitute | OPEN — blocks P0 item 2 and the P3/P4 mother-slice anchor | Dan (question surfaced in-session 2026-07-13) |
| G-5 | REST_ONLY/source-plane fail-closed law is UNBUILT at a0616a8 (schema only requires sourcePlanes to exist) — Kai's earlier "encoded as data" claim was an overclaim, corrected | OPEN — per-fact provenance validator owed in P1/P2. Failure taxonomy (joint route + Meta correction): missing/partial/REST_ONLY REQUIRED supplement → **FAILED_CAPTURE before graphs**; unreadable complete component definition → FAILED_COMPONENT; fully plugin-captured but unsupported → FAILED_CAPABILITY | Kai |

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
  phase failure. P0 stays incomplete until the §14 fixture set exists. ~~Builder's synthetic
  integration-fixture route and "mother = Shape" reading~~ **SUPERSEDED 2026-07-13 by the joint
  route below**: synthetic = §14.1 microfixtures only; §14.2 integration evidence must be
  plugin-origin from live roots; the mother is a distinct Dan-selected screen (G-4).
- **Supplement:** `sourcePlane: REST_ONLY` is fail-closed for any fact requiring
  resolvedVariableModes / styledTextSegments / component definitions / overrides /
  plugin-resolved remote variables. The marker grants NO capability; those capability rows stay
  unclear until supplement-backed fixtures prove them. Accepted — no escape hatch.
- **Routing:** adversarial QA = @s58-pixel; Meta = @s58-pixel-meta-qa.
- **§17.0 governance:** Dan's verbatim directive — "execute the v3 contract end 2 end no
  stopping no phase by phase - entire thing … pass to pixel and meta-qa for the final review" —
  is recorded here as the explicit resolution: continuous build, async QA/Meta review at frozen
  evidence, Dan judges the final product. Dan can veto this reading in-session at any time.

## Joint Meta+Pixel gap route (2026-07-13, accepted verbatim — governs G-1/G-2/G-4/G-5)

**Corpus law:** Shape and the real mother are separate §14.2 fixtures. Synthetic REST-schema
snapshots are valid ONLY for §14.1 microfixtures/mutations/parser-lowerer tests — never for
§14.2 integration evidence or full-corpus G0–G5 green. P0 exit needs a checked-in versioned
corpus index, every §14.1/14.2 role present, each package passing
schema/hash/provenance/census/reference-disposition validation. Minimum live source set:
Shape + Dan-selected distinct mother; a published provider file (remote variables/aliases,
complete component set, fonts, assets); a consumer file (two consuming screens + non-ONEMO,
editorial, GRID/mask/marketing, enterprise roots — consolidated pages allowed); plugin-origin
golden replacement. Each live root → sanitized sealed §4.3 evidence directory for hermetic CI.

**Source-plane law:** provenance is per fact family/dependency (document=PLUGIN_JSON_REST_V1_PRIMARY
+ REST cross-check; supplement=PLUGIN_PRIMARY_COMPLETE|REST_ONLY|PARTIAL; variables=PLUGIN_PRIMARY
+ optional REST cross-check; components complete|partial; assets/references/fonts carry
provider/version/hash/permissions/stability). REST_ONLY/PARTIAL = diagnostic only — cannot pass
G0, clear supplement-dependent G1–G5, stage promotion, or reach PROMOTABLE_VERIFIED. Production
request missing required supplement = FAILED_CAPTURE before graphs. Required mutations: supplement
delete/relabel → G0 FAILED_CAPTURE; dropped mode/range/property/override with stable REST → census
failure; mid-transaction dependency change → F/D mismatch → bounded retry → FAILED_CAPTURE.

**Dan-only inputs (blocking, surfaced to Dan 2026-07-13):**
1. G-4: select the distinct mother screen (or authorize a composed mother page).
2. G-1: create/publish the provider + consumer Figma files (or authorize Kai to compose them in
   a working file Dan reviews) — needed for §14.2 corpus roles.
3. G-2: plugin bridge rescans at pinned versions when supplement capture lands (P1).

**P0.5 envelope draft (Shape, local-heavy file, n=1):** REST version probe 807ms/2.9KB ·
REST nodes 1,303ms/618KB · bridge variables payload 13ms/1.4MB · REST image export 1,979ms/598KB
(2 requests). Three-pass capture projection ≈ 3×(nodes+deps) + refs ≈ 8–12s for Shape-class
locals — inside a tolerable design-loop envelope; remote-heavy corpus measurement owed (G-1).

## Decisions log

- 2026-07-13 Dan: full end-to-end execution authorized; per-phase Dan pause superseded for this
  run; final review by pixel + meta-qa; /o-deslop mandatory post-build; gaps = stop + collaborate.
- 2026-07-13 Kai (process synthesis, relayed to both lanes): phases = frozen evidence points with
  async QA/Meta review; no build idle; evidence discipline intact.

## Reviewer verdicts & checkpoints (append-only)

- 2026-07-13 Meta: gap ruling accepted (corpus = phase failure not debt; REST_ONLY grants no
  capability; §17.0 narrow waiver recorded). Formal QA not started; Pixel designing gap route.
