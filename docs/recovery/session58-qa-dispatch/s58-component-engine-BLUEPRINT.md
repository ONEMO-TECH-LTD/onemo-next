# Component Editing Engine — BUILD BLUEPRINT (build authority)

**Status:** BUILD AUTHORITY — sourcing resolved (framer-motion §1 + framer@3.0.4 §2/§3, all [SEEN-IN-CODE]
in s58-framer-CODE-model.md); designer gate PASS; @s58-qa REWORK findings 1-5 folded; re-submitted to
@s58-qa. Supersedes `s58-component-engine-architecture.md` (INPUT only — predated promote-to-css-module,
carried old sequencing language now resolved here). **No engine code until @s58-qa re-gate passes.**

Sourcing tags: **[CODE:framer]** from real framer-motion/Framer source (s58-framer-CODE-model.md) ·
**[CODE:ours]** from our real engine source (lib.ts / engine.ts, file:line) · **[OURS]** our design choice
(Framer's internal storage doesn't bind us). All sourcing is resolved — no pending placeholders remain.

---

## 0. The principle that makes this an ENGINE, not a vibe-coded tool
**The source code IS the document model. The editor is a bidirectional compiler.**
- READ: parse a component's `.tsx` + `.module.css` → a structured `ComponentModel` (variants, states,
  props, connectors, structure).
- WRITE: every edit is a **byte-exact, parse-guarded splice** through the existing `applyWrite` authority
  [CODE:ours lib.ts:1089 `applyWrite`], then **re-read** to reflect truth.
- There is NO shadow state that can drift from source. The inspector never shows an optimistic lie; after
  every write it re-parses. This is the anti-vibe-code contract — everything below obeys it.

## 1. ComponentModel — the READ layer (new: `editor-component-model` route + lib)
Parse a component into:
```
ComponentModel = {
  name, file (.tsx), cssModule (.module.css | null),   // null = not yet promoted (inline-styled)
  rootClass: string | null,                            // the .base local class, null pre-promotion
  props:    [{ name, tsType, controlType, default, boundTo }],
  variantAxes: [{ axis, values:[string], defaultValue }],   // CONFIG variants = N INDEPENDENT axes (D1); N=1
                                                            //   is the common case, NOT a special shape. Each
                                                            //   axis = one union-typed prop; values → delta classes.
  states: [{ name, kind:'interaction'|'semantic', selector, decls: {prop:value} }],  // the 6-state set (§6.2),
                                                            //   split OUT of config — states are orthogonal to
                                                            //   axes (D2), never members of a variant union.
  connectors:[{ from:'base'|axisValue, trigger, to:{axis,value}, transition,
                mode:'state'|'switch' }],   // F4: mode carried — 'state'=CSS pseudo, 'switch'=useState click (D4)
  variantState: { controlled:boolean, defaultVariant, hasUseState:boolean },  // F4/D3: switch → controllable state
  structure: StructureNode  // recursive JSX tree (D6): { tag, srcPos:{line,col}, className?, condVariant?, children[] }
}
```
How each field is parsed (all from existing primitives):
- **props** ← the exported function's destructured params + type literal (TS AST, same walker as
  [CODE:ours lib.ts:584 `renameComponentOp`] uses).
- **variantAxes (CONFIG, multi-axis — D1)** ← for EACH union-typed config prop (a prop whose values map to
  `.base.<axis>_<value>` rules), one axis `{axis, values, defaultValue}`. `defaultValue` = the param's
  default. A single-axis component (one prop, e.g. `variant`) is just `variantAxes.length===1` — same shape,
  not a legacy branch. Parse via postcss over `.base.<axis>_<value>` rules, same authority as
  [CODE:ours lib.ts:165 `resolveDeclRefs`].
- **states (BOTH kinds — the READ must mirror the WRITE, §6.2, or the model drifts on re-read):**
  INTERACTION states ← the `.base:hover|:active|:focus-visible|:disabled` pseudo-rules; SEMANTIC states ←
  the `.base[data-loading]` / `.base[data-error]` (and `[data-disabled]`) prop-class/data-attr rules PLUS
  their driving boolean prop in the signature. The engine re-reads the ComponentModel from source after
  every write, so parsing only pseudo-rules would lose loading/error and drift — parse both. Combinatorial
  rules (`.base.<axis>_<v>[data-loading]:hover`, D2) are decomposed back to their {axisValues, states} set.
- **connectors** ← each state/axis rule + its `transition` declaration; a `mode:'switch'` connector is read
  from its mandatory `@fc-connector` side-channel comment (D4), not inferred from JSX shape.
- **structure (D6)** ← the JSX AST walked recursively into `StructureNode` ([CODE:ours engine.ts:178
  `buildLayerTree` is the runtime analog; the server parse mirrors it]); each node carries its `{line,col}`
  source position (the addressing `set-variant-structure` uses) and any `condVariant` guard it sits under.
- **cssModule=null / rootClass=null** ← component is still inline-styled (pre-promotion). Model still
  returns props+structure; variantAxes/states are empty until promoted.
The model handles BOTH origins uniformly: converter output (already `.module.css`, e.g. mother-v2) and
react-figma-authored (inline) — the difference is only whether promotion has run.

## 2. promote-to-css-module — the SUBSTRATE op (the entry transform)
**Why it exists [CODE:ours]:** every react-figma-authored component is inline-styled — `create-component`
scaffolds `<div style={{…}}>` [CODE:ours lib.ts:875 `createComponent`], DemoButton is
`<button style={{…}}>`. There is no `.class` or `.module.css` to write a `:hover`/`.variant` rule onto.
Op-shape B (scoped CSS writes) cannot run until a module + class exist. This op creates them.

