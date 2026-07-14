# Compiler v2 — Phase Ledger & Gap Register (shared collective state)

> Governing contract: `../C11-CONTRACT-V3.md` sha256 fd8b6c9258c1701bdf265072eb8e50d099359e3c677e34214d7ac936afbc540a
> Builder baseline: commit `f37de9e` (nine legacy truth-fixes + contracts). Legacy lane stays operational (§0.1).
> Run mode (Dan, 2026-07-13, live directive): continuous end-to-end build; phases are FROZEN
> EVIDENCE POINTS reviewed asynchronously by the sole authoritative QA+Meta gate
> @s58-pixel-meta-qa; @s58-qa is advisory only;
> REWORK findings stop ALL dependent downstream work until cleared; only demonstrably
> orthogonal work continues during a rework. Dan judges the final product, Done, and cutover.
> Evidence discipline (self-review, mutations, honest failures) is NOT waived.

## Governance waiver (narrow, exact)

Dan's newer directive supersedes the per-phase Dan-wait sentence ONLY: this run does not pause
for Dan between phases. NOT waived: frozen phase evidence, authoritative QA+Meta handoffs to
@s58-pixel-meta-qa, fail-closed gaps, final Dan sign-off, Done ownership, cutover authorization.

**Current test truth (reported separately):** legacy converter suite 46 pass / 3 fail (missing
gitignored golden fixture `t88thL8hKksSpILgkeGRZ0-4084-25997.nodes.json`) / 0 skips ·
compiler-v2 foundation suite 53 pass / 0 fail / 0 skip across Builder and Meta repeated runs ·
compiler-v2 P2 graph suite 16 pass / 0 fail / 0 skip · P2 persisted-model suite 7 pass /
0 fail / 0 skip · compiler-v2 P3 planner suite 9 pass / 0 fail / 0 skip · P4 layout/render
suite 13 pass / 0 fail / 0 skip · P5 emission/security/editor suite 6 pass / 0 fail / 0 skip ·
P6 runtime/visual/editor-proof suite 7 pass / 0 fail / 0 skip, including pinned system-Chrome.
Combined current truth: 111 pass / 0 fail / 0 skip.
No phase may be recorded green from
harness-only or REST_ONLY placeholders.

**Gap blocking map:** G-1 (plugin-origin corpus) blocks P0 exit + P7 full-corpus G0–G13.
G-2 (plugin supplement capability) blocks P1 G0 supplement proof and every G1–G5 clearance of
component/mixed-text/mode-override domains. G-3 (dark reference) blocks dark-state G11 promotion
only. G-4 (Dan mother-screen selection) blocks P0 item 2 + the P3/P4 slice anchor. G-5's P2
pre-graph enforcement is built; its remaining P1 live-capture enforcement blocks P1 G0. G-6
(bounded retention/reader lease) blocks P0 operability acceptance only; it is not an atomic
publication freeze blocker and does not authorize speculative GC.

## Ownership
Builder/ledger: @s58-pixel. Authoritative independent QA/Meta reviewer: @s58-pixel-meta-qa
(Dan routing correction 2026-07-13); @s58-qa findings are advisory only and carry no gate verdict.
Lead/orchestrator + capture/fixture operator, hands-off code: @s58-kai.
Decisions/Done/cutover: Dan only.

## Phase ledger

| Phase | State | Frozen evidence | Notes |
|---|---|---|---|
| P0 continuity/contract/calibration | IN PROGRESS | — | see P0 section |
| P1 evidence capture | pending | — | |
| P2 canonical graphs | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `0c8471b` | sole authoritative QA/Meta cleared the frozen code snapshot only; live/plugin evidence still blocked by G-1/G-2 |
| P3 mother token/component slice | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `5dbcb39` | sole authoritative QA/Meta cleared core snapshot; real mother/plugin-origin exit blocked by G-1/G-2/G-4 |
| P4 mother layout/render slice | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `c754741` | sole authoritative QA+Meta cleared core snapshot; runnable mother/plugin evidence remains blocked by G-1/G-2/G-4 |
| P5 emitters/security/editability | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `4693a72` | sole authoritative QA+Meta cleared G8 core snapshot; integration/editor-corpus exit remains blocked |
| P6 runtime/visual/editor proof | CORE REWORK BUILT; AWAITING AUTHORITATIVE SNAPSHOT REVIEW | — | authority-backed G9–G11 + one real EC1 chain; EC2–EC8b and integration promotion remain honestly unavailable |
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
8. **Calibration publication/restart seam**: UUID-isolated multi-writer transactions; pointer
   rename final; opaque in-process ownership; strict pointer/marker/topology validation; atomic
   temp-unlink arbitration; dead-owner recovery; legacy-v1 namespace preservation; original
   failure diagnostics preserved. Foundation 53/53/0 plus deterministic publisher-won and
   recovery-won races. [SEAM CLEAR — not P0 exit]
