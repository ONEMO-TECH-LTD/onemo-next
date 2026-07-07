# figma-to-code — Deterministic Figma→React/CSS-Modules Converter · SPEC v0.1 (draft)

> The contract. Every mapping rule the converter applies, every case it refuses.
> Approved spec = the converter's requirements AND meta-QA's checklist. No rule here, no code there.
> Status: DRAFT — pending s58-designer peer review, then Dan sign-off.

## 0 — What this is

A deterministic CLI: `figma-to-code <frame-url>` → React component + CSS Module in `onemo-next/src/`,
every style value a design token (`var(--…)`) wherever the Figma value is bound to a variable,
plus a **conformance report** (token coverage, raw values, refused nodes). Zero LLM in the
structure/layout/token path — same input, same output, every run.

**Acceptance target (golden frame):** `Editor 402 iphone - apple blur glass` —
file `t88thL8hKksSpILgkeGRZ0`, node `4084:25997` (Create Studio "Effect" screen, 402×871).
Probed 2026-07-04 on ONEMO's Figma plan: 285 nodes, 43 auto-layout frames, 165 nodes with
bound variables, 52 HUG/FILL-sized nodes — all readable via REST with a standard token.

**Output lands in `src/` → compiles → the tagging loader stamps `data-src` → the screen is
immediately selectable/editable in the react-figma editor.** No import step.

## 1 — Data sources (all proven live)

| Data | Source | Plan gate | Status |
|---|---|---|---|
| Node tree: layout, sizing, geometry, text, fills, per-property `boundVariables` (variable IDs) | REST `GET /v1/files/:key/nodes?ids=…` with `FIGMA_TOKEN` (file-content read-only scope) | none | ✅ probed, full data |
| Variable ID → name/collection catalog | Plugin API (`figma.variables.getLocalVariablesAsync()`) via desktop-bridge dump, cached as JSON artifact | none (plugin API is ungated) | design settled; dump to be run once per file version |
| Token name → CSS custom property | Existing ds-pipeline convention (figma-var collection path → `--…` name), same mapping `tokens.css` is built from | n/a | ✅ exists |
| Screenshots for pixel-compare | Figma MCP `get_screenshot` | none | ✅ used already |

REST variables catalog endpoint (`/variables/local`) is Enterprise-gated — **not used**. The plugin
dump replaces it. Follow-up (recommended): extend the DS export to include variable IDs so the
dump and the DS JSON stay one artifact.

**Staleness guard (s58-designer):** the plugin dump is stamped with the file `version` it was taken
at; the converter REFUSES to run when the REST response's file version differs — a stale ID→name
map silently mislabels tokens, which is worse than failing.
**Auto-refresh workflow (s58-lead F6 — or the guard gets bypassed):** on version mismatch the CLI
first tries to refresh the dump itself through the figma-console desktop bridge (scriptable; Figma
desktop open with the bridge plugin running). Only if the bridge is unreachable does it stop with
the exact one-step instruction. Refusal is the fallback, not the workflow.

## 2 — Pipeline

```
fetcher (REST, token)         → raw node JSON (cached, hash-stamped)
variable-map (plugin dump)    → { variableId → { name, collection, cssVar } }
normalizer                    → resolves instances (flattened, override-applied),
                                resolves alias chains (cycle-guarded),
                                two-pass sizing (bottom-up child sizing, then container-vs-child stretch)
IR                            → thin per-node tree (id, name, layout, sizing, styleRefs, text, children)
emitter: react-css-modules    → ComponentName.tsx + component-name.module.css
conformance report            → token coverage %, raw-value list (file:line), refused nodes, id map
```