**Op:** `{ kind:'promote-element', file, line, col }` — promotes ONE element to a class in the
component's module (creating the module on first use).
1. Resolve the element at line:col (TS AST, [CODE:ours lib.ts:299 `findJsxAt`]).
2. Lift its inline `style={{…}}` object → a CSS rule `.<localName> { … }` in `<Name>.module.css`
   (create the file + `import styles from './<Name>.module.css'` if absent).
3. Replace `style={{…}}` with `className={styles.<localName>}` (merge if a className already exists).
4. **Refinements (all REQUIRED, from the 5 locked with the designer):**
   - **(R1) Not root-only:** promotes ANY targeted element. Root → `.base`; a child targeted by a
     variant/state → its own class. The op is per-element; the engine calls it on-demand when a
     scoped write targets an un-promoted element.
   - **(R2) Preserve var() tokens verbatim:** `style={{background:'var(--x)'}}` → `.base{background:var(--x)}`
     — never resolve/inline a token binding.
   - **(R3) Idempotent / already-module no-op:** if the element already has `className={styles.…}` and the
     module import exists (converter output, or already promoted) → NO-OP, return the existing class. This
     is what unifies inline-authored and converter components.
   - **(R4) Visual parity:** the promoted component must render pixel-identical (lifting inline→class is a
     representation change, not a style change). Gate asserts this live.
     **F4 caveat (specificity):** inline style = specificity 1000, a class = 10. In ISOLATION (gallery,
     scoped module) identical. But a promoted component used in a PAGE under higher-specificity global CSS
     (e.g. `.wrap button`) could newly lose a value it kept as inline. Visual-parity gate is isolation-only
     → it does NOT prove in-page parity. GUARD: on a detected in-page regression, escalate the promoted
     selector's specificity (`.base.base {…}` doubling, or a `.base[data-fc]` anchor) — a named escape, not
     a silent lift. Note surfaced so it's a known edge, not a surprise.
   - **(R5) Structural safety:** `assertValidTsx` BOTH files before either write [CODE:ours lib.ts:291],
     byte-exact splice, idempotent; git is rollback.

**§2.1 The style-object→CSS converter (F1 — where promote succeeds or silently corrupts; SPECIFIED + unit-tested):**
Lifting a React `style={{}}` object to a CSS rule must reproduce EXACTLY what React rendered, or visual
parity (R4) breaks silently. Exact rules:
1. **key: camelCase → kebab-case** (`backgroundColor`→`background-color`); a `--custom-prop` key passes
   through verbatim.
2. **number value → px ONLY for length props.** Mirror **React's own `isUnitlessNumber` set** (react-dom's
   authoritative list: opacity, zIndex, lineHeight, fontWeight, flex, flexGrow, flexShrink, order, zoom,
   gridRow/Column, aspectRatio, …) — a number on a unitless prop stays raw, a number on a length prop gets
   `px`, EXACTLY as React decided when it rendered. This is the anti-corruption core: our lift must equal
   React's render, not our own px heuristic.
3. **string value → passes through verbatim** (shorthands `font:'500 13px/1.2 system-ui'`,
   `padding:'10px 20px'`, `transform:'rotate(-90deg)'`), quote-stripped at the object boundary only.
4. **var() token → verbatim** (R2). Comma-lists, calc(), gradients → verbatim.
5. Emit deterministically (property order = source order) so a re-promote is byte-identical.
[§9 adds a dedicated converter unit-test matrix: each rule + the unitless-vs-length boundary + shorthands.]

## 3. The WRITE ops — full set (each an AST/CSS contract, extends `applyWrite`)
All jailed + parse-guarded like the existing ops [CODE:ours lib.ts:91 `jailModuleCss`, :291 `assertValidTsx`].
1. **`promote-element`** — §2.
2. **`write-scoped-declaration`** `{file, localClass, scope, prop, value}` — the ONE scoped write, now
   **multi-axis + combinatorial** (folds D1/D2 — single-axis is just the N=1, zero-state case, NOT a
   separate shape). Scope is a COMPOSITE descriptor:
   ```
   scope = { axisValues?: [{axis, value}],        // 0..N config-axis selectors (D1) — each → .base.<axis>_<value>
             pseudo?: 'hover'|'active'|'focus-visible'|'disabled',   // 0..1 interaction state
             semantic?: ['loading'|'error'|'disabled'] }             // 0..N semantic states (D2, orthogonal)
   ```
   base = `{}` (all empty). **`scopedSelector(scope)` builds ONE selector in a DETERMINISTIC order** so any
   two edits to the same target hit the same rule (no duplicate/near-miss rules):
   `.base` + axis classes `.<axis>_<value>` **sorted by the axis's index in `variantAxes`** + semantic
   `[data-<state>]` **sorted by the 6-state order** + the single `:pseudo` **last**. So
   `{axisValues:[{size,lg}], semantic:[loading], pseudo:hover}` → `.base.size_lg[data-loading]:hover`.
   **Separator law:** `<axis>_<value>`, joined by a single `_`; axis names are prop identifiers (camelCase,
   never contain `_`) so the READ splits on the FIRST `_` → axis, remainder → value (values may contain any
   char). This is the exact string `classifyScopedSelector` parses — WRITE and READ share it.
   Creates the rule if absent; **DELTA discipline applies to the MOST-SPECIFIC rule only** (a decl lives in
   the deepest rule that changes it; base values are never duplicated up the stack).
   **Subsumes** the current `add-state-rule` [CODE:ours lib.ts:1106], generalized to the full 6-state set
   (§6.2) + N variant axes. Shares ONE module-CSS declaration-locator with the style-prop var-rewrite (§5).
   [CODE:ours — GROUNDING: the designer's I1 `editTarget` is already a descriptor and the `applyOverride`
   redirect already routes through this op; multi-axis needs only the scope shape above + the selector
   builder, NOT a substrate rewrite — confirmed by the builder against the shipped I1 code.]
   **F3/F2b — pseudo-state preview (selector fixed to match the real wrapper):** a `:hover`/`:focus`/`:active`
   rule can't be force-rendered statically, and the gallery renders `React.createElement(f.Comp)` INSIDE a
   host frame [CODE:ours components-canvas/page.tsx:147-152] — so `data-preview` lands on the WRAPPER, NOT on
   the component's `.base` element; a `.base[data-preview]` selector would never match. Exact mechanism: the
   pseudo-state rule emits an **ANCESTOR dual selector** —
   `.base:hover, :global([data-fc-preview="hover"]) .base { … }`. The gallery sets `data-fc-preview="hover"`
   on the host frame (the ancestor wrapper it already controls); the `:global(...)` escapes the CSS-module
   hash so the global wrapper attr matches, and ` .base` re-scopes to this component's root beneath it. The
   `:global([data-fc-preview]) .base` half is EDITOR-ONLY: on Keep/Export it is stripped, shipped CSS = pure
   `.base:hover`. GATE (§9): set data-fc-preview on a frame → the `:hover` styling renders statically (not
   just on real hover). Prop-class states (loading/error) need no preview selector — `[data-<state>]` on
   `.base` is already forced by toggling the boolean prop, which IS their real production selector.