9. **Clean-snapshot live Shape calibration evidence**: run from detached clean snapshot
   `08fef0dfd3464b731aea9b7b320612e5b18b2402` against file
   `Qdb9Kx98afJHxaCGAIxoMC`, node `6075:53685`, version `2375782983690416241`, light route
   `:3077`. Sealed v2 generation records the full build SHA; latest/published records are
   byte-identical; all images are 804×1748; declared artifact hashes match. Repeat capture is
   byte-identical; Figma/build draft metrics are 11.21% changed >2, 0.388% changed >32,
   mean delta 1.592. Legacy latest + four generation artifacts remained byte-identical.
   [EVIDENCE CAPTURED — DRAFT ONLY; §13.3 distributions/class budgets/approval still pending]

## Gap register (stop-and-collaborate log, Dan's gap protocol)

| # | Gap | Status | Owner/next |
|---|---|---|---|
| G-1 | §14.2 integration corpus requires PLUGIN-ORIGIN sanitized evidence packages from live Figma roots (joint route). Synthetic JSON is legal for §14.1 microfixtures/mutations/parser-lowerer tests ONLY — earlier "harness + fixtures owed" and "synthetic integration" statements are WITHDRAWN | OPEN — BLOCKS P0 exit + P7. Needs Dan input #2 (provider + consumer files) | Dan input; Kai builds capture/sanitize tooling |
| G-2 | Plugin supplement capture (resolvedVariableModes, styledTextSegments, component defs) is a REQUIRED capture plane; REST_ONLY/PARTIAL provenance is diagnostic-only and cannot pass G0 or clear supplement-dependent G1–G5 (joint route — earlier "Shape completeness without supplement" claim narrowed accordingly) | OPEN — BLOCKS P1 G0; needs Dan input #3 (bridge rescan at pinned versions) when capture lands | Kai builds; Dan rescan |
| G-3 | Dark-mode visual promotion impossible without an authored dark reference (§4.5) | OPEN — dark states DIAGNOSTIC_ONLY until Dan authors a dark-mode reference frame | Dan (when he wants dark visually promoted) |
| G-4 | §14.2 mother screen must be selected + version-pinned BY DAN; Shape cannot substitute | OPEN — blocks P0 item 2 and the P3/P4 mother-slice anchor | Dan (question surfaced in-session 2026-07-13) |
| G-5 | Per-fact source-plane fail-closed law | PARTIAL CLOSURE — P2 canonical-model preflight now refuses missing/partial/REST_ONLY required facts as FAILED_CAPTURE before inventory/graphs; every graph repeats its required-family gate. P1 live capture/adapter enforcement remains open and blocked with G-2 | Pixel |
| G-6 | Complete published calibration generations currently have no bounded reader-safe retention policy | OPEN — non-blocking for atomic freeze; blocks P0 §4.7 storage/operability acceptance only. Preserve reader safety; no speculative GC | Pixel + QA/Meta architecture |

## P0 findings

- **F-P0.1 (2026-07-13): live-screen replay cannot reproduce the E-rows.** Baseline (6c36475)
  convert against TODAY's Shape cache emits clean (119 elements, no baked hex, no invert, no
  rotate) — Dan's Figma-side fixes removed the defect-triggering patterns (single root fill now
  index-aligns by accident; rail rebuilt at 0°). The broken-era input was overwritten by
  refreshes. RESOLUTION: E1–E13 reproduce on the clean baseline via **hermetic microfixtures**
  crafted per E-row (multi-fill root, bound stops, bound effects, bound opacity, per-side
  weights, rotated asymmetric container, mirror matrix, fixed-box text). This merges P0.1 into
  P0.3 and is consistent with Meta's corpus ruling below.

## P2 build checkpoint (2026-07-13)

- Implemented versioned `DocumentGraph`, `VariableGraph`, `BindingGraph`, `ComponentGraph`,
  `TextGraph`, and `AssetGraph`, composed by one JSON-safe `CanonicalModel` boundary.
- Added strict persisted-model parsing: missing graph, unknown nested schema, and malformed
  identity/relationship/content fields in every graph refuse before downstream use. The parser
  cross-checks document topology, variable catalogs/traces/modes, binding identities/references,
  native component APIs, UTF-16 text/font coverage, and asset content identity.
- Source-plane preflight is centralized and runs before alias inventory: integration requires
  plugin-primary-complete document/supplement/variables/components/fonts/assets/dependencies;
  `fixture` is accepted only for §14.1 microfixtures.
- Binding identity keeps stable variable/collection keys, source slot/range/domain/target,
  subtree-complete defaulted `ModeContextId`, and persisted resolution trace tables. Every
  source node now requires a captured supplement mode row; both BindingGraph and VariableGraph
  persist the same complete node-context table so later scoped-mode lowering cannot substitute
  a root context for descendants.