**Operating modes:** one-shot `convert` (hard staleness refusal) and `watch` (C6.3) — polls the
file version; on change converts to STAGING and promotes to `--out` ONLY when every gate is green
(error-hold: a broken edit never clobbers the last good build); `--allow-stale-dump` warns instead
of refusing (unknown variable ids fall to raw + report — a stale dump cannot mislabel silently).
With `--fidelity-route <url> [--budget 10]` the MEASURED visual gate joins the promotion path
(C6 rework, s58-qa): after structural promotion the live route is screenshotted at the frame's
exact viewport, pixel-judged against Figma's render (ledgered regions masked), and an over-budget
OR unmeasurable verdict ROLLS BACK to the previous output (`✗ HELD-VISUAL` — fail-closed: a gate
that cannot measure does not promote). Capture + judge run via `audit/capture.mjs` (Playwright on
the system Chrome): raw headless Chrome enforces a ~500px minimum window width (a 402 capture
silently lays out at 500 — live-hit), and the judge child serves the gate dir ITSELF because the
watch parent is blocked in execFileSync during the call (frozen event loop = deadlock, live-hit).

The IR is the audit artifact: conformance is measured IR-vs-Figma, not by reading generated CSS.

## 3 — Mapping rules (normative)

### 3.1 Structure
- One Figma frame = one React component. Child nodes emit in Figma order (z-order preserved).
- **Root = viewport (C6, Dan).** The frame IS the screen: the root element always emits
  `container-type: inline-size; width: 100%; height: 100dvh` — unconditionally (a HUG/FILL root
  has no width/height decl to swap; the pair is inserted at the canonical rank-1 position). At a
  viewport equal to the design size the render is Figma-identical (the fidelity gate measures
  there); at any other size the DS's own fluid (`cqi`) tokens adapt WITH the viewport. Direct
  root children whose width Figma caps (`max-width`) get `width: 100%` + `margin-inline: auto`
  (flag `centerViewport`, derived in buildIr): they fill to the cap and CENTER in the leftover
  space — Figma has no opinion there (the frame is the viewport), so the law is: content centers,
  content adapts. Both properties are reverse-guarded (GEOM_PROPS).
- **DOM mirrors the Figma layer tree 1:1.** Every emitted element carries the source node's name
  as its CSS-module class (sanitized: lowercase, camelCase for multi-word, uniqued per file).
- **Class-name contract (react-figma reader compat, s58-designer):** sanitized locals MUST contain
  **no underscores** (the editor's dev-class parser and the resolver's `_local__` matcher treat `_`
  as a delimiter — an underscored local can false-match another). Uniquing suffix is a bare ordinal
  (`statusBar2`), never `_2`. The emitter imports styles as `import styles from './name.module.css'`
  (default import, relative path) — the exact shape the editor's resolver scans for.
- Node types: FRAME/GROUP-with-autolayout → `div` (or semantic tag per §3.6); TEXT → `span`
  (always, unless §3.6 promotes to a heading tag — no `p` in v1, one rule, zero judgment);
  VECTOR/BOOLEAN_OPERATION → inline `<svg>` (§3.5, always inline);
  RECTANGLE w/ image fill → `<img>` or `background-image` per the children rule in §3.5.
- **Fonts ship in the package (Dan).** Figma's API never serves font binaries (licensed assets)
  — it only names the family. With `--fonts-dir <repo font library>` the converter resolves the
  CONFORMANCE fonts list (token chains → family names) against the library, copies every matching
  web font into `<out>/fonts/`, declares them in `<out>/fonts.css` (weight/style from filename;
  variable fonts → `font-weight: 100 900`), and page.tsx imports it. A family with no match is
  reported loudly (`MISSING IN LIBRARY`) — never a silent system-font fallback.
- **Output placement (s58-lead F4):** emitted to `onemo-next/src/app/(dev)/converted/<frame-slug>/`
  — `<ComponentName>.tsx` + `<frame-slug>.module.css` + a converter-emitted `page.tsx` wrapper
  (renders the component full-bleed) so AC2/AC5 have a route with zero manual steps. Naming law:
  ComponentName = PascalCase(sanitized frame name), frame-slug = kebab-case(same), ordinal uniquing
  on collision — same sanitization pipeline as class names (§ class contract).
- INSTANCE nodes: converted **flattened** (the resolved, override-applied tree as returned by the
  API). Component-ization of repeated instances is a later increment (v2) — v1 emits structure.

