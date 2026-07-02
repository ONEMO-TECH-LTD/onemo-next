# EXECUTION STATE — ONEMO Creator Studio + DS Token Inspector

> **Durable memory.** Read `session-canons/RULES.md` FIRST, then this. Update as work progresses.
> **All canon files now live in `session-canons/`:** RULES.md · EXECUTION-STATE.md · tokens-changelog.md · COMPONENT-ADDITIONS.md · DS-COMPONENT-TOKENS-BRIEF.md · SESSION-LOG.md · apply-token-edits.js (bake the change-set from `localStorage.dashBakeQueue`).
> Last updated: 2026-06-21 — RoundButton component + `--size-round-button` token; canon folder created.

## What we're building
0. **SSOT FLIP (2026-06-21 directive).**While prototyping the real Creator screen we treat the local **token CSS as the working SSOT**: we add proper named **component tokens** here (based on the actual design), bake them into `tokens/*.css`, and THEN update Figma + the converter FROM the CSS. Discipline: **NO component token gets created/baked until the user sanctions its NAME** — incremental, one at a time, verify each. Every hand-edit to `tokens/*.css` MUST get an entry in `tokens-changelog.md` (backup/audit trail, newest-first) so any wrong change is reversible. `apply-token-edits.js` + `dashBakeQueue` remain the deterministic write path for prototype markup.
0b. **ATOMIC RANGE (2026-06-21 directive).** This whole logic — atomic tagging + component tokens + componentizing repeats — applies to **EVERY element across the full atomic range**, not one-offs. Rules: (a) every element gets a unique `data-anat` incl. containers, objects AND nested glyphs/icons (e.g. close→close-glyph) so the dash decomposes atoms→molecules→organisms with no dead-end at a component boundary; (b) every reusable element gets sanctioned component tokens → semantic, baked + logged; (c) recurring elements (round buttons, dials, swatches, tabs…) wire to ONE reusable component. First component: `RoundButton.dc.html` (cancel/done + small round controls). WIRED 2026-06-21: close · confirm · view-toggle · menu are now `<dc-import name="RoundButton">` (undo/redo EXCLUDED — different archetype: icon-in-pill, not a 40px circle). RoundButton uses `var(--editor-*, fallback)` so it renders standalone too. **BAKE CAVEAT:** componentized buttons' style source is now `RoundButton.dc.html`, so the dash bake (anchors `data-anat` in the SCREEN file) will SKIP them — component-level edits belong in `RoundButton.dc.html`; per-instance differences are props (icon/surface/tone). PENDING: user has NOT sanctioned the size-token name — `--size-control-{sm,md,lg}` is Claude's placeholder (currently in app-tokens.css+semantic.css+RoundButton, logged); rename on user's word. Do NOT bake more token names unsanctioned.

## What we're building
0z. **⚠ INCOMING DS RE-BASE (from s57/lead2 track, 2026-06-21 — read TRANSCRIPT VAULT/claude/s57/lead2/2026-06-21).** A canonical DS migration is in progress that SUPERSEDES some of our local work:
  - **Type re-based 18/20 → mobile-first 16→18.** This makes fluid spacing land on a clean grid: mobile `--spacing-*` = 4/8/12/16/24/32/48/64/96 (s=16!). So **16px WILL exist on the fluid scale** — the whole "no 16 in fluid" problem dissolves. Root cause was the inherited Utopia demo default 18/20 base.
  - **Fluid scale EXTENDED below 4px** (adds 4xs/5xs/6xs = 3/2/1px) → fluid now covers micro-spacing.
  - **Static spacing collections REMOVED upstream** (`2.4.1_Alias_Spacing_Static` + `3.2.1_Semantic_Spacing_Static` deleted in Figma v2) — the extended fluid covers them. → **Our local `--spacing-static-*`/`--alias-spacing-static-*` block becomes redundant; REMOVE it when the regenerated CSS lands.**
  - Canonical Figma file is now **"ONEMO DS v2 - 21 June 26+"** (`dcl2tPNNLlOgrvnDEReD1T`), NOT the old "ONEMO DS". Converter (`build-tokens.mjs`, utopia-core@1.6.0) re-exports from v2.
  - size fix l=40 confirmed (rides the export). emitAlias stays false in the canonical (our local alias-emit was a local-only experiment).
  - **ACTION when regen CSS arrives:** drop it in, delete our hand-crafted static block, re-verify the prototype against the new grid-clean fluid scale (16 = `--spacing-s` mobile).