- Components preserve complete typed definitions, native instance identity, properties,
  references, swaps/overrides; incomplete definitions and illegal variants fail
  `FAILED_COMPONENT`. Text preserves contiguous UTF-16 ranges and proves every used font mapping.
  Assets bind source identity/geometry to the sealed manifest hash+byte record.
- Typed codecs keep token leaves, require explicit opacity scale, and reject CSS/React plane
  crossover. Deprecated-background mirror proof is structural and key-order independent.
- Authoritative rework repairs now conserve resolution traces exactly by trace id + consuming
  node `ModeContext` across both graph tables, reject trace substitution at the first variable
  hop, and reject otherwise-valid orphan traces. Component-property references are a closed
  `visible|characters|mainComponent -> typed property name` map owned by the containing native
  component/main component; overrides must target a real descendant and use the closed captured
  `NodeChangeProperty` vocabulary. Canonical output carries the source fingerprint, per-graph
  hashes, and a whole-model content seal, so post-build asset/text-content drift refuses.
- Independent oracle imports no P2 builders and rejects the actual legacy `src/ir.mjs` output at
  G1-G5 on the same semantic fixture. P2 suite 16/16/0; foundation 53/53/0; syntax/diff checks
  green. Advisory review of frozen `0d04e26` exposed a strict-parser defect; it was reproduced
  and repaired with permanent
  persisted-corruption mutations across all six graphs and cross-graph links. This is a Builder
  checkpoint only: no P2 phase, integration, promotion, or Done claim;
  QA/Meta review and plugin-origin G-1/G-2 evidence remain required.

## P3 Builder core checkpoint (2026-07-13)

- Added a versioned, project-generic `TokenRegistry` and staged delta: stable Figma keys own
  identity; each destination domain owns a separate CSS or React channel; WEB syntax enters only
  through the policy adapter; existing registry identity wins; naming changes create migration
  requests; generation/hash conflicts and additive-delta forgery fail without mutating the base.
- Added `TokenPlan` lowering under each consuming node's exact `ModeContextId`. Cross-collection
  aliases resolve in the consuming context, retain their trace, preserve a token leaf, and emit
  separately typed CSS/React data. Unsupported bound values fail; no literal fallback exists.
- Added root/change-only `ModeContextPlan` boundaries and a semantic component/text slice that
  preserves stable-key component identity, every captured variant combination, typed public
  properties, native instances/references/overrides, rich-text ranges/hyperlinks/fonts, nested
  modes, and exact token/mode plan conservation.
- Failure-first progression: inherited P3 fixture failed 0/7 at the stricter P2 boundary; fixture
  truth repairs reached 7/7; forged registry stage/foreign plan mutations forced 5/7; removal
  mutation forced 6/7; implementation repairs restored green. Final exact split: foundation
  53/53/0 + P2 graphs 16/16/0 + P2 persisted models 7/7/0 + P3 7/7/0 = 83/83/0;
  eight P3 syntax checks and diff check green. The earlier 76 total omitted `p2-models.test.mjs`.
- This is a Builder architecture checkpoint only. It does not satisfy the P3 exit row: G-1/G-2
  still withhold plugin-origin supplement evidence and G-4 withholds the Dan-selected, pinned
  real mother. No P3 phase, promotion, integration-corpus, cutover, or Done claim.

## P3 authoritative rework (2026-07-13)

- Snapshot `d69a0fa` rejected on F1-F5: unvalidated TokenPlan content, Cartesian variant
  overclaim, per-member rather than set-level React identity, source-unrelated registry deltas,
  and omitted persisted-model tests.
- Builder repair makes TokenPlan validation an exact re-derivation from its sealed model,
  registry, and per-binding codec options; every channel/expression/registry/token-data mutation
  refuses and the independent oracle binds the validated plan hash.
- Sparse authored variant combinations are preserved without inventing a Cartesian product.
  Members retain source keys/variant props, while set instances target one set-level React symbol
  and retain the member key as source identity.
- Registry stages now bind source fingerprint/content seal and are re-derived from the exact
  model + WEB policy at commit validation; unrelated additions and deleted migration requests
  refuse. Two permanent tests raise P3 to 9 tests; full required truth is now 85/85/0.
- Authoritative rereview of `2c6b27c` credited F4/F5 and stale-field rejection as closed, but
  reproduced three residuals: TokenPlan trusted its embedded registry/options; missing per-axis
  options were accepted; set members still appeared as standalone React components.
- Repair 2 validates TokenPlan against the independently supplied frozen registry stage and named
  external codec policy, and the independent oracle compares exact stage/channel identities.
  Sparse cross-axis combinations remain legal only when every advertised option appears in at
  least one captured member. Set members now exist only as metadata under the single set-level
  component; no standalone member React symbols remain. Self-consistent registry substitution,
  unapproved codec policy, missing-option, and member-symbol mutations are permanent tests.
- Authoritative rereview of `9532450` closed those three residuals, then found one adjacent G4
  gap: per-axis option coverage allowed the combined advertised default tuple to have no authored
  member. Repair 3 requires an exact authored default member while preserving sparse non-default
  combinations; the missing-default mutation refuses in lowering and independently trips G4.
