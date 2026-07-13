# C11 — Lossless Figma Compiler Recovery · CONTRACT v2.1 (unified, draft)

> The contract for repairing the converter after the Shape-screen failure (2026-07-13).
> Unifies and SUPERSEDES: Kai's C11 v1.1 (evidence base, scope, phasing) and @s58-pixel-3's
> C11R v1.0 (lossless architecture, invariants, gates) — independently derived, cross-verified
> against the live file and each other, then merged. Sibling to `SPEC.md`; every rule here amends
> or mechanizes a SPEC rule. Status: **DRAFT — no implementation before Dan sign-off.**
> Builder → QA → Meta → Dan pipeline applies to every phase.

## 0 — Decision

Do **not** greenfield-rewrite the converter, and do **not** keep patching properties inside the
current lossy model. Legacy modules (fetch, layout/flex laws, React/CSS-Modules shape,
reporting, editor-package contract) are **candidates for reuse, not grandfathered as proven** —
their old proofs were partly circular (E8); each is kept only after it passes the new
independent fixtures and G0–G6. Rebuild the boundary that determines fidelity:

```
atomic versioned snapshot → raw alias inventory → canonical binding records
  → typed lossless IR → React/CSS/SVG + emission source map
  → independent static gates → runtime/theme visual gates → promotable output
```

**The governing invariant:** every visual Figma property has a disposition. A bound property
emits through its exact variable, remains token-aware inside an emitted asset, or **fails
explicitly**. It never silently becomes a resolved hex, number, font name, opacity, shadow, or
SVG paint. "Works with any screen and variable system" means the core discovers bindings by
identity and property path, never by ONEMO names.

## 1 — Evidence base (what shipped broken, and how)

All rows verified against `cache/Qdb9Kx98afJHxaCGAIxoMC-6075-53685.nodes.json` (Shape, 209 nodes)
and pixel's live plugin-console read of the same node; both audits converged independently.

| # | Figma truth | Converter output today | Mechanism |
|---|---|---|---|
| E1 | root SOLID bound → `bg/app/primary` | baked `linear-gradient(#fbfbfc,#fbfbfc)` | `bv.fills` is a compacted list (2 fills → 1 entry); `ir.mjs` indexes it per *filtered visible* fill |
| E2 | Spec-Pill gradient stops bound (2 stops) | baked hexes | `bv.fills` for a gradient = the stops **flattened** (1 fill → 2 entries); per-stop `stop.boundVariables.color` never read |
| E3 | Effect Card shadow: radius/spread/color/offsetY bound | raw `box-shadow: … rgba(…)` | `effectsOf` reads no bindings; `effect.boundVariables` ignored; `bv.effects` is another compacted mirror |
| E4 | Tab opacity 0.85 bound → TabBar/inactive | raw `opacity: 0.85` | `bv.opacity` never read (5 bound opacities on screen) |
| E5 | Pill-Done per-side stroke weights bound (60 such slots on screen) | raw px | `bv.individualStrokeWeights` keyed object never read |
| E6 | menu `relativeTransform` = `[[0,-1,…],[1,0,…]]` (clockwise 90° in screen coords) | `rotate(-90deg)` → mirrored rail | angle derived from scalar `rotation` + sign negation; matrix ignored |
| E7 | ground = silver slab, light theme | near-black in EVERY scheme | E1's baked layer + `--fc-surface-invert` hack's `background-blend-mode: difference` blending two bg layers |
| E8 | E1–E7 shipped "all gates green" | CONFORMANCE: 80%, PASS, 0 unresolved | reverse gate re-derives from the same IR via shared emitter helpers (circular); no binding anchor; `background-image` outside the coverage denominator |
| E9 | grain IMAGE paints **over** the bound solid | solid emitted as TOP CSS layer, grain buried | REST `fills[]` arrives **top-first**; emit law assumed bottom-first — every multi-fill stack inverted |
| E10 | 71 vector nodes carry bound paints on the svg root itself | bindings baked | token-aware scan skips depth 0 |
| E11 | TabBar opacity tokens in the catalog (3,281 ids) | absent from tokens.css → their `var()` could never resolve | dump and tokens.css written by two non-atomic steps; `/api/convert` syncs neither; `/api/refresh` swallows sync failure |
| E12 | fidelity pair + svg assets | capture fire-and-forget after promotion; svg cache keyed by node id only | `studio/server.mjs` unawaited; `assets.mjs` cache has no version key |