### 3.2 Auto-layout → flexbox
| Figma | CSS |
|---|---|
| `layoutMode: HORIZONTAL / VERTICAL` | `display: flex; flex-direction: row / column` |
| `itemSpacing: n` | `gap: <token or px>` |
| `paddingTop/Right/Bottom/Left` | `padding: …` (shorthand, slot-preserving; token per-slot when bound — SAME slot law as react-figma's editor: minimal 1→2→4 form, untouched slots keep their text; see ENGINE-PLAN.md §5 + engine `boxSlots`/`editSlot`. Emitter formatting = one decl per line, `prop: value;` — the byte-splice write path assumes it) |
| `primaryAxisAlignItems: MIN/CENTER/MAX/SPACE_BETWEEN` | `justify-content: flex-start/center/flex-end/space-between` |
| `counterAxisAlignItems: MIN/CENTER/MAX/BASELINE` | `align-items: flex-start/center/flex-end/baseline` |
| `layoutSizingHorizontal/Vertical: FIXED` | explicit `width`/`height` |
| `layoutSizingHorizontal/Vertical: HUG` | omit the dimension (content-sized) |
| `layoutSizingHorizontal/Vertical: FILL` | `flex: 1` on main axis / `align-self: stretch` on cross axis |
| `layoutWrap: WRAP` | `flex-wrap: wrap` |
| child `layoutPositioning: ABSOLUTE` | `position: absolute` (parent gets `position: relative`), offsets from constraints |
| `clipsContent: true` on a frame | `overflow: hidden` (the golden frame's dome/screen clipping depends on this) |

- `primaryAxisAlignItems: SPACE_BETWEEN` → `itemSpacing` is IGNORED (Figma ignores it too) — emit no `gap`.
- Text-bearing FILL children get `min-width: 0` on the main axis (flexbox text blowout — deterministic rule, not a heuristic).
- **Figma never shrinks children (C3.5 live-proven):** auto-layout children keep their size and the
  row OVERFLOWS; CSS flex shrinks by default. Every non-FILL flex child (element/text/svg, not
  absolute) gets `flex-shrink: 0` — without it a 9×48px dial row in a 402px frame silently squeezes
  to 34px pills. FILL children keep `flex: 1` (grow/shrink is their semantic).

**Two-pass rule:** `align-items: stretch` may be hoisted to the container only when EVERY child
resolves to cross-axis FILL (bottom-up pass first); otherwise per-child `align-self`.

### 3.3 No auto-layout = absolute positioning (structure/geometry ALWAYS convert)
The layer tree IS the DOM tree and geometry is math (Dan, 2026-07-04: "100% figma clean, 100%
reproduction… the list of layers can surely be matched"). A FRAME without auto-layout is **not
refused** — it becomes a positioning context (`position: relative`) and its children are pinned
absolutely (`position: absolute; left/top`) at their **real Figma offsets** (child `absoluteBoundingBox`
minus the parent's). This is faithful, not a guess: Figma hands exact coordinates for every node.

Why this isn't the "div-soup" failure of other converters: they *fall back* to absolute positioning
because they can't read the design; we reproduce Figma's *own* coordinates exactly, and a clean
auto-layout design still emits clean flexbox (§3.2). Absolute positioning is the correct output for
a design authored without auto-layout — the converter reproduces what the file says, both modes.

**Canon is a GRADE, not a gate (two-mode conversion):** every design converts fully; how *clean*
the output is (token-bound vs raw, flexbox vs absolute, semantic tags) is scored in the conformance
report, never blocked. A non-auto-layout frame still converts — it just scores lower and the report
names why. Structure and geometry never refuse; only genuinely unmappable **properties** do (§3.5).
The authoring contract for ideal output lives in `FIGMA-CANON.md`.

### 3.4 Values → tokens (the core rule)
For every property, in order:
1. `boundVariables[property]` exists → resolve ID → alias-chain → token name → emit `var(--css-name)`.
2. Text style / effect style bound → same, via the style's bound variables.
3. No binding → emit the raw value verbatim **and** append to the conformance report
   (`RAW: node, property, value, nearest-token candidates`).
Never approximate a raw value to a "close" token — report it, don't guess it. (One-click binding
in react-figma is the remediation path.)

**RAW entry shape (drives the editor's remediation loop, s58-designer):** the JSON twin's RAW
entries carry `{ nodeId, className, prop, value, file, candidates: [{ token, resolved, exact }] }`
— `className + prop` is exactly what the editor's resolver needs to produce a byte-exact DeclRef,
so a RAW row becomes select-element → variable-picker-preopened → `bind-token` in one click.
Candidates whose resolved value matches EXACTLY are flagged `exact: true` (safe one-click);
near-misses are display-only. Still never auto-applied.

### 3.5 Fills, strokes, effects, text
- Solid fill → `background-color`/`color` (token rule §3.4).
- **Fill stacks (multiple visible fills, s58-lead F3.4):** composed into one CSS `background`:
  bottom-most solid fill → `background-color`; every other visible fill (gradients, images,
  non-bottom solids as single-stop gradients) → `background-image` layers, **top fill first**
  (CSS layer order). Invisible fills skipped.
- **Gradients (F3.5):** `GRADIENT_LINEAR` → `linear-gradient` (angle from `gradientTransform` via
  ONE shared function) · `GRADIENT_RADIAL` → `radial-gradient` · `GRADIENT_ANGULAR` →
  `conic-gradient` · `GRADIENT_DIAMOND` → `REFUSED: unsupported-gradient` (report).
- **Image fills (F5, placement re-pinned by Dan 2026-07-04 — "complete package"):** node with
  image fill and NO children → `<img>` via **static import** (`import asset0 from './assets/<ref>.png'`);
  node with image fill AND children → `background-image: url('./assets/<ref>.png')`. Assets live in
  an `assets/` subdir INSIDE the emitted package folder — the output is fully self-contained
  (code + every asset, zero external references). Images are the **originals** from Figma's
  imageRef store (`/v1/files/:key/images`) — byte-exact, **no recompression, no resizing**;
  recorded by content hash in the run record. A missing/undownloadable asset = report entry +
  sized placeholder, never a silent gap.
  **imageTransform crop (meta-qa C3 F1):** a STRETCH ("crop") fill carries an affine matrix mapping
  layer→image space; it is reproduced EXACTLY, never dropped: `background-size: 100/m00 % 100/m11 %`
  + `background-position: m02/(1−m00) % m12/(1−m11) %`. A leaf with a NON-identity transform emits
  as background-image (not `<img>`) so the crop applies; identity-transform leaves stay `<img>` via
  static import. Rotation/skew terms (m01/m10 ≠ 0) → axis-aligned approximation + APPROXIMATIONS entry.
- **Vectors (F5):** VECTOR/BOOLEAN_OPERATION/STAR/POLYGON/LINE → always **inline `<svg>`** from
  REST geometry (fills/strokes token rule applies to svg attrs). Never exported as raster.
- **Node opacity & blend (F3.1):** node `opacity` ≠ 1 → CSS `opacity`. `blendMode` ≠
  PASS_THROUGH/NORMAL → `mix-blend-mode` (direct enum map, lowercased with hyphens); fill-level
  blend modes on single fills → same; on stacks → `background-blend-mode` list.
- **Strokes + strokeAlign (F3.2 · C3.2 — always convert, never refuse):** solid `INSIDE` → `border`
  (Figma dims are border-box — no size drift); solid `OUTSIDE` → `box-shadow: 0 0 0 <w> <color>`
  (non-inset spread — no layout impact); solid `CENTER` → box-shadow ring straddling the edge
  (`0 0 0 <w/2>` + `inset 0 0 0 <w/2>`). **Gradient / non-solid stroke** → converts, never refused:
  a SQUARE node → `border-image: <gradient> 1` (exact gradient); a ROUNDED node → `border: <w> solid
  <avg-gradient-color>` (border-image ignores `border-radius`, so faithful shape wins over exact
  gradient — the averaged color is deterministic). Per-side INSIDE weights → per-side `border-*`.
  Only a genuinely unmappable stroke *paint* (e.g. IMAGE stroke) reports `unknown-stroke-paint`.
  **Scope (C1.2 build-pin):** these apply to **non-vector** nodes — vector strokes emit inside the
  `<svg>` (golden frame: 107/107 CENTER strokes are vectors, rendered faithfully in the svg).
  **Exact gradient ring (C4.2):** a gradient stroke on a node WITH fill layers emits the layered-
  background technique — fill layers clipped to `padding-box` stacked over the stroke gradient
  clipped to `border-box`, `border: <w> solid transparent`, per-layer size/position/clip lists,
  `background-origin: border-box` — follows any radius, shows the true gradient. Only an UNFILLED
  rounded node keeps the avg-color flatten (+ APPROXIMATIONS entry). All background/border decls
  derive from ONE shared function (`bgBorderDecls`) used by both emit and the reverse gate.
  **GLASS (C5 · C6.1-calibrated):** converts as a pinned approximation — `backdrop-filter: blur(8px)`
  (no REST params exist) + APPROXIMATIONS entry; backdrop blurs compose into one decl (strongest
  wins). Calibration (C6.1, measured on the live glass band): blur radius/saturate/brightness
  variants land within 0.25pp of each other — the residual is Figma's material FILL modulation,
  not reproducible without params; blur(8px) pinned as tied-best. Stays ledgered.
- **Negative `itemSpacing` (F3.3 · C5 — implemented):** never refused, and the overlap REPRODUCES:
  CSS `gap` cannot be negative, so children after the first flowed one carry the negative main-axis
  margin (`margin-left`/`margin-top`, elements AND svg flex items), derived in buildIr (single
  source) and reverse-guarded (GEOM_PROPS).
- **`box-sizing` (F3.6):** Figma dimensions are border-box. The converter assumes the app's global
  `box-sizing: border-box` reset; `canon-check` verifies the reset exists in the target app once
  per run (it does in onemo-next's globals).
- **Font weight (F3.7):** `fontName.style` → weight via pinned table: Thin=100, ExtraLight/
  UltraLight=200, Light=300, Regular/Normal/Book=400, Medium=500, SemiBold/DemiBold=600, Bold=700,
  ExtraBold/UltraBold=800, Black/Heavy=900; `Italic` suffix → `font-style: italic` (weight from the
  remainder). Unknown style name → `REFUSED: unknown-font-style` (report), never guessed.
- Corner radius → `border-radius` (slot-preserving for mixed corners; tokens where bound).
- Effects: DROP_SHADOW/INNER_SHADOW → `box-shadow` (multiple effects → comma list, **Figma array
  order preserved**); LAYER_BLUR → `filter: blur()`;
  BACKGROUND_BLUR → `backdrop-filter: blur()` (the golden frame's glass depends on this).
- **box-shadow composition order (s58-lead closure caution 1):** when an OUTSIDE-stroke ring (§ strokes)
  and shadow effects land on the same node, the comma list is: **stroke ring first** (topmost — it
  reads as the border), then effect shadows in Figma array order. One rule, one shared emitter path.
- **Unknown effect types (C1.2 build-pin):** any effect outside the four mapped kinds →
  `REFUSED: unknown-effect`, never approximated. Live case: Figma's `GLASS` effect (3 nodes in the
  golden frame) has no CSS equivalent — it lands in the report as a design decision, not a fake blur.
- **Vector subtrees (C1.2 build-pin, wording fixed per lead C1 F3):** a VECTOR/BOOLEAN_OPERATION
  node, or a GROUP whose entire subtree is vector-ish, is a **vector subtree root** → one `<svg>`
  (Figma-rendered export, inlined). **The census counts the svg ROOT as one unit; svg internals are
  verified by asset content hash**, not element counting. Rotation inside an svg is vector geometry
  (faithful); a rotated FRAME/INSTANCE is **not refused** — its `rotation` becomes
  `transform: rotate()` (§ rotation rule below), the same faithful geometry as any leaf.
- TEXT: `fontName/fontSize/lineHeight/letterSpacing/fontWeight` → typography tokens when the text
  style is bound; `textAutoResize: WIDTH_AND_HEIGHT` → no width (inline); `HEIGHT` → fixed width;
  `NONE`/`TRUNCATE` → fixed box (+ `text-overflow` when truncating). Content emitted verbatim.
  **Units pinned (s58-designer):** `lineHeight` PIXELS → `px`; PERCENT(_FONT_SIZE_) → unitless
  (`percent/100`); AUTO → omit. `letterSpacing` PIXELS → `px`; PERCENT → `em` (`percent/100`).
- Multiple shadows emit in Figma's array order (Figma top-of-list = CSS first = visually topmost).
  Gradient `gradientTransform` → angle via the standard matrix→degrees derivation, rounded to 2dp
  (pin the exact function in code review — determinism depends on one shared implementation).
- Masks: only alpha-to-opaque per Figma's rule — mask nodes become `overflow: hidden` when the
  mask is a rounded-rect matching the container, else `clip-path`; anything more complex →
  conformance report `REFUSED: complex-mask`.
- Rotation ≠ 0 → `transform: rotate()` for **every** node (leaf, container, svg root). Figma REST
  `rotation` is **radians**, counter-clockwise-positive; CSS is degrees, clockwise-positive → the
  emitter converts and negates: `deg = -rotation × 180/π` (C3.1). Never refused; geometry is math.
  (The `transform` sits in the visual-property group of the canon order law.)
  **Rotated geometry (C5, lead-verified):** `absoluteBoundingBox` on a rotated node is the rotated
  AABB, not the intrinsic box — buildIr recovers the true size by inverting the AABB system
  (`w = (W·c − H·s)/det`, `h = (H·c − W·s)/det`, `det = c² − s²`, c/s = |cos/sin rotation|) and
  positions rotated absolute nodes by CENTER (rotation preserves the center; CSS rotates about the
  center). Near 45° the system is singular (`|det| ≤ 0.05`) → AABB fallback, never NaN.
- **FONTS report (C5):** the conformance report lists every `font-family` the screen needs — a
  design font missing from the app build falls back silently, so it must be visible. (Ledger note:
  the radial-gradient extent uses handle distances in normalized space — exact for axis-aligned
  handles; skewed radial axes on non-square nodes are approximated.)

### 3.6 Semantics & a11y (v1 minimal)
Name-driven, pinned (s58-lead F8): node named `button`/`*Button` (case-insensitive) OR carrying
`reactions[]` with an `ON_CLICK` trigger → `<button>`; exact names `nav`/`header`/`footer`/`main` →
that tag. TEXT promoted to a heading ONLY by bound typography token, per pinned table — paths verified
against the live figma-var export (3.3-Sem-Type-Fluid, 2026-07-04):
`display/*` → `h1` · `title/screen/*` → `h2` · `title/section/*` → `h3` ·
`title/product/*`, `title/headline/*` → `h4` · `body/heading/*` → `h5`
(anything else — body, label, deco — stays `span`). Everything else `div`/`span`.
Alt text = image node name.

### 3.7 Determinism constraints
- No `Date`/random/LLM anywhere in the pipeline. Same input bytes → same output bytes.
- Fetcher caches the raw REST response with a content hash; the emit step runs offline from cache.
- Class-name uniquing is ordinal (document order), not random.
- Formatting via the repo's prettier config — output is stable under re-runs.

## 4 — Conformance report (the human audit surface)

Per converted frame, one `CONFORMANCE.md` (+ JSON twin for tooling):
- **Token coverage:** N of M style values token-bound (percentage + per-category breakdown).
- **RAW list:** every unbound value — node name, property, value, `file:line` in the emitted CSS.
- **REFUSED list:** genuinely unmappable **properties** (never structure) — the handful with no
  faithful CSS: GLASS effect, GRADIENT_DIAMOND, complex-mask, unknown-font-style, unknown-stroke-paint
  (e.g. IMAGE stroke) — with node ids. The node still emits; only that property is reported. The
  design-cleanup + authoring-canon worklist. (CENTER and gradient strokes CONVERT per §3.5 — they
  never appear here; a lossy conversion lands in APPROXIMATIONS below, not REFUSED.)
- **APPROXIMATIONS list (lead C3):** lossy-but-deliberate conversions — visible, never silent:
  gradient border flattened to its average color on an UNFILLED rounded node; a rotated/skewed
  image-crop matrix reproduced axis-aligned; GLASS → pinned backdrop-blur. Distinct category
  between "exact" and "refused".
- **TOKEN VALUE PARITY (C4.3):** for every numeric `var()`-decl, the token chain is resolved
  through the app's tokens build and evaluated at the FRAME width (rem×16, cqi/vi×W/100, clamp);
  |resolved − Figma raw| > 0.5px → a parity row naming token, resolved px, Figma px. DS drift made
  mechanical. **Non-fatal report section** (the converter's emission is correct — the drift is
  DS-side; fix the token build or the Figma variable). Covers gap/width/height/radius/font-size/
  padding slots.
- **ID map:** Figma node id ↔ emitted element (class/data-src) — proves 1:1 tree mirroring.
- **Pixel pass:** side-by-side screenshot (Figma MCP render vs local route render) — human eyes.

## 4b — Code-conformance guard (Dan: "code slop is more dangerous than token slop")

Token non-conformance is VISIBLE (editor pills, report). Code non-conformance is invisible and
compounds — so the emitted code is held to canon by a zero-tolerance mechanical gate (`canon-check`),
run on every conversion and in CI. Three layers:

1. **Industry canon, executable.** The React/CSS "bible" exists as the industry's own rule engines,
   run at max strictness with a ZERO-warning bar: ESLint (`react`, `react-hooks`, `jsx-a11y`,
   `typescript-eslint` strict) · Stylelint (`stylelint-config-standard` + no-duplicate-selectors,
   no-descending-specificity, declaration-block-no-redundant-longhand-properties, no-shorthand-
   property-overrides) · `tsc --noEmit` strict · Prettier check. One warning = the conversion FAILS.
   Rule sets are pinned (versions + config committed) so the canon is reproducible, not drifting.

2. **ONEMO code canon (`CODE-CANON.md`, sibling to this spec)** — the rules generic linters can't
   express, each mechanically checked on the emitted AST/CSSOM:
   - **No slop elements:** emitted element count == IR node count == raw-tree census (§4b.4).
     Every wrapper must correspond to a Figma node. Extra divs are a FAIL, not a style choice.
     (No placeholders exist — structure always converts, so the count is exact with no exemptions.)
   - **Flat selectors only:** one class per element, `.class { }` — no nesting, no descendant/child
     combinators, no id/tag selectors, no `!important`. (Keeps specificity trivially editable by
     the react-figma byte-splice engine.)
   - **No inline styles** in emitted TSX (all style in the module.css).
   - **No dead code:** no unused classes, no unused imports, no declarations overridden within the
     same rule, no empty rules.
   - **Absolute positioning is sanctioned + budgeted:** `position: absolute` appears exactly for
     (a) `layoutPositioning: ABSOLUTE` children and (b) children of a **non-auto-layout** frame
     (pinned from Figma coords, §3.3) — both counted in the run record's `absoluteCount`, which the
     canon check enforces `==` against the emitted CSS. Not a fallback; a faithful, budgeted mapping.
   - **Formatting law:** one declaration per line, `prop: value;`, property order pinned (layout →
     box → visual → typography) — the exact shape the editor's write path splices.
   - **Naming law:** §3.1 class contract (no underscores, ordinal uniquing, camelCase locals).

3. **The round-trip is a code guard too:** AC7's reverse-parse only succeeds on structurally clean
   output — slop that survives layers 1–2 still fails when it can't round-trip to an identical IR.

4. **Raw-census anchor (s58-lead F1 — no self-grading):** the element-count check and AC7 both
   anchor on the converter's own IR, so a normalizer that silently drops/merges nodes would pass
   both. Therefore conformance includes ONE check anchored to the **raw REST response** by an
   **independent walker** (a separate small script that shares no code with the converter, applying
   spec-§3 visibility rules: skip invisible nodes, count flattened instances by their resolved
   children): raw-tree node census vs the emitted ID map. Census mismatch = FAIL. This is the
   external anchor that makes the whole gate non-circular.

5. **Token resolution check (s58-lead F2 — live-proven failure class):** emitting `var(--x)` is
   not conformance if `--x` doesn't exist in the app's built `tokens.css` (this exact bug is live
   today: `toolbar.module.css` consumes `--spacing-m`, which tokens.css doesn't define — KAI-9288).
   The report gains a **"resolves?"** column per emitted var name, checked against the app's current
   tokens build; any unresolved name = RED in the report AND fails the run (converter-side name
   mapping bug or stale DS — either way it must not land silently).

Why this doesn't exist off the shelf: general converters must serve every codebase, so they can
conform to none — and their buyers evaluate screenshots, not diffs. A canon gate is only possible
when the output shape is narrow and owned. Ours is.

## 5 — Non-goals (v1)
Variants/interactive states · prototype interactions/animations · multi-breakpoint responsive
(the frame's own size only) · component deduplication · Shopify emitter (v2, same IR) ·
writing anything back to Figma.

**Expectation to hold (s58-lead):** v1 output is **fixed-frame** (the golden frame's 402×871) —
prototype-grade until the responsive increment lands. Screens are faithful at their designed size;
they do not adapt yet. This is a scope statement, not a defect.

## 6 — Acceptance criteria (golden frame)
1. `figma-to-code <golden-url>` runs to completion with zero manual steps (token + cached variable map present).
2. Output compiles clean in onemo-next dev; route renders; react-figma can select every emitted element.
3. Conformance report shows ≥ the frame's actual binding rate (165 bound nodes probed) — every bound variable in Figma arrives as `var(--…)` in CSS; zero silent raw conversions of bound values.
4. Re-run → byte-identical output for **code + report** (determinism proof). Exported assets are
   recorded by content hash in the report (Figma's image exports aren't guaranteed byte-stable
   across runs — s58-lead F7); asset-hash drift is reported, never blocks code determinism.
5. Pixel pass: visually equivalent at 402×871 (glass blur, dock, dial, ruler all present); documented deltas only for REFUSED/RAW items.
6. Real repo hygiene: output is new files only; nothing else in the tree changes.
6b. **Fidelity budget (C6.2):** the measured pixel residual between Figma's render and the
   converted screen's render — masking ledgered-approximation regions + the dev badge — must be
   ≤ the budget (default 10%, the text-AA floor); `audit/fidelity-gate.mjs` exits 1 over budget.
   "Works on any screen" is a machine-checked property, not a claim.
7. **Reverse round-trip (fidelity proof, Dan):** the emitted TSX+CSS is parsed BACK into an IR by a
   reverse-reader, and `diff(IR_original, IR_reparsed)` must be empty. Proves the generated code
   carries 100% of the design data — nothing lost, nothing distorted. (A full code→Figma writer —
   pushing screens back into Figma as
   native frames via the plugin API — is a roadmap capability enabled by keeping the IR; explicitly
   NOT required for v1 acceptance.)
8. **Round-trip with the editor (s58-designer):** open the emitted screen in react-figma, edit one
   padding side via the panel, Save to code → git diff is exactly one clean line in the emitted
   module.css (slot-preserving, tokens intact) — proves the emitter's output is byte-splice-editable,
   not just selectable.
9. `tsc --noEmit` and repo lint pass with the emitted files included (compiles ≠ typechecks).
10. **`canon-check` passes with zero warnings** (§4b: industry linters at strict + ONEMO code canon
    + element-count == node-count). The conversion is not "done with notes" — a canon violation is
    a converter bug and fails the run.
11. **Raw census matches (F1 anchor):** the independent raw-REST walker's node census equals the
    emitted ID map — verified by the walker script, which shares no code with the converter.
12. **Every emitted `var(--…)` resolves (F2):** zero unresolved custom-property names against the
    app's current tokens build. One unresolved name fails the run.
13. **Runtime-clean render:** the emitted route renders with zero console errors and zero new
    warnings in a fresh browser load (compiles ≠ typechecks ≠ renders clean — all three gates).
