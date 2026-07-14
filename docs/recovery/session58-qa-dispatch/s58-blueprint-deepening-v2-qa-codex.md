# s58-qa Blueprint Deepening v2 Gate

Target:
- `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-component-engine-BLUEPRINT.md`
- Deepening section starts at `# BLUEPRINT DEEPENING v2`, lines 281-366.
- Source ledger: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-CODE-model.md`

Verdict: REWORK before I2. HOLD I2.

## What I Verified

- Full-read blueprint lines 1-366 and source ledger lines 1-108.
- Confirmed Framer source grounding:
  - `motion-dom@12.42.2/dist/index.d.ts:121-134` has `TargetAndTransition`, `Variant`, and flat `interface Variants { [key: string]: Variant }`.
  - `framer-motion@12.42.2/dist/index.d.ts:934` has the `AnimationType` trigger vocabulary.
  - `framer@3.0.4/index.d.ts:895-1076` has `ControlType`, `Enum`, and `SegmentedEnum`.
  - `framer@3.0.4/index.d.ts:4850-4859` has `useVariantState`.
- Checked local CVA source exists in workspace:
  - `onemo-next-editor/node_modules/class-variance-authority/package.json:2-3` identifies `class-variance-authority@0.7.1`.
  - `dist/index.d.ts:22-35` defines `variants`, `defaultVariants`, `compoundVariants`, and `cva(base, config)(props)`.
- Current implementation worktree is dirty with I1 work, so this verdict is a doc/source gate only, not an implementation run.

## Findings

### HIGH 1 — D1/D2 supersede base contracts, but the base contracts are still authoritative and contradictory

Evidence:
- Base `ComponentModel` is still single-axis/single-variant shaped: `variants: [{ name, kind:'config'|'state', selector, decls }]` at blueprint lines 26-35.
- Base `write-scoped-declaration` still accepts only `scope = {base} | {variant,name} | {state,pseudo} | {state,propClass}` at lines 106-109.
- Base `editTarget` is still single target: `{base} | {variant:name} | {state:pseudo}` at lines 158-163.
- D1 adds `variantAxes: [{ axis, values, default }]` at lines 299-300.
- D2 requires stacked `editTarget = { axisValues, states }` and composed selectors at lines 319-324.

Why it blocks I2:
- I2 cannot build from two incompatible models. The builder would have to guess whether D1/D2 merely add fields or replace the base `variants`/`scope`/`editTarget` shape.

Required rework:
- Fold D1/D2 into the main build contract, not only the appendix.
- Update `ComponentModel` to include `variantAxes` as the primary config-variant model, or state exactly how legacy `variants` is derived/kept.
- Update `write-scoped-declaration` scope to accept axis-value and stacked state context.
- Update `editTarget` in §4 to the stacked descriptor, or explicitly say D2 supersedes it and give the final shape.

### HIGH 2 — D1 compile pseudocode is wrong/underspecified for multi-axis

Evidence:
- D1 compile line: `axes.map(a => styles[`${a}_${props[a]}`])` at blueprint lines 296-298.

Why it blocks I2:
- If `axes` are descriptors, `a` is not the prop key. This compiles to an object-string key class like `[object Object]_...`.
- Defaults are also not specified. CVA-style composition uses `props[axis] ?? defaultVariants[axis]`; the blueprint currently composes `undefined` when a prop is absent.

Required rework:
- Specify the exact axis descriptor and compile:
  - `variantAxes: [{ axis, values, defaultValue }]`
  - class key = `${axis}_${props[axis] ?? defaultValue}`
  - null/undefined behavior is explicit.
- Add an I2 gate for defaulted axis composition and two-axis composition.

### HIGH 3 — D2 claims I0 write reuse, but combinatorial states require a new selector contract

Evidence:
- D1 says axis-value rules reuse existing `write-scoped-declaration` at lines 301-305.
- Existing scope only writes `.base`, `.base.<name>`, `.base:<pseudo>`, or `.base[data-<state>]` at lines 106-109.
- D2 requires `.base.variant_primary[data-loading]:hover` at lines 321-324.

Why it blocks I2/I1:
- This is still bounded, but not "existing op as-is." It requires a generalized `scopedSelector` builder that accepts base + N axis classes + N semantic states + optional pseudo in deterministic order.
- Without this, I1 state writes and I2 axis writes can both pass independently while the first combined edit fails or writes the wrong rule.

Required rework:
- Define the final `scope` / `editTarget` payload shape and deterministic selector order.
- Add gates:
  - base + one axis + semantic state + pseudo writes exactly `.base.size_lg[data-loading]:hover`.
  - read-back preserves that combination.
  - delta discipline applies to the most-specific rule only.

### MED 4 — D4 still contains fake decisions for lossless read

Evidence:
- Transition side-channel: "on Export the comment stays ... or is stripped" at lines 336-340.
- Switch connector: "Spec the exact detector; if fragile, mirror the transition side-channel" at lines 341-343.

Why it blocks later parity:
- The whole D4 purpose is lossless read. "Stays or stripped" and "if fragile" are not build authority; they leave the source of truth undecided.

Required rework:
- Decide whether `@fc-transition` is authoring metadata retained in source, stripped only in a separate export artifact, or represented elsewhere.
- Decide switch connector read source now:
  - AST-only with exact pattern and failure modes, or
  - mandatory `@fc-connector` side-channel.
- Add read/write/read gates for transition and switch connector.

### MED 5 — D5 structural variants are still not fully op-specified and reintroduce v1/later language

Evidence:
- Base op is `{file, variant, edit}` at lines 151-156.
- D5 says add/remove/swap subtree with flat conditionals at lines 347-351.
- D5 says "swap in v1" and "deep reparenting = a NAMED later phase" at lines 352-353.

Why it matters:
- The shape of `edit` is still not buildable: no target addressing, no payload for add/remove/swap, no axis/value form, no source-position or node identity rule.
- The "v1/later phase" wording violates the no-defer framing unless deep reparenting is explicitly declared outside component-state parity with a refusal taxonomy.

Required rework:
- Specify `set-variant-structure` payloads for add/remove/swap, target identity, and refusal modes.
- Replace `v1/later phase` with an explicit current-boundary/refusal rule if deep reparenting is intentionally out of scope.

### LOW 6 — CVA and Radix/control-state references need citation hygiene

Evidence:
- D1 header says `[CODE:framer §1+§3 + CVA]` at line 286, but the build authority does not cite a CVA package/version/path/line.
- D3 cites "Radix `useControllableState` shape" at line 328 without source citation.

Why it matters:
- The concepts are sound, but this packet's gate is source-grounding. Uncited named libraries should either be source-cited or downgraded to `[OURS/PATTERN]`.

Required rework:
- Either cite concrete CVA/Radix sources or remove the source implication and mark them as implementation patterns.

## Criteria Result

- Source-grounded: PARTIAL. Framer citations check out. CVA/Radix pattern citations missing.
- No defer/fake-decision language: FAIL. D4 and D5 still contain undecided/later-phase wording.
- Ops fully specified: FAIL. `mint-union-prop` is close, but axis/scoped selector/structural payloads are not build-complete.
- Full parity/production scope: PARTIAL. The direction covers the right gaps, but read/write contracts are not yet coherent.
- Bounded-check: PARTIAL. The approach can stay bounded, but the spec currently overclaims reuse of I0 without defining the required selector/scope generalization.

Final verdict: REWORK. I2 should stay held until these are folded into one coherent build contract.
