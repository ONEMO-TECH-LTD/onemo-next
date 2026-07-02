# ONEMO — RULES & CONVENTIONS (read this first)

> Canonical rules for ANY agent (incl. post-compaction) working on the ONEMO Creator prototype + DS token work.
> Source of truth for token discipline lives in `ds-source/naming-rules.json` + Figma `figma-variables-2026-03-10.json`.
> Sibling canon files (this folder `session-canons/`): `EXECUTION-STATE.md` (current state — read 2nd), `tokens-changelog.md` (every CSS edit), `COMPONENT-ADDITIONS.md` (Figma authoring feed), `DS-COMPONENT-TOKENS-BRIEF.md`, `SESSION-LOG.md`, `apply-token-edits.js` (deterministic baker).

## 0. Token tier architecture (4 tiers)
`Primitive (1.x)` → `Alias (2.x, emitAlias=false — Figma-internal ONLY, never in CSS)` → `Semantic (3.x — what UI consumes)` → `Component (4.x)`.
- **Hard rules** (from naming-rules.json): no hardcoded hex in components; **alias is the swap point — semantic→alias→primitive, never skip a layer**; primitives are raw values only; Figma is SSOT (except during the SSOT-FLIP below); use British `grey`; radius static px; letter-spacing em.
- Compiled CSS collapses semantic→primitive (alias invisible). To show the alias tier the dash reads the Figma JSON.

## 1. Token NAMING convention (critical)
Component tokens **share their category's CSS prefix** and append the component name — exactly like the DS's component colours:
- Component colour → `--color-{component}-{part}-{prop}` e.g. `--color-slider-handle-bg`, `--color-footer-button-fg`, `--color-text-editor-icon-fg`.
- Component size  → `--size-{component}` e.g. **`--size-round-button`** (NOT `--round-button-size`, NOT a t-shirt scale).
- **Component tokens name a SPECIFIC component; they do NOT use the semantic t-shirt scale (s/m/l/xl…). The t-shirt scale is the SEMANTIC layer's job.**
- **Padding → semantic INSET family** (`--spacing-inset-*`), EVERY side incl. zero → `--spacing-inset-none`. NEVER bare `0` or base `--spacing-*` for padding. (Gap between stacked items → `--spacing-stack-*`; inline/row gaps → `--spacing-inline-*`; base `--spacing-*` for margins/general.) Compiled names keep the `--spacing-` prefix (e.g. `--spacing-inset-m`).
- **UTOPIA APPLICATION CANON (from Figma $descriptions — how fluid is meant to be applied):** assign spacing by ROLE/INTENT, NOT by matching the old pixel value — fluid handles scaling, so you never "snap px to nearest rung". inset role map: `none` zero · `xs` compact · `s` default · `m` comfortable · `l` generous. base `--spacing-*` GAP roles: `3xs` micro/icon-padding · `2xs` inline element gaps · `xs` form-field · `s` list/form gaps · `m` card padding · `l` section inner padding. → A control's compact padding = `inset-xs`; default = `inset-s`; card = `inset-m`. Static (`--size-*`) is ONLY for things that must NOT scale (icons/controls, device chrome) — ordinary padding/gaps are fluid-by-role.
- **STATIC ELEMENTS KEEP STATIC INSET (critical).** Fluid inset is for FLUID/layout containers only (sections, cards, screen-edge gutter). A FIXED-size element (icon, round button, tab bar, dock, dial, swatch) must NOT use fluid inset — its internal padding is part of its fixed geometry; fluid padding on a fixed box makes content drift. Their inset = STATIC → `--size-*` or a static component-spacing token (the `4.1_Component_Dimensions` gap — legitimately needed here, NOT dead). Discriminator for any element: does it SCALE (fluid container → fluid inset) or is it FIXED (control/bar/icon → static inset)?
- CSS prefixes by category (naming-rules.json): colours `--color-` / `--semantic-`; spacing `--spacing-` (grouped inset/stack/inline drop the prefix → `--inset-*` etc.); radius `--radius-`; size `--size-`; type `--text-` (+`--line-height`/`--letter-spacing`/`--font-weight`); fonts `--font-`; width `--width-`; container `--container-`; breakpoint `--breakpoint-`; primitives `--primitive-*` (BARRED from direct use in components).

