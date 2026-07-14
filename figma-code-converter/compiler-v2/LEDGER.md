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

**Current test truth (reported separately):** legacy converter suite 49 pass / 0 fail / 0 skip ·
compiler-v2 foundation suite 53 pass / 0 fail / 0 skip across Builder and Meta repeated runs ·
compiler-v2 P0 regression suite 11 pass / 0 fail / 0 skip ·
compiler-v2 P2 graph suite 16 pass / 0 fail / 0 skip · P2 persisted-model suite 7 pass /
0 fail / 0 skip · compiler-v2 P3 planner suite 9 pass / 0 fail / 0 skip · P4 layout/render
suite 13 pass / 0 fail / 0 skip · P5 emission/security/editor suite 7 pass / 0 fail / 0 skip ·
P6 runtime/visual/editor-proof suite 8 pass / 0 fail / 0 skip, including pinned system-Chrome ·
P7 inventory suite 6 pass / 0 fail / 0 skip · P7 mutation/scale diagnostic suite 6 pass /
0 fail / 0 skip · P8 sandbox transaction suite 16 pass / 0 fail / 0 skip · P8 Studio suite
8 pass / 0 fail / 0 skip · P9 cutover/rollback kernel suite 11 pass / 0 fail / 0 skip.
Combined current truth:
248 pass / 0 fail / 0 skip.
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
| P1 evidence capture | CORE BUILT — AWAITING REVIEW; PHASE EVIDENCE BLOCKED | — | diagnostic three-pass candidate core only; no accepted envelope/plugin authority/live snapshot |
| P2 canonical graphs | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `0c8471b` | sole authoritative QA/Meta cleared the frozen code snapshot only; live/plugin evidence still blocked by G-1/G-2 |
| P3 mother token/component slice | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `5dbcb39` | sole authoritative QA/Meta cleared core snapshot; real mother/plugin-origin exit blocked by G-1/G-2/G-4 |
| P4 mother layout/render slice | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `c754741` | sole authoritative QA+Meta cleared core snapshot; runnable mother/plugin evidence remains blocked by G-1/G-2/G-4 |
| P5 emitters/security/editability | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `4693a72` | sole authoritative QA+Meta cleared G8 core snapshot; integration/editor-corpus exit remains blocked |
| P6 runtime/visual/editor proof | SNAPSHOT CLEAR; PHASE EVIDENCE BLOCKED | `948c626` | sole authoritative QA+Meta cleared the environment-bound core snapshot; integration budgets/corpus/promotion remain blocked |
| P7 corpus & scale | CORE SNAPSHOTS CLEAR; PHASE EVIDENCE BLOCKED | `4169dab`, `3bd8dbd` | inventory + diagnostic evidence laws cleared; live corpus/capture/budgets/runtime/real mutations/scale remain blocked |
| P8 studio dual-run | CORE SNAPSHOTS CLEAR; PHASE EVIDENCE BLOCKED | `bc6c56e`, `60801e0` | transaction/recovery and truthful Studio snapshots cleared; live configured integration remains open |
| P9 cutover | CORE SNAPSHOT CLEAR; PHASE/CUTOVER BLOCKED | `fb41978` | fail-closed cutover/rollback mechanics cleared; no live authority/configuration/activation; Dan-only |

## P0 work items

1. **Baselines separated**: clean broken baseline = `6c36475`; operating delta = `f37de9e`.
   E1–E13 reproduction method = hermetic per-E-row microfixtures run against the baseline
   converter (per finding F-P0.1 — the live-cache replay instruction is WITHDRAWN as
   impossible). The harness now loads the exact baseline modules from Git with pinned source
   hashes, reproduces E1–E13, and distinguishes operating-delta fixes from Compiler v2 plan/
   snapshot evidence. [BUILDER GREEN — awaiting authoritative snapshot review]
2. **Mother screen selection**: OPEN — §14.2 lists "current Shape screen" AND a separate "one
   real current ONEMO mother screen, selected and version-pinned with Dan at P0; Shape or a
   synthetic fixture cannot substitute for it". Shape stays its own integration fixture and
   Dan's demo target ("code and on our screen the result"); the §14.2 mother needs DAN's
   explicit selection → gap G-4. Dark-mode authored reference does not exist → dark states are
   `reference:null` → DIAGNOSTIC_ONLY per §4.5 (honest, logged). [BLOCKED on G-4]
