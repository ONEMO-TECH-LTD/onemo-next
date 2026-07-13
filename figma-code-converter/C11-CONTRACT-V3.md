# C11 — Figma Compiler Product Contract v3.0 (unified)

**Supersedes:** unified C11 v2.1 and the Compiler v2 counterproposal

**Evidence companion:** `C11-PRODUCTION-STRESS-TEST.md` (non-governing)

**Status:** Adversarial re-review candidate; single governing contract; no implementation authorization

**Product:** Figma screens, native components, variables, and visual states to editable React,
CSS Modules, and inline SVG

**Priority:** correctness, change safety, and explicit failure over conversion rate or speed

## 0. Decision

Build a clean fidelity core beside the legacy converter. Reuse existing shell modules only after
they pass the new independent corpus.

```text
Plugin Primary Capture + REST Cross-Check
  -> Immutable Evidence Snapshot
  -> Canonical Figma Graphs
  -> Capability Planner
  -> Semantic/Layout IR + Render/Compositing IR
  -> React/CSS/SVG Lowerers
  -> Source-Mapped Production Package
  -> Independent Static + Runtime State Matrix
  -> PROMOTABLE_VERIFIED or named failure
```

This is not a patch series around `src/ir.mjs`. It is also not a greenfield rewrite of Studio,
the CLI, and packaging. The compiler boundary is new; every reuse candidate earns reuse through
the same gates as new code.

This file is the **only governing C11 contract**. It absorbs the verified recovery evidence,
binding laws, product architecture, delivery gates, and process rules from the two superseded
documents. The stress report and prior contracts remain evidence/history only. If wording
conflicts, this v3 contract wins. Dan signs one contract, not a supersession pair.

### 0.1 Product continuity before cutover

The legacy converter remains Dan's operating tool for daily ONEMO design work until Compiler v2
is `PROMOTABLE_VERIFIED` on the required ONEMO corpus and Dan explicitly authorizes cutover. P0
does **not** revert, freeze, or delete the working legacy path. The current seven narrow
truth-fixes remain permitted operating behavior:

1. carrier-local solid-fill binding reads;
2. carrier-local fill-gradient stop bindings;
3. carrier-local stroke-gradient stop bindings;
4. token-preserving non-bottom solid emission;
5. no inversion heuristic on token-bound image surfaces;
6. fixed-box vertical text alignment;
7. audit preview defaulting to the converted frame's exact dimensions.

The matching reverse-reader inversion branch may remain as a serialization check; it is not an
independent fidelity oracle. Further legacy fixes are allowed only when they correct observed
source truth, include a regression/mutation proof, do not invent screen-specific product law, and
do not claim Compiler v2 coverage. They ship through the normal Builder -> QA -> Meta -> Dan
pipeline without waiting for the v2 program.

Compiler v2 builds beside legacy under an explicit version switch and writes only to a versioned
sandbox. A failed or diagnostic v2 run cannot overwrite the last promoted legacy screen. Legacy
removal happens only at cutover after the full ONEMO corpus passes and a rollback package exists.

### 0.2 Recovery evidence absorbed

E1-E12 were verified against the Shape snapshot and source. E13 was verified after v2.1 was
written from Shape's fixed 16px text boxes, 12px line height, `textAlignVertical:CENTER`, and the
current surgical correction. A current operating fix does not retire an evidence row; every row
becomes a permanent regression and mutation target.

| ID | Figma/source truth | Broken baseline output | Failure mechanism |
|---|---|---|---|
| E1 | root SOLID bound to `bg/app/primary` | baked single-color gradient | compacted `boundVariables.fills` indexed against filtered visible fills instead of the carrier |
| E2 | Spec-Pill gradient has two bound stops | stop colors baked | flattened compacted fill metadata used; stop-local bindings ignored |
| E3 | Effect Card shadow radius/spread/color/offsetY bound | raw `box-shadow` segments | effect-local bindings ignored |
| E4 | five tab opacities bound | raw `opacity: 0.85` | node opacity binding ignored |
| E5 | 60 per-side stroke-weight slots bound | raw pixel widths | keyed individual-stroke bindings ignored |
| E6 | menu affine matrix represents clockwise 90 degrees in screen coordinates | mirrored/counter-rotated rail | scalar rotation plus sign heuristic replaced the matrix |
| E7 | ground is a light silver slab | near-black in every scheme | baked E1 layer combined with the difference-inversion heuristic |
| E8 | E1-E7 shipped with green reports | 80% conformance, zero unresolved | reverse proof re-derived shared emitter logic; binding/background-image gaps outside proof |
| E9 | grain IMAGE is above the bound solid | layer order inverted | REST and CSS are top-first but emitter treated source paints as bottom-first |
| E10 | 71 vector nodes carry bindings on the SVG root | root paints baked | token-aware vector scan skipped depth zero |
| E11 | opacity tokens exist in the captured catalog | token definitions absent from `tokens.css` | dump and token build were non-atomic; refresh failures could be swallowed |
| E12 | fidelity pair and SVG assets belong to one file version | stale/unpaired captures or cross-version assets possible | capture was fire-and-forget and asset cache lacked version/content identity |
| E13 | fixed-box text respects Figma vertical alignment | 12px line rode about 2px high inside 16px pill labels | vertical alignment was captured but not lowered; CSS defaulted to top alignment |

Confirmed non-defects remain evidence too: the sampled raw `10px`/`178px` values are unbound, and
the two hashed remote ids occur on non-emitting paragraph spacing. V3 still requires an explicit
disposition; it does not relabel unbound authoring debt as a compiler loss.

### 0.3 Adopted recovery-law map

The v2.1 I1-I10 laws are incorporated here rather than referenced through a second contract:

| v2.1 law | Governing v3 mechanism |
|---|---|
| I1 atomic input | V1 plus G0 root/dependency/reference transaction |
| I2 binding identity | V3, `BindingGraph`, and G2 identity multiset |
| I3 carrier truth | V2 plus carrier/slot source paths in `BindingRecord` |
| I4 no bound fallback | V4 and named unsupported/failure states |
| I5 typed translation | V6, per-domain channels, codecs, and G3 grammar proof |
| I6 ordered visuals | V9, `RenderGraph`, G6, and G7 |
| I7 token-aware vectors | V4/V9, sanitized inline SVG, G2/G7/G8 |
| I8 independent proof | V11 and oracle import boundaries |
| I9 explicit runtime state | section 2 truth states plus G10/G11 |
| I10 core/policy separation | V15, capability registry, and no ONEMO paths in compiler core |

## 1. Product guarantee

For a declared supported Figma feature set and state matrix inside the source boundary below, the
compiler guarantees:

1. Every visible and behavior-bearing source property has a canonical disposition.
2. Every bound value remains a live token expression with the same stable Figma variable
   identity, or promotion fails.
3. Native Figma components remain React components with typed variant/property interfaces;
   instances remain instances. An unavailable or unsupported definition fails promotion.
4. Structure, order, mode context, component relationships, text ranges, transforms, and asset
   identity are conserved exactly.
5. React/CSS/SVG output is deterministic, secure, source-mapped, and has no converter runtime
   dependency.
6. Declared states pass strict structural and rendered gates under a pinned environment.
7. Unknown or unsupported features fail at their source location. They never bake, flatten,
   disappear, or receive a green approximation.

The compiler does **not** promise universal bit-identical output for proprietary or unexposed
Figma effects, unavailable fonts, or browser-dependent rasterization. It promises that such a
case cannot be mislabeled exact.

### 1.1 Declared source boundary

The initial product boundary is **Figma Design** content reachable from declared screen,
component, or component-set roots, plus their required component, variable, font, and asset
dependencies. Every captured node type and property inside that boundary is classified. A new or
unknown visual field cannot inherit support from a similar field.

The boundary must also close over render-affecting ancestors, clips, masks, backdrops, overlapping
content, and blend/isolation context. If the selected root's pixels or layout depend on evidence
outside the readable boundary, capture or capability fails at that dependency; the compiler does
not validate a component against an artificially empty backdrop.