- Authoritative rereview cleared the resulting core snapshot `5dbcb39` with 85/85/0 and its
  external attack replay. This is snapshot clearance only; P3 phase evidence remains blocked by
  G-1/G-2/G-4 and external registry-stage authenticity remains an orchestration precondition.

## P4 Builder core checkpoint (2026-07-14)

- Added versioned semantic-layout and render/compositing IR from the sealed CanonicalModel:
  auto-layout including wrap/negative gap/track alignment, GRID tracks + direct-child placement,
  free/absolute layout, exact local and composed affine matrices, sizing/constraints/overflow,
  reverse child paint order, clipping, and stroke geometry contribution.
- Added explicit source-mapped fragments for isolation, mask, clip, every visible fill/stroke/effect,
  content, and captured vector geometry. Decorative fragments are aria-hidden/pointer-free; raw
  source indexes survive hidden predecessors; mask groups preserve Figma's subsequent-sibling law.
- Every binding has exactly one layout, fragment, or semantic owner. Missing/multiple owners and
  unsupported visible operations fail; scalar rotation cannot replace an affine matrix.
- Added a planner-independent G6/G7 oracle and hard-case mutations for grid span, affine shear,
  reverse-z source drift, reordered paint source, mask targets, fragment order, and exact binding
  owner. Exact current split at the initial checkpoint was foundation 53 + P2 16 + P2 persisted 7
  + P3 9 + P4 5 = 90/90/0;
  four syntax checks and diff check are green.
- Authoritative review rejected snapshot `3e2d8bb` on five reproduced gaps: open blend-mode
  values, neutral opacity-token owner loss, oracle semantic-owner fallback, generic clip geometry,
  and storage-preorder-dependent world composition. Builder repair validates the closed current
  Figma blend enum at node/paint/stroke/effect boundaries; keeps live opacity bindings on a stable
  isolation fragment even at `1`; permits semantic owners only for React/text-range records;
  makes clip fragments own exact uniform/per-corner geometry plus radius-token dependencies; and
  resolves world transforms by memoized parent relations independent of persisted row order.
  Ten permanent P4 tests include every reproduced attack plus identity/ownership and per-corner
  strengthening. Current full boundary: 95/95/0; three changed-file syntax checks and diff check
  green. This is Builder repair evidence awaiting authoritative snapshot rereview, not clearance.
- Authoritative rereview of `8d2ed1c` closed original F1-F5, then reproduced two adjacent gaps:
  `cornerSmoothing` disappeared from exact shape/clip geometry, and G7 independently closed only
  blend modes while a planner-forbidden `MAGIC_GLOW` effect could remain oracle-green. Residual
  repair carries validated 0–1 smoothing in both content and clip payloads, with exact clip
  mutation coverage; G7 now independently checks the complete render-capability surface the
  planner refuses: node/paint/stroke/effect blend values, opacity/smoothing/radius ranges, closed
  fill/stroke/effect/mask types, visible-array shape, and required vector geometry. Permanent
  forged-effect and out-of-range-opacity mutations raise P4 to 12 tests and the full boundary to
  97/97/0. This remains Builder evidence awaiting authoritative rereview.
- Authoritative rereview of `de5734f` closed R1 and every advertised R2 class, then reproduced
  one R2-adjacent vector hole: `{}` passed as `vectorNetwork`. The surgical repair implements the
  current Figma VectorNetwork law independently in planner and oracle: required vertex/segment
  arrays; finite vertex and tangent coordinates; integer in-range endpoints; typed winding-rule
  regions with non-empty loops; valid segment references; and undirected connected closed-loop
  topology. `{vertices:[],segments:[]}` remains valid. Permanent planner and independently forged
  oracle mutations cover missing/non-array fields, nonfinite vertices/tangents, bad endpoints,
  bad region references, and open/disconnected loops. P4 is 13/13/0; full boundary 98/98/0.
- Authoritative rereview of `aafc525` closed those structure/index/value/orientation claims and
  reproduced one topology escape: a figure-eight region made from two closed triangles sharing
  one vertex passed the ordered cursor walk. Planner and oracle now independently require every
  vertex participating in a declared region loop to have degree exactly two, counting a self-loop
  twice. The shared-vertex degree-four mutation is permanently planner-red and G7-red; valid open
  networks without regions, empty networks, and reversed-orientation triangles remain green.
- This is a Builder core checkpoint only, not P4 phase clearance: runnable sandbox emission is the
  next seam, and real plugin/mother evidence remains blocked by G-1/G-2/G-4.

## P5 Builder core checkpoint (2026-07-14)

- Added a pure deterministic package compiler for reviewed P3/P4 plans: typed React components,
  CSS Modules, CSS/React token channels, local mode resolution, sealed manifest/inventory,
  source map, and explicitly `DIAGNOSTIC_ONLY` capability/fidelity reports. Legacy emission stays
  untouched and remains the operating lane.
