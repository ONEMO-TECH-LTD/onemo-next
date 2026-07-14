# Framer variant + state + interaction model — extraction for the react-figma component engine

**By:** @s58-designer (Kai), 2026-07-08. **For:** @s58-expert (architecture) per Dan's directive — "no variants and no states = react-figma component engine crippled; read Framer, extract logic, match and improve." **Method:** deterministic extraction from Dan's authed Framer project (component `test` variant editor) — Framer's **inspector PANELS are light DOM and ARE console/DOM-readable** (only the WebGL canvas render + the internal store are not; `window` exposes no model, console emits no model logs). So the control vocabulary below is pulled VERBATIM from Framer's own DOM, not guessed; the deeper storage semantics (copy-vs-diff) that live only in the WebGL/store are supplemented from Framer's public docs. Confidence-tagged throughout. (No mutation to Dan's project: opened the Variables + type-picker, read the DOM, Escaped without committing — `test` unchanged, Interactions empty.)

Confidence tags: **[SEEN]** live-observed · **[DOC]** Framer official docs · **[OURS]** an architecture choice for us (Framer's internal storage isn't public and doesn't bind us).

## The visual model (what Dan means by "one place, not blurred") [SEEN]
Opening a component (double-click → breadcrumb `Home > test`) shows a **variant-set canvas**: every variant is a frame, edited with the SAME inspector as any frame (Position/Layout/Styles). Two kinds of variant coexist in that one canvas:
- **Config variants** — `Variant 1 · Primary`, `Variant 2`, … + a ghost `+ Variant` tile. These are the consumer-chosen configurations.
- **State variant slots** — a distinct auto-suggested `Hover / Pressed` ghost tile, visually separated from the numbered config variants.
- Selected variant shows a **⚡ connector** on its edge = "wire a transition to another variant".
- **Interactions** panel (right) = **`New Transition`** + **`New Event`** (the two primitives).
- **Transition** is a first-class style property — default **Spring** (Styles panel).

So Framer is NOT blurring: config-variants and state-variants are BOTH members of the one variant set, authored in one canvas, but they are distinct roles. Dan is right — one coherent place, correct.

## Answers to the 5 architecture questions

### Q1 — Variant storage: copy vs diff [OURS — not publicly specified]
Framer's on-canvas authoring presents each variant as a full frame, with layers **matched by name across variants** (that name-match is what lets Framer morph Primary→Hover). Internally-stored copy-vs-diff isn't public and doesn't bind us. **Recommendation for our engine:** store a **base variant + per-variant override map** keyed by layer identity — compiles to one base render + a className/style delta per variant. Full-copy storage would bloat output and break the "same element, different state" morph.

### Q2 — State ↔ variant relation [SEEN]
`Hover / Pressed` is a **separate auto-suggested slot** from the numbered config variants, but lives in the **same variant-set canvas**. So: states are a **distinct sub-kind of variant**, authored alongside config variants, not fused with them and not a wholly separate subsystem. This is the ground truth (corrects the earlier "Framer blurs them" framing). **For us:** keep the expert's code substrate — **config variants → a `variant` prop; state variants → CSS pseudo-rules** — but the AUTHORING surface presents both in one variant-set editor, exactly like Framer. The split is at compile time, not in the UI.

### Q3 — Connector/transition semantics + the CSS-vs-JS boundary [DOC + SEEN]
A wire encodes **{ trigger, targetVariant, transition }**. Vocabulary:
- **Triggers (variant-switch / "Show On"):**
  - **CSS-pseudo-expressible:** Hover, Press (active), (Focus) — map to `:hover` / `:active` / `:focus-visible`.
  - **JS-runtime only (no CSS analog):** Appear/On-Load, Scroll (past %), Time (after N s), Exit (pointer leaves / page hide), Click-to-navigate. [DOC: Framer Triggers = Time, Scroll, Exit + conditions; gestures onTap/onHover/onPress from Motion.]
- **Transition:** **Spring** (stiffness / damping / mass) or **Tween** (duration / easing). [DOC]

**This is THE architecture line (validates the expert's thesis):** hover/press/focus triggers + spring/tween → compile to **CSS pseudo-rules + CSS `transition`/`@keyframes`**. Appear/scroll/time/exit → the **small walled-off JS state layer**. Most component states (buttons/inputs) are the CSS set → ~clean-CSS majority.

### Q4 — Structural vs style variants [DOC]
Framer variants can differ **structurally** (add/remove/reorder layers, not only style props); layers shared across variants are matched by name for morphing. **Implication (important, don't under-scope):** style-only variants → a className/prop map (trivial); **structural** variants → **conditional JSX** (`{variant === 'x' ? <A/> : <B/>}`), a bigger compile. Our engine must support both; v1 can lead with style variants + basic structural (show/hide a child) and name deeper structural divergence as a phase.

### Q5 — Property controls [SEEN via DOM — authoritative + DOC]
**Framer's own type-picker, read verbatim from its DOM** (the design-side "Variables" a component exposes), in order:
`Plain Text · Formatted Text · Date · Link · Image · Color · Toggle · Number · Option · Event · File · Transition · Border · Cursor · Shadow` (+ searchable).
Design-name → code-API mapping: Plain Text=String, Formatted Text=RichText, Toggle=Boolean, Option=Enum, Event=EventHandler; the fuller code API [DOC] also has Array/Object/ComponentInstance/ResponsiveImage/Padding/BorderRadius/BoxShadow/Gap/Font/Cursor/TrackingId (22 total). The **`test Variables` modal** is the authoring surface: two sections — **Variables** (the props above) and **Events** ("Trigger custom interactions from any layer within your component" — the EventHandler type, seeded with a `Click` event). Common config [DOC]: `title · defaultValue · description · hidden(props) · optional`.
Binding: each variable = a component prop; exposing replaces a literal with `props.x` (default fills). Per-variant vs all-variants isn't in docs — **[OURS]** our `expose-as-prop`: a prop is component-wide, its VALUE overridable per variant via the override map.
**For our v1 control set** (maps cleanly to CSS/JSX): Plain Text, Formatted Text, Toggle, Number, Option, Color, Link, Image, Event — plus Border/Shadow/Cursor/Transition as style-token controls. File/Date/ComponentInstance/Array = later.

## Synthesis → our engine (validates + sharpens the expert's thesis)
Framer's unified visual authoring **compiles to**:
- **(a) config variants → `variant` prop + per-variant className/style map** (style variants) and **conditional JSX** (structural variants).
- **(b) state variants (hover/press/focus) → CSS pseudo-rules** + **CSS `transition`/keyframes** for spring/tween.
- **(c) a small JS state layer ONLY for no-CSS-analog triggers** (appear/scroll/time/exit) — the explicitly-walled-off minority.
- **(d) property controls → the 22 ControlTypes**, `expose-as-prop` replacing literals with `props.x`, values overridable per variant.

Authoring parity with Framer (one variant-set canvas, config + state variants together, connectors, transitions) with a ~clean-CSS-majority output. The place we can BEAT Framer: our output is real React+CSS in the actual build (no proprietary runtime), and structural variants become honest conditional JSX.

**Open decisions for the expert + Dan:** (1) focus/disabled in this epic (recommend yes — cheap once the state-selector exists); (2) how far structural variants go in v1; (3) the JS-runtime trigger set — include appear/scroll now or defer to the motion epic. The B `expose-as-prop` AST op-shape and the state-selector op-shape share the "redirect writes to a target rule/override" mechanism — design them together.
