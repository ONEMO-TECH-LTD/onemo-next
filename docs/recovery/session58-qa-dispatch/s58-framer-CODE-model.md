# Framer CODE-level model — real source extraction for the component-engine blueprint

Sourcing input for the engine blueprint (Dan: "sourced from REAL Framer code, don't reinvent").
Tags: **[SEEN-IN-CODE]** read from actual source/types · **[DOC]** official docs · **[OURS]** our design choice.

---

## Section 1 — framer-motion / motion (variants, transitions, triggers) — by @s58-expert
Source: `framer-motion@12.42.2` + `motion-dom@12.42.2`, pulled via `npm pack`, read from the shipped
type declarations (the authoritative API/model). Citations are file:line in those packages.

### 1.1 Variant model [SEEN-IN-CODE] — motion-dom/dist/index.d.ts
- **`interface Variants { [key: string]: Variant }`** (L132–134): a variant SET is a **keyed map**,
  variant-name → Variant. (This is exactly our `variant` prop union + per-name style delta.)
- **`type Variant = TargetAndTransition | TargetResolver`** (L131).
- **`type TargetAndTransition = Target & { transition?: Transition; transitionEnd?: ResolvedValues }`**
  (L121–124): a variant = **a Target (style values) + an optional Transition**. So a variant carries BOTH
  the destination styles AND how to animate to them.
- **`interface Target extends DOMKeyframesDefinition`** (L2282): the Target is the set of animatable
  **style properties** (x, opacity, backgroundColor, …). = the style delta of the variant.
- **`type TargetResolver = (custom, current, velocity) => TargetAndTransition | string`** (L125): dynamic
  variants (a function). [OURS: out of parity scope for v1 — our variants are static style deltas.]
- **`type VariantLabels = string | string[]`** (L130): the active-variant selector on a node.
- Propagation exports (L5292 export list): `getVariantContext`, `resolveVariant`, `animateVariant`,
  `variantProps`, `variantPriorityOrder`, `checkVariantsDidChange`, `isControllingVariants`,
  `isVariantNode`. **Model: a parent controls variants and the active variant label propagates to
  children by context.** [OURS-MAP: in clean CSS this is free — a variant class on the root cascades to
  descendants via normal CSS; no JS context needed.]

### 1.2 Trigger vocabulary [SEEN-IN-CODE] — THE CSS-vs-JS line, now code-grounded
- **`type AnimationType = "animate" | "whileHover" | "whileTap" | "whileDrag" | "whileFocus" |
  "whileInView" | "exit"`** (framer-motion/dist/index.d.ts L934). This is Framer/motion's authoritative
  gesture+lifecycle trigger set, from source — NOT a UI guess.
- **Maps to CSS pseudo-classes (our clean-CSS states):** `whileHover → :hover`, `whileTap → :active`,
  `whileFocus → :focus-visible`. Add `:disabled` (DOM state, not a motion gesture — ours).
- **JS-only, no CSS analog:** `whileInView` (scroll/appear), `exit` (unmount), `animate` (on-mount),
  `whileDrag`. Framer implements THESE in JS itself — confirming they cannot be pure CSS. This is the
  explicitly-walled-off minority; it is NOT component interaction-state, it's page/lifecycle motion.

### 1.3 Transition encoding [SEEN-IN-CODE] — motion-dom/dist/index.d.ts
- **Spring** (real physics params): `stiffness?` (L2046), `damping?` (L2055), `mass?` (L2064),
  `bounce?` (L2035), `visualDuration?` (L2023, overrides duration), `restSpeed?` (L1995),
  `restDelta?` (L2003), `velocity`. Default spring is Framer's transition default.
- **Tween**: `duration?` (L2181), `ease?: Easing | Easing[]` (L2182), `delay?` (L2129),
  `repeat?` (L1966), `repeatType?` (L1978), `times?`.
- **[OURS-MAP to clean CSS]:** Tween → CSS `transition-duration` + `transition-timing-function` directly
  (cubic-bezier / named ease). Spring{stiffness,damping,mass} → CSS `linear()` easing generated from the
  spring curve (motion ships a `spring`/`generateLinearEasing` generator, L3055 / export
  `generateLinearEasing`, `supportsLinearEasing`) — i.e. we can sample the real spring into a CSS
  `linear()` easing for parity, or fall back to a cubic-bezier approximation. transition lives on the
  base rule / the state rule.

### 1.4 What this GROUNDS in the blueprint (real-code, not invented)
1. A variant = **keyed name → style-target delta (+ transition)** → our `variant` prop union +
   `.base.<name>` delta class + optional transition. Directly from `Variants`/`TargetAndTransition`.
2. The **trigger set is code-confirmed**: hover/tap/focus are the CSS-pseudo set; inView/exit/animate/drag
   are JS — so "states = CSS pseudo-rules, motion-triggers = deferred JS" is now [SEEN-IN-CODE], not a call.
3. **Transitions are real, compilable**: tween → CSS transition; spring → CSS `linear()` from the spring
   generator. Parity on the animation, clean CSS out.
4. **Variant propagation** is a JS-context concern in motion that CSS gives us free (class cascade).

## Section 2 — Compiled component / variant-state shape — by @s58-designer
Source: `framer@3.0.4/index.d.ts` (published package types, [SEEN-IN-CODE]) + reconciled with Section 1's framer-motion. NOTE: Framer's LIVE editor runtime is NOT console-extractable — the compiled component runs in a cross-origin sandbox iframe (SecurityError), no window globals, React fiber holds no model, CRDT/WebGL layer; probed 4 ways, walled by design. So the compile SHAPE is sourced from the `framer` package's own types (which import framer-motion + layer the variant/gesture wrapper) — Dan-authorized 2026-07-08: framer-motion is what Framer hides behind, use it.