FigJam, Slides, Buzz, widgets, prototype reactions, animation behavior, and editor-only state are
outside the initial contract unless a later capability row and corpus explicitly add them. This
scope is narrower than "every object Figma can store," but it is not screen-specific: no ONEMO
name, layer convention, token taxonomy, or fixed paint count is part of the compiler core.

## 2. Output truth states

Only these terminal states exist:

| State | Meaning | May promote? |
|---|---|---:|
| `PROMOTABLE_VERIFIED` | Zero-tolerance identity/structure/token/order gates are exact; all required rendered states are within P0-calibrated contract budgets. | Yes |
| `DIAGNOSTIC_ONLY` | The tool produced inspectable output, but an unsupported or unverified feature remains. | No |
| `CANCELLED` | The operator cancelled capture/compile; staged evidence, registry changes, and package output were discarded. | No |
| `FAILED_CAPTURE` | Evidence is incomplete, stale, unauthorized, or unstable. | No |
| `FAILED_CAPABILITY` | A source feature has no exact capture/normalize/lower/proof chain. | No |
| `FAILED_BINDING` | Token identity, type, mode, or emission differs. | No |
| `FAILED_COMPONENT` | Component definitions, props, instances, or overrides differ. | No |
| `FAILED_STATIC` | Structure, order, geometry, syntax, security, or determinism differs. | No |
| `FAILED_RUNTIME` | A declared state cannot render or be measured. | No |
| `FAILED_VISUAL` | A declared state exceeds its class-specific visual budget. | No |
| `FAILED_EDITOR` | Source selection, declaration resolution, edit, save, or localized round-trip proof failed. | No |

There is no generic `PASS`, `OK`, warning-only approximation, or promotable stale mode.
`Exact` is reserved for the zero-tolerance identity, structure, token, state, and ordering claims.
Rendered fidelity is verified within the calibrated contract; it is not relabeled bit-exact.

## 3. Non-negotiable invariants

| ID | Invariant |
|---|---|
| V1 | **Evidence atomicity:** every artifact belongs to one root capture transaction and dependency lock; each source file/library/registry/reference has a pinned version or repeated stable content fingerprint. |
| V2 | **Source completeness:** every node/property/alias and external render dependency inside the declared boundary is classified before lowering. |
| V3 | **Stable identity:** source node ids, component keys, variable keys, property paths, text ranges, paint/effect indexes, and assets survive to the source map. |
| V4 | **No bound fallback:** a bound visual or semantic value emits a live token expression or blocks promotion. Raw fallback is legal only when the source is unbound. |
| V5 | **Node-local modes:** alias resolution uses the consuming node's effective inherited/overridden mode context. |
| V6 | **Typed expressions:** tokens remain typed expression trees through lowering; string CSS is the final serialization only. |
| V7 | **Native components:** Figma component identity drives reuse. No visual-similarity deduplication and no default instance flattening. |
| V8 | **Two-tree rendering:** source semantics/layout and browser render fragments are separate, ordered, and source-mapped. |
| V9 | **Compositing exactness:** paint, stroke, effect, clip, mask, blend, isolation, opacity, and transform operations preserve source order and group boundaries. |
| V10 | **Capability closure:** a feature is supported only when capture, normalize, lower, serialize, static proof, and runtime proof all exist. |
| V11 | **Independent proof:** fidelity oracles cannot import compiler normalizers or emitter derivations. |
| V12 | **Determinism:** identical evidence and configuration produce byte-identical output and verdicts. |
| V13 | **Security:** source strings, CSS syntax, SVG, URLs, and paths cross explicit validation boundaries. |
| V14 | **Change locality:** token-only changes do not churn component structure; unrelated source subtrees do not churn. |
| V15 | **No inferred product law:** the compiler never invents themes, breakpoints, semantics, or interactions absent from source or explicit policy. |
| V16 | **Editor round trip:** every editable semantic element/component and every render fragment is source-addressable; a supported edit saves as a localized deterministic diff without corrupting identity, modes, source maps, or render order. |
| V17 | **Transactional naming:** token-registry identity and candidate output stage together and commit together only after promotion; failed, cancelled, stale, or crashed runs leave persistent naming state unchanged. |
| V18 | **Operator viability:** correctness cannot depend on a capture workflow that routinely fails during active design; duration, bytes, progress, retry, cancel, and actionable failure behavior are release-gated. |

## 4. Evidence capture

### 4.1 Canonical capture route

The Figma plugin is the primary semantic capture plane because it exposes node-effective modes,
rich text segments, component relationships, and local/remote variables in the live document.

The three-pass route below is the correctness candidate that P0 must measure under section 4.7.
P1 adopts it only after the operator envelope is accepted. P0 may change scheduling or immutable
dependency reuse, but any replacement must prove the same V1/V2 facts and stability boundary.

One capture transaction performs:

1. Read root REST version `V0`, file/branch key, editor type, current page, selected root ids, and
   color profile. Resolve the declared state-reference metadata, but do not render it yet.
2. Run capture pass A through the read-only adapter: export selected roots as `JSON_REST_V1`;
   discover and capture every descendant and external render dependency; collect the semantic
   supplement; batch-resolve variables and readable component definitions; resolve the versioned
   font registry; and hash required image/vector/export assets. Seal that complete candidate as
   fingerprint `F0` plus dependency lock `D0`.
3. Run a fresh validation pass B from the same declared roots, rediscovering the complete boundary
   and dependency set and producing `F1`/`D1`, then read root REST version `V1`. If `F0 != F1`,
   `D0 != D1`, or `V0 != V1`, discard everything and retry the whole transaction once. A second
   instability returns `FAILED_CAPTURE`.
4. Capture every authorized REST reference root at its own declared pinned version. Hash the
   response bytes and exact request parameters into the reference manifest. REST never replaces
   plugin semantic evidence.
5. Run validation pass C, producing `F2`/`D2`, and read root REST version `V2`. Promotion requires
   `F0 == F1 == F2`, `D0 == D1 == D2`, and `V0 == V1 == V2`; otherwise discard and return
   `FAILED_CAPTURE`.
6. Seal the immutable evidence manifest only after the read-only call/event gate and every
   completeness census pass.

The fingerprint algorithm is schema-versioned. It hashes canonical JSON REST exports plus the
node-local mode, text, component, variable, font-registry, asset, external-render, and library
dependency facts used by the compiler. A node count, timestamp, selection id, or file name is not
an adequate fingerprint. Every dependency records a provider version when exposed; otherwise its
complete captured representation must hash identically at `F0`, `F1`, and `F2` or capture fails.
`D0`/`D1`/`D2` contain each reference's pinned identity/version/request metadata; the rendered
response-byte hashes are sealed separately in `references/manifest.json`.

Figma documents plugin JSON export as equivalent to the REST node response:
[exportAsync JSON_REST_V1](https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/).

### 4.2 Plugin semantic supplement

The supplement is versioned and contains only facts that the compiler requires:

```ts
type NodeSupplement = {
  nodeId: string;
  nodeType: string;
  resolvedVariableModes: Record<CollectionId, ModeId>;
  explicitVariableModes: Record<CollectionId, ModeId>;
  styledTextSegments?: StyledTextSegment[];
  componentPropertyDefinitions?: ComponentPropertyDefinitionMap;
  componentProperties?: ComponentPropertyValueMap;
  componentPropertyReferences?: ComponentPropertyReferenceMap;
  mainComponentKey?: string;
  overrides?: OverrideRecord[];
  fontDependencies?: FontDependency[];
};
```