3. **Hermetic fixtures**: committed synthetic replacement for the lost gitignored legacy golden
   now preserves the 60-node structural/emission/fresh-IR reverse laws without claiming plugin
   provenance; legacy suite is 49/49/0. The separate E1–E13 microfixture harness is synthetic,
   hash-pinned to baseline `6c36475`, and explicitly non-plugin/non-integration. It reproduces
   carrier/stop/effect/opacity/per-side/affine/invert/false-green/order/vector/atomicity/cache/text
   failures and exercises current plan/snapshot mutations. [PARTIAL SNAPSHOT CLEAR `8df8b1b`;
   E1–E13 harness awaiting review]
4. **fidelity-budgets.json**: a diagnostic calibration core now requires the closed eight-class
   §13.3 census, synchronized per-row source/version/environment/corpus/reference/package/build
   identity, production/no-badge/zero-mask proof, same-source repeat groups, known-broken
   mutations, named zero-area environment exclusions, per-metric distributions, Wilson 95%
   confidence, and derived false-pass/false-fail truth. Partial census fails capture; overlapping
   boundaries fail visual; separated samples remain an unapproved draft with QA/Meta/Dan blockers.
   Real repeated image pairs, actual thresholds, approval evidence, and normative
   `fidelity-budgets.json` remain open. [BUILDER GREEN — DIAGNOSTIC CORE ONLY]
5. **Capture operability envelope**: the P0 diagnostic harness now enforces the exact visible
   three-pass phase order/counts; derives phase/total wall time, CPU, peak RSS, request count and
   bytes; races cancellation at every phase; permits exactly one instability retry; names changed
   provider/file/key/permission/action; detects active-file drift; and proves persistent registry/
   package identity unchanged. It cannot accept its own envelope. Existing Shape n=1 REST/bridge/
   export measurements remain draft; real local + remote-heavy runs, restart-stage evidence, numeric
   limits, and QA/Meta/Dan acceptance remain open (remote-heavy blocked by G-1).
   [BUILDER GREEN — DIAGNOSTIC CORE ONLY; LIVE ENVELOPE UNACCEPTED]
6. **Editor round-trip corpus pinned**: all EC1–EC8b cases now execute in the synthetic
   microfixture boundary with localized bytes, rotating package authority, deterministic rebuild,
   pinned-browser capture, conserved source/mode/order identity, package-derived binding values,
   and independent per-case mutations. EC3 swaps only the token segment; EC4 edits a typed prop;
   EC5 preserves a descendant scope; EC6 resolves fragment ownership; EC7 keeps escaped text;
   EC8a rebuilds the edited package; EC8b loudly inventories source-truth overwrite on rerun.
   [BUILDER GREEN — MICROFIXTURE ONLY; plugin-origin EC4/EC5 integration evidence remains G-1/G-2]
7. **Registry transaction protocol**: §6.1.1 verbatim; lane-scoped generations
   (v2 sandbox namespace only until P9). [P8 CORE + STUDIO SNAPSHOTS CLEAR; PHASE EVIDENCE OPEN]
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
| G-5 | Per-fact source-plane fail-closed law | PARTIAL CLOSURE — P2 canonical-model preflight refuses missing/partial/REST_ONLY required facts. P1 diagnostic capture core now refuses every non-complete semantic plane before retaining a candidate. The adapter-authority core independently audits exact bundle bytes and verifies an external Ed25519 receipt, but no reviewed live bundle/receipt exists; capture persists nothing until that authority plus the accepted P0 envelope exist. Live enforcement remains blocked with G-2 | Pixel + Kai capture operator |
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

## P8 Builder transaction/recovery core checkpoint (2026-07-14)

- Added a compiler-v2-only sandbox store; it never writes or activates the legacy route. A dual-run
  view always reports legacy as the operating production lane and shows the v2 candidate separately.
- Each candidate stages one immutable generation containing the exact token registry, generated
  package inventory, report, and strictly derived candidate record. Every file and directory entry is
  flushed before the generation rename; the parent directories are flushed before the database can
  reference it. Generation/control/package symlinks and escaped topology refuse before use.