### 2.1 Framer's REAL state set [SEEN-IN-CODE: framer@3.0.4/index.d.ts] — CORRECTS focus/disabled assumption
```ts
declare interface EnabledGestures { hover: boolean; pressed: boolean; loading: boolean; error: boolean; }
declare type EnabledVariantGestures = Record<string, EnabledGestures>;
export declare const CycleVariantState: unique symbol;
declare type GestureHandlers = Pick<TapHandlers & DOMAttributes<HTMLDivElement>,
  "onTap" | "onTapStart" | "onTapCancel" | "onMouseEnter" | "onMouseLeave">;
```
→ Framer's per-variant STATE slots = **hover · pressed · loading · error**. The load-bearing insight: **states are TWO KINDS** (this is the §6 state model):

**KIND A — INTERACTION states (pointer/keyboard) → CSS PSEUDO-class, automatic (no prop):**
- `hover` → `whileHover` → **`:hover`**
- `pressed` → `whileTap` → **`:active`**
- `focus` → `:focus-visible` *(OURS — web parity; Framer's gesture set omits it, a real web component needs it)*

**KIND B — SEMANTIC states (app-driven) → a BOOLEAN PROP toggling a state class (NOT a pseudo):**
- `loading` → `loading?: boolean` prop → **`.base--loading`** (or `[data-loading]`) *(Framer's real one)*
- `error` → `error?: boolean` prop → **`.base--error`** *(Framer's real one)*
- `disabled` → `disabled?: boolean` → **`:disabled`** for form els / **`[data-disabled]`** otherwise *(OURS — web parity)*

So **editTarget state chips = Hover · Pressed · Focus · Disabled · Loading · Error** (Framer's hover/pressed/loading/error PLUS web's focus/disabled = match AND beat). **`write-scoped-declaration` must handle BOTH**: `{scope:{kind:'state', pseudo}}` for the interaction set (hover/active/focus-visible/disabled-as-pseudo) writing a pseudo-rule; `{scope:{kind:'state', propClass}}` for loading/error (and disabled-as-data-attr) writing a class rule AND ensuring the boolean prop exists (reuse `expose-as-prop` to add the `loading`/`error` prop + the `className` toggle). This is FULLER parity than the draft's hover/active/focus/disabled.

### 2.2 Compile shape — Framer IS framer-motion + a variant/gesture wrapper [SEEN-IN-CODE]
Framer's types import `MotionProps`/`HTMLMotionProps` from framer-motion and layer `EnabledGestures` + `variant` selection on top. So a Framer smart component compiles to: **a `variant` PROP (enum of variant names) + framer-motion `variants` keyed map (Section 1.1) + gesture props (whileHover/whileTap from EnabledGestures) + `transition`**. Framer does NOT invent a variant runtime — it IS framer-motion. → Our clean-CSS compile (`variant` prop + `styles[variant]` delta class + `.base:hover`/`:active` pseudo-rules + prop-driven `.is-loading`/`.is-error` + CSS `transition`/`linear()`) is the **static-CSS equivalent of Framer's motion output — same authoring model, shippable CSS instead of a JS runtime.** VALIDATES blueprint §7 variant-prop+delta-class compile against Framer's real (motion) shape.

## Section 3 — ControlType + addPropertyControls (props API) — by @s58-designer [SEEN-IN-CODE: framer@3.0.4/index.d.ts]
```ts
export declare enum ControlType {
  Boolean="boolean", Number="number", String="string", FusedNumber="fusednumber",
  Enum="enum", SegmentedEnum="segmentedenum", Color="color", Image="image",
  ResponsiveImage="responsiveimage", File="file", ComponentInstance="componentinstance",
  Slot="slot", Array="array", EventHandler="eventhandler", Transition="transition",
  BoxShadow="boxshadow", Link="link", Date="date", Object="object", Font="font",
  Border="border", Cursor="cursor", Padding="padding", BorderRadius="borderradius",
  Gap="gap", TrackingId="trackingid",
}
export declare function addPropertyControls<Props = any>(
  component: React.ComponentType<Props> | React.ForwardRefExoticComponent<Props> | HigherOrderComponent<Props>,
  propertyControls: PropertyControls<Props>): void;
```
CODE names vs UI labels: UI "Toggle"=`Boolean`, "Option"=`Enum`, "Plain Text"=`String`; CODE adds `SegmentedEnum` (segmented picker), `Slot` (child insertion point), `FusedNumber` (linked-sides, e.g. padding/radius), `EventHandler` (the Events surface in the live "test Variables" modal).
**→ v1 expose-as-prop controlType set (clean React+CSS):** String, Number(+FusedNumber), Boolean, Enum/SegmentedEnum(→union/variant-select), Color, Link, Image, EventHandler. Phase-in via the .module.css custom-property bridge (NAMED, not dropped): Font, Border, BoxShadow, Cursor, Padding, BorderRadius, Gap, Transition, ResponsiveImage. Later: ComponentInstance, Slot, Array, Object, File, Date, TrackingId.

> Sections 1–3 complete + [SEEN-IN-CODE] cited. @s58-expert: fill blueprint §5 (props ← §3) + §7 (compile validation ← §2), reconcile the state set (Framer hover/pressed/loading/error + ours focus/disabled), then self-gate vs @s58-qa's 5 criteria → @s58-qa blueprint gate. NO code until it passes.