Figma confirms that resolved modes include ancestor inheritance and node overrides:
[`resolvedVariableModes`](https://developers.figma.com/docs/plugins/api/properties/nodes-resolvedvariablemodes/).
Figma's styled text API exposes range-level fills, bindings, lists, links, and OpenType fields:
[`getStyledTextSegments`](https://developers.figma.com/docs/plugins/api/properties/TextNode-getstyledtextsegments/).

This extends an existing capture plane; it does not start from zero. The current live bridge
payload already carries `valuesByMode` plus collection/mode data, and `ds-export.mjs` consumes
those fields. The persisted lightweight variable dump strips entries to name/collection and is
insufficient as compiler evidence. P1 preserves the useful bridge payload, versions it, and adds
the missing semantic/dependency/completeness proof rather than rebuilding that transport blindly.

### 4.3 Evidence manifest

Every snapshot directory includes:

```text
evidence/
  manifest.json
  document.rest.json
  supplement.json
  dependencies.json
  variables.json
  components.json
  fonts.json
  assets/
  references/manifest.json
  references/<state>-<reference-root>.png
```

`manifest.json` records:

- `schemaVersion`, compiler version, policy version, capability-registry version;
- root file/branch key, root file version, root ids, capture id, captured time;
- every library/file/font-registry/reference dependency key, exposed version, content fingerprint,
  source plane, and stability proof;
- plugin API version, REST API version, endpoint permissions and missing permissions;
- color profile, export scale, font inventory, browser target;
- SHA-256 and byte length of every evidence file and asset;
- capture warnings, retries, and explicit state matrix;
- node, alias, variable, component, text-run, and asset census.

Unknown schema versions, missing hashes, unstable root or dependency evidence, an open render
boundary, incomplete required component definitions, or unresolved required web-font bytes fail
before canonical graphs are built.

### 4.4 Permissions and remote libraries

REST Variables endpoints have plan/scope limits. The capture path therefore cannot assume they
are available. Plugin resolution is primary; REST Variables data is an optional independent
cross-check when authorized. The manifest records which source proved each variable fact.

Figma documents the Enterprise/Tier-2 and `file_variables:read` requirement here:
[Variables REST endpoint](https://developers.figma.com/docs/rest-api/variables-endpoints/).

No per-binding network call is allowed. Referenced ids are deduplicated, batched, and cached only
within the immutable capture transaction.

Remote/library objects do not become atomic merely because they have stable keys. Their exposed
provider version is pinned when available; otherwise their complete captured semantics are
fingerprinted at all three transaction reads. A dependency that cannot be reread or proven stable
returns `FAILED_CAPTURE`.

### 4.5 Read-only law and reference truth

Capture is observational. It may not change selection-dependent source state, set variable modes,
create or clone nodes, import/materialize library assets, detach instances, or save a new source
version. A component conversion requires the complete component or component-set definition to be
readable without those actions. If it is not, return `FAILED_COMPONENT`; do not advertise a
partial reusable API. A screen conversion may still fail closed on that instance rather than
flattening it.

This is enforced, not trusted: only a dedicated read adapter receives the Plugin `figma` global;
capture modules cannot import it directly. The built capture bundle is hashed and statically
rejected if its call graph includes mutation/import APIs or dynamic access that bypasses the
adapter. A runtime `documentchange` observer must record zero events for the transaction. Any
event aborts capture and reports the affected document; it is never normalized into success.

Figma's REST image endpoint renders a node from a pinned file version; it does not accept an
arbitrary variable-mode matrix. Therefore each visually promoted `RequiredState` must name a
reference root authored and saved in the intended mode/variant state at the root transaction's
`V0`, or name a separately approved reference file and its own pinned version. The compiler never
mutates Figma merely to manufacture a reference. A state without an authored reference can pass
static and runtime diagnostics, but it cannot exceed `DIAGNOSTIC_ONLY`.

Figma documents the image endpoint's version pin here:
[REST file endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/).

### 4.6 Font provenance

The Plugin API proves the `FontName` used by text and whether that font is available to Figma. It
does not provide the licensed web-font file bytes. `fonts.json` therefore records both:

- Figma identity: family, style, affected text ranges, availability, and missing-font state;
- web identity: approved registry/package source, local file path, license/provenance id, format,
  weight/style axes, byte length, and SHA-256.

The Plugin API does not expose the exact font bytes used by Figma, so the compiler must not claim
byte equality to Figma. Visual promotion instead requires an authoritative approved mapping from
the captured `FontName` to pinned local web-font bytes, plus the text structure/glyph/render proofs
in G5 and G11. Substitution, an unversioned CDN URL, or family-name equality without that mapping
is diagnostic only.

Figma documents font listing/loading behavior here:
[Plugin `figma` API](https://developers.figma.com/docs/plugins/api/figma/).

### 4.7 Capture operability

P0 must measure the proposed capture transaction before its three-pass form becomes normative.
The calibration corpus includes a local-only file and a remote-heavy ONEMO file with libraries,
components, fonts, images, authored references, and an external render boundary. P0 records wall
time, CPU, peak RSS, request count, transferred bytes, retry rate, instability rate, and the time
spent in each visible phase.

P0 also contracts the operator experience:

- deterministic progress phases and counts, not an indeterminate spinner;
- cancel at every phase, leaving no persistent registry/package mutation;
- one bounded automatic retry for snapshot instability, followed by an actionable changed-file or
  dependency report;
- explicit handling when the active Figma file changes during capture: retain the last promoted
  legacy screen, discard the candidate, and offer a fresh retry rather than looping;
- dependency failures name the provider/file/key, required permission or unavailable fact, and
  the exact next action;
- restart/crash recovery deletes or resumes only a verifiably matching staged transaction;
- operator duration/byte/error budgets accepted by QA, Meta, and Dan before P1 implementation.

If three complete passes cannot meet the accepted envelope, P0 must redesign capture scheduling,
reuse immutable provider facts, or narrow the declared transaction without weakening V1/V2. A
correct design that routinely returns `FAILED_CAPTURE` while designers work is not production
reliability.

## 5. Canonical Figma model

The compiler does not normalize directly into CSS concepts. It first builds lossless, versioned
graphs.

### 5.1 Document graph

`DocumentGraph` preserves every captured node, parent/child relation, z-order, visibility,
layout properties, local/absolute transforms, clips, masks, constraints, exports, and source
properties. Unknown visual properties enter the capability planner; they never disappear during
destructuring.

### 5.2 Variable graph

`VariableGraph` preserves:

- stable variable and collection keys plus capture-local ids;
- local/remote/subscribed identity;
- type, scopes, code syntax, mode ids/names/default, extended collections, and values by mode;
- alias edges and per-node effective mode context;
- cycle detection and full resolution traces;
- token registry identity and every emitted CSS or React value-channel identity.

The stable key is the long-lived identity. Capture-local ids remain evidence, not the registry
primary key.

### 5.3 Binding graph

One canonical record exists per destination slot, not per variable occurrence count:

```ts
type BindingRecord = {
  schemaVersion: 1;
  bindingId: string;
  source: {
    fileKey: string;
    nodeId: string;
    propertyPath: JsonPointer;
    slot?: { kind: 'paint' | 'stop' | 'effect' | 'stroke' | 'text-range'; index: number };
    textRange?: { start: number; end: number };
  };
  variable: {
    key: string;
    captureId: string;
    collectionKey: string;
    figmaType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  };
  modeContextId: string;
  resolutionTraceId: string;
  destinationDomain: DestinationDomain;
  emissionTarget: 'css' | 'react';
  disposition: 'pending' | 'emitted' | 'inactive-proven' | 'unsupported';
};
```

Mirrored/compacted metadata is linked to a canonical record but never treated as positional truth.
Every raw `VARIABLE_ALIAS` occurrence must be canonical, a named mirror, reviewed nonvisual
metadata, or unknown-fatal.

### 5.4 Component graph

`ComponentGraph` preserves:

- component and component-set key/id/name;
- variant axes, legal values, defaults, and source component for each combination;
- `BOOLEAN`, `TEXT`, `INSTANCE_SWAP`, `VARIANT`, and slot-like properties;
- nested `componentPropertyReferences`;
- instance source component, property values, swaps, exposed instances, and override records;
- remote component provenance and asset dependencies;
- a source-to-generated React component/prop map.

Figma's component APIs expose these definitions and values:
[componentPropertyDefinitions](https://developers.figma.com/docs/plugins/api/properties/ComponentPropertiesMixin-componentpropertydefinitions/).

Rules:

1. Generate reuse only from native Figma component identity; never from visual similarity.
2. A complete component set becomes one typed React component with a discriminated variant prop
   model when all variants are captured and lowerable.
3. `BOOLEAN` maps to conditional source layers; `TEXT` to escaped text props;
   `INSTANCE_SWAP` to a typed component choice; explicit slot nodes to `ReactNode` slots.
4. An instance emits the generated component plus source overrides. It may flatten only in
   `DIAGNOSTIC_ONLY`, never in `PROMOTABLE_VERIFIED`.
5. A missing remote definition or unrepresentable override returns `FAILED_COMPONENT`.
6. Component names are readability labels. Stable keys drive file identity and source maps.
7. A component/component-set target captures every authored variant plus every property
   definition, type, default, option, and constraint its generated public type advertises. Tests
   exhaust finite variant/BOOLEAN/INSTANCE_SWAP options and apply generic laws plus adversarial
   representatives to open TEXT/slot values. If the definition surface is incomplete, the compiler
   fails; it never emits an apparently complete but unverified component API.

### 5.5 Text graph

`TextGraph` preserves Unicode indexes, paragraphs, line breaks, range boundaries, lists,
indentation, hyperlinks, fills, bindings, text styles, OpenType features, direction, and fonts.

Rules:

- Adjacent equal ranges may coalesce only after an identity-preserving equivalence proof.
- Links must pass URL policy and emit semantic anchors.
- List structure emits semantic lists only when Figma list facts prove it.
- Missing fonts block visual promotion; substituting a font is diagnostic only.
- Text stays live/selectable. Outlining is not production text conversion.

### 5.6 Asset graph

Every image, SVG, and export has content hash, source node, settings, color profile, dimensions,
MIME type, and local output path. Font dependencies retain Figma identity separately from the
approved web-font asset and hash defined in section 4.6. No unversioned cache key and no runtime
external URL are permitted.

## 6. Token identity and expressions

### 6.1 Persistent token registry

The registry is part of the generated project contract, not ONEMO policy. One Figma variable may
feed several incompatible destinations, so identity cannot collapse to one CSS name:

```ts
type TokenRegistryEntry = {
  variableKey: string;
  figmaType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  stableBase: string;
  channels: Record<DestinationDomain, {
    channelId: string;
    target: 'css' | 'react';
    cssName?: string;
    tsSymbol?: string;
  }>;
};
```

`token-registry.json` maps the stable Figma variable key to this entry. The variable key preserves
design identity; a channel preserves the destination representation. For example, the same FLOAT
may need independent `length-px`, `opacity-normalized`, and `number` channels. Reusing one custom
property across those grammars is forbidden.

Resolution order:

1. Existing registry entry and existing destination channels for the stable variable key win. If
   explicit WEB syntax has changed, emit a migration request; never churn generated code.
2. Missing channels are created in a deterministic domain order. CSS channels use a valid,
   unique explicit WEB name only when policy validates it for that channel; otherwise use
   `--fg-<readable-slug>-<short-key-hash>-<domain>`.
3. React channels use a deterministic exported symbol derived from the same stable key and
   destination domain. New entries/channels form a staged registry delta; they are not persistent
   project state until the candidate package is promoted.

The hash carries identity; the slug is readability only. Two names that slugify equally cannot
collide. A later Figma rename does not silently rename the CSS property. An explicit registry
migration is required and emits a migration report.

Invalid code syntax, duplicate explicit syntax, missing stable keys, incompatible domain reuse,
or a type conflict fails the binding gate. After initial project generation, a missing or
hash-mismatched registry is a hard snapshot failure; the compiler does not reconstruct it from
current labels and risk identity churn.

#### 6.1.1 Registry/package two-phase commit

1. Acquire a project-scoped registry generation and read lock; record the base registry hash and
   generation in the capture manifest.
2. Build a deterministic registry delta in the versioned candidate directory. No shared registry,
   promoted package, or existing generated file changes during capture/compile/gating.
3. Run G0-G13 against the base registry plus staged delta and the staged package.
4. On `PROMOTABLE_VERIFIED`, acquire the exclusive commit lock and compare the current registry
   generation/hash with the recorded base. A mismatch is a named commit conflict; rebase and
   revalidate the candidate or abort. Never last-write-wins.
5. Commit registry generation, package, manifest, source map, and verdict through one atomic
   promotion pointer/rename transaction. A partial commit is invalid and recovered to the prior
   generation on restart.
6. On failure, cancellation, stale evidence, process exit, or restart mismatch, discard the staged
   delta/package. Persistent registry identity remains byte-identical.

Only a named registry migration task may intentionally rename/remove channels. It owns the
migration report, dependent-code inventory, compatibility window, QA/Meta evidence, and Dan
approval. Ordinary compilation cannot approve or silently perform a naming migration.

Registry generations are lane-scoped. Before P9, a successful v2 candidate may commit only to the
Compiler v2 sandbox registry/package namespace; it cannot modify the active legacy route or active
production registry pointer. P9 atomically activates an already verified v2 generation.

### 6.2 Typed token expression AST

```ts
type TokenExpr =
  | { kind: 'token'; variableKey: string; channelId: string; target: 'css' | 'react'; figmaType: FigmaType; destinationDomain: DestinationDomain }
  | { kind: 'number'; value: number; unit?: CssUnit }
  | { kind: 'color'; space: 'srgb' | 'display-p3'; channels: number[]; alpha: number }
  | { kind: 'calc'; op: 'add' | 'sub' | 'mul' | 'div'; args: TokenExpr[] }
  | { kind: 'list'; separator: 'space' | 'comma'; items: TokenExpr[] }
  | { kind: 'function'; name: AllowedCssFunction; args: TokenExpr[] };
```

Bound source values must retain a `token` leaf. A codec may wrap it in `calc`, a gradient,
shadow, or transform expression; it may not replace it with the resolved literal.

Destination codecs validate the property domain. Examples:

- opacity `85` -> `calc(var(--token) / 100)`;
- length token -> `var(--token)` only if emitted token values carry a legal length unit;
- gradient stop -> token leaf inside a structured gradient item;
- shadow field -> token leaf at its exact segment and index;
- string typography token -> parsed allowlisted weight/style value, or unsupported;
- boolean component token -> conditional React prop expression, not CSS text.

### 6.3 CSS and React token channels

`tokens.css` contains only values proven legal for their CSS destination channel. FLOAT values are
serialized per domain: lengths receive the required unit, opacity is normalized to CSS's accepted
range or percentage, and unitless numbers remain unitless. Compatible alias edges may emit as
channel-to-channel `var()` references; incompatible cross-domain aliases retain their full trace
and regenerate derived channel values per mode. Component CSS never bakes the resolved literal.

Figma also permits bindings to `characters`, `visible`, and `componentProperties`. Those values
cannot in general be represented by swapping a CSS custom property. Generated `token-values.ts`
therefore contains typed STRING/BOOLEAN/FLOAT/COLOR values by stable variable key and mode, while
`mode-contexts.ts` provides a small pure resolver used by generated React for content, structural
visibility, and component-property bindings. It has no I/O, cache, Figma API, or converter runtime
dependency.

Visual style bindings use CSS channels; content/structure/component-prop bindings use React
channels. Both retain the same source variable key, mode context, alias trace, and source-map
segment. A token-only change regenerates token data and evidence, not component TSX or CSS
structure. Figma lists `characters` and `visible` as bindable fields and exposes
`componentProperties` bindings here:
[VariableBindableNodeField](https://developers.figma.com/docs/plugins/api/VariableBindableNodeField/),
[`boundVariables`](https://developers.figma.com/docs/plugins/api/properties/nodes-boundvariables/).

## 7. State and mode model

### 7.1 Effective mode context

Each source node receives a canonical `ModeContextId` derived from its
`resolvedVariableModes`. Alias resolution runs under the consuming node's context, including
cross-collection aliases, extended collections, overrides, and cycle detection.

The canonical context contains one effective mode for every collection used by the reachable
subtree. When a collection has no explicit inherited selection, its captured default mode is
inserted; absence is never interpreted as the root's arbitrary selection. Root context is never
substituted for descendant context.

### 7.2 Scoped mode-context emission

The planner produces a `ModeContextPlan` that compares each node's effective context with its
parent. Generated markup emits a deterministic scoped context marker only at the root and at
boundaries where the effective collection-mode map changes. CSS channel values cascade from those
boundaries; React-channel lookups receive the same `ModeContextId`. Unchanged descendants inherit
without duplicate wrappers or declarations.

The generated root accepts a typed state prop or project-supplied context adapter. That input
selects only declared root modes; authored descendant overrides remain scoped and cannot be
overwritten by the root. G2 and G10 compare every source node's expected context with both the
source map and the runtime-computed channel values.

### 7.3 State matrix

The explicit compile request defines required product states:

```ts
type CompileRequest = {
  targetKind: 'screen' | 'component' | 'component-set';
  rootIds: string[];
  requiredStates: RequiredState[];
};

type RequiredState = {
  id: string;
  rootId: string;
  viewport: { width: number; height: number; dpr: number };
  collectionModes: Record<CollectionKey, ModeId>;
  componentProps?: Record<ComponentKey, Record<string, unknown>>;
  reference: null | { fileKey: string; version: string; rootId: string };
};
```

The compiler adds every distinct mode context actually used by the source and every native
component variant. It does not blindly claim all Cartesian combinations are meaningful.

If the complete reachable matrix exceeds configured budgets, the compile blocks until policy
declares required combinations. Sampling may produce diagnostics, never a promotion verdict.

Each required state is structurally and computationally tested. G11 additionally requires the
state's authored, pinned `reference`; `reference: null` makes the state diagnostic-only. A
component/component-set target must cover every finite variant/BOOLEAN/INSTANCE_SWAP state its
generated type advertises, plus the contracted representative and mutation corpus for open
TEXT/slot inputs. A screen target must cover every product state claimed by its generated API.

### 7.4 Change behavior

- Token value change: regenerate token CSS/data and visual evidence; React/CSS structure hashes
  stay stable unless a destination codec/type changes.
- Token rename: stable key keeps registry and component code stable; report label change.
- Token type change: fail until every binding destination is revalidated.
- Mode add/remove: update state matrix and rerun affected states; no stale verdict survives.
- Component variant/property change: invalidate that component and dependent instances only.
- Screen subtree change: invalidate that subtree, ancestor layout/compositing dependencies, and
  affected runtime states.
- Figma schema/API version change: capability registry must accept it explicitly before compile.

## 8. Two intermediate representations

### 8.1 Semantic/Layout IR

Models React-facing structure:

- screen roots, native components, instances, text semantics, links, lists, and slots;
- flex, GRID, absolute layout, constraints, sizing, min/max, wrapping, overflow, and z-order;
- visibility and variant conditions;
- accessibility annotations only when source or explicit policy proves them.

It does not contain pseudo-elements, SVG filter ids, or browser workaround wrappers.

### 8.2 Render/Compositing IR

Models browser graphical operations:

```ts
type RenderFragment = {
  fragmentId: string;
  sourceNodeId: string;
  role: 'content' | 'paint' | 'stroke' | 'effect' | 'clip' | 'mask' | 'isolation' | 'vector';
  order: number;
  bounds: Rect;
  transform: Matrix3;
  opacity?: TokenExpr;
  blendMode: BlendMode;
  clip?: ClipRef;
  mask?: MaskRef;
  payload: CssBox | CssBackground | InlineSvg | FilterGraph | AssetRef;
};
```

One Figma node can emit zero, one, or many render fragments. Every auxiliary fragment is:

- source-mapped;
- `aria-hidden` when decorative;
- pointer-events-free unless it represents actual content;
- excluded from semantic component APIs;
- ordered through the explicit compositing graph.

This removes the false requirement that one source node must equal one browser element while
preserving source identity.

### 8.3 Exact lowerer selection

The planner chooses the simplest representation that proves equivalence:

1. native element property;
2. CSS background/border/effect list;
3. source-mapped auxiliary render fragment;
4. inline sanitized SVG/filter/mask;
5. `unsupported`.

It never chooses a screenshot or opaque SVG for a token-live production subtree. Static exports
may be attached to `DIAGNOSTIC_ONLY` reports for comparison only.

### 8.4 Layout coverage

Required initial layout lowerers:

- horizontal/vertical auto layout, wrapping, negative gaps, baseline and track alignment;
- Figma GRID tracks, row/column gaps, auto-flow, spans, anchors, and child alignment;
- absolute/non-auto layout with affine transforms and transform origins;
- constraints, min/max width/height, aspect locks, layout grow/align, and overflow/clipping;
- `itemReverseZIndex`, `strokesIncludedInLayout`, and stroke contribution to geometry;
- fixed, hug, fill, and content-driven text sizing.

Responsive output is generated only from deterministic layout/constraint facts or multiple
authored required states. No breakpoint inference from one fixed frame.

### 8.5 Compositing coverage

The render graph preserves Figma order for:

- every fill, fill opacity, crop/transform, repeat, clip, origin, and blend mode;
- every stroke paint, side width, align, cap, join, dash, and geometry contribution;
- ordered inner/outer shadows, layer/background blur, and supported filter graphs;
- vector, alpha, and luminance masks plus mask group boundaries;
- node opacity and isolation;
- nested affine transforms, reflection, shear, anchor, and transformed clips.

CSS/SVG lowering follows W3C operation and isolation semantics, not visual heuristics:
[Compositing and Blending](https://www.w3.org/TR/compositing-1/),
[CSS Transforms](https://www.w3.org/TR/css-transforms-1/), and
[CSS Masking](https://www.w3.org/TR/css-masking-1/).

## 9. Versioned capability registry

Support is data, not an assumption:

```ts
type Capability = {
  sourceKind: string;
  propertyPath: string;
  sourceValueClass: string;
  destinationDomain?: DestinationDomain;
  lowererId?: string;
  capture: CapabilityStatus;
  normalize: CapabilityStatus;
  lower: CapabilityStatus;
  serialize: CapabilityStatus;
  staticOracle: CapabilityStatus;
  runtimeOracle: CapabilityStatus;
  requiredFixtures: string[];
  browserTargets: string[];
};
```

A row is `supported` only when every stage is supported and all fixtures pass. Otherwise a source
occurrence becomes a named `FAILED_CAPABILITY` with node, path, value class, and remediation.

The registry has its own schema/version and is pinned by the snapshot. New Figma fields cannot
inherit support from a nearby field or a wildcard.

## 10. Emission package

```text
generated/<root>/
  screens/<Screen>.tsx
  components/<Component>.tsx
  styles/<Screen>.module.css
  styles/<Component>.module.css
  tokens.css
  token-values.ts
  mode-contexts.ts
  token-registry.json
  assets/
  manifest.json
  source-map.json
  capability-report.json
  fidelity-report.json
```

Rules:

1. Output compiles with the repository's pinned React/TypeScript/CSS toolchain.
2. Generated components are pure and deterministic; no data fetching or converter runtime. The
   generated mode/value resolver is project-local, side-effect-free code, not a runtime service.
3. Stable Figma keys/ids drive internal names. Readable labels may change without structural
   churn.
4. Text emits as escaped React children. No `dangerouslySetInnerHTML`.
5. SVG emits through an AST serializer after sanitization, never raw string injection.
6. CSS custom properties and values parse through a standards-aware parser.
7. Assets are local, content-addressed, and referenced by relative confined paths.
8. Source map entries cover declarations, expression segments, elements, SVG attributes,
   component props, and auxiliary render fragments.
9. No generated selector or token is screen-name-special-cased.
10. The package has no hidden theme inversion, media-query theme inference, or user-agent branch.
11. Every editable semantic element and native component instance carries stable source identity
    resolvable by the ONEMO tagging/selection layer. Every auxiliary fragment is individually
    addressable/selectable by `fragmentId` in render-inspection mode and resolves to its owning
    source node for semantic editing; it cannot masquerade as a separate semantic element.
12. CSS/React token uses resolve through `source-map.json` to an exact editable
    declaration/expression segment. Formatting preserves deterministic declaration boundaries and
    slot semantics required for localized Save-to-code writes.

## 11. Security contract

### 11.1 SVG

- Parse Figma SVG into an AST.
- Allowlist required SVG elements and attributes.
- Reject scripts, event attributes, `foreignObject`, remote URLs, CSS imports, and unapproved
  data URLs.
- Rewrite ids and local `url(#...)` references with a deterministic per-asset namespace.
- Preserve only capability-approved filters, masks, gradients, and links.
- Enforce node, path-data, filter-depth, and serialized-byte limits.

### 11.2 CSS and tokens

- Validate explicit WEB code syntax as a legal, unique custom property name.
- Parse every emitted value in its destination property grammar.
- Reject unapproved `url()`, `@import`, expression-like legacy syntax, and declaration breaks.
- Escape comments and generated identifiers.
- Confine emitted asset paths inside the package.

### 11.3 React and text

- Escape all text and attributes through JSX serialization.
- Serialize generated token/state data from a typed schema; escape STRING values as data, never
  executable source fragments.
- Do not emit raw HTML.
- Allowlist link protocols and default external links to safe rel attributes.
- Never turn Figma layer names into event handlers or executable property names.

React documents the XSS risk of untrusted raw HTML here:
[React common components](https://react.dev/reference/react-dom/components/common).

## 12. Independent gates

Compiler modules produce artifacts. Separate oracle packages parse raw evidence and generated
output. Oracles may share schemas and standards parsers, but may not import normalizers, codecs,
planners, or emitter helpers.

| Gate | Proof | Hard failure |
|---|---|---|
| **G0 Evidence** | root/dependency hashes and versions, permissions, read-only call/event proof, declared reference manifests, pinned web-font/assets, stable closed-boundary capture | stale/missing/open/unstable/mutated evidence |
| **G1 Capability** | every source node/property/alias occurrence maps to a supported capability or named failure | unknown/wildcard/unclassified occurrence |
| **G2 Binding identity** | exact source record multiset equals IR and parsed output source-map multisets, including variable key, destination channel/target, node, property, range, slot, and mode context | missing/extra/swapped/baked binding |
| **G3 Variable semantics** | stable registry channels, type/domain, mode/default, alias trace, scoped context, CSS/React grammar, and resolved value parity per consuming node | type/domain/mode/value/cycle/collision drift |
| **G4 Component semantics** | complete advertised definitions/variants, prop types/defaults, instance values, swaps, references, and overrides equal parsed React model | partial API/flattened/missing/wrong component behavior |
| **G5 Text semantics** | Unicode content, ranges, list/link structure, range styles/bindings, and approved pinned web-font mapping equal parsed React/CSS | coalesced/lost/wrong text or substituted font |
| **G6 Structure/layout** | node/component/source-map census, order, visibility, layout law, computed geometry, transforms, overflow, and z-order | structural or geometry drift |
| **G7 Render graph** | paint/effect/stroke/mask/clip/isolation order and every render fragment equal independent scene oracle | flattened/reordered/wrong group |
| **G8 Output/security** | TS/JS/CSS/SVG parse, typecheck, lint, sanitizer, URL/path confinement, no runtime external dependency | invalid or unsafe package |
| **G9 Determinism/change locality** | repeated compile byte-identical; token/name/subtree mutations change only permitted artifacts | unexplained churn/stale output |
| **G10 Runtime state matrix** | every required mode/variant/viewport loads; scoped CSS and React channels resolve at the correct node context; no runtime/console/network error | missing/unmeasured/wrong scoped state |
| **G11 Visual fidelity** | strict class-specific comparison for each state with a valid pinned authored Figma reference; `reference:null` is not run and remains diagnostic-only | budget exceeded; invalid/missing claimed references fail G0 |
| **G12 Scale** | measured CPU, wall time, peak RSS, artifact size, and network-call budget on large corpus | superlinear or over-budget run |
| **G13 Editor round trip** | every editable semantic element/component selects by stable source identity; every fragment selects by `fragmentId` in render-inspection and resolves its owner; token/style/prop edits target the exact source-map segment; Save-to-code yields a localized deterministic diff that recompiles with component identity, scoped modes, source maps, and render order intact | unselectable/ambiguous source or fragment, wrong owner/segment, non-local churn, invalid save, or lost identity/order/context |

No later gate can override an earlier failure.

## 13. Fidelity measurement

### 13.1 Pinned environment

The manifest pins:

- production build, browser/version, OS image, viewport, DPR, and device scale factor;
- installed font files and hashes;
- approved font provenance/license ids and Figma-to-web mapping;
- Figma export scale and color profile;
- animation/transition disabling and stable time;
- image-decoding completion and font readiness;
- background color, locale, text direction, and reduced-motion state.

References and generated captures use the same dimensions and color profile. Figma export settings
explicitly expose color profiles and document browser/OS text variance:
[Figma ExportSettings](https://developers.figma.com/docs/plugins/api/ExportSettings/).

### 13.2 Non-negotiable exact checks

These have zero tolerance:

- source/binding/component/text identity multisets;
- child, paint, effect, stroke, mask, and compositing order;
- token keys, mode context, alias trace, and expression destination;
- text content and line breaks;
- required runtime states and computed token selection;
- state-to-authored-reference root/version mappings;
- asset hashes and output determinism.

### 13.3 P0-calibrated render budgets

No numeric rendered-fidelity floor is normative at contract sign-off. P0 first creates synchronized
Figma/build pairs under the pinned environment for flat color/alpha, vector/shape, raster/crop,
text/font, effects/compositing, geometry/transforms, Shape, and the selected ONEMO mother screen.
It measures repeat-run noise, renderer variance, known structural mutations, and known imperceptible
raster differences.

P0 publishes versioned `fidelity-budgets.json` with, per class:

- metric and threshold definition (for example geometry deltas, DeltaE, SSIM, changed pixels,
  glyph bounds, asset/crop identity);
- synchronized corpus/reference hashes and environment manifest;
- within-source repeat distribution and known-broken mutation distribution;
- false-pass/false-fail analysis and the narrow reason the boundary separates them;
- sample size, confidence, exclusions, and owning gate;
- QA, Meta, and Dan approval evidence.

Those accepted values become normative for P1 onward. Later changes, tighter or looser, require a
versioned calibration rerun, ADR, corpus evidence, QA, Meta, and Dan sign-off. The contract does
not privilege an uncalibrated number merely because it looks strict.

The legacy 10% global residual is forbidden.

No converter approximation may be masked. The test route must be a production build with no dev
badge. Environment-only exclusions must be zero-area where possible and named in the manifest.

### 13.4 Honest text boundary

If live text cannot meet the calibrated text budget with the required browser/font, the state is
`DIAGNOSTIC_ONLY`. Outlining text may be used as a reference-control experiment, but cannot turn
the result into editable production React text.

## 14. Adversarial corpus

All fixtures are sanitized, checked in, versioned, and small unless explicitly a scale fixture.
No required test depends on ignored cache data.

### 14.1 Microfixtures

1. compacted metadata versus carrier-local paint/stop/effect bindings;
2. arbitrary fill count, per-paint opacity, blend modes, crops, and ordering;
3. multi-stroke, per-side widths, stroke alignment, caps, joins, and dashes;
4. every supported effect field independently bound;
5. alpha/vector/luminance masks, nested clips, and isolation groups;
6. affine rotation, reflection, shear, nested transform, and transformed clip;
7. H/V auto layout, wrap, negative gap, GRID, spans, reverse z, and strokes-in-layout;
8. mixed text, lists, links, OpenType, emoji/surrogates, and range bindings;
9. local/remote/extended variables, default/descendant modes, alias cycle, no WEB syntax, and
   collisions;
10. component set with all property types, nested references, swaps, variants, and overrides;
11. malicious SVG, CSS syntax, text, URL, and path payloads;
12. missing/substituted font, unsupported effect, unknown Figma field, unstable capture, and stale
    asset;
13. one FLOAT bound across length, opacity, and unitless destinations, including cross-domain
    aliases;
14. STRING-bound characters, BOOLEAN-bound visibility, and variable-bound component properties;
15. root mode plus multiple nested scoped overrides and a collection using its default mode;
16. unreadable remote component definition, attempted source mutation, and a runtime state with no
    authored visual reference;
17. remote dependency changing under a stable key, direct Plugin-global write bypass, and a blend
    or backdrop effect whose pixels depend on content outside the selected subtree.
18. editor round-trip fixtures for slot-preserving padding/radii, token-expression segments,
    component props, scoped-mode boundaries, and auxiliary fragment ownership.

### 14.2 Integration fixtures

- current Shape screen;
- one real current ONEMO mother screen, selected and version-pinned with Dan at P0; Shape or a
  synthetic fixture cannot substitute for it;
- a checked-in replacement for the missing legacy golden;
- a non-ONEMO screen with unrelated variable names and no WEB syntax;
- a component-library page plus two consuming screens;
- a rich-text/editorial page;
- a GRID/mask/multilayer marketing page;
- a large enterprise fixture with repeated components, remote variables, and deep nesting.

### 14.3 Mutation suite

Every mutation must fail at its assigned gate:

- swap same-valued variable ids;
- bake one bound value;
- use root mode for a descendant override;
- reorder paints/effects/masks;
- flatten an instance;
- change one variant default or instance swap;
- merge two unequal text runs;
- drop one grid span or reverse-z flag;
- reduce an affine matrix to angle;
- inject unsafe SVG/CSS/URL content;
- reuse a stale asset or verdict;
- skip one required runtime state;
- change only a token value and churn component TSX;
- collapse two incompatible destination channels into one CSS custom property;
- emit token-bound characters, visibility, or component props as inert CSS text;
- drop a descendant mode-context marker or its React context id;
- advertise one uncaptured component variant;
- import/materialize a remote component or change a source mode during capture;
- bypass the read adapter through direct/dynamic Plugin-global access;
- change a library dependency between fingerprint reads while keeping its stable key;
- omit an external backdrop/overlap dependency from the source boundary;
- substitute a same-family font with different bytes;
- promote a state whose authored reference is null or belongs to another version;
- add an unknown visual field and continue conversion;
- drop or duplicate one semantic/component source address;
- expose a decorative fragment as a fake semantic selection or lose its owning-node address;
- make an auxiliary fragment unselectable by `fragmentId` in render-inspection mode;
- resolve a token edit to the wrong declaration/expression segment;
- edit one padding/radius slot and rewrite unrelated slots or more than the owning declaration;
- Save-to-code and churn component identity, scoped mode markers, source-map ids, or render order;
- fail or cancel after staging a new token channel and mutate the persistent registry;
- race two compiles from one registry generation and accept last-write-wins;
- restart during registry/package commit and retain a partial generation;
- cancel capture and leave staged artifacts or an indeterminate operator state.

## 15. Performance and scale

Complexity laws:

- document and alias traversal: `O(nodes + properties + alias occurrences)`;
- variable/component lookup after capture: expected `O(1)`;
- alias resolution: `O(variables + alias edges + distinct mode contexts)` with memoization;
- no network call inside per-node, per-binding, per-text-run, or per-render-fragment loops;
- rendering cost is measured per required state and parallelized only after evidence is immutable.

Before fixed budgets are adopted, P0 records the target hardware and profiles the old and new
pipelines on the large fixture. P7 then locks explicit CI budgets for:

- capture requests and transferred bytes;
- wall time and CPU time by phase;
- peak RSS and snapshot/IR/output bytes;
- output component count and render-fragment expansion ratio;
- runtime-state count and capture time.

Budget values are evidence-derived and committed to config. "Fast enough" is not an exit gate.
Exceeding a budget fails G12; it cannot silently drop states or source maps.

## 16. Reuse policy

### 16.1 Presumed replace

These are presumed-replace **inside Compiler v2**. Section 0.1 governs the still-operating legacy
tool; listing a module here does not authorize its pre-cutover removal or reversion.

- `src/ir.mjs`;
- token lookup and positional carrier code;
- `src/emit.mjs` as an architectural center;
- `src/reverse.mjs` as a fidelity oracle;
- current conformance coverage logic;
- current global residual and approximation masks;
- unversioned SVG/assets and fire-and-forget fidelity state;
- hardcoded Studio gate labels.

### 16.2 Reuse candidates

- Figma URL parsing;
- CLI command shape and nonsemantic flags;
- filesystem packaging helpers;
- Studio navigation/shell;
- parsers/serializers that pass sanitizer and round-trip fixtures;
- selected CSS/SVG lowerer functions that pass independent microfixtures unchanged.

Reuse is decided function by function. Existing green tests are regression evidence only; they are
not proof because current gates share derivation and omit required domains.

## 17. Delivery phases

No phase starts until the previous phase has Builder self-review, adversarial QA, Meta review, and
Dan approval. The new compiler writes only to a versioned sandbox until cutover.

| Phase | Build | Exit evidence |
|---|---|---|
| **P0 Continuity, contract, and calibration** | preserve the clean broken baseline and current operating delta separately; select/pin a real ONEMO mother screen; restore hermetic fixtures; calibrate synchronized visual budgets; measure/approve capture duration, bytes, progress/retry/cancel/failure UX; pin editor round-trip corpus and registry transaction protocol | E1-E13 reproduce on clean baseline; seven truth-fixes reproduce on operating delta; no required fixture missing; `fidelity-budgets.json`, capture-operability envelope, mother-screen references, G13 corpus, and contract approved |
| **P1 Evidence capture** | enforced read-only plugin adapter, closed render boundary, dependency lock, supplement built on the existing bridge payload, variable/component/font-registry/assets capture, pinned authored references, REST cross-check, manifest/hashes, and approved operator controls | G0 plus unstable/stale/permission/remote/source-mutation/reference/backdrop/progress/cancel/restart mutations within P0 envelope |
| **P2 Canonical graphs** | document, variable, binding, component, text, asset graphs and schema parsers | G1-G5 fail against intentionally lossy legacy IR |
| **P3 ONEMO mother token/component slice** | compile the P0-selected mother screen through staged per-domain registry channels, CSS/React token data, scoped modes, one complete native component set, instances, nested modes, and rich text | same real mother-screen evidence plus arbitrary-token/state/change-locality tests; staged registry rollback/conflict mutations; G2-G5 green |
| **P4 ONEMO mother layout/render slice** | compile that same mother screen through flex/GRID/absolute layout, render fragments, paints/effects/strokes/masks, and affine transforms into runnable source-mapped React/CSS/SVG in the versioned sandbox | useful runnable mother-screen sandbox output; hard-case fixtures and mother screen G6-G7 green; no screen-specific core rule |
| **P5 Emitters, security, and editability** | production-shaped package, pure mode resolver, addressable source maps, sanitizers/parsers/typecheck, declaration/slot formatting, selection and Save-to-code adapters | G8 and G13 static/editor fixtures plus malicious corpus |
| **P6 Runtime, visual, and editor proof** | state runner, scoped-context oracle, pinned authored-reference capture, production build, calibrated class metrics, select/edit/save/recompile loop | G9-G11 and G13 on the selected mother screen, Shape, and microfixtures; first v2 `PROMOTABLE_VERIFIED` candidate |
| **P7 Corpus and scale** | all integration fixtures, large fixture, accepted budgets, change-locality/editor matrix | full G0-G13 green; zero skips; mutation suite all bites |
| **P8 Studio dual-run** | truthful states/reports, side-by-side legacy/v2, legacy still operating, no overwrite, staged registry/package recovery | failed/cancelled states cannot promote or mutate persistent identity; evidence survives restart |
| **P9 Cutover** | Dan-authorized production compiler switch, atomic registry/package promotion, remove superseded hacks/caches/gates only after rollback package | required ONEMO corpus `PROMOTABLE_VERIFIED`; QA -> Meta -> Dan sign-off; rollback package exercised |

P3 and P4 are architecture proofs, but they are anchored to one real ONEMO mother screen so the
first proof also produces the first useful runnable output. The P4 sandbox remains non-promotable
until P5/P6. If the slice cannot meet the contract without screen-specific core rules, stop and
revise the architecture before continuing.

### 17.1 Operating lanes

- **Legacy lane:** remains the default daily design tool through P8 under section 0.1. Truth-fixes
  may continue independently with their own evidence and Dan gate.
- **Compiler v2 lane:** versioned sandbox only until a P6+ candidate is
  `PROMOTABLE_VERIFIED`; it never writes the legacy promoted route or active production registry
  pointer. Verified candidates commit only to the v2 sandbox namespace before P9.
- **Cutover lane:** P9 only, with atomic package/registry promotion and an exercised rollback.

### 17.2 Phase governance and Linear

Each phase starts in a fresh task worktree from `origin/staging` unless Dan names another base.
Use one PR per phase or an explicitly ordered stack. The PR carries the exact gate outputs,
mutation results, performance/operability measurements, artifact hashes, and self-review. Static
green without required runtime/editor evidence cannot advance.

Linear contains one C11 v3 epic plus P0-P9 tasks whose descriptions copy the phase exit evidence
verbatim. Workflow is Builder (`Ready for Builder` -> `Building`), QA (`Ready for QA` -> `In QA
review`), Meta (`Ready for Meta` -> `In Meta review`), and Dan (`Ready for Dan` -> `In Review by
Dan`). A failed gate returns to Builder with a linked finding. Advisors provide evidence but do
not replace a gate. Only Dan moves a task to Done.

## 18. Definition of done

Compiler v2 production cutover is ready for Dan sign-off only when all are true:

1. Every requirement in this contract maps to an artifact and independent gate.
2. Capability registry covers every property present in the release corpus; no wildcards.
3. Every binding record has exact source -> graph -> expression -> output identity.
4. Arbitrary no-WEB-syntax variables compile through stable per-destination registry channels.
5. FLOAT cross-domain and STRING/BOOLEAN React-channel fixtures preserve identity and legal
   runtime behavior.
6. Token value and name mutations preserve component-code stability as contracted.
7. Node-local modes, defaults, scoped emission, and cross-collection alias traces pass all
   declared states.
8. Native component definitions, every advertised variant/prop, instances, swaps, and overrides
   survive.
9. Rich text ranges, links, lists, bindings, and the pinned approved web-font mapping/bytes survive.
10. Required flex/GRID/absolute layout and compositing features survive.
11. React/CSS/SVG output plus generated token/state data parses, typechecks, sanitizes, and has no
    external converter runtime dependency.
12. Every promoted state names an authored reference root at the captured version and passes its
    P0-calibrated visual budget; missing-reference states remain diagnostic-only.
13. Full suite has zero skipped/todo tests and no ignored required fixture.
14. Every mutation fails at its assigned gate.
15. Determinism, change locality, and scale budgets pass on pinned CI hardware.
16. Studio can never label or promote an unmeasured, stale, unsupported, or failed package.
17. Capture proves it performed no Figma write/import/materialization operation.
18. Root and external dependency locks remain stable, and every render-affecting backdrop/overlap
    dependency has a disposition.
19. Legacy inversion, positional bindings, scalar transform hacks, circular reverse proof, global
    10% residual, and unversioned caches are removed at cutover.
20. Documentation describes the actual capability frontier and current measured corpus.
21. Builder, QA, Meta, and Dan sign-off evidence is attached. Agents do not mark Done.
22. The P0-selected real ONEMO mother screen produces a useful runnable sandbox at P4 and reaches
    `PROMOTABLE_VERIFIED` through P6/P7 without screen-specific compiler-core law.
23. Every editable semantic element/component is source-selectable, and every auxiliary fragment
    is selectable by `fragmentId` in render-inspection with an exact owner; the editor corpus edits,
    saves, recompiles, and produces only the contracted localized diffs with identity, tokens,
    modes, maps, and order intact.
24. Failed/cancelled/crashed/concurrent compiles leave the persistent token registry and promoted
    package unchanged; successful promotion commits one recoverable registry/package generation.
25. Capture meets the P0-approved duration/byte/retry envelope and progress/cancel/actionable-error
    UX on local and remote-heavy corpora.
26. The legacy converter and its seven truth-fixes remain available until the required ONEMO
    corpus passes and Dan authorizes P9 cutover.

## 19. Explicit non-goals

- Infer business logic, data fetching, navigation, or prototype interactions not present in the
  declared source contract.
- Invent accessibility semantics absent from Figma annotations or explicit policy.
- Invent responsive breakpoints from one fixed frame.
- Deduplicate visually similar non-component layers.
- Promote screenshots, outlined text, or opaque full-screen SVG as editable React/CSS.
- Approximate unsupported proprietary effects and call them exact.
- Support a second UI framework before the React/CSS contract is proven.
- Modify Figma content.
- Claim support for FigJam, Slides, Buzz, widgets, or prototype behavior through the Figma Design
  compiler without a separately proven capability set.

These are truth boundaries, not shortcuts. A separate explicit policy or authoring input may add
semantics later without weakening compiler fidelity.

## 20. Meta requirements trace

| Original requirement | Contract mechanism | Release proof |
|---|---|---|
| Figma-agnostic screens | declared Figma Design boundary, canonical graphs, no name/path policy in core | G1, G6, diverse screen corpus |
| native components | complete `ComponentGraph`, typed public variants/props, no flattening | G4 plus component-library integration fixture |
| arbitrary tokens | stable-key, per-domain CSS/React channels; node-local/default modes | G2, G3, mutation suite |
| token changes do not break code | token artifacts regenerate independently; registry identity persists | G9 component TSX/CSS structure hashes |
| new screens fail safely | versioned capability registry; unknown fields fatal; no wildcards | G1 plus schema/unknown-field mutations |
| modern multilayer 1:1 transfer | separate semantic/layout and render/compositing IRs | G6, G7, GRID/mask/multilayer corpus |
| pure editable React/CSS | React, CSS Modules, sanitized inline SVG, local pure state resolver; no converter runtime | G8 parse/type/security gate |
| ONEMO select/edit/save continuity | source-addressed semantic/component/fragment ownership plus exact declaration/expression segments and localized deterministic writes | G13 editor corpus and Save-to-code mutations |
| closest honest route to 100% | exact identity/structure gates plus P0-calibrated class-specific visual budgets | G2-G7 and G10-G11 per authored state |
| production reliability | atomic read-only evidence, transactional registry/package promotion, capture operability, security, determinism, change locality, scale, editor survival | G0, G8, G9, G12, G13 and P0/P8 recovery evidence |
| uninterrupted design work | legacy operating lane with truth-fix allowance until verified ONEMO cutover | section 0.1 plus P8/P9 proof |

This trace proves architecture coverage, not implementation. The product remains unbuilt until the
phase gates pass on current evidence.

## 21. Review status

- **Builder:** single v3 governing contract merged after Pixel and Kai REWORK; no implementation
  started.
- **QA:** independent v3 re-review pending; end-to-end document self-audit complete.
- **Meta:** both adversarial reviews conceded the architecture direction; their eight
  decision-package blockers are integrated and the candidate is ready for resubmission.
- **Dan:** pending; only Dan may authorize P0 or mark the architecture review complete.

## 22. Architecture sign-off question

Approve this single **C11 v3 Compiler v2 clean fidelity core with verified edge reuse** contract,
preserve the legacy operating lane, and authorize P0 only.

Do not authorize C11 v2.1 R1-R7 unchanged, any implementation beyond P0, or production cutover.