3. **`mint-union-prop`** `{file, propName, values, defaultValue}` — the SHARED AST primitive (D1 lead-catch
   fix): add/extend a union-typed prop on the exported function's param + type literal, unique-name guarded.
   **Built in I2** (for `add-variant-axis`), **reused by `expose-as-prop` Enum in I3** — removes the I2→I3
   forward dependency. [CODE:ours — GROUNDING: generalizes the designer's shipped I1 `addBooleanPropToComponent`
   helper from `boolean` to a string-union type; same AST param-surgery path, not net-new.]
3a. **`add-variant-axis`** `{file, axis, values, defaultValue}` — a NEW config axis (D1): calls
   `mint-union-prop` to add the `<axis>` union prop, seeds each value's empty `.base.<axis>_<value>` delta
   class, ensures `className` composes `styles[`${axis}_${props[axis] ?? defaultValue}`]` into the join.
   NOT a new export — one component, one prop per axis.
3b. **`add-variant-value`** `{file, axis, value}` — extend ONE existing axis's union (+ its `.base.<axis>_
   <value>` class). Thin over `mint-union-prop` (extend) + one empty scoped rule.
4. **`rename-variant-value` / `delete-variant-axis` / `delete-variant-value`** — rename/remove a value (union
   member + its class) or a whole axis (the prop + all its classes); delete refuses if an instance uses that
   axis/value (consumer walk, [CODE:ours lib.ts:616 pattern]).
5. **`add-state`** `{file, state}` — [CODE:framer §2.1 two-kind]. Makes a state AUTHORABLE; add-state itself
   does NOT write the state's style rule (that lands on the first scoped inspector edit) — it establishes the
   state's existence + the shared base transition:
   - INTERACTION (hover/pressed/focus) → ensure the idempotent base `transition` (§6.3); the `.base:<pseudo>`
     rule (`hover→:hover`, `pressed→:active`, `focus→:focus-visible`) is created on the first scoped edit.
   - **`disabled` is ROOT-TAG-AWARE (F-M2 — `:disabled` only matches FORM elements):** a form-associated root
     (button/input/select/textarea/fieldset) → `:disabled`; ANY OTHER root (e.g. a `<div>`, which is most
     converted components incl. mother-v2) → the SEMANTIC data-attr path `.base[data-disabled]` + a
     `data-disabled` toggle — because `.base:disabled` on a non-form element is DEAD CSS (measured). Never
     emit a bare `:disabled` for a non-form root.
   - SEMANTIC (loading/error, and disabled-on-non-form) → add the boolean `<state>` prop + the
     `data-<state>={state||undefined}` toggle on the root (reuses the shared `mint-union-prop`/boolean-prop
     path). The state EXISTS the moment add-state runs — the READ lists it from PROP PRESENCE immediately
     (per shipped I1), so the model round-trips before any styling edit; the `.base[data-<state>]` RULE is
     created on the first scoped edit. Idempotent: re-adding an existing state re-targets, never 409s.
   Both branches converge on ONE idempotent base `transition` write (§6.3) — no last-write-wins collision.
6. **`set-connector`** `{file, from, trigger, to, transition, mode}` — TWO connector KINDS (F2 — do NOT
   silently collapse tap→:active; that loses Framer's persistent on-click variant switch used by
   toggles/tabs/segmented):
   - **MOMENTARY interaction-state** (`mode:'state'`): trigger hover/press/focus, `to` = an interaction
     state → writes the `.base:<pseudo>` rule (the `to` delta) + CSS `transition`/`linear()` [CODE:framer
     §1.2/§1.3]. Pure CSS, no JS. `:active` here = while-pressed styling only.
   - **PERSISTENT variant-switch-on-click** (`mode:'switch'`): trigger tap, `to` = a CONFIG axis value → CSS
     cannot switch-and-hold, so compile to the idiomatic React controllable-state pattern (D3): a
     `useControllable(props.<axis>, defaultValue)` hook (uncontrolled by default, controlled when the parent
     passes the prop — see D3) + `onClick={() => set('<to>')}` (or cycle for a toggle — [CODE:framer
     `CycleVariantState`, §2.1]). This is the **ONE explicitly-allowed JS** for click interactions — named,
     minimal, clean idiomatic React, NOT a proprietary runtime. **READ source of truth (D4, DECIDED — no
     inference):** `set-connector` writes a mandatory side-channel comment `/* @fc-connector: tap <axis>→<to>
     [cycle?] */` above the handler; the ComponentModel READS the connector back from THAT comment, never by
     pattern-matching the useState/onClick shape (which is fragile across formattings). The comment PERSISTS
     on export (harmless authoring metadata, keeps the component round-trippable). Full parity: toggles/tabs
     work. JS-only MOTION triggers (inView/exit/animate/drag) remain OUT (page motion, not component state).
7. **`expose-as-prop`** — §5.
8. **`set-instance-prop`** `{file, line, col, propName, value}` — write/update a JSX attribute on an
   instance (NEW — no attr-write op exists today; style/text/link/name only). Refuses on non-instance.
9. **`set-variant-structure`** `{file, axisValue:{axis,value}, edit}` — STRUCTURAL variants (Framer variants
   differ in LAYERS, not only style — full-parity, NOT deferred). Compiles a per-axis-value divergence to
   FLAT CONDITIONAL JSX (one guard per diverging subtree, keyed on the axis prop — never nested ternaries).
   **`edit` payload (fully specified — three ops, source-position addressed):**
   - `{op:'add', anchor:{line,col}, position:'before'|'after'|'firstChild'|'lastChild', jsx}` → insert a new
     subtree at the anchor, wrapped `{props.<axis> === '<value>' && ( <jsx/> )}` (show-in-this-value).
   - `{op:'remove', target:{line,col}}` → wrap the existing target subtree `{props.<axis> !== '<value>' && (
     <target/> )}` (hide-in-this-value) — the node stays in source, guarded; never physically deleted (so
     other values keep it).
   - `{op:'swap', target:{line,col}, jsx}` → `{props.<axis> === '<value>' ? ( <jsx/> ) : ( <target/> )}` —
     the ONE allowed ternary, single-level, at the swap site only.
   **Target identity = source `{line,col}`** (same addressing as `promote-element`/`set-instance-prop`),
   resolved via [CODE:ours lib.ts:299 `findJsxAt`]. `assertValidTsx` both branches before write.
   **Refusal taxonomy (422):** target not found at line:col; target already under a *different* axis's guard
   (would nest guards ambiguously — refuse, require editing at the outer guard); **DEEP REPARENTING — moving
   a node to a different parent — is the EXPLICIT CURRENT BOUNDARY, refused** `"deep reparenting unsupported:
   add/remove/swap within a subtree only"`. This is a named refusal, not a deferral: add/remove/swap cover
   Framer's structural-variant surface for token-driven components; cross-parent moves are the walled edge
   with an explicit error, so a builder/user hits a clear boundary, never silent partial behavior.
   The variant board's insert/delete-in-a-value routes here. Sequenced last (I6) — build order, fully specified.