- Stable source ranges cover semantic nodes, set-level native components plus authored member
  identities, every auxiliary fragment, CSS declarations, token expressions, component prop
  values, and text. Set components preserve sparse authored member mapping under one React symbol;
  member selection resolves through that one semantic owner.
- Save-to-code validates the sealed package before selection/edit, edits one exact UTF-8 byte
  segment, updates containing ranges plus source-map/manifest hashes, rejects uncaptured variant
  values and forged/cross-domain token channels, and preserves identity/mode/render-order hashes.
- Security uses AST SVG allowlisting + deterministic local-id rewrite, rejects dangling/colliding
  ids and remote/executable carriers, validates CSS declaration boundaries, confines package and
  asset paths, escapes JSX text, and allowlists link protocols. Generated TS/TSX is parsed and
  typechecked as one virtual package; the oracle imports no emitter/editor helpers.
- Corrected an upstream opacity serialization defect exposed by real emission: percent-scale
  token data remains raw `0..100` and the emitted `calc(var(...) / 100)` performs normalization
  exactly once. Literal-preserving generated token types now keep React-bound booleans/props
  type-safe.
- Failure-first malicious/mutation corpus covers unsafe SVG/CSS/URL/path/TSX, manifest/source-map
  drift, package traversal, type corruption, missing/forged node-component-fragment addresses,
  fragment role/order, binding mode/source linkage, arbitrary token rebinding, invalid CSS slot
  values, and uncaptured variants. Full code boundary: 104/104/0.
- This is Builder core evidence awaiting sole authoritative @s58-pixel-meta-qa snapshot review.
  It is not P5 phase, integration-corpus, runtime, visual, promotion, cutover, or Done clearance;
  G-1/G-2/G-4 still block real plugin/mother evidence and P6 owns runtime/visual/editor proof.
- Authoritative review of `68e58b0` reproduced five P5-boundary gaps: self-consistent upstream
  plan substitution, self-consistent source-map identity rewrite, generated runtime network calls,
  false refusal of the standard SVG namespace, and browser-normalized backslash href escape.
  Repair rederives TokenPlan/ModeContextPlan/SemanticSlice/LayoutRenderPlan from the canonical
  model plus the trusted registry stage and named codec policy; requires an externally held,
  rotating editor package seal and independently recomputes source identity; rejects generated
  network APIs in the independent TS AST oracle; accepts only the standard SVG namespaces; and
  rejects browser-normalized separators. All five are permanent mutations. This is Builder repair
  evidence awaiting authoritative rereview, not snapshot clearance or a phase claim.
- Authoritative rereview of `bd6f091` closed plan authority, editor authority, SVG namespace, and
  href normalization, then reproduced two adjacent G8 escapes: computed/aliased runtime capability
  access and protocol-relative CSS loading. Repair replaces the TS/TSX network-name blacklist with
  an independent closed generated-module capability grammar: only local imports, declared calls,
  `JSON.stringify`, `new Error`, and the exact emitted JSX intrinsic/attribute surface are allowed;
  ambient globals, computed calls, constructor chains, dynamic imports, and fetching elements
  refuse. CSS values are standards-parsed, reject remote/scheme-relative carriers in every value
  form, and allow `url()` only when it resolves to an explicitly approved, existing package-confined
  `assets/` entry. Exact reviewer attacks plus local-asset positives are permanent. Builder boundary
  remains 104/104/0; this is repair evidence awaiting authoritative rereview, not phase clearance.
- Authoritative rereview of `e1c29fb` closed the CSS boundary but reproduced one runtime-grammar
  implementation defect: file-global declaration collection let a name declared in one lexical
  scope authorize an ambient reference in another. Repair removes handcrafted name collection and
  asks the TypeScript checker for each identifier's actual resolved symbol/declarations. Only symbols
  declared in the generated package are local; the sole ambient values remain the exact built-in
  `JSON` and `Error` symbols, and callable identity is validated from the resolved declaration kind.
  Cross-function shadow/ambient confusion is now a permanent G8-red mutation. This is residual repair
  evidence awaiting authoritative rereview; CSS and all earlier P5 findings remain credited closed.
- Authoritative rereview of `89e8eec` closed lexical use-site resolution, then identified the final
  declaration-identity distinction: a package-owned `declare` symbol has no executable runtime body,
  and an import alias is not confined merely because its import specifier node lives in-package.
  Repair rejects declaration-file/`declare` ancestors, follows TypeScript alias symbols to their
  executable target declarations, and validates every relative import by resolving it from the source
  file to an existing generated `.ts`/`.tsx` or `.module.css` package entry without escape. Package
  ambient globals, forged built-ins, escaping relative imports, and an in-package alias targeting an
  ambient declaration are permanent G8-red mutations.
  This is residual repair evidence awaiting authoritative rereview; lexical scope, CSS, and all earlier
  P5 findings remain credited closed.