Confirmed non-defects: the raw `10px`/`178px` values are unbound in Figma (authoring worklist);
2 unique library-remote ids (hashed form) appear only on `paragraphSpacing` (non-emitting today —
handled by disposition, §4). Prior hot-patches in this worktree (`ir.mjs`, `emit.mjs`) are
**reverted at R0** — they patch symptoms inside the broken model.

## 2 — Non-negotiable invariants

| ID | Invariant |
|---|---|
| I1 | **Atomic input:** nodes, variable catalog, web token artifact, and assets describe one Figma file version, hash-stamped together. |
| I2 | **Binding identity:** canonical identity is `{nodeId, propertyPath, variableId}` — never a count or a resolved value. |
| I3 | **Carrier truth:** array-object bindings come from the paint/stop/effect that carries the property; compacted node arrays are metadata mirrors — cross-checked, never indexed. |
| I4 | **No bound fallback:** a bound slot with an unresolved/invalid variable FAILS; raw emission is legal only for genuinely unbound slots. `tokenOr(raw)` on a bound value is forbidden. |
| I5 | **Typed translation:** every supported property has an explicit Figma-domain → CSS-domain codec; "the variable exists" is not enough. |
| I6 | **Ordered visuals:** paint, stroke, effect, blend, mask, and transform ordering preserved exactly. |
| I7 | **Token-aware vectors:** bound vector paints stay variables in inline SVG or fail. Baked output for a bound colour is never an exemption. |
| I8 | **Independent proof:** at least one gate reads raw Figma data importing no converter/emitter helpers. |
| I9 | **Explicit runtime state:** generated, statically-green, visually-measured, and promotable are distinct states; the studio renders stored verdicts, never hardcoded "OK". |
| I10 | **Core/policy separation:** Figma semantics live in the compiler core; ONEMO naming, routes, heading promotion, viewport wrapper, and theme selectors live in ONE policy module (`policy/onemo.mjs`). No hidden ONEMO token paths in core. |

## 3 — Input architecture

### 3.1 Atomic snapshot (kills E11, E12-cache)

One conversion consumes one immutable snapshot: `manifest.json` (fileKey, fileVersion, nodeId,
nodeHash, variableCatalogHash, tokenArtifactHash, assetManifestHash, capturedModes,
converter version) + `nodes.json` + `variables.json` + `tokens.css` + `assets/`.

- Dump local variables PLUS every remote/library id the frame references; generate tokens.css
  from **that exact dump** (never a previous disk artifact). Root-cause the current 46-definition
  catalog↔tokens.css gap (starts at the OPACITY/Com collections) in the ds-pipeline synthesis.
- Re-read the file version after capture; changed → discard and retry once; second change =
  `SNAPSHOT_UNSTABLE`, refuse.
- Verify every bound id resolves to a catalog entry AND a token definition **before IR
  construction**. Misses are named and fatal.
- `--allow-stale-dump` survives for diagnostics only; stale runs are never promotable.
- Asset/svg cache keys: `fileKey + fileVersion + nodeId + exportSettings + contentHash`.

### 3.2 Raw alias inventory (generic, future-safe)

An independent walker records every `VARIABLE_ALIAS` occurrence in the raw document —
recursive, name-agnostic: `{occurrenceId, nodeId, jsonPointer, variableId, carrier}`.
A classifier then assigns each occurrence exactly one class:

- `canonical` — owns a render-slot binding record (carrier-local: paint / stop / effect / node
  scalar / keyed object);
- `mirror-of:<bindingId>` — compacted REST metadata (`bv.fills`, `bv.effects`), cross-checked;
- `nonvisual-metadata` — finite reviewed list only;
- `unknown-carrier` — **fatal until classified** (a new Figma feature fails loudly, never bakes).

Wildcards and count-only exemptions are forbidden. The v1.1 binding-source table survives as the
*seed classification*, not as the discovery mechanism.

### 3.3 Canonical binding records