## 4. editTarget — the one mechanism (inspector routing) — STACKED descriptor (D1/D2)
Runtime state is a COMPOSITE descriptor, structurally identical to `write-scoped-declaration`'s scope
(§3.2) so editTarget → scope is a direct pass-through:
```
editTarget = { axisValues: [{axis, value}], pseudo?: <interaction>, semantic?: [<semantic>] }   // base = all empty
```
The user selects zero-or-more axis-value chips (grouped by axis: `Size: sm md lg | Color: …`) PLUS zero-or-
more state chips (Hover·Pressed·Focus·Disabled·Loading·Error) — so `Size=lg` + `Hover` edits
`.base.size_lg:hover`, the combinatorial target (D2). Every existing inspector edit ([CODE:ours page.tsx
`applyOverride`]) routes through it: on commit, instead of always the base rule, it calls
`write-scoped-declaration` with `editTarget` as the scope. Multi-axis-editing, state-editing, combinatorial-
editing, base-editing = the SAME action. New UI = the axis-grouped chips + state chips only. If the targeted
element isn't promoted yet → `promote-element` fires first (transparent). [CODE:ours — the designer's I1
`editTarget` was already built descriptor-first for exactly this; the redirect needs the composite scope
above, not a rewrite.]

## 5. Props / expose-as-prop + the custom-property bridge — [CODE:framer §3 ControlType, grounded]
`expose-as-prop {file, line, col, target:'text'|'attr'|'inline-style'|'module-css', attrName?, propName,
controlType, enumOptions?}`. Route BY TARGET LOCATION:
- text/attr/inline-style → literal-swap (`{propName}` / `x={propName}` / `color:props.color`).
- **module-css value → custom-property bridge (F1 — precedence made coherent):** exposing a value as a
  prop rewrites that property in **EVERY rule that declares it** — the base rule AND every variant/state
  delta that sets the same property — each to `var(--<propName>, <that-rule's-own-literal>)`, keeping its
  own literal as the fallback. Then add `style={{'--<propName>': propName}}` on the ROOT; the prop is
  OPTIONAL, default `undefined` (React omits an undefined custom property). Result — ONE coherent
  precedence, **explicit prop > variant > base**, and it actually compiles:
  - prop PROVIDED → `--<propName>` is set on the root and cascades into base + all variant/state rules →
    every rule resolves the var to the explicit value → **explicit prop wins everywhere** (incl. over a
    variant that also set that prop).
  - prop UNSET → `--<propName>` undefined → each rule falls to its OWN literal fallback → the variant/state
    rule (higher specificity `.base.secondary` / `.base:hover`) beats `.base` → **variant > base**.
  (The earlier "only base rewritten, variants still win" was self-contradictory — a variant's literal would
  beat the prop. Rewriting every declaring rule is what makes explicit-prop-wins true.)
  GATE (§9): expose a color that base AND a variant both set → prop provided wins in base-view AND
  variant-view; prop unset → variant beats base. Assert generated CSS + live render.