- Authoritative `[CLEAR — P5 CORE SNAPSHOT ONLY]` at `4693a72`: exact declaration-file,
  declaration-only alias, escaping-import negatives and confined executable-alias positive passed;
  dependent P6 work released. No P5 phase/integration/runtime/visual/promotion/cutover/Done claim.

## P6 Builder core checkpoint (2026-07-14)

- Added a deterministic production browser bundle over the sealed P5 package. Two builds produce
  identical JS/CSS/HTML inventories and hashes; unsafe paths, persisted metadata drift, and stale
  manifest inventory refuse before bundling.
- Added a live state capture on pinned Playwright/system Chrome: exact viewport+DPR screenshot,
  effective `data-mode-context` at every source node, CSS custom-property and React-channel value
  selection per binding, derived browser/environment identity, console/page/runtime errors, and
  external network requests. Unsupported requested root modes fail loud rather than being inferred.
- Visual comparison requires an exact declared metric-class census, same-size pinned reference,
  explicit opaque-white alpha composition, and class-region changed-pixel/mean-delta measurements.
  Missing references remain diagnostic; stale references, runtime gaps, budget excess, or editor
  drift receive their contracted terminal states.
- G9 requires two package-identical, artifact-inventory-identical builds plus token-value, label,
  and subtree locality records whose changed-file lists are derived from before/after inventories.
  G13 requires all pinned EC1–EC8b cases with file locality, identity/mode-order preservation, and
  successful recompilation. The independent oracle imports no P6 builder or emitter helpers.
- Failure/mutation corpus covers missing runtime, context/channel/value/environment drift, external
  network access, stale reference, metric-class additions, over-budget visual output, build churn,
  editor churn, duplicate states, unsafe package paths, stale package inventory, and forged reports.
- `PROMOTABLE_VERIFIED` additionally requires an externally supplied integration authority bound to
  the exact package, compile request, fidelity budgets, and blocker inventory. Missing/stale authority
  stays `DIAGNOSTIC_ONLY`; a self-consistent microfixture report is not promotion authority.
- Current core boundary is 111/111/0. The in-app Browser plugin was attempted first but reported
  `No Codex IAB backends were discovered`; the contract-pinned Playwright/system-Chrome fallback ran
  the live production bundle with zero console/network/runtime errors and exact context/token parity.
- This is Builder microfixture core evidence awaiting sole authoritative snapshot review. It is not
  P6 phase, real-reference, calibrated-budget, integration, promotion, cutover, or Done clearance;
  G-1/G-2/G-4 and P0's unaccepted budgets still prevent a real `PROMOTABLE_VERIFIED` candidate.

## Meta rulings accepted (2026-07-13)

- **Corpus:** "harness + fixtures owed" is NOT a P0/P7 exit. Missing required fixture = named
  phase failure. P0 stays incomplete until the §14 fixture set exists. Current law: synthetic =
  §14.1 microfixtures only; §14.2 integration evidence must be plugin-origin from live roots;
  the mother is a distinct Dan-selected screen (G-4). (A prior builder reading was superseded —
  see Decisions log.)
- **Supplement:** `sourcePlane: REST_ONLY` is fail-closed for any fact requiring
  resolvedVariableModes / styledTextSegments / component definitions / overrides /
  plugin-resolved remote variables. The marker grants NO capability; those capability rows stay
  unclear until supplement-backed fixtures prove them. Accepted — no escape hatch.
- **Routing:** Builder = @s58-pixel; sole authoritative QA+Meta gate =
  @s58-pixel-meta-qa; @s58-qa is advisory only and cannot clear or block.
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

**P0.5 envelope measurements (Shape, local-heavy file, n=1 — DRAFT EVIDENCE ONLY, no envelope
is approved until P0 calibration):** REST version probe 807ms/2.9KB · REST nodes 1,303ms/618KB ·
bridge variables payload 13ms/1.4MB · REST image export 1,979ms/598KB (2 requests). Naive
three-pass projection ≈ 8–12s for Shape-class locals (uncalibrated); remote-heavy corpus
measurement owed (G-1). Envelope acceptance belongs to QA/Meta/Dan per §4.7.

## Decisions log

- 2026-07-13 Dan: full end-to-end execution authorized; per-phase Dan pause superseded for this
  run; final review by pixel + meta-qa; /o-deslop mandatory post-build; gaps = stop + collaborate.
- 2026-07-13 Kai (process synthesis, relayed to both lanes): phases = frozen evidence points with
  async QA/Meta review; no build idle; evidence discipline intact.
- 2026-07-13 Dan/Meta: lock-free calibration publication uses atomic temp-pointer arbitration;
  bounded retention/reader leases remain P0 operability debt, not a third atomic freeze blocker.

