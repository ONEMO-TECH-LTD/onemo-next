# s58 component engine blueprint QA - Codex

Verdict: REWORK before I0.

Scope:
- Build authority: `s58-component-engine-BLUEPRINT.md`, 252 lines, read fully at 2026-07-08 18:01 version.
- Source ledger: `s58-framer-CODE-model.md`, 108 lines, read fully.
- Source verification: fetched exact npm packages to `/tmp/s58-framer-src-check` only for audit:
  - `framer-motion@12.42.2`, shasum `8628ad31a9b5c1ea6f908ea1764784e33870b711`
  - `motion-dom@12.42.2`, shasum `b4661b9b3394ae7e990d76dc954bc1e321c59305`
  - `framer@3.0.4`, shasum `9b199a6b38c30e91d67adfbcfb9a19b7fe3c7e6d`
- Ours-code citations spot-checked in `src/app/api/dev/editor/lib.ts`, `react-figma/engine.ts`, and `components-canvas/page.tsx`.

Findings:

1. HIGH - Prop bridge precedence is contradictory and cannot work as written.
   - `s58-component-engine-BLUEPRINT.md:159-162` says module CSS props are exposed by rewriting only the base declaration to `var(--prop, fallback)`, then says "variant/state rules still win" and also "Precedence: explicit prop > variant > base".
   - Those cannot both be true. With the described CSS, a variant rule that writes the same property directly will beat the base `var()` declaration, so explicit prop does not override variant. If explicit prop must override variants, every scoped variant/state declaration for that exposed prop must use the same custom-property fallback, or the bridge must use a different mechanism.
   - Required closure: choose and state the real precedence, then specify the compiler rule and gate for base + variant + explicit prop.

2. HIGH - Pseudo-state preview selector does not specify a mechanism that can match the rendered component.
   - `s58-component-engine-BLUEPRINT.md:108-113` emits `.base:hover, .base[data-preview="hover"]`.
   - It says the gallery sets `data-preview` on the frame's root. Current components canvas wraps `React.createElement(f.Comp)` inside a host frame (`components-canvas/page.tsx:147-152`), so setting `data-preview` on the frame wrapper will not match `.base[data-preview="hover"]` unless the component root itself receives the attribute.
   - Required closure: specify the exact render mechanism: either render `<Comp data-preview="hover" />` and require/splice root prop spreading, or change the selector/preview wrapper contract. Add a gate that proves the forced state actually renders.

3. MED - ControlType parity language still overclaims and contradicts itself.
   - `s58-component-engine-BLUEPRINT.md:166-177` says the section maps Framer's 27 members, but then labels some as `v1+` and others "out of component-authoring scope".
   - `FusedNumber` appears both as `Number(+FusedNumber)` at `:168` and as out-of-scope at `:177`.
   - Expert's gate-context says all mapped controls get built in order except explicitly out-of-component-state controls. The build authority needs to say that exactly, with no "v1/v1+" wording and no duplicate `FusedNumber`.
   - Required closure: retitle to increment order, list IN vs OUT once, and remove the "props/27 ControlType parity" overclaim unless all 27 are actually implemented.

4. MED - Persistent connector support is specified in prose but not carried through the increment gate/model.
   - `s58-component-engine-BLUEPRINT.md:124-137` correctly adds `mode:'switch'` for tap-to-persistent-variant.
   - But the model still shows `connectors:[{ from:'base', trigger, to:variantName, transition }]` at `:33`, and I4 gate at `:243-244` still only says pseudo-rule + CSS transition.
   - Required closure: update the ComponentModel connector shape and I4 gate to include `mode`, source/from semantics, and the persistent switch proof.

5. LOW - Build-authority status is internally stale.
   - `s58-component-engine-BLUEPRINT.md:11-12` still says `[PENDING §2/§3]`.
   - `s58-component-engine-BLUEPRINT.md:251-252` still says "before it leaves DRAFT" and references pending sections.
   - Required closure: remove stale pending/draft text before treating this as build authority.

Notes:
- Source-grounding is mostly real: exact npm package citations for motion/framer checked out against registry packages, and ours-code function references exist.
- Do not start I0 until the HIGH findings are corrected in the build authority and re-gated.

## Re-gate - 2026-07-08 18:10 blueprint

Verdict: REWORK-NARROW before I0.

Prior findings 1-5:
- F1 precedence contradiction: closed in substance. The bridge now rewrites every declaring rule with per-rule fallbacks, making explicit prop > variant > base compile.
- F2 preview selector mismatch: closed in substance. The selector now uses the ancestor wrapper contract with `:global([data-fc-preview="hover"]) .base`.
- F3 ControlType overclaim: closed in substance. The text now states IN/OUT, drops 27-parity, and removes the FusedNumber duplicate.
- F4 connector model/gate: closed in substance. `mode`, `from`, and `variantState` are carried through the model and I4 gate.
- F5 stale DRAFT/PENDING status: closed at status level.

Residual findings:

1. MED - ComponentModel READ still omits semantic states.
   - `s58-component-engine-BLUEPRINT.md:42` says state variants are parsed only from pseudo rules: `.base:hover|:active|:focus-visible|:disabled`.
   - But the same blueprint now makes `loading/error` first-class semantic state variants via `.base[data-loading]` / `.base[data-error]` or `.is-*` at `:127-129`, `:207-209`, and I1 `:254-256`.
   - Required closure: update the READ layer to parse both pseudo-state rules and prop-class/data-attr semantic state rules. This matters because the core engine contract is re-read-from-source after every write.

2. LOW - Preview attribute naming is still inconsistent in the build authority.
   - The fixed mechanism uses `data-fc-preview` at `:113-117`.
   - But §7 still says `data-force-state` at `:221-222`, and §9 still says `[data-preview]` at `:244-245`.
   - Required closure: use one exact name/contract everywhere, preferably `data-fc-preview`, and make the strip gate assert that exact selector half.

## Re-gate - 2026-07-08 18:13 blueprint

Verdict: BUILD-READY for I0.

Narrow residuals:
- Semantic state READ is closed. `s58-component-engine-BLUEPRINT.md:42-46` now parses both interaction pseudo rules and semantic data-attr/prop-class rules plus their driving boolean props.
- Preview attribute consistency is closed. The positive contract is now `data-fc-preview` in §3.2, §7, and §9. Remaining `data-preview` text only describes the rejected `.base[data-preview]` approach.

Gate meaning:
- This clears the blueprint for I0 start only.
- It does not certify implementation, live UI, or Dan acceptance.
- I0 must still prove its own gates: promote-element, write-scoped-declaration, ComponentModel read, visual parity, real pseudo-rule, and tsc0.
