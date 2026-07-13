# C11 Production Stress Test

**Status:** Evidence companion to C11 v3; non-governing; no implementation authorization

**Date:** 2026-07-13

**Converter baseline:** `6c36475f4b4afd04999cf6e110f8cb42c9b3e9a9`

**Reviewed contract:** unified C11 v2.1, 280 lines, SHA-256
`aa2b3a62be3e1681876ddd4109b3a94834e9950dac355980c9b5c607533e717c`

**Independent precursor:** C11R v1.0, 524 lines, SHA-256
`c98bdaa53353f2a9c8722ae41593b8903a5a2bfd253002ca986e7370c5706370`

**Governing decision document:** `C11-CONTRACT-V3.md`

## 1. Executive verdict

**FIX-FIRST. Do not execute C11 v2.1 unchanged.**

C11 v2.1 is the correct recovery contract for the failures already exposed by Shape. It is not
yet a production contract for the requested product: Figma-agnostic screens, native components,
arbitrary variable systems, modern multilayer rendering, and token-safe regeneration.

The decisive issue is scope, not polish. C11 rebuilds a lossless binding boundary around the
current screen emitter. The product requires a versioned compiler model for all of these separate
domains:

1. document and layout semantics;
2. variables, aliases, modes, and bindings;
3. components, variants, properties, instances, and overrides;
4. rich text ranges;
5. ordered paint, effect, clipping, masking, and compositing groups;
6. deterministic React/CSS/SVG lowering;
7. independent structural, token, security, and rendered proof.

Without those models, the next valid Figma feature can still disappear with a green result.

**Recommended route:** build a clean Compiler v2 fidelity core. Reuse existing URL parsing,
packaging, Studio, or lowerers only after each candidate passes the new independent corpus. Do not
rewrite the entire tool shell, and do not preserve the current IR as the architectural center.

## 2. Meaning of the brief

This review uses the following explicit interpretation:

- **Pure React/CSS code** means editable React components and CSS Modules, with inline SVG where
  SVG is the browser-native exact representation. A screenshot or opaque full-screen SVG is not a
  promotable conversion.
- **Token-safe** means a bound Figma value stays a live token expression. Token value, mode, or
  name changes cannot silently bake a color or number into component code.
- **Component conversion** means preserving native Figma component identity, variant axes,
  property definitions, instance values, nested references, and overrides. Flattening an instance
  into anonymous divs is not component conversion.
- **Closest to 100%** means exact identity for structure, bindings, order, state, and geometry,
  plus strict class-specific visual budgets under a pinned renderer. It does not mean claiming
  universal pixel identity where Figma itself documents browser/OS text variance.
- **Agnostic** means no ONEMO names, screen names, paint counts, theme assumptions, or carrier
  paths in compiler core. It does not mean guessing semantics that Figma does not expose.
- **Production** means deterministic, secure, source-mapped, versioned, observable, fail-closed,
  and able to regenerate after document or token changes.

Three interpretations were possible:

| Interpretation | Outcome |
|---|---|
| Fix Shape only | Rejected: too narrow. |
| Make the existing emitter accept more carriers | Rejected: still loses unmodeled domains. |
| Build a general compiler with an explicit capability frontier | Selected. |

## 3. Evidence reviewed

### 3.1 Current work

- Pixel transcript: 774/774 lines read.
- Unified C11 v2.1: 280/280 lines read.
- Pixel C11R v1.0: 524/524 lines read.
- Converter implementation, tests, CLI, Studio, audit UI, config, and docs: 49 text files,
  5,967 lines read.
- Kai implementation delta at Meta close: five tracked files, 2,578 insertions and 229 deletions,
  pinned as a 215,112-byte binary diff with SHA-256
  `b8a0df9dabaf01d3feee123d1f3507c28a630f829acd951f0da83b9e725fed96`.
  The four converter patches add exact iframe sizing, fixed-box text vertical alignment,
  carrier-local paint/gradient token reads, and a narrower image-inversion heuristic mirrored by
  the reverse reader. The fifth file regenerates the token bundle from 1,675 to 3,998 lines and
  1,437 to 3,989 custom-property declarations. These are meaningful Shape fixes; they do not
  implement the Compiler v2 contract.