## What we're building
1. **Creator Studio screen** — a clean, standalone, exportable mobile prototype (iPhone 16/17 Pro, **402 × 874**).
2. **DS Token Inspector dash** — a *universal* tool that imports any screen and shows, per element: anatomy tree, Figma-style annotation overlay, and the **token chain + DS-compliance** of every applied value.

## Files
- `Creator Studio.dc.html` — the screen module (pure prototype + its own logic: dock/tool/ruler/swatch). Has the `--editor-*` component-token layer in its `<helmet>`.
- `Product Page.dc.html` — copy shell of the screen, root `data-anat="product page"` (placeholder; not yet designed).
- `Creator Polish - Tokens WIP.dc.html` — **the dash**. Imports a screen via `<dc-import>` (sc-if gated, `currentScreen` state), scans host-based, owns the overlay + inspector. THIS is the file most edits land in.
- `DS-COMPONENT-TOKENS-BRIEF.md` — brief for Claude Code (author component tokens in Figma).
- `COMPONENT-ADDITIONS.md` — running log of tokens to add to Figma (feed to Claude Code).
- `ds-source/figma-variables-2026-03-10.json` — **SSOT** Figma export (imported).
- `ds-source/naming-rules.json` — tier routing + hard rules.
- `tokens/*.css` — compiled DS tokens (generated view; **never hand-edit**).

## Architecture (locked)
- Screen = standalone DC module; dash imports it as INPUT and only *reads* it (DOM scan + computed styles + stylesheet cascade). Overlay lives in a dash-owned stage wrapper, never in the prototype DOM.
- Dash scan is generic: `[data-screen-host] [data-anat]` → first tagged node is the screen root.
- Multi-screen: `screens` state + `pickScreen()`; only the selected screen mounts.

## DS truth (from SSOT — do not re-derive)
- **4 tiers:** Primitive (1.x) → **Alias (2.x, `emitAlias=false`, Figma-internal only)** → Semantic (3.x, what UI consumes) → Component (4.x).
- Hard rules: *no hardcoded hex in components*; *alias is the swap point — never skip a layer*; *primitives are raw values only*; *Figma is SSOT*; radius static px; letter-spacing em.
- **Static (fixed px):** radius (`--radius-*` 0/2/4/6/8/10/12/16/20/24/full), breakpoints, widths, containers, **element sizes (`--size-*` 16/24/32/48/56/72)**, primitive dimensions.
- **Fluid (clamp):** spacing (`--spacing-*`), typography (`--text-*`).
- **No static *component* spacing token exists** → must be authored (DS gap).
- Compiled CSS collapses semantic→primitive (alias invisible). To show the alias tier the dash must read the Figma JSON.

## Migration rule (how to wire any component value)
- **Color** → `--color-*` / `--semantic-*` (incl. component-color tokens below).
- **Fixed size / radius** → `--size-*` / `--radius-*` (static — icons/controls must NOT grow fluidly).
- **Flexing layout spacing** → `--spacing-*` (fluid).
- **Fixed component spacing** → DS gap; pin with `--size-*` meanwhile, author a static component-spacing token.
- **Primitives are BARRED** from direct use (read-only).

## Real Figma component tokens that fit our editor (4.0_Component_Colours, mode "Value")
- `text-editor-icon-fg` → `{fg-secondary}`, `text-editor-icon-fg_active` → `{fg-primary}` → **our control-icon ink** (`--editor-fg`, `--editor-fg-strong`).
- `footer-button-fg` / `_hover` → `{text-brand-secondary}` → **dock tab labels**.
- `slider-handle-bg` → `{bg-primary}`, `slider-handle-border` → `{border-brand}` → **ruler/slider handle**.
- `toggle-*` → **Tune segmented switch**.