- Registry and package identity commit through one SQLite `BEGIN IMMEDIATE` transaction. Commit
  compares package generation plus independently versioned registry generation/hash, re-reads all
  candidate bytes, requires exact G0–G13 `VERIFIED`, no blockers, `PROMOTABLE_VERIFIED`, and an
  Ed25519 receipt bound to project/base/registry/package/report/corpus/budget/environment. The module
  contains no signer and rejects every non-Ed25519 promotion public key before project creation. A
  stale, diagnostic, failed, cancelled, tampered, unsigned, or wrong-key-type candidate cannot move
  the pointer.
- Failure-first multi-process tests exposed and closed two real races: a duplicate-stage loser could
  delete the winner generation, and simultaneous first opens could fail with `database is locked`.
  Rename-winner ownership now controls cleanup; project metadata creation converges on one immutable
  authority; SQLite busy handling is active before WAL/schema work. Permanent tests run eight real
  processes for first-open, duplicate-stage, and commit arbitration.
- Crash injection after the in-transaction pointer update rolls back to the exact prior registry and
  package; staged evidence survives restart. Package-only promotion advances the package pointer while
  preserving an unchanged registry generation/hash. Report grammar, receipt fields, record derivation,
  authority identity, path confinement, tamper, cancel, and restart mutations are permanent.
- Authoritative @s58-pixel-meta-qa review cleared the frozen P8 core at `bc6c56e`; the clearance
  released Studio UX work only, not the P8 phase or integration/promotion/cutover/Done.
- Studio now opens the existing sandbox with the public Ed25519 verification key only. It has no
  signer or candidate-staging route. HTTP exposes exact status plus only three sealed runtime
  artifacts; the served shell rewrites only its two expected local asset references and applies a
  closed CSP. Commit rechecks exact eligibility and moves only the v2 sandbox pointer; diagnostic,
  unsigned, stale, failed, cancelled, or unconfigured states remain non-committable.
- The UI separates legacy Sandbox, legacy Library, and Compiler v2. The v2 surface shows side-by-side
  legacy/v2 render slots, exact transaction/evidence/gate/blocker/receipt/hash truth, disabled actions
  when unavailable, and the persistent statement that legacy remains production. The paste field is
  explicitly labeled legacy-only. A v2 status failure cannot break the operating legacy Studio.
- Live isolated verification on `:3901` showed the real legacy mother render beside an unconfigured
  v2 slot, `terminalState:null`, exact legacy `convert-run.json` SHA identity, and disabled commit/
  cancel. Screenshot: `output/playwright/compiler-v2-studio-unconfigured.png`. The pre-existing Next
  HMR websocket proxy emits 502 console noise on the isolated port; page/runtime rendering succeeds
  and this legacy proxy debt is not presented as Compiler v2 evidence.
- Current full compiler-v2 boundary at the frozen Studio checkpoint: 148 pass / 0 fail / 0 skip;
  syntax/diff checks green. Authoritative review cleared snapshot `60801e0`. No P8 phase, live
  configured integration candidate, promotion, production cutover, or Done claim.

## P9 Builder core checkpoint (2026-07-14)

- Added a production namespace separate from both legacy and the v2 sandbox. Its immutable trust
  root pins the initial legacy route/artifact identity plus distinct Ed25519 review and Dan public
  keys; extra/private-key fields and non-Ed25519 keys refuse. No signer exists in production code.
- P9 imports only the exact current `PROMOTED` P8 sandbox generation. It re-reads its package,
  registry, report, receipt, corpus, budget, environment, and source identities; STAGED,
  diagnostic, cancelled, stale, tampered, or non-current sandbox evidence cannot enter P9.
- One signed payload binds review authority, Dan authority, production base, sandbox generation,
  package/registry/report, G0-G13 corpus/budget/environment evidence, rollback package, and a
  deterministic pointer-cycle exercise. Staging copies and flushes an immutable generation but
  leaves the production pointer byte-identical.
- Activation and rollback update package and registry identity through one SQLite
  `BEGIN IMMEDIATE` pointer transaction. Failure after the in-transaction pointer update rolls
  back completely. Real multi-process tests prove one activation winner and one staging owner.
- Rollback restores the exact prior generation and survives restart. Sequential v2 releases mark
  the prior authority `SUPERSEDED` in the activation transaction and restore it to `ACTIVE` in the
  rollback transaction, so exactly one cutover authority remains active.
- A complete generation orphaned by a hard crash before row insertion is adopted only after exact
  sandbox/proposal/signature/byte re-verification. Unknown generation/staging debris is reported
  and preserved, never guessed or deleted.