### 3.2 Executed probes

**Whole Shape traversal:** 209 visible nodes, depth 10, 93 vector nodes, 67 non-identity
transforms, 10 masks, 26 gradients, 11 effects, and 14 corner-smoothing nodes.

The same traversal proves Shape is not a general corpus: it contains no instances, mixed text,
GRID layout, or explicit mode overrides.

The raw file contains 761 `VARIABLE_ALIAS` occurrences and 53 unique variable ids. The persisted
3,281-entry lightweight bridge dump strips entries to `name` and `collection`; that artifact alone
contains no stable key, `codeSyntax`, `valuesByMode`, or remote flag and cannot prove mode/token
identity. This is not a from-zero capture problem: the current bridge payload already carries
`valuesByMode` plus collection/mode data, and `ds-export.mjs` consumes those fields. P1 must retain,
version, and complete that existing plane rather than treating the stripped dump as all the bridge
can provide.

**Synthetic current-compiler probe:** a valid fixture containing GRID, mixed text, a luminance
mask, an instance with component properties, a node-local mode override, paint-local bindings,
bound opacity, and bound shadow fields produced this result:

| Feature | Current IR result |
|---|---|
| root and node mode contexts | discarded |
| GRID | discarded; child changed to absolute positioning |
| mixed text runs | collapsed to one uniform text style |
| mask type and mask role | discarded |
| component id and properties | discarded |
| paint-local variable | discarded; compacted metadata id selected instead |
| bound opacity | discarded; raw `0.85` retained |
| bound effect fields | discarded |
| refusals | zero |

This is a silent-loss proof, not a theoretical concern.

**Clean-baseline test suite:** 46 passed, 3 failed, 0 skipped. All three failures depend on the
missing gitignored legacy fixture
`cache/t88thL8hKksSpILgkeGRZ0-4084-25997.nodes.json`. The current Shape input is not the golden
integration fixture.

### 3.3 Live Shape check after the implementation fixes

The live Studio is Kai's exact worktree (`node studio/server.mjs` on `:3900`, Next on `:3077`).
Its active draft is `shape`, 402x874. The current audit JSON reports 119 elements, 78% coverage,
zero refusals, zero token drift, and zero ledgered approximations. Those are audit-structure facts,
not a pixel-fidelity percentage.

The latest evidence is not an atomic visual pair: `shape.json` was regenerated at `19:41:57`, the
Figma capture at `19:42:05`, while `shape-build.png` remains from `19:33:50`. Therefore the current
console cannot honestly substantiate a measured 98% result. Original-resolution inspection of the
earlier captures showed closely aligned geometry, content, assets, and controls, but also opaque
black background bands in the build where the Figma viewer presented white/transparent regions.
That discrepancy and the stale pair must be resolved before visual promotion.

Meta interpretation: the fixes materially improve the Shape fixture and should be retained as
regression cases. They do not change the architectural verdict because Shape still omits native
components, mixed text, GRID, nested modes, open token domains, and independent non-circular
proof. A near-exact fixture is evidence for its covered features, not evidence of product
universality.

## 4. What C11 v2.1 gets right

These parts should be preserved:

1. Atomic, version-stamped evidence capture before IR construction.
2. Recursive raw alias inventory with unknown carriers fatal.
3. Canonical binding records and exact identity conservation.
4. No raw fallback for a bound property.
5. Property codecs rather than string substitution.
6. Explicit paint order, token-aware SVG, and full affine transforms.
7. Machine-readable emission source maps.
8. Independent raw-data gates instead of emitter checking itself.
9. Core/policy separation.
10. Mutation tests, scale tests, staged dual-run migration, and Dan-gated cutover.

Those are necessary foundations. They are not sufficient product coverage.