## Dash compliance legend (live cascade resolver, reads `document.styleSheets`)
- `✓ sem` — routes through semantic (compliant).
- `⚑ gap` — VIOLATION: skips a layer (component→primitive, or direct primitive/raw on a colorable prop).
- `▦ mat` — component MATERIAL with no semantic yet (glass/dock/stage gradients/alphas) — legitimate, pending Figma authoring.
- `◐ prim` / `· na`.

## Status
- Dash wired to live cascade resolver (680-token graph). Real chains + 3-state compliance working.
- `--editor-accent*`, `--editor-tool-ink*`, `--editor-fg-disabled`, `--editor-dock-ink`, `--editor-fg-strong` = ✓ compliant.
- `--editor-fg` = ✓ FIXED → now `var(--color-text-editor-icon-fg)` (→ semantic-fg-secondary, grey-11 neutral). Was the "faint blue" (blue-green-12 violation).
- Glass/dock/stage materials = ▦ pending authoring.

### Session 2026-06-20 (late) — viewer + UI fixes DONE
- **Viewer is now an IFRAME stacked ON TOP of the dash** (not a column inside it). `Creator Studio.dc.html` / `Product Page.dc.html` load via `<iframe data-screen-frame src>`; dash reads cross-frame (`_sdoc()`/`_swin()` → contentDocument/contentWindow; `_tg()` reads iframe styleSheets; overlay `off()` walks to iframe root for absolute coords).
- **Size dropdown** (sidebar): iPhone 16 Pro · 402 / Desktop · 1440 → resizes the iframe window so `vi` fluid tokens resolve true per-device (mobile 18px confirmed). `_vp()` computes frameW/H/scale; desktop GROWS dashW (no shrink). Right-edge + corner resize handles on dash.
- Screen root reverted to FIXED 402×874 (phone never breaks); wrapper centers it in the iframe; phone radius(46)+shadow live on the screen root; iframe has matching `border-radius:46px` so no gray square-corner "peeking". De-duped a doubled box-shadow on both roots.
- Inspector flexes to full dash width (table columns spread). Viewer band: no gray underlay, phone centered.
- **Selection is now clearable**: default `insSel:'__none__'` (proto renders CLEAN, no overlay); click-away on the viewer band (`onDeselect`) clears selection + annotations. buildFromWired handles `sel=null`.
- iPhone/Desktop both verified: overlay tracks the centered phone in both.
- **DESKTOP CAVEAT**: no desktop LAYOUT exists — Desktop mode = centered 402 phone on a 1440 canvas. A true desktop layout (dock→side panel etc.) is unbuilt design work; user to decide if/when.

