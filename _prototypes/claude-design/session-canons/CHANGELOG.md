# BUILD CHANGELOG — ONEMO Creator Studio + DS Token Inspector

> Newest first. One entry per meaningful change. Pairs with `versions/<date>_vN/` snapshots for rollback.
> Rollback = copy the file(s) from a `versions/` snapshot back over the working file.

---

## 2026-06-27

### DS v2.3 full-fluid — token integration into the Creator + component de-hardcode findings
> DS v2.3 converter + tokens shipped to SSOT (`onemo-ssot-global` PR #173, merged `f8bca60`): keyword-driven `--sem-dim-fluid/static-*` + `--sem-type-fluid-*`, unified dimension scale, floor 360→320. This entry = wiring v2.3 into the Creator prototype + what it surfaced. Pre-swap snapshot → `versions/2026-06-27_pre-v2.3-remap/`.

- **Token layer → v2.3.** Swapped `tokens-v2/{tokens.css,tokens.ts}` to the v2.3 build (`DS-V2.3--26-JUNE-2026`, floor 320, **780 tokens**). `tokens-v2/README.md` synced (was stale at DS-V2.1 / 764 / floor-360).
- **Creator remapped to v2.3 names** (consumers: `Creator Studio.dc.html`, `Main.dc.html`, `tokens-v2/onemo-app-vars.css`): `--sem-space-*`→`--sem-dim-fluid-*` (gaps/padding), `--sem-size-*`→`--sem-dim-static-*`→ then `--sem-dim-fluid-*` (control dims, see below), `--sem-type-*`→`--sem-type-fluid-*`. `--sem-col-*`/`--sem-border-*`/`--sem-radii-*` unchanged (persist in v2.3). **0 dangling**, verified.
- **Control dimensions → fluid (31 refs).** Dock/dials/icons now grow on the real v2.3 clamps, capped at 1440 — measured exact: **dial 48→56, dock 56→64, dock-icon 24→28**. (Earlier hand-rolled "bigger-growth" demo clamps were stripped — they faked a larger magnitude; real tokens are gentler.)
- **All icons are SVG (verified live in the DOM).** Dial tools + toolbox = inline `<svg>`; dock = SVG via `<img src="assets/glass/*.svg">`; 101 SVG assets. The only raster (PNG) = stage textures (`aluminium/noise/grain`) + the effect content image — **not icons**. So icons are fluid-safe (vector scales crisp); no raster static-exception needed.

**Component de-hardcode punch-list** — surfaced by going full-fluid. These are **Creator-SOURCE** items, currently patched in the test harness (`_resizer.html` / `_phone.html` `_bf` block), **to move into the Creator source during the component sprint** (Linear KAI-9255 / stage = KAI-9258):
- **Stage** hardcoded `320px` → two-segment: **280 @375 / 320 @402 (nominal) / 520 @1440** (deriveCompact).
- **Dial ring** SVG hardcoded `width="48"` → `width:100%` to fill the fluid dial (kills drift — was the "broken icons").
- **Content-col** centers only at `@container ≥768` → caused the **iPad-mini (744) left-align bug**; fixed with `margin-inline:auto` (center the capped column at every width).
- **bottom-section** hardcoded `256` → `height:auto` (hug the stack).
- **tool-box** carousel centering hardcoded → derived from the fluid dial size.

**Harness.** `_resizer.html` (device-frame tester: iPhone SE→iPad→desktop presets + free drag). **NEW `_phone.html`** (full-screen, no frame — served over LAN `http://<mac-ip>:8756/_phone.html` for on-device iPhone testing). Both apply the height-fix + the de-hardcode patches; control sizes come from real v2.3 tokens (no faked clamps). The faked-token-clamp scaffolding was removed; only genuine component/layout behavior remains (destined for source).

## 2026-06-23

### Alias tier landed — tokens.css DS-V2.1 + dash alias column
- **Swapped `tokens-v2/{tokens.css,tokens.light.json,tokens.dark.json}`** to QA-clean DS-V2.1 (22-June) from SSOT `token-outputs/`. Diff: **+214 `--al-*` alias tokens, 0 removed**; **277 semantic names identical** (0 broken refs). Full chain now real: `component → sem → alias → prim → raw` (e.g. `--sem-col-text-primary → --al-col-base-brand-black → --prim-col-base-brand-black → oklch(…)`).
- **Pre-swap snapshot →** `versions/2026-06-22_v2-baseline/tokens-v2_pre-alias/`.
- **Dash:** `_tier()` now recognises `--al-*` → `'alias'`; trace extracts alias name; added **Alias column** between Primitive and Semantic in the inspector table. Confirms alias hop is shown, not collapsed.
- Confirmed: alias suppression (`emitAlias=false`) is intentional in the app pipeline too — it's now exposed in the design CSS for traceability.

## 2026-06-22

### v2 BASELINE snapshot + build cleanup
- **Creator Studio stripped to pure editor** — removed embedded inspector engine (`readWired`/`buildFromWired`/`inspector`/`dockSlice`/`REGISTRY`/`SPEC`/`WSEM`/`WPRIM`/`SEMOPTS`/`tokOverride` + all `ins*` state). File 57.9KB→30.7KB (**47% smaller**). Verified: 5 dock tabs, 8 dials, dock/tab-bar/toolbox intact, renders identical, 0 console errors. Dash still reads it live (79 nodes).
- **Final audit:** build (Creator Studio + RoundButton) = **0 v1 refs, 0 dead code**. 62 prim-direct in build = the v2 audit gaps to rewire next (expected). Dash carries 11 v1 *string-literals* in a dead hardcoded `SPEC`/`cols()` fallback (superseded by live resolver) — flagged for cleanup, not blocking.
- **Snapshot → `versions/2026-06-22_v2-baseline/`** — build + dash + RoundButton + tokens-v2 + session-canons + `BASELINE.md`. Restore point before per-section audit.

### v1 DELETED — build + dash fully on v2
- Removed `tokens/app-tokens.css` from all helmets; build/dash/RoundButton now load `tokens-v2/tokens.css` + `tokens-v2/onemo-app-vars.css` (bridge) ONLY.
- **Bridge** (`tokens-v2/onemo-app-vars.css`): defines `--font-primary`(Chillax)/`--font-body`(Satoshi) and component token `--size-round-button: var(--sem-size-l)` — things v2 has no tier for.
- **Build + RoundButton**: every v1 ref → v2 (value-preserving). `--primitive-dimension-N`→`--prim-dim-N`, `--semantic-*`/`--color-*`→`--sem-col-*`, `--radius-full`→`--sem-radii-full`, `--text-label-*`→`--sem-type-label-*-{size,letter-spacing}`, `--primitive-color-*`→`--prim-col-*`. Deleted `editor-icon-fg`→`--sem-col-fg-secondary`. `--editor-*` layer re-pointed to `--sem-col-*`. accentVars→`--prim-col-`.
- **Dash resolver → v2 (auto-read)**: `_tier()` now `--prim-`/`--sem-`/`--editor-`+bridge; dropdown `_OPT` filters `--sem-col-`/`--sem-space-`/`--sem-radii-`/`--sem-size-`; spacing grouped by v2 BANDS (nano/standard/big/huge, inset/stack/inline gone); swatch regex → `sem-col|prim-col`. Verified: 122 v2 tokens in dropdowns, 0 v1; build renders (status=brand-black, dock=#071013, sizes/spacing resolve mobile via cqi-sim).
- v1 remains ONLY in `versions/2026-06-22_v1/` snapshot + `_archive/` + storybooks (not loaded). Rollback intact.
- TODO: storybooks still v1 (lower priority); Creator Studio still carries a vestigial embedded self-inspector (renamed to v2, but should be deleted for clean export); spacing/type still value-preserving on `--prim-dim-*` (primitive-direct = compliance gaps the dash flags) — fix to true semantic per-section via dash.


### v2 DS wired (alongside v1, non-breaking)
- Loaded `tokens-v2/tokens.css` (DS-V2-22-JUNE-2026, structural names) in the helmets of the dash, Creator Studio, RoundButton — ALONGSIDE v1 `app-tokens.css`. v2 names (`--sem-*`/`--prim-*`) don't collide with v1 (`--semantic-*`/`--spacing-*`/…), so both namespaces resolve and migration is incremental (drop v1 at the end).
- Dash AUTO-reads v2 (resolver `_tg()` reads `document.styleSheets`): 529 v2 vars now in the live graph, no hardcoding. Verified resolves in build context: `--sem-space-standard-m`=16.05px (mobile via cqi-sim), `--sem-size-l`=40px.
- NEXT: mechanical rename sweep (color/dim/radius/size) → resolver tier-prefix + dropdowns AUTO-derived from loaded CSS (not hardcoded) → section-by-section spacing/type/`--editor-*` re-wire. Plan: `session-canons/V2-REBASE-PLAN.md`. Spacing px→band mapping still needs user confirm.


### v1 snapshot — `versions/2026-06-22_v1/`
Files: Creator Polish - Tokens WIP · Creator Studio · RoundButton · Product Page.

**Dash viewer — iframe REMOVED → same-document `dc-import` (ARCH REVERSAL).**
- Was: screen rendered in an `<iframe data-screen-frame>` stacked over the dash; dash read cross-frame.
- Now: screen mounts inline via `<dc-import>` inside `[data-screen-host]`; dash reads the main document (`_sdoc`/`_swin` already fall back to `document`/`window`).
- **Why:** an iframe with rounded corners (`border-radius:46px`) at fractional DPR (1.44) is forced into an offscreen rasterized buffer → permanent blur; and the annotation overlay was clipped by the iframe's rounded `overflow:hidden`. Same-document render composites natively (pixel-crisp) and the overlay can overflow freely.
- Corner rounding moved off the iframe onto the wrapper (`overflow:hidden`); host `transform:none` at 1:1 (was identity `scale(1)`, itself a rasterization trigger).
- Overlay coordinate math switched from iframe offset-walking → `getBoundingClientRect` relative to `[data-screen-host]`.
- **⚠ TRADEOFF → RESOLVED (same day, see below):** fluid `vi` initially resolved against the desktop window. Fixed with a `cqi` preview-sim — no longer an open issue.

### Viewport fix — `cqi` preview-sim (resolves the iframe-absence `vi` problem)
- Problem: with the build inline in the dash's wide document, fluid `vi` tokens measured the desktop window (~19px for `--spacing-s` instead of mobile 18px).
- Fix: `_installViewportSim()` scans loaded `:root` token rules, and for every custom prop whose value uses `vi` it re-declares the SAME formula with `vi→cqi`, scoped under `[data-screen-host]{container-type:inline-size}` (a 402px query container). The build measures the 402px frame → true mobile fluid; the shipped DS keeps `vi` (global untouched — this is a PREVIEW SIMULATION only, not a DS change, so the earlier `cqi`-for-app rejection still stands).
- Auto-derived at runtime from whatever tokens are loaded → survives the incoming DS re-base. Verified: build `--spacing-s` = 18.04px, `--spacing-m` = 27.07px; dash-context `--spacing-s` = 19.02px.
- Desktop mode would resize `[data-screen-host]` so `cqi` tracks 1440 — wired-ready, untested (desktop layout still unbuilt).

**Scan — stabilization poll + MutationObserver (fixes partial read).**
- `dc-import` streams in incrementally; the old "scan when first `[data-anat]` appears" fired at 2 nodes and never re-ran.
- New `_scanWhenReady()`: polls node count until stable across 2 ticks (100ms), then `readWired()`; `_observeScreen()` MutationObserver (childList/subtree) re-scans on late/streamed changes and screen switches; `componentWillUnmount` disconnects. Verified: 79 nodes / 115 tokens / 76 gaps on clean load.

**Layout order** = build / iframe→build / dash, left-to-right (`order:1/2/3`). Canvas spacer experiment added then removed.

### Dash inspector — feature adds (pre-snapshot, same day)
- **Type tab** added; `font` shorthand decomposed → weight/size/line-height/family rows; line-height/letter-spacing/text-transform routed to Type.
- **All copy + all icons/glyphs** now surface in the tree (leaf-text + `<i>/<img>/<svg>` included in scan).
- **Live glyph preview chip** in inspector header (clones the selected icon/text onto a contrast-matched backdrop).
- **Resizable sidebar** (drag handle, 180–560px, persisted in `dashUIState`).

### Creator Studio — dial row physics
- Drag-to-pan + flick **momentum** (90ms velocity window) + eased release-**snap** to nearest dial; centered on launch (no post-load jump); `_busy` flag silences `onToolScroll` re-render storm during drag; CSS `scroll-snap` removed (was fighting the drag).
- Shape/Add dials (no ruler) show icon only, no value number.

---

## 2026-06-21
- RoundButton component + `--size-round-button` token (name UNSANCTIONED placeholder). close/confirm/view-toggle/menu wired to `<dc-import name="RoundButton">`.
- Canon folder `session-canons/` created (RULES · EXECUTION-STATE · tokens-changelog · COMPONENT-ADDITIONS · DS-COMPONENT-TOKENS-BRIEF · SESSION-LOG · apply-token-edits.js).
- Deterministic bake pipeline (`dashBakeQueue` → `apply-token-edits.js`).
- See `tokens-changelog.md` for token-level edits (separate audit trail).