Refusal taxonomy: not-a-literal→422; propName collision→409; multi-element literal (ambiguous)→422 unless
one shared module-css decl (then one var drives all — desired).

**controlType set — mapped from Framer's REAL `ControlType` enum** [CODE:framer §3, framer@3.0.4] (Framer
declares 27 members; we do NOT claim "27-parity" — the list below is what's built, in INCREMENT ORDER, and
what's explicitly outside component-authoring parity):
- **IN — built (increment order, none skipped):** `String`→text prop (literal-swap) · `Number`→number prop
  (literal / bridge for dimensions) · `Boolean`→boolean prop (also drives loading/error state — §6) ·
  `Enum`/`SegmentedEnum`→string-union prop (the variant selector + arbitrary option props) · `Color`→color
  prop (bridge) · `Image`/`ResponsiveImage`→`src` prop (attr-swap on `<img>`) · `Link`→`href` (reuse
  `wrap-jsx-link`) · `Font`→font-family (bridge) · style controls `BoxShadow`/`Border`/`Padding`/
  `BorderRadius`/`Gap`→module-css values via the bridge · `ComponentInstance`/`Slot`→children/slot prop
  (structural, lands with I6) · `EventHandler`→`onClick`/`on*` handler prop · `Transition`→the connector's
  transition (§6, not a value prop).
- **OUT — explicitly outside component-authoring parity (data-binding controls, no component-STATE meaning;
  named, not invented):** `Array`, `Object`, `Date`, `File`, `Cursor`, `TrackingId`, `FusedNumber`.

## 6. Variant + STATE + transition COMPILE — [CODE:framer §1 motion + §2 EnabledGestures, grounded]
### 6.1 Variants — keyed delta → prop + class, MULTI-AXIS (D1, folded into §1/§3/§4)
A config axis = keyed value→style-delta (§1.1 `Variants`) → one `<axis>` string-union prop + `.base.<axis>_
<value>` delta classes. A component carries N INDEPENDENT axes (`variantAxes`, §1); a single-axis component
is N=1, not a special shape. `className` COMPOSES all axes (CVA pattern):
`className={[styles.base, ...variantAxes.map(ax => styles[`${ax.axis}_${props[ax.axis] ?? ax.defaultValue}`])].filter(Boolean).join(' ')}`
— class key `` `${axis}_${props[axis] ?? defaultValue}` `` (prop absent → the axis default composes, never
`undefined`). [CODE:framer §2.2: Framer compiles to variant prop(s) + a motion `variants` map — our composed
CSS delta-classes are the static equivalent; multi-axis combining = the CVA pattern, D1.]
### 6.2 States — TWO KINDS (Framer's real `EnabledGestures = {hover,pressed,loading,error}`, §2.1)
- **INTERACTION states → CSS PSEUDO-rules (automatic, no JS):**
  - `hover` → `.base:hover` (§1.2 `whileHover`) · `pressed` → `.base:active` (`whileTap`) ·
    `focus` → `.base:focus-visible` (`whileFocus`) [OURS-superset, web-standard] ·
    `disabled` → `.base:disabled` (form els) / `.base[data-disabled]` (others) [OURS-superset].