## Next steps (in order) — BUILD FIXES continue here
0. **DETERMINISTIC BAKE PIPELINE — DONE (2026-06-21).** Page CANNOT write project files (verified: serve route GET-only, PUT 404; support.js exposes only host→page api, no write msg; sandbox fetch can't reach backend). So persistence = page→host→backend, agent-run. Pipeline: dash **Save** writes exact change-set to `localStorage.dashBakeQueue` keyed by each element's UNIQUE `data-anat` (verified unique per source element; sc-for repeats = one source el). **`apply-token-edits.js`** (project root) = pure deterministic applier: anchors on data-anat, rewrites named inline-style props, refuses on missing/ambiguous anchor, expands padding/margin shorthand→longhand, idempotent. BAKE = agent reads queue via eval_js + runs applier via run_script → writes files. Proven dry-run (replace/append/shorthand-expand, run1===run2). When user says "bake", do it. Future real home: dev endpoint in onemo-next runs the same applier behind Save.
   - Dash also persists its OWN UI state (`localStorage.dashUIState`: viewport/size/zoom/currentScreen/insSel/insTab) so rebuilds don't reset the dash.
1. **`--editor-fg` DONE** (→ text-editor-icon-fg). Continue re-pointing remaining `--editor-*` colors: dock labels→footer-button-fg; ruler→slider-handle; toggle→toggle-*.
2. Author `COMPONENT-ADDITIONS.md` entries for materials + static component spacing (feed Claude Code → Figma).
3. Markup cleanup: `--primitive-dimension-*` → `--size-*` (fixed) / `--spacing-*` (fluid). (bottom-section bottom padding already → `--spacing-s`.)
4. Finalize dash inspector columns: component → semantic → (alias from JSON) → primitive → raw + compliance mark; add Alias column.
5. Primitive/alias read-only guard (so they can't be hand-written).
6. (decision) Desktop layout — build or keep mobile-only/centered-phone.

## Open decisions (need user)
- Alpha primitives for glass / dock-ink-muted (add `base/white-aNN`+`black-aNN`?) or keep glass as raw component material.
- Static component-spacing collection name (`4.1_Component_Dimensions`?).
- Component tokens are UNVERIFIED until real components exist → treat as **mock components** for now.

## Viewer = iframe (DECIDED 2026-06-20) — ⚠ SUPERSEDED 2026-06-22
**SUPERSEDED:** the iframe was REMOVED 2026-06-22 (see CHANGELOG v1). An iframe with rounded corners at fractional DPR (1.44) rasterizes into an offscreen buffer → permanent blur, and the annotation overlay was clipped by its rounded `overflow:hidden`. The build now mounts inline via `<dc-import>` in the SAME document (pixel-crisp, overlay overflows freely). The `vi`-viewport reason the iframe existed is now solved WITHOUT an iframe via the `cqi` preview-sim (`_installViewportSim()` re-declares `vi` tokens as `cqi` scoped to a 402px `[data-screen-host]` container). Scan readiness handled by `_scanWhenReady()` (stabilization poll) + `_observeScreen()` (MutationObserver). The original iframe rationale below is kept for history only.

The screen must render in its **own iframe sized to the device width (402px)** so it has a real window. Reason: DS fluid spacing/type use `vi` (viewport=window) by design — correct for the real app where the screen IS the window. Embedding the screen as an inline `div` in the dash's 924px window makes `vi` resolve desktop values (proved: `--spacing-s` = 19px identical at root and inside the 402 frame). `cqi`/container-queries REJECTED (fluid should track the device window, not nested containers). Iframe gives the screen its own 402px window → `vi` resolves true mobile (18px). NOT a hack — it's the correct viewport.
Cross-frame rewire needed in the dash read path:
- `readWired` scope → `iframe.contentDocument` (not main doc); use `iframe.contentWindow.getComputedStyle`.
- `_tg()` cascade resolver → read `iframe.contentDocument.styleSheets` (screen's --editor + token CSS live in the iframe).
- annotation overlay → element offset within screen + the iframe's rect offset in the dash doc.
- screen picker → swap iframe `src` between `Creator Studio.dc.html` / `Product Page.dc.html`; re-scan on iframe `load`.

## Original `/goal` (recovered from compaction — DO NOT lose again)
Source: `onemo-dev/onemo-ssot-global/_ssot-workbench/claude-design.md`.
1. **Retain the original; apply DS tokens in every detail** — check each current value vs DS, sanity-check, **full swap** (normalise = apply tokens).
2. **Where DS is silent → separate component documenting the real values on a "Storybook" page** (don't forget them). Here ⇄ Storybook stay **in sync**.
3. **Unified side-by-side page: LEFT = original, untouched/locked visual reference; RIGHT = DS-applied duplicate** — to catch drastic deviation/breakage. (Two copies of the original; left pristine.)
4. **Theme-flipping is automatic** once DS tokens applied (tokens already cover light/dark).
5. **Desktop works out of the box** from the DS once tokens applied.
> Project already has Storybook DCs: `Design System - Storybook.dc.html`, `Components - Storybook.dc.html`, `Creator Studio- Storybook.dc.html`.

## Transcript
No verbatim transcript is retrievable in this environment (compaction drops history; no subagent reads it). THIS file + `COMPONENT-ADDITIONS.md` + the brief are the continuity record. Keep them current.
