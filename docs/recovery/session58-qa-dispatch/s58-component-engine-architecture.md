# react-figma component engine — architecture + op-shapes (@s58-expert, 2026-07-08)

## LIVE-VERIFIED by @s58-expert (own Framer extraction, not docs/relay) — 2026-07-08
I reached Framer myself (own tab, Dan's authed workspace) and extracted from its runtime. Framer's
canvas is WebGL (not console-readable) but the PANELS are real DOM and the storage is inspectable.
Verified by my own eyes/console, NOT docs:
- **Engine = "Vekter"; project = CRDT-backed** (IndexedDB `crdt-sync-cache`, `VekterUserDefaults`). The
  document model syncs from Framer's backend into memory — the raw CRDT holds version/refs, not a
  decodable tree, so component-node internals aren't console-dumpable. Storage model confirmed.
- **Config-vs-state variant separation [now SEEN by me, upgrades the designer's SEEN]:** in the `test`
  component editor, config variants (`Variant 1 · Primary`, `Variant 2`, ghost `+ Variant`) sit in one
  row; **`Hover / Pressed` is a separate ghost slot BELOW them.** One canvas, two distinct variant
  roles — exactly the Q2 ground truth. This is the crux fact and it's confirmed.
- **Variant inspector = the frame inspector** (SEEN): Interactions · Link · Position&Size · Layout
  (Stack/Grid, Direction, Distribute, Align, Wrap, Gap, Padding) · Effects · Overlays · Cursor · Styles.
- **Transition = Spring, a first-class Style property** (SEEN) — with the ⚡ icon; ⚡ connector on the
  variant's edge (SEEN). Confirms transition is per-variant, spring default.
- **Interactions "+" primitives = exactly `New Transition` + `New Event`** (SEEN, opened + Escaped, Dan's
  project NOT mutated).
- **Breadcrumb `Home > test`** (SEEN) + **Assets = Templates/Components/Styles/Vectors/Code** (SEEN).

STILL doc-sourced (I did NOT verify, because revealing it requires CREATING an interaction = mutating
Dan's project): the exact trigger enum (hover/press/focus vs appear/scroll/time/exit) reached via
New Event. **Why it's not load-bearing:** the CSS-vs-JS compile partition is a property of the WEB
PLATFORM, not of Framer's labels — hover/press/focus have CSS pseudo-classes and appear/scroll/time do
not, regardless of what Framer calls them. So the architecture below is robust to the exact enum. If we
want the verbatim list, one `New Event` on a throwaway component (not Dan's) reveals it — flag if needed.
Net: every fact the architecture leans on is now live-verified; only a non-load-bearing label list stays doc-sourced.

---


Reasoned from the designer's Framer extraction (s58-framer-variant-state-model.md). This is the
compile-target + the two AST op-shapes (expose-as-prop, scoped-write/state-selector) for the B/C build.
Design authority for the engine; my gate probes it against generated output, not just "op ran".

## 1. The generated-code target (what every op must produce)
A component with config variants + states + a prop compiles to ONE clean file pair:

```tsx
// Button.tsx  — hand-editable via react-figma, deterministic structure
import styles from './Button.module.css'
export function Button({ variant = 'primary', label = 'Button', disabled = false }: {
  variant?: 'primary' | 'secondary'; label?: string; disabled?: boolean
}) {
  return (
    <button className={[styles.button, styles[variant]].join(' ')} disabled={disabled}>
      {label}
    </button>
  )
}
```
```css
/* Button.module.css — base + variant deltas + state pseudo-rules */
.button { /* base props */ transition: background .15s ease, transform .15s ease; }
.primary   { background: var(--sem-…); }        /* config variant = DELTA on base (cascade) */
.secondary { background: var(--sem-…); }
.button:hover  { background: var(--sem-…hover); }   /* state = pseudo-rule */
.button:active { transform: scale(.98); }
.button:disabled { opacity: .5; }
```

Key: **base + per-variant DELTA** (designer's Q1 recommendation), expressed as CSS cascade (base class
+ variant class, variant wins). Not full copies. State = pseudo-rule on the base class. This is a real
shadcn/Radix-grade component — the output that beats Framer's proprietary runtime.

## 2. THE unifying abstraction (the core insight — minimal new subsystem)
The inspector already writes a declaration to a rule (applyOverride → commit → set/add-declaration).
Everything variant/state adds is: **WHICH rule does the write target?** Introduce one concept —
`editTarget = { base } | { variant: <name> } | { state: <pseudo> }` — and every existing style edit
routes to that target's rule:
- base → `.button`
- variant:secondary → `.button.secondary` (delta class)
- state:hover → `.button:hover`

So variant-editing, state-editing, and base-editing are the SAME mechanism (scoped write); the whole
existing inspector is reused; the only new UI is a target selector (variant/state chips in the component-
edit view). expose-as-prop is the sibling: it redirects a VALUE (literal → props.x) rather than a rule.
This is why the two op-shapes share design — both are "redirect a write to a non-base target."

## 3. OP-SHAPE A — `expose-as-prop` (the props engine)
```
{ kind: 'expose-as-prop', file, line, col,
  target: 'text' | 'attr' | 'inline-style',   // WHAT literal is being lifted
  attrName?: string,                            // for target='attr' (e.g. 'href') or 'inline-style' (e.g. 'color')
  propName: string,                             // new prop identifier (camelCase, unique in signature)
  controlType: 'String'|'Number'|'Boolean'|'Color'|'Enum'|'Link'|…,  // from the 22; drives type + default serialization
  enumOptions?: string[] }                       // for controlType='Enum' → union type
```
Behavior:
1. Locate the literal at line:col by target kind — JSX text child / JSX attribute value / inline-style
   object value. REFUSE (422) if it's not a literal (already an expression/prop/var binding — can't lift
   a dynamic value; which value would the default be?).
2. default = the current literal, serialized by controlType (String→quoted, Number→bare, Boolean→bool,
   Enum→first option + union type, Color→quoted string).
3. Evolve the signature: zero-prop `Button()` → `Button({ propName = default }: { propName?: T })`;
   already-propped → EXTEND the destructure + the type literal. AST surgery on the function param
   (rename-component-grade).
4. Replace the literal: JSX text → `{propName}`; attr `x="lit"` → `x={propName}`; inline-style
   `color: '#fff'` → `color: props.color` (or destructured `color`).
5. assertValidTsx BOTH the edited component AND (if a controls registry is emitted) the registry, before
   ANY write. Parse-guard refusal, specific errors.
PATH ROUTING BY TARGET LOCATION (designer's refinement, ACCEPTED as v1-CORE — the path is decided by
WHERE the value lives, not by controlType):
- JSX text child → literal-swap: `text` → `{propName}`.
- JSX attribute value → literal-swap: `x="lit"` → `x={propName}`.
- INLINE style value → literal-swap: `color: '#fff'` → `color: props.color` (no var needed).
- **CSS-MODULE (.module.css) value → CUSTOM-PROPERTY BRIDGE — v1-CORE, NOT deferred.** Because our
  generated components style via .module.css (§1), a Color/Number/radius/gap STYLE prop necessarily lands
  on a .module.css value — deferring the bridge would mean v1 can't expose ANY style prop (only text/attr/
  enum), which is too thin for "fully create" (Framer's Color/Number controls are core). The bridge:
  1. rewrite the .module.css declaration `prop: <literal>` → `prop: var(--<propName>, <literal>)` (the
     literal becomes the FALLBACK — do NOT delete it).
  2. add/merge `style={{ '--<propName>': <propName> }}` on the component's ROOT JSX element (root, so the
     var cascades to base/variant/state rules alike — one prop drives every use of that value).
  3. **PRECISION — the prop defaults to `undefined`, NOT the literal.** React omits an undefined custom
     property, so an unset prop → the CSS `var()` fallback applies → **variant/state rules that set their
     own value still win** (a variant's `.btn.secondary { --btn-bg: … }` or the base fallback). If the prop
     defaulted to the literal, the inline var would ALWAYS be set and would clobber every variant's bg even
     when the consumer passed nothing — breaking variants. So style-props are optional, default undefined,
     literal-in-the-fallback. Precedence falls out clean: explicit prop > variant default > base default.
  This makes the custom-property bridge not a workaround but the correct composition of style-props with
  the variant/state override map.
REFUSAL TAXONOMY (the class the designer must implement + I gate):
- not-a-literal (dynamic expr/binding) → 422 "select a literal value to expose".
- propName collision in signature → 409.
- multi-element literal (same value on N elements, ambiguous which to prop) → 422 "select one element"
  (unless the values share ONE .module.css declaration — then the bridge props all uses via the one var,
  which is the desired one-prop-drives-all behavior; distinguish these two cases).

## 4. OP-SHAPE B — `write-scoped-declaration` (state-selector + variant-selector, subsumes add-state-rule)
Generalizes the existing declaration write with an editTarget. ONE op replaces add-state-rule and
scopes every inspector edit:
```
{ kind: 'write-scoped-declaration', file, localClass,
  scope: { kind: 'base' }
       | { kind: 'variant', name: string }     // → .localClass.<name>  (delta class, created if absent)
       | { kind: 'state', pseudo: 'hover'|'active'|'focus-visible'|'disabled' },  // → .localClass:<pseudo>
  prop, value }                                  // same (prop,value) the inspector already produces
```
Behavior:
1. Resolve/create the target rule in the component's .module.css: base = existing rule; variant = `.class.name`
   (create if absent — a new delta class); state = `.class:pseudo` (create if absent, the add-state-rule path).
2. Write the declaration into that rule (byte-splice for existing prop; append for new). DELTA discipline:
   only props that DIFFER from base live in a variant/state rule (don't duplicate base values — keeps output
   minimal + the cascade honest).
3. On first write to a variant scope, ensure the component's className joins the variant class
   (`styles[variant]`) and the `variant` prop exists (bridges to expose-as-prop's enum). On first state
   write, add the CSS `transition` (already done by add-state-rule) so spring/tween smoothness is default.
4. postcss parse-guard before write; jailed like every css write; validate the prop/value (no `{};` injection).
REFUSAL: invalid pseudo, invalid class, value with CSS-injection chars → 422.

## 5. Compile targets recap (the 4 the designer synthesized, made precise)
- (a) config variant → `variant` enum prop + `styles[variant]` delta class (style) / conditional JSX (structural).
- (b) state variant → `.class:pseudo` + CSS transition/keyframes (spring→cubic-bezier approx or @keyframes; tween→transition).
- (c) JS layer ONLY for appear/scroll/time/exit — walled off, NOT in the CSS ops above.
- (d) 22 controls via expose-as-prop; value overridable per variant through op-shape B's variant scope.

## 6. My recommendations on the 3 open Dan-decisions
1. **focus/disabled THIS epic — YES.** Once op-shape B exists, `:focus-visible` and `:disabled` are just two
   more `scope.state` values — near-zero marginal cost, and a button/input without them is incomplete (fails
   "fully create components"). Ship the full CSS state set (hover/active/focus-visible/disabled).
2. **Structural variants — lead style, basic structural in v1, deep structural = phase.** Style variants
   (className delta) cover ~80% of real design-system components (button/badge/input = style deltas). Basic
   structural = show/hide a child (conditional render of an existing subtree) — cheap, include it. DEEP
   structural (different layouts/layer trees per variant → full conditional JSX divergence) = a named phase;
   it's the expensive minority and rare in a token-driven DS.
3. **JS triggers (appear/scroll/time/exit) — DEFER to the motion epic.** They're page-level motion, not
   component interaction states; they're the explicitly-walled-off non-CSS minority; and every real COMPONENT
   state is in the CSS set. Ship hover/press/focus/disabled now; appear/scroll/time when we scope motion.

Net: this epic delivers Framer-authoring-parity (one variant-set canvas, config+state variants, the target
selector) with clean-CSS-majority output — props (22 controls), config variants (style + basic structural),
full CSS states — and names the two deferrals (deep structural, JS-motion) as decisions, not gaps.