## 2. Fluid vs Static
- **FLUID (clamp, viewport-driven via `vi`):** spacing (`--spacing-*`, incl. step-pairs like `--spacing-s-m`) and typography (`--text-*`). Layout breathes with the device window.
- **STATIC (fixed px):** radius (`--radius-*`), element sizes (`--size-*`: 2xs16 s24 m32 l40 xl48 2xl56 — see size fix below), breakpoints, widths, containers, primitive dimensions.
- **Icons/control affordances do NOT scale fluidly** — they're static (`--size-*`). Hit targets are device-ergonomic, not proportional.
- Fluid `vi` reads the real WINDOW, not a nested container — that's why the dash renders the screen in its own iframe sized per-device (402 iPhone / 1440 desktop) so fluid tokens resolve true. cqi/container-queries REJECTED (fluid should track the device window).

## 3. SSOT-FLIP (current working model, 2026-06-21)
While prototyping the real Creator screen, the **local token CSS is the working SSOT**: add named component tokens here (from the ACTUAL design), bake into `tokens/*.css`, THEN update Figma + converter FROM the CSS.
- **NO component token created/baked until the USER sanctions its NAME.** Incremental, one at a time, verify each in the dash.
- Every hand-edit to `tokens/*.css` MUST get a `tokens-changelog.md` entry (newest-first: file · old→new · reason · who sanctioned · revert) — backup/audit so any bad change is reversible.
- `tokens/*.css` is otherwise generated — never hand-edit outside this flow + a changelog entry.

## 4. ATOMIC RANGE (governing principle)
The whole logic applies to EVERY element across the full atomic range, not one-offs:
- (a) every element gets a UNIQUE `data-anat` — containers, objects AND nested icons (e.g. `close` → `close-icon`) — so the dash decomposes atoms→molecules→organisms with no dead-end at a component boundary.
- (b) every reusable element gets sanctioned component tokens → semantic, baked + logged.
- (c) recurring elements (round buttons, dials, swatches, tabs…) wire to ONE reusable component. First: `RoundButton.dc.html`.

## 5. Brand method (UI-BRIEF — the style constitution)
- **95% canonical + 5% ONEMO, shifted by SHAPE not colour** (Virgil Abloh). Every element = familiar archetype + exactly one geometric move.
- **CTA reference element:** full-width pill, transparent fill (window into the surface), 8px solid `#071013` stroke, label in Chillax Medium cold slate `#2C3A4A` (NOT black). Differentiate by contour, never colour.
- **Colour discipline:** runs between aluminium stage (ice-blue `#C3E1F2`→paper `#FAFAFA` gradient + noise) and black brand pole `#071013`. Accent colour ONLY in brand-pattern moments, NEVER on UI controls. Shell stays silent.
- **Icons:** 100% neutral canon, light/1.5px weight (Phosphor light baseline), inherit text colour, sizes 16/20/24. Brand geometry never used as control icons.
- **Noise/grain** is a signature material on stage surfaces.
- Fonts: **Chillax** (`--font-primary`, display/headings/labels/CTA/nav) + **Satoshi** (`--font-body`). Brand colour = blue-green (teal) ramp. Accents: lime-moss (1st); raspberry-plum + indigo-bloom (2nd).

## 6. Product canon
ONEMO = "special effects for your clothes." Modular wearable **Effects** (sticker-like ~1.6mm cut-outs) attach to **Bases** (garments) via an **Interface** (magnetic/velcro). Public unit name is always **Effect**. Mobile-first single-design (iPhone 402×874). Voice: calm, premium, witty, anti-noise, permission-giving.

## 7. Build rules
- Design Components (`.dc.html`), inline styles referencing token vars (load `tokens/app-tokens.css` in `<helmet>`). NEVER hardcode hex.
- Screen = standalone module (`Creator Studio.dc.html`); the dash (`Creator Polish - Tokens WIP.dc.html`) IMPORTS it via iframe and only READS it (DOM scan + computed styles + stylesheet cascade). Overlay is dash-owned.
- Deterministic bake: dash **Save** → `localStorage.dashBakeQueue` (keyed by unique `data-anat`) → `apply-token-edits.js` (pure, idempotent, refuses on ambiguity, expands padding/margin shorthand). The PAGE CANNOT write project files (sandbox); agent runs the applier. Verified: serve route GET-only, no write API.

## 8. Known DS fixes done / pending
- **DONE:** size off-by-one (semantic `l`→40, `xl`→48, `2xl`→56) mirrored in CSS from user's Figma `3.6_Semantic_Size` remap. Names `s/m/l` (semantic) vs `sm/md/lg` (alias) kept distinct ON PURPOSE.
- **DONE:** `--size-round-button: var(--size-height-l)` — first component token.
- **PENDING (Figma authoring, see COMPONENT-ADDITIONS.md):** glass/dock/stage MATERIAL component tokens (alpha primitives needed); static component spacing; the `--editor-*` layer is a stand-in, names NOT yet sanctioned.