- **SEMANTIC states → PROP-DRIVEN class (app state, NO pseudo — Framer's `loading`/`error`, §2.1):**
  - `loading` → a boolean `loading` prop → toggles `.base` `data-loading`/`.is-loading`, styled by a
    `.base[data-loading]` rule. `error` → same via an `error` prop. [CODE:framer §2.1 — these are
    component state props, not motion gestures.]
- So the editTarget **state chips = Hover · Pressed · Focus · Disabled · Loading · Error** (6). Marked
  which are Framer-parity (hover/pressed/loading/error) vs ours-beyond (focus/disabled).
### 6.3 Transition — real motion physics → clean CSS
Spring{stiffness,damping,mass}/Tween{duration,ease} (§1.3) → CSS `transition` (tween direct; spring →
sampled `linear()` easing via motion's spring generator). **Lives on the BASE rule, NOT the state/variant
rule (bidirectional — Framer parity, corrected per F-M1/lead).** A transition on a `.base:hover` rule only
animates on ENTER (leaving `:hover` returns to `.base`, which would carry no transition → snaps back
instantly); putting `transition` on `.base` animates BOTH enter and exit. So `add-state` writes ONE canonical
base transition `transition: all .15s ease` (the `all` superset covers every property either an interaction
or a semantic state animates); it is IDEMPOTENT — if the base rule already declares `transition`, add-state
does NOT overwrite it (killing the last-write-wins collision F-M1 measured, where a later semantic add-state
narrowed a prior interaction transition). Per-state transition *tuning* (a specific spring on one state) is
authored later via `set-connector` (§3.6, I4); the default is the shared bidirectional base transition.
### 6.4 Propagation → free via CSS class cascade (§1.1 note; motion needs JS context, CSS doesn't).

## 7. Gallery prop-union render change — [CODE:ours needed, §2.2 validated]
components-canvas currently renders NAMED EXPORTS as frames [CODE:ours components-canvas/page.tsx
`collectFrames`]. New variants are AXIS PROP values (§6.1), not exports → the gallery renders a frame per
axis-value (`<Comp <axis>=X/>`), grouped by axis (§1 `variantAxes` → the axis-grouped board, D1); a
multi-axis component shows one group per axis (+ optional compound frames). State frames render the pseudo/
prop states by setting `data-fc-preview="<state>"` on the host frame — the ONE preview contract, §3.2. Same
increment as add-variant-axis, or variants won't appear on the board. **§2.2 confirms this matches Framer's
real compile** (variant prop(s) + variant map).
Legacy multi-export (DemoButton/DemoButtonGhost) → a later `merge-exports-into-variants` migration
[OURS — cleanup of pre-engine components, not a parity gap].

## 8. Determinism / safety / read-back
Every op: jailed path, `assertValidTsx`/postcss parse-guard BEFORE write, byte-exact splice, idempotent,
specific refusal errors, git rollback. After every write the editor RE-READS the ComponentModel (no
optimistic UI). Two-repo discipline: ops that touch the global library (onemo-component-library) snapshot
+ verify BOTH repos' git state (the pollution that 500'd the editor came from checking one repo only).

## 9. Test strategy (executable gates, not eyeballing)
- **Round-trip:** ComponentModel → source → re-parse → identical model (idempotency proof).
- **Visual parity:** promote a component → screenshot-diff pre/post = identical (R4).
- **Output assertion:** after add-variant-axis + a scoped write, the generated `.tsx`+`.module.css` match a
  golden clean-code shape (a real shadcn-grade component), tsc 0, eslint baseline.
- **Multi-axis composition (D1, finding 2):** (a) DEFAULTED axis — a component with `variantAxes=[{size,
  [sm,md,lg], md}]`, rendered with NO `size` prop → `className` composes `styles.size_md` (the default, NOT
  `undefined`/omitted); (b) TWO-AXIS — add a 2nd axis `variant`, set both → `className` = `.base.size_lg
  .variant_primary`, each delta applies, `<Comp size=lg variant=primary/>` renders the composed result.
- **Combinatorial selector (D2, finding 3):** editTarget `{axisValues:[{size,lg}], semantic:[loading],
  pseudo:hover}` → the write lands in EXACTLY `.base.size_lg[data-loading]:hover` (deterministic order,
  §3.2), a read-back preserves the full combination, and delta discipline put the decl in that most-specific
  rule only (not duplicated up the stack).
- **Live clickthrough:** browser — add an axis + value, edit a state, hover works in preview, prop overrides.
- **Token preservation, already-module no-op, child promotion** each have a unit case.
- **Style-object→CSS converter matrix (F1):** camelCase→kebab; number→px on a length prop vs raw on each
  unitless prop (React `isUnitlessNumber` boundary — opacity/zIndex/lineHeight/fontWeight/flex/order/…);
  shorthand strings passthrough (font/padding/transform); var()/calc()/gradient verbatim; determinism
  (re-promote byte-identical). This test is the gate on promote not silently corrupting styles.
- **Dual-selector strip (F3):** assert the exact contract — shipped CSS after Export = pure `.base:hover`
  (the `:global([data-fc-preview="hover"]) .base` half removed), editor build carries that exact half.
- **Persistent variant-switch (F2):** a tap-switch connector emits valid useState + onClick, tsc 0, and
  clicking in preview switches-and-holds the variant.

## 10. Gated increment plan (build sequence — each an INTERNAL gate, not a report-to-Dan)
Build e2e; I adversarially gate each increment live before the next; ONE report to Dan when the node
system WORKS.
- **I0 substrate:** promote-element + write-scoped-declaration + ComponentModel read. Gate: promote
  DemoButton → module+.base+className+import, visual-identical, write `.base:hover` real pseudo-rule, tsc0.
- **I1 states (all 6, two-kind §6.2):** editTarget chips Hover·Pressed·Focus·Disabled·Loading·Error →
  scoped writes. Gate: pick Hover, edit bg → `.base:hover`, live hover in preview; pick Loading → real
  `loading` boolean prop + `data-loading` toggle, state LISTS in the model from prop presence immediately
  (round-trips before any styling edit), then editing it writes `.base[data-loading]`, toggling the prop
  shows the style; clean CSS. **F-M2 gate: on a `<div>`-root component (mother-v2), Disabled emits
  `.base[data-disabled]` (NOT dead `.base:disabled`); on a `<button>` root it emits `:disabled`.** **F-M1
  gate: add Hover THEN Loading → the base `transition` survives as ONE `all` declaration (not overwritten/
  narrowed), animating bidirectionally (§6.3).**
- **I2 config variants (multi-axis per D1):** `mint-union-prop` primitive + `add-variant-axis`/
  `add-variant-value` + axis-aware variant chips (`{axis,value}` descriptor) + gallery prop-union render.
  Gate: add an axis + a value, edit delta, `<Comp size=x/>` renders, both frames on the board; add a SECOND
  axis → className composes both (`.base.size_lg.variant_primary`). NOTE (I2/I3 interleave): I2 BUILDS the
  shared `mint-union-prop` primitive (add/extend a union-typed prop); I3's expose-as-prop REUSES it — so the
  designer builds mint-union-prop in I2, not I3, and hits no wall mid-I2.
- **I3 props:** expose-as-prop (REUSES I2's `mint-union-prop` for Enum + bridge, F1 rewrite-every-declaring-
  rule) + props panel + set-instance-prop. Gate: expose a color base AND a variant both set → prop-provided
  wins in base-view AND variant-view; prop-unset → variant beats base (precedence explicit-prop > variant >
  base, per §5); instance override real.
- **I4 connectors (BOTH modes, F4):** set-connector authoring. Gate (mode:'state'): wire hover→Hover → real
  `.base:hover` + CSS transition, live. Gate (mode:'switch'): wire tap→an axis value → emits the D3
  controllable hook (`useControllable`, NOT naive `useState(props.x ?? d)`) + `onClick` + the mandatory
  `/* @fc-connector: tap <axis>→<to> */` side-channel, tsc 0, clicking in preview switches-AND-HOLDS.
  D3 desync gate: controlled mount → parent prop change reflects; uncontrolled → click holds. ComponentModel
  round-trips the connector's mode/to by READING the side-channel comment (D4), not by JSX inference.
- **I5 variant board UI:** the full Framer-layout board — **axis-grouped** (each axis a group, its values the
  frames — D1) + state ghost slots + +Axis/+Value, breadcrumb-integrated. Gate: board matches Framer layout,
  multi-axis groups render, all authoring works from it.
- **I6 structural variants:** `set-variant-structure` add/remove/swap (payloads/refusals per §3.9) → flat
  conditional JSX. Gate: a value shows an extra child via `{props.<axis>==='<value>' && …}`, `<Comp axis=x/>`
  renders it, other values don't, deep-reparent refuses 422, tsc 0.

---
# BLUEPRINT DEEPENING v2 — the production/parity depth-gaps meta found, now FOLDED INTO the base contract
> **STATUS: D1 + D2 are FOLDED into the authoritative base contract (§1 ComponentModel `variantAxes`+`states`,
> §3.2 composite `scope`+`scopedSelector`, §3.3 `mint-union-prop`/`add-variant-axis`/`add-variant-value`, §4
> stacked `editTarget`). There is NO competing shape — the base IS multi-axis; this section is the GROUNDING
> + rationale + the read/decision specs (D3–D6) that live only here.** Runs parallel to I1 (state UI is
> axis-orthogonal). Grounded in real code before I2 builds on it, so we don't rebuild.

## D1 — MULTI-AXIS variants (load-bearing) — GROUNDING for the folded §1/§3/§4 [CODE:framer §1+§3, CVA cited]
Precise attribution (lead-verified against my OWN §1): **Framer's `Variants` is a FLAT keyed map — a single
named variant SET, NOT multi-axis-combining** (s58-framer-CODE-model.md §1.1). So `size × color × emphasis`
combining is a **production-DS requirement — the CVA pattern** ([CODE:cva class-variance-authority@0.7.1,
`onemo-next-editor/node_modules/class-variance-authority/dist/index.d.ts:22-35`: `variants` map +
`defaultVariants` + `compoundVariants`, `cva(base, config)(props)`]) **+ Framer's PROPERTY CONTROLS** —
Framer delivers combining dimensions via multiple `ControlType.Enum` props [CODE:framer §3], NOT via its
variant set. Dan wants BOTH (Framer parity AND production), so multi-axis is IN — delivered as a
**GENERALIZATION of two pieces the base ALREADY had**, not a redesign, now folded so the base is the single
authority:
- §6.1: variant → union prop + delta class. §5: Enum/SegmentedEnum → a union prop. **These are ONE
  mechanism:** a variant-set axis and an Enum-prop axis are the SAME thing — a union-typed prop whose values
  map to delta classes, composed. 1 axis → N. Folded into §1 `variantAxes` (config) split from `states`.
- **Compile = className COMPOSITION over the `variantAxes`** (EXACT — finding-2 fix; iterate the axis
  DESCRIPTORS, key by `axis` with the default fallback, never treat a descriptor as a key):
  ```
  className={[styles.base, ...variantAxes.map(ax =>
      styles[`${ax.axis}_${props[ax.axis] ?? ax.defaultValue}`])].filter(Boolean).join(' ')}
  ```
  class key = `` `${axis}_${props[axis] ?? defaultValue}` `` (prop absent → the axis default composes, NOT
  `undefined`). Delta classes `.base.<axis>_<value>`, `_`-joined, axis names never contain `_` (§3.2
  separator law). Static CSS, the CVA shape.
- **Folded into §4:** `editTarget` keyed on the composite `{axisValues, pseudo, semantic}` descriptor.
  **Folded into §1:** `variantAxes:[{axis, values, defaultValue}]`. **Folded into §3.3:** `mint-union-prop`
  (built I2, reused by expose-as-prop I3 — the lead-catch forward-dependency fix) + `add-variant-axis`/
  `add-variant-value`. **Folded into §3.2:** axis-value rules are scopes of the generalized
  `write-scoped-declaration`; the selector builder composes them.
- **Board (I5):** each axis = a group, its values = frames. Framer's single variant-set = ONE axis (parity);
  N axes = the CVA production superset. Axis-aware from I2 so the board isn't rebuilt at I5.
- **Precedence (§5 bridge):** a style-prop's `var(--x)` fallback lives in EACH axis-value rule (F1 "rewrite
  every declaring rule" covers axis rules) → explicit prop > any axis value > base holds.
BOUNDED-CHECK: generalizes §5+§6.1, reuses the §3.2 write op (selector builder generalized, NOT a new
substrate — corrected per the lead's honest re-call and s58-qa finding 3), grounds `mint-union-prop` in the
designer's shipped `addBooleanPropToComponent`. No from-scratch redesign.

## D2 — COMBINATORIAL states (hover WHILE loading) — FOLDED into §3.2 + §4 [CODE:framer §2.1 states ⊥ variants]
States are ORTHOGONAL to axes — never members of a variant union. The composite `scope`/`editTarget` (§3.2,
§4) STACKS them: `Size=lg` + `Loading` + `Hover` → the generalized `scopedSelector` emits
`.base.size_lg[data-loading]:hover` in the DETERMINISTIC order defined in §3.2 (base + axis classes sorted
by `variantAxes` index + semantic `[data-<state>]` sorted by 6-state order + trailing `:pseudo`). READ
decomposes that rule back to `{axisValues:[{size,lg}], semantic:[loading], pseudo:hover}` (§1 states parse).
Delta discipline: the decl lives in the MOST-SPECIFIC rule only. This is the §3.2 generalized selector
builder — the single new bounded piece finding-3 required; there is no separate combinatorial op.

## D3 — CONTROLLED/UNCONTROLLED switch (kill the desync footgun) [OURS/PATTERN — controlled/uncontrolled React idiom]
The draft `useState(props.<axis> ?? default)` DESYNCS — when the parent later changes the prop, internal
state ignores it (a production bug baked in the spec). Spec the REAL idiom (the standard controlled/
uncontrolled React pattern — [OURS/PATTERN], not a cited package; ships as our own `useControllable` helper,
no dependency): `const [internal, setInternal] = useState(props.default<Axis>); const value = props.<axis>
?? internal;` and the switch onClick calls `setInternal` ONLY when uncontrolled (`props.<axis> == null`). So
a controlled parent ALWAYS wins; uncontrolled self-manages. The `set-connector` mode:'switch' emits this
exact hook, not the naive useState. Gate (I4): mount controlled → parent prop change reflects; mount
uncontrolled → click switches-and-holds; no desync.

## D4 — LOSSY-READ audit (no drift at I4) — DECIDED source-of-truth for every lossy field (no fake decisions)
- **TRANSITION (irreversible) — DECIDED:** spring→CSS `linear()` CANNOT be reversed to stiffness/damping, so
  the CSS is the OUTPUT and the parseable SIDE-CHANNEL comment IS the source of truth:
  `/* @fc-transition: spring 260 20 1 */` (stiffness damping mass), written above the rule. The READ parses
  THIS and re-emits the `linear()`. **The comment PERSISTS on export** (lead-decided) — it's a benign CSS
  comment, and keeping it makes the exported component round-trippable back into the editor. Not "stays or
  stripped": it stays. Never reverse-engineer the easing.
- **SWITCH CONNECTOR — DECIDED:** the READ does NOT infer the switch from JSX shape (fragile across
  formattings). `set-connector` writes a MANDATORY side-channel comment `/* @fc-connector: tap <axis>→<to>
  [cycle?] */` above the handler (§3.6); the READ parses THAT → `connector{mode:'switch', trigger:'tap',
  to}`. Side-channel is the single source of truth — no "if fragile" fallback.
- **INSTANCE OVERRIDES (lossless by construction):** an instance's overrides ARE its JSX attributes — the
  instance-model READ parses `<Comp variant="x" size="lg"/>`'s attrs = the overrides. Source is truth.
- Gates (I4): write→read→write each of transition + switch connector; the re-read model equals the written
  model (no drift), and a re-emit produces byte-identical source.

## D5 — STRUCTURAL variants — FOLDED into §3.9 (`set-variant-structure` payloads + refusals fully specified)
The op, its three `edit` payloads (add/remove/swap, source-position addressed), the flat-one-conditional-per-
subtree compile (never nested ternaries), and the refusal taxonomy are now FULLY specified in §3.9 as build
authority. Two decided points that live here as rationale:
- **Compile is FLAT:** add → `{props.<axis>==='x' && <Extra/>}`; remove → `{props.<axis>!=='x' && <T/>}`; swap
  → the ONE allowed single-level ternary at the swap site. Multiple diffs = multiple INDEPENDENT flat
  conditionals, never nested. Shared layers stay shared (name-matched).
- **DEEP REPARENTING is the EXPLICIT CURRENT BOUNDARY (a named refusal, NOT a loose "v1/later"):** §3.9
  refuses moving a node to a different parent with a 422 `"deep reparenting unsupported"`. add/remove/swap
  cover Framer's structural-variant surface for token-driven components; the cross-parent case is walled with
  a clear error so a builder/user hits a defined boundary, never silent partial behavior.

## D6 — ComponentModel `structure` READ — FOLDED into §1 (`StructureNode` recursive tree)
Folded into §1's model: `structure: StructureNode` = `{ tag, srcPos:{line,col}, className?, condVariant?,
children[] }` — a recursive JSX-return-tree parsed server-side via the TS AST (the server mirror of
[CODE:ours engine.ts:178 `buildLayerTree`]). Each node carries the `{line,col}` that `set-variant-structure`
(§3.9) addresses and any `condVariant` guard it sits under. Fixes the I0 gap where mother-v2 returned
`structure:None`. Gate: read mother-v2 → structure is the real tree (motherV2 → topSection → … → dial), and
each node's `srcPos` resolves back to the right JSX element.

---
**Status:** I0 shipped + QA PASS + Meta PASS (measured: R4 computed-style hash-equal across 1348 props;
adversarial refusal + child-promote; read works on real mother-v2). I1 states shipped (in the gate funnel).
DEEPENING v2 REWORK (s58-qa 6 findings) FOLDED into the base contract: multi-axis is now the base §1/§3/§4
authority (no competing appendix shape), compile pseudocode corrected, `scopedSelector` generalized +
selector-order specified, D4 lossy-read decisions made firm, §3.9 structural payloads/refusals specified,
CVA cited + Radix downgraded to [OURS/PATTERN]. → re-gate @s58-qa → @s58-lead sign → build I2 against it.
I1 proceeds in parallel (axis-orthogonal).