- Independent P9 oracle code imports no production-cutover validator and catches pointer
  package/registry splits, signed-record drift, package/registry/report tamper, authority drift,
  and malformed rollback proof. P9 suite 11/11/0; full Compiler v2 boundary 159/159/0.
- Operational law is documented in `P9-CUTOVER.md`. No production configuration, private keys,
  live signatures, pointer activation, legacy deletion, P9 phase, cutover, or Done claim exists.
  G-1/G-2/G-4, P0 budgets, live corpus, configured P8 integration, and Dan sign-off remain open.

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
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P6 CORE SNAPSHOT ONLY]`: exact target
  `58a145d56da27a4d42a4cf283207302801a9cb1f`; all earlier P6 authority/G9/capture-reference/
  G13/promotion findings and subtree `requiredAny` repair were credited closed. One §13.1
  residual remained: browser version/UA did not identify the Chrome executable, OS image, font
  installation/provenance, color profile, or complete render environment. P7 remains stopped.
- 2026-07-14 Builder P6 environment repair evidence: capture now requires an opaque
  microfixture-only environment authority; integration authority issuance fails closed until P0.
  The manifest binds and re-verifies Chrome executable bytes/version/provenance, OS tuple/image id/
  receipt bytes, installed font bytes/provenance/license plus Figma-to-web mapping, reference export
  scale/profile, screenshot/reference decoded color space, fixed time, disabled motion, image/font
  readiness, background, locale/direction/reduced motion, viewport/DPR, and observed font stacks.
  Fidelity budgets and the report carry the exact manifest hash; independent G10/G11 oracle code
  re-reads the same raw bytes without production validator imports. Permanent mutations cover
  browser, OS image/receipt, font hash/provenance/license/mapping, color profile, background, and
  stable time. Full boundary: 112 pass / 0 fail / 0 skip; syntax/diff checks green. This is Builder
  evidence only; P6/P7/integration/promotion/cutover/Done remain uncleared.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P6 CORE SNAPSHOT ONLY]`: exact target
  `948c6268dfcd32913281dfe9de5a6ff92662eb4c` passed snapshot review. The reviewer confirmed
  microfixture-only environment authority, fail-closed pre-P0 integration issuance, and independent
  browser/OS/font/color/render/viewport/manifest revalidation with no residual. This releases
  dependent P7 construction only; P6 phase/integration/accepted budgets/promotion/cutover/Done and
  P7 itself remain uncleared.