`{bindingId, nodeId, propertyPath, variableId, variableName, collectionId, cssVar, figmaType,
cssValueType, rawValueByMode, disposition, destination?}` — one record per property slot (four
shadow slots on one token = four records; each can be lost independently). Dispositions:
`pending | emitted-css | emitted-svg | inactive-for-content | unsupported-bound`.
`inactive-for-content` requires a deterministic proof (e.g. paragraphSpacing on single-paragraph
text); `unsupported-bound` produces sandbox output + report but **blocks promotion**.

### 3.4 Variable→web resolver (how `cssVar` is obtained — never guessed)

A contracted `VariableResolver` interface, resolution order fixed:

1. **Explicit Figma WEB code syntax** on the variable (the design file's own statement) — wins;
2. else the **policy adapter** (`policy/onemo.mjs` carries the ds-naming derivation — it is
   ONEMO policy, not core);
3. else the binding is `unsupported-bound` — a missing mapping is fatal for promotion, never
   name-derived in core.

### 3.5 Mode-aware alias graph law

The snapshot resolver resolves cross-collection alias chains under the **root's per-collection
mode context** (each collection contributes its active mode; chains hop collections with the
consuming context preserved), with cycle detection and a **stable resolution trace** persisted
per binding (`variableId → … → raw value, per mode`). G3's "value matches per captured mode" is
defined AGAINST this trace — an untraceable chain is `unsupported-bound`.

### 3.6 Artifact schema versioning

`manifest.json`, binding records, the IR, and the emission source map each carry a
`schemaVersion`. A consumer refuses unknown/newer versions (G0 for the snapshot; the studio for
stored verdicts); migrations are explicit, never silent reinterpretation of cached artifacts.

## 4 — Typed lossless IR and codecs

Every visual IR value is `{raw, binding|null}`. Legal operations only:
`emitBound(record, codec)` · `emitRaw(raw)` when unbound · `refuseBound(record, reason)`.

**Required codecs** (Figma domain → CSS domain, validated against the snapshot's value types):
colour (paint/stop/stroke → bg/color/border/svg, alpha preserved) · lengths (dims, gap, padding,
radii, per-side stroke widths) · **opacity (Figma 0–100 token domain → valid CSS syntax — a bare
`85` is invalid and must be impossible)** · typography (STRING style → valid weight/style; invalid
web syntax fails) · gradient stops (order, position, identity, transform, alpha) · shadow/blur
segments (each bound radius/spread/offset/colour independent, with units) · transform (full
affine or named-unsupported) · image crop (matrix + asset identity).

**Paint-stack law (E9):** REST paint order is top-first; CSS background-image order is top-first.
Keep every visible fill in original order; the bottom-most fill may become `background-color`
only when it is a normal opaque solid representable there; every other solid becomes a
token-aware single-colour gradient layer at its original index; size/position/clip/origin/repeat/
blend lists ride the same indexes. **No inferred theme/inversion layer, ever** — theme behavior
comes only from bound tokens; `--fc-surface-invert` and its `theme.css` are deleted (E7). A
paint whose opacity/blend cannot be represented exactly lowers via a source-mapped
pseudo-element or returns `unsupported-bound` — flattening is not allowed.
For Shape: grain image over `var(--…bg-app-primary)`, both theme faces via tokens.

**Vector law (E10):** simple vector geometry lowers to inline SVG with token-aware
fill/stroke/opacity/stroke-width. Complex exported SVG is legal only when the subtree has no
bound visual properties, or a deterministic structural rewrite maps every bound record to a
specific SVG attribute and G2 proves the mapping. Depth-0 root paints included; baked bound
colour = `unsupported-bound`.

**Transform law (E6):** `relativeTransform` is authoritative; scalar `rotation` is fallback
evidence only when no matrix exists. The solver supports and tests: both handedness cases on
asymmetric containers, scale/reflection, anchor compensation, counter-rotated auto-layout
children, nested transforms. A matrix the DOM representation cannot preserve exactly is reported
unsupported and blocks promotion — `atan2` reduction alone is not a transform law.

## 5 — Emission contract

**Emission source map:** every generated declaration/SVG attribute carries a machine-readable
entry `{bindingId, destination:{file, selector, property, segment}, emitted}` — generated by the
emitter, **verified independently against parsed output** (this closes the E8 hole precisely:
a baked colour segment is attributable, and a URL can never be confused with a bound segment).

**Core vs policy (I10):** core owns Figma semantics, typed bindings, codecs, platform-neutral IR,
deterministic assets, source maps. `policy/onemo.mjs` owns route placement, root-viewport
wrapper, heading/tag promotion, theme selector names, class naming/formatting. The core must
pass a fixture with arbitrary non-ONEMO collection/variable names. One policy boundary — no
multi-framework speculation; React/CSS-Modules stays the only emitter.

## 6 — Independent gates

| Gate | Proves | Fails on |
|---|---|---|
| **G0 snapshot integrity** | hashes, versions, catalog completeness, remote-id resolution, token definitions, asset identity match the manifest | any mismatch — before IR construction |
| **G1 classification completeness** | every raw alias occurrence classified | any `unknown-carrier` |
| **G2 binding conservation by identity** | `source identity == IR identity == parsed emission-map identity == emitted variable identity` for every canonical record | missing/extra/swapped id — equal totals are insufficient; id-swap with identical values must fail |
| **G3 token type & mode parity** | emitted var exists, value type legal at destination, resolved value matches Figma per captured mode | type misuse, mode drift |
| **G4 raw visual oracle** | independent walker (no IR/emitter imports) derives visibility census, paint/effect/stroke order, binding slots, affine matrices, asset refs — compared to parsed TSX/CSS/SVG + source map | any structural/order/transform divergence. The existing reverse reader is retained as a **serialization check only** — no longer described as fidelity proof |
| **G5 code canon** | existing census/canon/lint/typecheck/determinism/selectability | unchanged; green here can never override G0–G4 |
| **G6 runtime & theme fidelity** | stateful pipeline `GENERATED → STATIC_GREEN → RUNTIME_PENDING → VISUAL_GREEN → PROMOTABLE`; capture per **explicit variable-mode combination**, same mode stamped on the route; never `prefers-color-scheme` as truth; no dark Figma reference → verdict says "light verified / dark unverified" | over-budget residual, unmeasured capture (stays RUNTIME_PENDING — unpromotable), failure states `FAILED_{SNAPSHOT,BINDING,STATIC,RUNTIME,VISUAL}` rendered from stored results |
| **G7 cache integrity** | versioned asset keys | any cross-version asset reuse |

## 7 — Regression strategy

**Hermetic microfixtures** (committed, sanitized — no gitignored-cache dependency): compact-array
mirror + carrier-local solid · two-stop bound gradient · multi-subproperty bound effect with
repeated ids · bound 0–100 opacity · four per-side stroke bindings · depth-0 vector-root paint ·
+90°/−90° asymmetric matrices · scale/reflection/nested transforms · remote-library id ·
arbitrary non-ONEMO names · stale-snapshot combinations. Plus one sanitized **Shape-derived
integration fixture** (golden frame #2) and golden frame #1's fixture restored.

**Scalability acceptance (Dan's "scalable" made mechanical):** one synthetic large fixture
(thousands of nodes, full-catalog-scale variables) with budgets established from the current
baseline and enforced in CI: inventory + classification O(nodes + aliases); variable lookup O(1)
indexed; remote ids resolved batched (zero per-binding network calls); bounded memory; explicit
time/memory ceilings. Correct-but-unusable is a failure.

**Mutation proofs — each gate must bite:** remove a carrier-local read → G2; swap two same-valued
ids → G2; bake a bound vector colour → G2/G4; emit bare `85` opacity → G3; flip a transform
sign → G4/G6; reorder paint layers → G4/G6; reintroduce the difference-invert → G4/G6; stale
tokens.css or svg cache → G0/G7; skip runtime capture → stuck RUNTIME_PENDING, unpromotable.
A gate that passes the repaired output without failing the known-broken output is not accepted.

## 8 — Delivery phases

| Phase | Work | Exit gate |
|---|---|---|
| **R0 freeze & replay** | preserve the exact broken Shape input/output/reports as evidence; revert the two hot-patched files | old output reproducibly shows dark ground, reversed rail, false green |
| **R1 atomic snapshot** | manifest, local+remote catalog, exact token build, pipeline-gap fix, versioned assets | G0 + stale-snapshot mutations |
| **R2 binding inventory** | alias walker, mirror classifier, canonical records, emission-map schema/parser | G1/G2 fail on the OLD lossy IR before any visual fix |
| **R3 typed IR & codecs** | replace positional lookups and bound-raw fallback; opacity/text/effect/stroke/gradient/vector codecs | every Shape binding has a legal disposition; zero bound fallbacks |
| **R4 paint/vector/transform fidelity** | ordered stacks (top-first), token-aware vectors incl. depth-0, affine solver; delete invert mechanism + theme.css | Shape acceptance matrix (§9) rows meet source truth **statically** (incl. both-mode token parity via the §3.5 trace); both-mode VISUAL truth is claimable only once G6 exists (R6) |
| **R5 gates & source map** | G1–G5 wired into convert; mutation-proof suite | all mutations bite on fixtures |
| **R6 studio/runtime/cache** | awaited + persisted fidelity states, explicit theme matrix, versioned caches, promotion refusal on non-PROMOTABLE | G6/G7 green; no hardcoded dashboard verdicts |
| **R7 spec migration & cutover** | amend SPEC §§1–4/AC7 (reverse = serialization integrity; binding identity = the fidelity proof; paint order top-first); retire superseded heuristics; delete legacy paths | full suite green, zero skips; QA → Meta → Dan |

**Migration safety:** the lossless path builds beside the legacy path behind an explicit
compiler-version switch; during R1–R6 it writes only to a versioned sandbox package (never over
the last promoted screen); dual-run on both golden fixtures with retained reports; studio default
cuts over only when the lossless path is PROMOTABLE on every required fixture; positional
lookups, invert logic, and unversioned caches are deleted at R7 — they are not kept as fallbacks.

**Process:** fresh session worktree from `origin/staging`, one PR per phase (or stacked), QA gate
auditable (PR review + gate outputs pasted), Meta review against this contract, **Dan signs off
per phase; nothing is Done before that**. Linear: one epic (C11) + R0–R7 tasks with these exit
gates verbatim, created on contract approval.

## 9 — Shape acceptance matrix (the screen that found the bugs becomes the proof)

| Source truth | Required output |
|---|---|
| root: top grain IMAGE + bottom bound SOLID | grain over `var(--…bg-app-primary)`; correct both modes; no difference blend, no theme.css |
| three 2-stop bound gradients | both stops exact variables, original order |
| Effect Card bound shadow slots | radius, spread, offset, colour each an exact variable segment |
| five bound tab opacities | component variables emit valid CSS opacity syntax |
| per-side bound hairlines | four variable-backed border-width slots |
| bound vector-root paints (71 nodes) | token-aware inline SVG; zero baked bound colours |
| menu matrix `[[0,-1],[1,0]]` | clockwise rail, original top-to-bottom action order |
| 209 raw nodes | census/disposition explains every emitted or vector-collapsed node |

Pre-recovery output must fail G0/G2/G4/G6 — proven by replay, pasted in the PR.

## 10 — Definition of done

1. Shape renders from its exact snapshot with correct ground, rail, gradients, effects, opacity,
   hairlines, vector colours, and explicit theme behavior (§9 complete).
2. Every canonical binding record has a non-silent disposition; zero bound raw fallbacks.
3. One atomic hash-stamped snapshot resolves all local + remote ids; dump/tokens.css can no
   longer diverge silently.
4. Core fixtures prove arbitrary variable/collection names (no ONEMO assumptions in core).
5. Paint/effect order and affine transforms pass the raw oracle and runtime gates.
6. The studio cannot display green before static AND visual gates complete; promotion refuses
   any non-PROMOTABLE state.
7. All fixtures committed and hermetic; `npm test` zero failures, zero skips.
8. Mutation tests prove every old defect class cannot pass silently.
8b. The synthetic-scale fixture passes within its CI-enforced time/memory budgets; artifact
   schemas are versioned and unknown versions refuse.
9. SPEC corrected (reverse = serialization integrity; binding identity = fidelity proof;
   top-first paint order; snapshot law).
10. QA and Meta approve the evidence; **Dan gives final sign-off.**

## 11 — Explicit non-goals

No Figma writes · no component deduplication · no responsive-law redesign · no new studio UI
beyond truthful gate states · no second framework/emitter · no automatic approximation of
unsupported bound properties · no exemption added merely to make Shape pass.