- 2026-07-13 SUPERSESSION RECORD: the builder's initial corpus reading (synthetic REST-schema
  snapshots acceptable as §14.2 integration fixtures; Shape doubling as the §14.2 mother; E-row
  replay via live cache) was withdrawn and replaced by the joint Meta+Pixel route and finding
  F-P0.1. The ledger presents only the current law; this entry is the historical note.

## Reviewer verdicts & checkpoints (append-only)

- 2026-07-13 Meta: gap ruling accepted (corpus = phase failure not debt; REST_ONLY grants no
  capability; §17.0 narrow waiver recorded). Formal QA not started; Pixel designing gap route.
- 2026-07-13 Meta `[CLEAR TO FREEZE SEAM ONLY]`: byte-stable hashes
  full `3c971de483653e22dfa63f086b24e25c57dec10d77a1e116b99e094d959796b5`, narrow
  `b31fc77d5dbc08fbe82eed45859adbe25dd1b1438b864af82cc20648be9752ad`, worker
  `163199800fb6fa1644d44f69b0e657f9e641faf50c7ebce6af3175088d64a2fd`; independent
  3× foundation 53/53/0, four syntax checks and diff check green. R3-18b/R3-19/R3-20/R3-21
  cleared. This authorizes only the narrow snapshot and clean-checkout/live-calibration sequence;
  no phase, P0, promotion, fidelity, cutover, or Done verdict.
- 2026-07-13 Builder clean-snapshot calibration checkpoint: v2 generation
  `generations/08fef0df-72869-1783979185476-d339b2aa-e3fa-4f6a-bf90-655b8c2fe6bd`;
  draft SHA-256 `92726d5882e6af9772bd0cc52848345df1af2d2cf91e9eaa0838bb9bc59a927f`.
  Legacy hashes reverified unchanged: latest `caf4585334077bc3672b5537c6e6649f357a46a6667582e5af7f1481538f0477`,
  build-a `14de687921c156fa7a4d7989943936f41f3c46434067801879addbfd7d54aec6`,
  build-b `bccec2848283ae862e2bedd6e3f5c918d91d20df701ef03817bd05e0de81a134`,
  Figma `2ee8d8f8d69a300fdc7276439ba5c356ecf46d3a027b7e23a2fcdcc106cfbb8a`,
  draft `a8ecb8580e1475ce79c4d0b369864a83a2fd347ecde4985bee9465d2eb04de12`.
  No budget, P0, fidelity, promotion, phase, or Done claim.