- 2026-07-14 Builder P7 inventory stage: added an exact ten-role §14.2 checked-in corpus index
  validator and failure-first mutations. It checks file/version/root/fingerprint conservation,
  plugin-primary fact planes, distinct Shape/mother identities, no-WEB/component-provider/two-
  consumer/editorial/GRID-mask-multilayer/large-deep-remote role content, exact missing/duplicate/
  unknown-role failures, and index/snapshot realpath confinement. A structurally complete unit
  descriptor remains `DIAGNOSTIC_ONLY` and `integrationInventoryReady:false`; P1 capture authority,
  accepted budgets, runtime, mutation, and scale proof are explicit blockers. Capture-operator live
  verification says only Shape `6075:53685` exists; remaining roles and distinct mother stay
  G-1/G-2/G-4. P7 test boundary: 6 pass / 0 fail / 0 skip. Builder evidence only; P7 is uncleared.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P7 INVENTORY CORE SNAPSHOT ONLY]`:
  exact target `4169daba2169d5315b0743f651b88c51047d275e` passed review. The ten-role,
  sealed-read/census/identity/provenance/content/distinct-mother/seal/hash/realpath laws are
  fail-closed; structurally complete descriptors remain diagnostic and not integration-ready.
  This releases dependent P7 mutation/scale construction only. Live corpus, capture authority,
  budgets, runtime, mutation, scale, P7 phase/integration/promotion/cutover/Done remain uncleared.
- 2026-07-14 Builder P7 mutation/scale diagnostic core: transcribed the exact 34-row §14.3
  mutation census with one earliest owning gate and target seam; a diagnostic runner now binds
  actual before/after hashes and observed assigned refusal to an opaque process-local authority.
  The scale harness derives wall/CPU/RSS, output inventory/bytes, operation counts, and network
  counters, rejects inner-loop network use, and requires a unique increasing three-size series.
  Report hashes bind every run hash. Both proof classes are explicitly diagnostic and the module
  has no integration/promotion authority path. Full boundary: 124 pass / 0 fail / 0 skip;
  syntax checks green. Plugin corpus, capture/network authority, accepted hardware/budgets,
  runtime/editor evidence, real mutation execution, and P7 phase/integration/promotion/cutover/
  Done remain blocked. Builder evidence only; authoritative snapshot review required.
- 2026-07-14 @s58-pixel-meta-qa authoritative
  `[CLEAR — P7 DIAGNOSTIC EVIDENCE CORE SNAPSHOT ONLY]`: exact target
  `3bd8dbd9bc1ca9e443d27a85b95d91542f032932` passed review. The reviewer confirmed the
  closed 34-row mutation catalog, gate/seam ownership, canonical before/after hashes, opaque
  authorities, derived scale metrics/artifact inventories, meter enforcement, and hard
  non-promoting aggregate. Synthetic diagnostic only: plugin corpus, P1/P0 authority/budgets,
  live mutation/scale, P7 phase/integration/promotion/cutover/Done remain uncleared.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[REWORK — P8 CORE SNAPSHOT ONLY]`: exact target
  `14f03173bff67c1c2cf609b082cde8b7aaf4da12`; transaction/recovery/topology/concurrency/
  generation/dual-run areas credited closed. One V17 residual remained: promotion authority
  accepted any parseable asymmetric key instead of Ed25519 only. Builder reproduced the RSA-key
  acceptance failure-first, requires `asymmetricKeyType === ed25519`, and added a permanent RSA
  refusal mutation. Focused P8 16/16/0 and full boundary 140/140/0; syntax/diff checks green.
  This is repair evidence awaiting authoritative rereview, not P8 phase/integration/promotion/
  cutover/Done clearance.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P8 CORE SNAPSHOT ONLY]`: exact target
  `bc6c56e93ea13cef97e2b83356bbbbb4e206e07a`; strict Ed25519 authority validation and the
  permanent RSA refusal mutation close the only residual. Transaction/recovery/topology/
  concurrency/generation/dual-run areas remain closed. Clearance releases Studio UX integration
  only; P8 phase/integration/promotion/cutover/Done remain uncleared.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P8 STUDIO SNAPSHOT ONLY]`: exact target
  `60801e07bfffc3d41258ee4539ea01b1f1e39039`. Public-key-only configuration, closed runtime
  HTTP/CSP, truthful unconfigured state, diagnostic refusal, signed sandbox-only commit,
  cancellation/pointer preservation, escaped UI values, and legacy dual-run identity passed.
  Reviewer boundary 132/132/0 with syntax/diff/status green. Live configured integration, P8
  phase, promotion, cutover, and Done remain uncleared.
- 2026-07-14 @s58-pixel-meta-qa authoritative `[CLEAR — P9 CORE SNAPSHOT ONLY]`: exact target
  `fb41978480763b9f1472217ce8f476c87651d64a`. The isolated production-v1 namespace, distinct
  Ed25519 review/Dan authorizations, exact sandbox/corpus/budget/environment/base/rollback binding,
  immutable generation bytes, atomic activation/rollback, exact signed orphan adoption, debris
  preservation, and independent oracle passed review. Reviewer boundary 143/143/0 with syntax/
  diff/status green. Production configuration, live signatures, activation, P9 phase, cutover,
  promotion, and Done remain uncleared.
- 2026-07-14 @s58-pixel-meta-qa authoritative
  `[CLEAR — P0 HERMETIC GOLDEN REPAIR SNAPSHOT ONLY]`: exact target
  `8df8b1b179d6beadb09b825b36dc020a1215b956`. The committed synthetic fixture deterministically
  yields 60 IR nodes, three absolute children, one rotated child, and no structural refusals;
  structural, emission/id-map, and fresh-IR reverse laws passed. Reviewer focused boundary
  30/30/0 with syntax/diff/status green. This repairs only the lost gitignored golden; E1-E13,
  plugin corpus, P0 phase, integration, promotion, cutover, and Done remain uncleared.