## 5. Blocking findings

### P0. The contracted product excludes the required component system

C11's non-goals include component deduplication (`C11-CONTRACT.md:278`), but it never replaces
that with a native Figma component graph. Current IR explicitly flattens `INSTANCE` nodes
(`src/ir.mjs:350`).

Figma exposes component sets, `VARIANT`, `BOOLEAN`, `TEXT`, and `INSTANCE_SWAP` definitions,
instance property values, nested property references, component ids, and overrides. They need a
first-class model, not visual similarity heuristics. See Figma's
[component property documentation](https://developers.figma.com/docs/plugins/api/properties/ComponentPropertiesMixin-componentpropertydefinitions/)
and [REST component/instance fields](https://developers.figma.com/docs/rest-api/file-node-types/).

**Failure mode:** a visually correct screen can still ship as duplicated anonymous markup whose
variants, props, and future component edits do not propagate.

### P0. Root-only variable mode resolution is incorrect

C11 resolves alias chains under the root's per-collection mode context
(`C11-CONTRACT.md:122-128`). Figma's effective modes are node-specific: explicit modes inherit
from ancestors and a descendant can override another collection or the same collection. Figma
documents this in
[`resolvedVariableModes`](https://developers.figma.com/docs/plugins/api/properties/nodes-resolvedvariablemodes/).

**Failure mode:** the same variable used by two subtrees can legitimately resolve to different
values while C11 proves both against one root context.

### P0. Rich text has no lossless representation

Current IR reads one `node.style` and the first text binding (`src/ir.mjs:210-229`). C11 lists
typography codecs but no range graph, segment identity, list structure, hyperlinks, mixed fills,
OpenType features, or range bindings.

Figma's
[`getStyledTextSegments`](https://developers.figma.com/docs/plugins/api/properties/TextNode-getstyledtextsegments/)
returns range-specific font, fill, list, hyperlink, binding, and OpenType fields.

**Failure mode:** mixed typography and tokenized text ranges flatten without any binding-count
gate noticing the semantic loss.

### P0. Modern layout coverage is absent

Current `layoutOf` accepts only `HORIZONTAL` and `VERTICAL` (`src/ir.mjs:190-206`). Valid GRID
degrades to absolute positioning. C11 has no coverage registry or lowerer for GRID, grid spans,
wrapped-track alignment, reverse z-order, `strokesIncludedInLayout`, min/max height, constraints,
or overflow behavior.

Figma's current REST schema explicitly includes GRID tracks, gaps, spans, anchors, and auto-flow:
[Figma node types](https://developers.figma.com/docs/rest-api/file-node-types/).

**Failure mode:** a new layout feature is treated as ordinary no-auto-layout geometry instead of
unsupported, so output may look acceptable at one width and break immediately elsewhere.

### P0. One semantic tree cannot also be the exact render tree

C11's paint law permits a pseudo-element for an unrepresentable paint
(`C11-CONTRACT.md:149-156`) but does not define an arbitrary render-fragment model. A browser has
only two pseudo-elements per element. Arbitrary paint/effect/mask stacks need zero, one, or many
auxiliary render fragments, sometimes inline SVG/filter/mask groups.

The W3C compositing model fixes operation order as filter, clip, mask, blend, then composite, and
defines isolation/stacking behavior. Background layers blend only within the element's isolated
background group, not as arbitrary scene layers. See
[Compositing and Blending Level 1](https://www.w3.org/TR/compositing-1/).

**Failure mode:** forcing all visuals onto one DOM element changes the backdrop, isolation, clip,
or mask behavior. Adding screen-specific wrappers later recreates the current slop.

### P0. Masks and clipping groups are named, not contracted

C11 invariant I6 says mask order is preserved, but there is no mask IR, lowering algorithm,
source-map shape, capability rule, or fixture. Shape itself has ten masks. CSS and SVG masks create
their own group semantics; a boolean `isMask` cannot be emitted as a normal rectangle.

See [CSS Masking Level 1](https://www.w3.org/TR/css-masking-1/) and the W3C compositing order above.

### P0. Generic variables without WEB syntax are rejected

C11 resolver order is WEB code syntax, ONEMO policy, then `unsupported-bound`
(`C11-CONTRACT.md:112-120`). That is fail-closed but not Figma-agnostic. Valid external files often
have variables and modes but no web code syntax.

The core needs a persistent identity registry keyed by Figma's stable variable key. On first
capture it may generate a collision-proof custom property name and emit the corresponding token
bundle. A rename must not change that mapping silently. Figma's Variables API exposes stable
`key`, type, `valuesByMode`, remote status, scopes, and `codeSyntax`; access constraints must also
be explicit. See the
[Variables REST endpoint](https://developers.figma.com/docs/rest-api/variables-endpoints/).

### P0. One `cssVar` cannot preserve typed destination semantics

C11 binding records contain one `cssVar` string (`C11-CONTRACT.md:103-107`). Destination codecs
are required, but the IR needs to retain the result as a typed token expression, not prematurely
collapse it to a string.

Examples:

- Figma opacity variable `85` needs `calc(var(--opacity) / 100)` or a normalized emitted token.
- One FLOAT can be legal as a length for padding but illegal as a unitless font size.
- A bound shadow segment needs a token reference inside a structured shadow expression.
- A mode-aware alias may resolve through several collections while preserving the original token
  identity in output.

The deeper Meta issue is destination multiplicity. One FLOAT variable can legally feed length,
opacity, and unitless destinations, which require different serialized values. One raw custom
property value is not directly legal in all three, and scattering ad hoc wrappers through
component CSS makes type/change proof local and fragile. Compiler v2 therefore contracts explicit
per-destination channels under one Figma variable key.

CSS is also not the right state plane for every variable. Figma permits variable bindings to
`characters`, `visible`, and `componentProperties`. STRING/BOOLEAN values that change content,
structure, or React props need generated typed token/state data and a pure local resolver; they
cannot be preserved by emitting inert CSS text. See
[VariableBindableNodeField](https://developers.figma.com/docs/plugins/api/VariableBindableNodeField/)
and [`boundVariables`](https://developers.figma.com/docs/plugins/api/properties/nodes-boundvariables/).

**Failure mode:** a converter can pass binding-id conservation while emitting syntactically valid
but semantically wrong CSS.

### P1. The capture source is insufficiently specified

The current bridge dump is demonstrably not a variable catalog. C11 says dump local and remote
variables but does not assign a canonical source for node-local modes, rich text, component
semantics, or plugin-only fields.

Recommended evidence boundary:

1. Plugin-primary node capture through `exportAsync({format: 'JSON_REST_V1'})` behind an adapter
   that exposes no mutation/import API.
2. Plugin semantic supplement for resolved modes, styled text, components, variables, and fonts.
3. Three complete capture/validation passes plus a dependency lock for remote libraries, font
   registry, assets, and reference identities; a stable key alone is not atomic evidence.
4. A closed render boundary including required ancestors, backdrops, overlaps, and blend context.
5. REST version and render export as an independent cross-check, not the sole semantic source.
6. Static forbidden-call/dynamic-access proof plus zero runtime `documentchange` events.
7. Separate Figma font identity from the approved pinned local web-font mapping, hashes, and
   provenance; use glyph/render proof because Figma does not expose its font bytes.
8. Map every visually promoted runtime state to an authored reference root at a pinned file
   version. REST image export accepts a version, not an arbitrary variable-mode matrix.

Figma documents JSON REST export from a plugin in
[`exportAsync`](https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/), font
availability through the [Plugin `figma` API](https://developers.figma.com/docs/plugins/api/figma/),
and pinned image rendering in the
[REST file endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/).

**Failure mode:** a supposedly immutable capture can alter its own source, mix changing library
evidence, omit the backdrop a blend depends on, claim a substituted font as exact, or visually
approve a generated state for which no Figma reference ever existed.

### P1. The visual gate can preserve today's false confidence

C11 G6 says "over-budget residual" but does not replace the existing budget. Current production
code defaults to 10% mismatched pixels (`audit/fidelity-gate.mjs:83` and
`audit/console.html:155`) and permits approximation masks. That is incompatible with a claimed
near-1:1 converter.

Required split:

- identity/order/mode/structure: zero tolerance;
- computed geometry: subpixel tolerance under a pinned renderer;
- flat/vector regions: strict pixel, SSIM, and DeltaE limits;
- text: exact line breaks and glyph bounds plus a separate raster metric;
- no mask may hide a converter approximation.

Figma itself warns that SVG `<text>` rendering varies by browser/OS and does not guarantee visual
accuracy, while outlined text loses live text semantics. See
[Figma export settings](https://developers.figma.com/docs/plugins/api/ExportSettings/). The
contract must report this boundary honestly, not hide it inside one global residual.

### P1. Shape cannot certify an agnostic compiler

Shape is an excellent regression fixture for bindings, paint order, masks, vectors, and
transforms. It has no components, mixed text, GRID, or nested mode contexts. Passing Shape proves
only the features Shape contains.

A versioned capability matrix and diverse hermetic corpus must be the release gate. One golden
screen can never be the universality proof.

### P1. Responsive behavior cannot be inferred from one fixed frame

C11 explicitly excludes responsive-law redesign. That is reasonable for recovery but incomplete
for a production screen/component tool. Figma geometry can prove exact output at a declared
viewport; it cannot always reveal an author's intended breakpoint behavior from one frame.

The compiler must map deterministic auto-layout/constraint semantics and otherwise require
multiple authored states or explicit policy. It must never invent breakpoints and call them 1:1.

### P1. Generated SVG and CSS need a security boundary

The contract has no sanitizer or untrusted-input model. Generated SVG can contain links,
`foreignObject`, ids, URL references, and attributes that must not be copied blindly. Figma text,
layer names, code syntax, and URLs also enter generated files.

Required controls include an SVG element/attribute allowlist, local-only asset URLs, CSS custom
property validation, CSS parsing, text escaping, path confinement, resource limits, and no raw
HTML. React explicitly warns that untrusted raw HTML can create XSS:
[React common components](https://react.dev/reference/react-dom/components/common).

### P1. Exactness needs a capability frontier, not a universal promise

Some Figma behavior is proprietary, raster-dependent, font-dependent, or not exposed with enough
parameters for a live web reconstruction. "100% for every valid file" is therefore not an honest
engineering claim.

The production guarantee should be stronger and narrower:

- every captured feature is classified;
- every bound value remains live or blocks promotion;
- every supported feature passes exact structural and strict rendered gates;
- every unsupported feature is named with source location and reason;
- diagnostic raster/SVG fallback is never mislabeled token-live production output.

## 6. Scenario stress matrix

Legend: **PASS** contracted; **PARTIAL** direction exists but required semantics/gate missing;
**FAIL** can be lost, rejected despite valid input, or falsely green.

| Scenario | Legacy | C11 v2.1 | Compiler v2 target |
|---|---:|---:|---:|
| Shape paint/binding/transform defects | FAIL | PASS by contract | PASS |
| arbitrary names with WEB syntax | PARTIAL | PASS | PASS |
| arbitrary names without WEB syntax | FAIL | FAIL | PASS via stable registry |
| token-only value change leaves component code stable | PARTIAL | PARTIAL | PASS; code hash stable |
| token rename with stable Figma key | FAIL | FAIL | PASS; registry stable |
| one FLOAT used as length, opacity, and number | FAIL | FAIL | PASS via per-domain channels |
| STRING/BOOLEAN-bound content, visibility, or props | FAIL | FAIL | PASS via typed React data |
| descendant mode override | FAIL | FAIL | PASS; node effective context |
| scoped descendant mode in generated runtime | FAIL | FAIL | PASS; scoped context plan |
| cross-collection aliases and cycles | FAIL | PASS at root | PASS per node/context |
| component set and variant props | FAIL | FAIL | PASS |
| generated component advertises every authored variant | FAIL | FAIL | PASS or fail closed |
| nested instance overrides/swap | FAIL | FAIL | PASS |
| mixed text, lists, links, range tokens | FAIL | FAIL | PASS |
| GRID and grid child placement | FAIL | FAIL | PASS |
| arbitrary multi-paint opacity/blend | FAIL | PARTIAL | PASS via render fragments |
| vector/luminance masks | FAIL | FAIL | PASS via render graph |
| full affine nested transforms | FAIL | PASS by contract | PASS |
| remote variable unavailable | FAIL late | PASS fail-closed by contract | FAIL closed at snapshot |
| unknown new visual carrier | FAIL silent | PASS classification | PASS capability gate |
| approved pinned web-font mapping/bytes and color profile | FAIL | PARTIAL | PASS or diagnostic-only |
| unreadable remote component without source mutation | FAIL late | PARTIAL | FAIL closed |
| remote dependency changes under a stable key | FAIL silent | FAIL | FAIL closed at G0 |
| selected subtree depends on external backdrop/overlap | FAIL silent | FAIL | PASS with closed boundary or fail closed |
| runtime state without authored Figma reference | false green | PARTIAL | diagnostic-only |
| malicious SVG/CSS/text input | FAIL | FAIL | PASS sanitizer gates |
| one fixed frame at one viewport | PARTIAL | PARTIAL | PASS for declared state |
| inferred responsive breakpoints | guessed | excluded | unsupported unless authored |
| deterministic large file | unproven | PASS by contract | PASS with measured budgets |

## 7. Architecture route decision

| Route | Reliability | Risk | Decision |
|---|---|---|---|
| Patch current IR/emitter | Low. Every new field needs another local patch; unknown domains remain invisible. | Lowest initial effort, highest recurring breakage. | **Reject.** |
| Execute C11 v2.1 unchanged | Medium-high for Shape-like screens; incomplete for required components and modern features. | Builds a stronger boundary around an underspecified domain model. | **Reject unchanged.** |
| Full clean-room tool including CLI/Studio | Potentially high, but throws away useful shell code and delays proof. | Large migration and product risk. | **Reject.** |
| Clean Compiler v2 fidelity core; verified adapter reuse | Highest. New core is not constrained by lossy IR; shell reuse remains possible. | More architecture work before visible output, but risks are isolated and measurable. | **Recommend.** |

## 8. Required decision before implementation

Use the single governing `C11-CONTRACT-V3.md` before any Compiler v2 implementation begins.
C11 v2.1 and the former counterproposal remain evidence/history, not co-governing contracts.

The first build must be an isolated vertical slice, not another production patch. P0 must first
pin a synchronized corpus, calibrate class-specific visual budgets, and establish the capture
operator envelope. The slice must include the same real current ONEMO mother screen selected at
P0 and prove:

1. enforced read-only, three-pass dependency-locked capture, closed render boundary, and per-node
   modes;
2. arbitrary non-ONEMO tokens with no WEB syntax and one FLOAT across incompatible destinations;
3. STRING/BOOLEAN content, visibility, and component-prop bindings through typed React data;
4. token mutation without component-code churn;
5. one complete real component set with all property types and nested instance override;
6. mixed text with range bindings and an approved pinned web-font mapping/bytes;
7. GRID plus mask/compositing;
8. multilayer paint/effect lowering through source-mapped render fragments;
9. pinned authored references for every visually promotable state;
10. remote-dependency drift and omitted backdrop/overlap evidence rejected at G0/G1;
11. every semantic element/component and auxiliary render fragment remains source-addressable,
    with decorative fragments selectable through their semantic owner plus `fragmentId`;
12. select/edit/Save-to-code resolves the exact declaration or expression segment and produces a
    localized deterministic diff without damaging component identity, source maps, scoped modes,
    or render-fragment ordering;
13. failed, cancelled, restarted, or generation-conflicted compiles cannot commit token-registry
    naming; the registry and promoted package commit or roll back together;
14. local and remote-heavy capture stays inside the P0 duration/byte envelope and exposes useful
    progress, bounded retry, cancel, active-file-instability handling, and actionable dependency
    failures;
15. every deliberate mutation is rejected by the independent gate assigned to it.

Until that slice passes QA and Meta, the best possible architecture remains a hypothesis. C11
v2.1 implementation and production cutover are not approved by this review.

## 9. Meta closure against the brief

| Original requirement | Decisive failure in existing work/C11 | Compiler v2 closure | Implementation truth |
|---|---|---|---|
| agnostic screens | lossy fixed IR and incomplete capability surface | Figma Design source boundary plus canonical/capability graphs | unbuilt; G1/G6/corpus required |
| native components | instances flatten; no complete public variant model | complete component graph and G4 | unbuilt; full component-set fixture required |
| arbitrary tokens | name policy/one `cssVar`; root-only modes | stable per-domain CSS/React channels and scoped contexts | unbuilt; G2/G3/G9 required |
| token changes do not break output | values bake or naming churns component code | token artifacts regenerate independently by stable key | unbuilt; hash-locality mutation required |
| new screens fail safely | unknown properties can disappear with zero refusal | versioned capability frontier; unknown is fatal | unbuilt; schema mutations required |
| modern multilayer 1:1 | one semantic tree and limited pseudo-elements | separate semantic and render/compositing graphs | unbuilt; G6/G7/G11 required |
| pure React/CSS | legacy output is editable but lossy | React/CSS Modules, inline sanitized SVG, pure local state data | unbuilt; G8 required |
| ONEMO select/edit/save loop | v2.1 dropped SPEC AC8 and did not contract fragment ownership or byte-local writes | source-addressable semantic/component/fragment maps plus exact declaration/expression edits | unbuilt; G13 and editor corpus required |
| closest honest accuracy | 10% global residual and circular/static green | exact identity gates plus calibrated class-specific visual floors | unbuilt; authored-state G10/G11 required |
| stable token identities | missing destinations can churn persistent naming even when a candidate fails | staged registry delta plus atomic package/registry promotion, rollback, and generation conflict checks | unbuilt; V17/G3/G9 required |
| capture operability | correctness passes can make active design work routinely fail or stall without product UX | measured local/remote-heavy envelopes plus progress, retry, cancel, instability, and dependency failure UX | unbuilt; P0/V18/G0/G12 required |
| uninterrupted daily design | a long replacement program could freeze the converter Dan uses now | legacy operating lane and truth-fixes continue until verified corpus proof, rollback exercise, and Dan cutover | contracted only; P8/P9 and Dan required |
| production reliability | stale evidence, missing dependency/boundary/security/provenance/scale proof | enforced read-only dependency-locked capture, closed render boundary, provenance, security, determinism, scale | unbuilt; G0/G8/G9/G12 required |

Meta conclusion: the unified v3 contract closes the eight Kai/Pixel decision-package blockers on
paper without claiming implementation: single-contract governance, operating-product continuity,
real mother-screen value, accurate bridge scope, ONEMO editor round trip, calibrated promotion
truth, transactional registry naming, and capture operability. C11 v2.1 remains `FIX-FIRST`; v3
has completed full-read self-audit and now requires adversarial re-review followed by Dan's
architecture decision.

## 10. Review status

- **Builder:** evidence report authored; single v3 governing contract merged after both REWORKs.
- **QA:** evidence report complete; full v3 self-audit complete; independent re-review pending.
- **Meta:** Kai and Pixel conceded the architecture direction; their eight decision-package
  blockers are integrated in the single v3 candidate, ready for resubmission. Live Shape gains
  remain recorded without converting an unsynchronized visual pair into a fidelity claim.
- **Dan:** final architecture decision only; no task is Done before Dan sign-off.