- 2026-07-13 @s58-qa advisory finding at frozen `0d04e26` (explicitly non-authoritative per
  Dan's later routing correction): `parseCanonicalModel` checked only nested
  versions/top-level arrays and accepted corrupt document root/node, text-node, and asset rows.
  Builder reproduced the defect failure-first, then added strict per-graph and cross-graph
  validation plus a persisted-corruption mutation matrix. Builder rerun: P2 16/16/0,
  foundation 53/53/0,
  syntax/diff checks green. Authoritative @s58-pixel-meta-qa review remains required; no P2
  clearance claimed.
- 2026-07-13 @s58-qa second advisory finding at frozen `02fd782` (non-authoritative): persisted
  unknown/mirror/nonvisual arrays were not reconstructed from source, and forged export assets
  could name an absent node. Builder reproduced both failure-first; parser now reconstructs exact
  alias classification/canonical slot multisets, and AssetGraph/parser require SVG/export source
  nodes. This is code hardening only, not a gate verdict.
- 2026-07-13 @s58-pixel-meta-qa authoritative `[REWORK]` at range `0d04e26..3c51dcf`:
  F1 trace substitution/orphans, F2 unvalidated component references/override targets, F3
  unsealed asset/text-content drift, and F4 contradictory reviewer routing. Builder reproduced
  the attacks, froze P3 untouched, repaired only P2 + this ledger, and reran P2 16/16/0 plus
  foundation 53/53/0. This records Builder evidence only; authoritative re-review is still
  required and P2 remained uncleared at that historical checkpoint.
- 2026-07-13 @s58-pixel-meta-qa authoritative `[CLEAR — P2 SNAPSHOT ONLY]`: exact target
  `0c8471b7a5d9d14825256cabf998c620c39caa9a`, diff SHA-256
  `11a122c7c8f4be9739bc6bfcbac1bdc9bc6f7147b67f6559e15c0a24968167dc`; all seven changed
  files read in full in clean detached checkout `/private/tmp/s58-p2-verify-0c8471b`; combined
  suite 76/76/0, syntax/diff checks green, and stronger semantic corruption probe refused trace,
  component, asset-hash, and hyperlink mutations. Clearance applies only to the P2 code snapshot;
  G-1/G-2 and every phase/integration/promotion/cutover/Done gate remain open.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P4 CORE SNAPSHOT ONLY]`: exact target
  `3e2d8bbed59941ca07135ab7175a4cf553e80a5b`; 90/90/0 and static checks were green, but the
  external probe reproduced five semantic gaps: invented blend values accepted, neutral live
  opacity binding lost its fragment, forged semantic fallback stayed oracle-green, rounded clip
  geometry/token dependency was absent, and child-before-parent graph storage caused a raw
  `TypeError`. Dependent sandbox emission remains stopped. Builder reproduced all five
  failure-first and repaired only the P4 core/oracle/tests plus this ledger; authoritative
  rereview is required before dependent work resumes.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P4 REPAIR SNAPSHOT ONLY]`: exact target
  `8d2ed1c783b9b84f737696a8106432a6e0596897`; all original F1-F5 closed, 95/95/0 and static
  checks green. Residual R1 proved `cornerSmoothing:0.6` absent from content/clip IR and G7;
  residual R2 proved a consistently forged planner-forbidden `MAGIC_GLOW` effect stayed
  `{G6:false,G7:false}` because independent capability closure covered blend only. Builder
  repaired only R1/R2; dependent sandbox emission remains stopped pending authoritative rereview.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P4 RESIDUAL SNAPSHOT ONLY]`: exact
  target `de5734fe567ef335167d53f58aab2f7c4d104513`; R1 and all advertised R2 classes closed at
  97/97/0. One adjacent R2 blocker remained: any object, including `{}`, passed as vector geometry
  in planner and oracle. Required repair is the typed Figma VectorNetwork structure and topology,
  with independent permanent mutations. Original F1-F5 and R1 remain closed; sandbox stays stopped.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P4 VECTOR RESIDUAL SNAPSHOT ONLY]`:
  exact target `aafc525fc1cab803d66d87cc43bbd657f99a5ccf`; 98/98/0 and all advertised vector
  mutations closed. A degree-four shared vertex across two triangles inside one declared loop
  remained planner/oracle green. Required repair is an independent degree-exactly-two fork-free
  law per region loop. Every earlier P4 finding remains credited closed; sandbox stays stopped.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P4 CORE SNAPSHOT ONLY]`: exact target
  `c754741cfbe3cb0e408dd301888f41c4de82dbe8`, parent `aafc525`, and range SHA-256
  `c2f2fea7f02719eafa1805a4a30557624f9f3cd03935b528902b2b5ecbfc5d1b`; exact four-file
  scope and clean detached state verified. Full boundary 98/98/0 with syntax/diff/status green;
  independent positives cover open no-region, self-loop, separate-loop, and reversed-orientation
  networks, while both degree-four fork shapes refuse and forged forked output trips G7. This
  releases dependent sandbox emission only. P4 phase/integration/promotion/cutover/Done remain
  uncleared; G-1/G-2/G-4 still block real mother/plugin-origin evidence.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P5 CORE SNAPSHOT ONLY]`: exact target
  `4693a7297eb8f72f2eedeb0692231a71a8576e5a`; executable declaration identity,
  alias-target resolution, and package-confined imports closed the remaining G8 boundary.
  Clearance releases dependent P6 work only; no P5 phase/integration/runtime/visual/promotion/
  cutover/Done claim.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P6 CORE SNAPSHOT ONLY]`: exact target
  `ca385103df2454ecf1085021e20a553ea583db21`; five blockers reproduced: P5 package authority
  reopened at bundle time; G9 trusted invented inventories/locality; G10/G11 trusted claimed
  hashes/zero metrics without bytes; G13 trusted boolean summaries; and promotion authority was
  caller-mintable. P7 remains stopped.
- 2026-07-14 Builder P6 rework evidence: bundle/proof entry now requires rotating P5 authority;
  opaque build authority re-reads actual disk bytes; G9 authenticates before/after packages and
  derives contract-owned label/token-value/subtree locality; capture authority binds build,
  pinned environment, screenshot/reference bytes, region geometry/census, and budget identity;
  independent oracle re-reads builds and re-derives pixel metrics; G13 rejects booleans and
  requires raw package authorities, exact owner/segment, localized byte diff, conserved identity/
  modes/order, rotated authority, rebuild, and runtime capture. One real EC1 chain passes; missing
  EC2–EC8b remain G13-failed. Figma references require captureId+manifestHash; generated references
  are explicit microfixtures. No promotion-authority issuer exists, so microfixtures/self-labels
  cannot promote. Full boundary: 111 pass / 0 fail / 0 skip; five syntax checks and diff-check
  green. One frozen R3-18b race flaked once under the first combined run, passed immediate isolated
  rerun, then the exact 111-test boundary passed. This is Builder evidence only; authoritative
  snapshot rereview is required and P6/P7 remain uncleared.
  Post-freeze self-audit withdrew the first candidate before verdict: reversing an authenticated
  locality pair could change its claimed base. The replacement binds every locality `before`
  package hash to the exact main candidate and carries the reversal mutation in both proof/oracle.
  Meta then identified an adjacent subtree-policy hole before verdict: authenticated metadata-only
  manifest/source-map churn satisfied the empty required set. The next replacement requires at
  least one generated screen/style/component artifact and carries the root-name-only mutation.