- 2026-07-14 Builder P0 E1–E13 regression checkpoint: added a hash-pinned loader for the actual
  broken `6c36475f4b4afd04999cf6e110f8cb42c9b3e9a9` converter and hermetic microfixtures that
  reproduce every recovery row without relying on today's changed Shape cache. E1/E2/E7/E13
  distinguish the operating-delta corrections; E3–E6/E9/E10 remain visibly lossy in legacy and
  are conserved as Compiler v2 binding/render-plan facts with independent mutations; E8 proves
  the historical false-green reverse result; E11/E12 prove the historical non-atomic/unversioned
  source law and the sealed Compiler v2 snapshot refusal. The pass exposed and repaired one real
  adjacent gap: Compiler v2 now carries validated fixed-box text vertical alignment through P4,
  emits `align-content` through P5, and independently rejects missing/drifted output. Focused
  P0/P4/P5 boundary is 31/31/0. Full legacy + Compiler v2 rerun is 220/220/0; an initial full run
  had one transient pre-existing P8 SQLite first-open `database is locked` failure, the isolated
  race then passed and the complete rerun passed. This is Builder evidence awaiting sole
  authoritative @s58-pixel-meta-qa review; it is not plugin/integration evidence, P0 exit,
  promotion, cutover, or Done.
- 2026-07-14 Builder P0 editor-corpus checkpoint: P5 now emits asymmetric
  `rectangleCornerRadii` as four independently addressable CSS longhands while retaining a keyed
  bound corner as a token-expression segment. The EC2 edit changes only top-right radius plus
  source-map/manifest; bottom slots and bound top-left stay unchanged. The independent P5 oracle
  parses CSS and requires every captured corner declaration/segment. P6 now runs EC2 through
  rotated editor authority, deterministic rebuild, pinned-browser capture, and independent
  per-case oracle validation; a forged EC2 segment is refused. Focused P5/P6 boundary is 15/15/0;
  full legacy + Compiler v2 boundary is 220/220/0. EC3–EC8b runtime cases, plugin corpus, P0
  phase/integration, promotion, cutover, and Done remain open. Builder evidence awaiting sole
  authoritative @s58-pixel-meta-qa review.
- 2026-07-14 Builder withdrew the first EC2 snapshot `e3069b3` before review after the full
  immediate-caller audit found that Save-to-code's strict length grammar did not yet include the
  four new per-corner radius properties. Safe-but-invalid `red` could therefore pass the editor
  adapter. The replacement adds those exact properties to the existing nonnegative length grammar
  and pins a permanent refusal mutation. No broader editor grammar changed.
- 2026-07-14 Builder P0 full editor-corpus checkpoint: EC3–EC8b now join EC1/EC2 as executable
  microfixture evidence. Failure-first work exposed that capture sampled the pre-edit TokenPlan,
  that a length-changing token rebind rejected its equal-range CSS owner after mutating the target
  range in-place, and that binding identity alone did not prove the resolved runtime value.
  Capture now binds the exact edited package/build; Save-to-code compares every overlap against
  immutable original offsets; production and independent G13 parse the sealed emitted registry,
  `tokens.css`, and `token-values.ts` to require the full binding channel/context/target/value.
  All nine cases pass and per-case wrong-channel/value/segment/owner/build/overwrite mutations
  refuse. Focused P5/P6 boundary is 15/15/0. This remains synthetic microfixture evidence; live
  plugin-origin EC4/EC5, G-1/G-2, P0 phase/integration, promotion, cutover, and Done stay open.
- 2026-07-14 Builder P0 operability-core checkpoint: added a diagnostic-only §4.7/V18 meter with
  eight ordered visible phases, monotonic counts, per-phase/aggregate resource and transfer data,
  one bounded F/D/V instability retry, immediate in-flight cancellation, active-file refusal,
  actionable dependency failures, and before/after persistent-state proof. Production validation
  and an independent test oracle rederive request ownership/totals, stability from V/F/D triplets,
  retry/instability rates, and terminal truth; re-hashed label/metric/phase lies refuse. Focused
  boundary 8/8/0. No live capture transaction, accepted limits, remote-heavy evidence, P0/P1 phase,
  integration, promotion, cutover, or Done claim.
- 2026-07-14 Builder P0 fidelity-calibration-core checkpoint: added a deterministic, diagnostic-
  only §13.3 draft builder and independent oracle. The core requires all eight contracted classes,
  distinct Shape/mother sources, synchronized source/environment/corpus/reference/package/build
  identities, production builds without dev badges or approximation masks, repeat distributions,
  linked known-broken mutations, named zero-area exclusions, explicit metric definitions and
  thresholds, Wilson 95% confidence, and derived false-pass/false-fail analysis. Missing classes
  are FAILED_CAPTURE; overlap is FAILED_VISUAL; observed separation is only
  CANDIDATE_SEPARATED/DIAGNOSTIC_ONLY and carries QA/Meta/Dan blockers. Focused 6/6/0. No real
  calibration samples, accepted values, normative file, P0 phase, integration, promotion,
  cutover, or Done claim.
- 2026-07-14 Builder P1 capture-core checkpoint: added the real V0→A→B→V1→references→C→V2→seal
  orchestration over the P0 operability meter. The core derives F0/F1/F2 and D0/D1/D2 from
  canonical semantic/asset/dependency content; binds root file/branch/page/selection/color-profile
  identity and versioned root locks; requires the exact plugin-complete source-plane census,
  complete supplement rows, closed node/backdrop/external boundary dispositions, confined assets,
  pinned font provenance, exact authorized REST reference request/version/bytes, and zero
  forbidden/dynamic/documentchange audit evidence. One instability retry, active-file drift,
  typed permission failures, cancellation, and persistent-state drift all discard the candidate.
  Production validation plus an independent report oracle reject re-sealed identity/authority/
  promotion lies; the candidate is rechecked against F2/D2 and its byte hashes. Focused 10/10/0;
  full legacy + Compiler v2 boundary 244/244/0. The result is deliberately in-memory,
  `DIAGNOSTIC_ONLY`, `persisted:false`, and blocked by the accepted operator envelope plus external
  plugin-capture authority. No live plugin capture, evidence snapshot, P1 phase, integration,
  promotion, cutover, or Done claim.
- 2026-07-14 Builder P1 adapter-authority checkpoint: added a deterministic TypeScript-AST audit
  over the exact built adapter bytes plus an external, public-key-only Ed25519 receipt verifier.
  The audit requires one exported `createCaptureAdapter(figma)` capability boundary; refuses
  imports, ambient runtime globals, computed/dynamic access, indirect calls, property writes,
  nested assignment targets, invalid UTF-8, and the captured Figma mutation/import families; and
  records exact call/property inventories. The signed receipt binds authority, scope, bundle hash,
  audit hash, and a maximum seven-day validity window. Production re-parses the bundle and
  re-verifies the receipt for every proof/runtime use; the independent oracle re-hashes audit,
  receipt, public key, bundle, and verification time. Runtime composition additionally requires a
  zero-event `documentchange` window covering the verified capture instant. Mutation coverage
  includes document APIs, alias/dynamic/global escapes, malformed bytes/time, RSA/substituted keys,
  receipt/audit/bundle drift, proof lies, and observer drift/events. Focused 4/4/0; full compiler-v2
  199/199/0 plus legacy 49/49/0 = 248/248/0. This is a diagnostic authority mechanism only: no
  separately reviewed/signed live adapter, plugin capture, evidence snapshot, accepted envelope,
  P1 phase, integration, promotion, cutover, or Done claim.
- 2026-07-14 Builder P1 plugin-reader checkpoint: added the actual import-free, read-only Figma
  plugin reader plus a separate host normalizer. The plugin captures one exact JSON_REST_V1 root,
  complete node supplement rows, resolved/explicit modes, full styled-text segments, native
  component/instance semantics, local and referenced alias variables/collections, image bytes,
  declared SVG exports, file/page/color-profile identity, and documentchange evidence. It cannot
  mint file-version/branch locks or licensed web-font bytes: the host independently supplies and
  conserves those authorities before any plugin-complete source-plane label exists. The normalizer
  requires one root per transaction; exact node/image/SVG/mode/component/variable census; pinned
  font bytes and UTF-16 range coverage; confined collision-free assets; and a matching versioned
  dependency boundary. The actual bundle passes the static adapter audit and its output passes the
  existing three-pass P1 transaction. An independent oracle bites document, supplement, variable,
  component, asset, font, root-lock, and provenance substitutions. Focused P1 boundary 8/8/0;
  full Compiler v2 203/203/0 plus legacy 49/49/0 = 252/252/0. This remains synthetic diagnostic
  evidence: the adapter bytes have no external integration receipt, no live plugin-origin Shape
  capture exists, and P1 phase/integration/promotion/cutover/Done remain open.
