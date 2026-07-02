# Variables Panel — Build Ledger (append-only)

Builder: Claude (Opus), reporting to Kai. Branch: session57-task/variables-gui
Worktree: onemo-ssot-global/.claude/worktrees/s57-variables-gui

## Setup
- Surprise 1: remote has NO `staging` branch (only `main` + task branches). Branched off `origin/main` instead.
- Surprise 2: `16-storybook/node_modules` does not exist anywhere in repo — nothing to symlink. Running `npm install` in worktree's 16-storybook.

## Data format (verified against figma-variables-2026-03-10.json)
- Top-level = ARRAY of 23 objects, each `{ "<CollectionName>": { modes: { "<Mode>": tokenTree } } }`.
- Modes vary: Light/Dark (colours, effects), Value (most), Desktop/Mobile (fluid + alias type/spacing).
- Leaf token = object with `$type` (float|color|string), `$value` (literal OR "{ref}"), `$scopes`, optional `$description`, `$hiddenFromPublishing`.
- Alias: `$value` = "{dot.path}" + `$collectionName` = target collection. Ref dot-path is a NESTED object walk in the target tree (family.primary -> tree.family.primary). `/`-named keys (style/normal/extra-light) are literal flat keys, NOT split.
- Validated: all 589 alias tokens resolve via nested walk against $collectionName (trying each mode). 0 unresolved, 0 missing collections.
- Max resolution chain depth = 3 (Component -> Semantic -> Alias -> Primitive).
- Leaf counts per collection captured (Primitive_Colours=127, Semantic_Type=126, etc).

## Build steps (v1 display)
- [x] copy figma-export.json into src/variables/
- [x] resolver.ts (parse + resolve, mirror build-tokens.mjs)
- [x] VariablesPanel.tsx (sidebar + groups + Name|Value table + inspect + search + mode toggle)
- [ ] VariablesPanel.stories.tsx (title "Design System/Variables Panel")

## SCOPE EXPANDED (coordinator relay) -> real EDITOR
1. [ ] NOT HARDCODED — story imports real figma-export.json (copy of artifacts file). Confirm dynamic.
2. EDITING:
   a. [ ] inline-edit literal values (number/color/string)
   b. [ ] "+ Create variable" — add token to selected collection/group (name/type/value)
   c. [ ] ADD MODES — add a mode to a collection, per-mode values
3. [ ] ALIAS via searchable dropdown — valid lower-tier targets, writes {refPath}+$collectionName
4. [ ] PERSIST — Vite configureServer middleware POST -> write JSON back to artifacts file. Fallback: Download JSON.

## DONE — all scope items
1. [x] NOT HARDCODED — story imports real figma-export.json (byte-identical copy of artifacts). Confirmed in browser: all 23 collections + real values render.
2a. [x] inline literal edit — verified live (set dimension "16" -> 999 in browser).
2b. [x] "+ Create variable" row (name/type/value, added to all modes).
2c. [x] add-mode ("+ mode" copies current mode tree; per-mode values).
3. [x] alias searchable dropdown (◈) — targets filtered to strictly-lower-tier collections + same $type; writes {refPath}+$collectionName.
4. [x] PERSIST — Vite configureServer plugin POST /__variables-save writes BOTH story copy + artifacts file. Verified live: HTTP 200 ok:true round-trip. Download JSON fallback for static build.

## VERIFY (all green)
- [x] tsc -b — ZERO errors in my files (only pre-existing v3-current unused-import errors remain, untouched by me).
- [x] build-storybook — exit 0, "Storybook build completed successfully", VariablesPanel.stories chunk emitted.
- [x] live: storybook dev iframe 200, story registered (design-system-variables-panel--default), no console errors, resolution chain Semantic->Alias->Primitive verified, inline edit verified.

## Post-verify cleanup
- Restored worktree artifacts + story copy to pristine 32e43f... (my round-trip save test had re-pretty-printed it; primary clone never touched).
- Removed storybook-static + node_modules/.cache. Killed dev server.

## Final diff for Kai
- M 16-storybook/.storybook/main.ts  (register save plugin via viteFinal; .ts extension required by SB10)
- M 16-storybook/vite.config.ts      (register save plugin)
- ?? 16-storybook/src/variables/      (resolver.ts, VariablesPanel.tsx, .stories.tsx, save-plugin.ts, figma-export.json, LEDGER.md)
- package-lock.json UNCHANGED. node_modules gitignored.

## Sidekick pass (s57-sidekick) — finish + QA + resizable + converter loop
Builder: Claude (Opus) as @s57-sidekick, handed off from @s57-lead2. Worktree only, not committed.

### Fixes (lead2 handoff gaps)
- **Truncation**: VariablesPanel root `height:660` → `height:'100vh'`; table body scrolls internally. Fills viewport.
- **Mode toggle**: render the pills ONLY when `coll.modes.length > 1`; single-mode shows a `"<mode> · single mode"` label (no inert toggle). Active pill gets blue border/text. Verified Light/Dark flips + single-mode label live.

### Resizable panels (Dan directive)
- New `ResizeHandle` atom (axis x/y, window mousemove drag) + `clamp` + localStorage layout persistence (`onemo-variables-panel-layout`) + `⤢ Reset`.
- 4 boundaries drag-resize: sidebar width (180–560), collections/groups split (80–640), inspect width (240–620), Name|Value column split (20–75% via mainRef px→%). All verified by live drag.

### Converter engine loop (brief core)
> NOTE (superseded — converter is now the scan-driven `build-scan.mjs` + `tokens.format-spec.json`, emitting 5 frameworks; the `build-tokens.mjs` / `.preview-output` / 4-CSS details below are the ORIGINAL build-loop record, kept as dated history).
- **Discovery**: a self-contained converter lives in THIS repo — `tools/ds-pipeline/build-tokens.mjs` (+ tokens.config.mjs), reads `11-design-system/artifacts/figma-variables-2026-03-10.json` (= the file the editor saves). So the loop is fully inside onemo-ssot-global; onemo-next's converter (lead2's lane) is untouched.
- **save-plugin.ts**: added POST `/__variables-build` — writes the POSTed tokens to an UNWATCHED temp (`tools/ds-pipeline/.preview-output/.input.json`, gitignored) and runs `build-tokens.mjs --input <temp> --output-dir .preview-output`. `--output-dir` ≠ DEFAULT means build-tokens writes ONLY there (§2580) — never the onemo-next/onemo-theme consumers or SSOT. Returns the 4 generated CSS files.
- **VariablesPanel.tsx**: `⚙ Build` button + `BuildOutputPanel` modal (tabs primitives/semantic/semantic-inline/aliases + counts, dark code view). `handleBuild` POSTs the in-memory `doc` straight to the build endpoint (NO pre-save → no figma-export.json write → no HMR remount; earlier bug: saving figma-export.json HMR-remounted the component and closed the modal).
- **Verified live**: Build → modal shows real CSS (primitives 443, semantic 168, semantic-inline 524, aliases 0 suppressed). Edit-flows-through proven at endpoint: token `16`→`160` ⇒ `--primitive-dimension-16: 1rem` → `10rem`. figma-export.json + artifact md5 UNCHANGED by a build (32e43f). tsc clean (ours), build-storybook OK.
- ds-pipeline needs culori → `npm install` in tools/ds-pipeline (node_modules gitignored). `.preview-output/` added to ds-pipeline/.gitignore.

### Read-any-file (brief: load/work/save/switch, converter reads any format)
- **resolver.ts**: `parseLoadedFile(text, filename)` detects Figma-JSON vs CSS. `cssToExport()` parses a CSS custom-property file into the editor model — **selector blocks become MODES** (`:root` → Light, `[data-theme="dark"]` → Dark = base ⊕ overrides), `--` dropped, `-` segments nest into groups, **lossless** (collisions fall back to a flat key; no overwrite). NB: a CSS file has ~3× lines per token (light + 2 dark blocks) → correct unique count, not loss.
- **VariablesPanel.tsx**: `📂 Open` (File System Access `showOpenFilePicker`, `<input type=file>` fallback) loads JSON/CSS → replaces `doc`, shows a source chip (`CSS · <file>` / `JSON · <file>`), `↺ Default` switches back. `Save` is source-aware: a file opened via the picker is written back in place via `handle.createWritable()` (true "save into it"); default source → the dev-endpoint artifact save; Download = save-as.
- **Verified live** (injected the converter's own primitives.css via the hidden input — the native picker isn't automatable): editor shows 225 unique tokens, grouped (`primitive/color/grey`…), Light values correct (`grey-1` oklch 99.13%), Dark toggle flips to dark (`grey-1` → 17.85%, base/white stays, brand/white darkens). Round-trip Figma-JSON → Build → CSS → reload-CSS shows the same truth. tsc clean.
- **Honest gap**: `Save`-into-handle (write-back to a picker-opened file) is code-complete but live-verified only by code read — the OS file dialog can't be driven by browser automation; the `<input>`-fallback path (no handle) was the one exercised.
- **Next (not built)**: multi-framework OUTPUT — converter emits CSS/Tailwind today; React/Liquid/Next naming views are a converter-emitter extension.

### Figma-style table rework (Dan: compare modes / nested groups / select filters)
- **Mode columns side by side** — table is now `Name | <mode1> | <mode2> | …` (was a mono single-Value column + toggle). Each row shows every mode's value to compare; column header = the focus switch; `+ mode` adds a column. `rowsByMode` indexes each mode's tokens by id; edits are per-mode (`handleSetLiteral/Alias(row, value, m)`).
- **Nested collapsible group tree** — `resolver.buildGroupTree()` builds the full folder hierarchy from token path prefixes (roll-up counts); `GroupTreeView` renders recursive collapsible folders (▸/▾, indent by depth). Replaces the old flat top-level list. Verified on 3.1_Semantic_Type (display ▸ sizes; title ▸ screen/section/product ▸ primary/secondary) — collapse hides children.
- **Select group → table filters** — `selectedGroup` is now a `/`-joined path; rows match it or any descendant (`g === sel || g.startsWith(sel+'/')`). Verified: select "grey" → table shows only grey.
- Verified live: colours show Light/Dark columns (grey-1 `#fcfcfd`/`#111113`); tsc clean. **Needs re-QA** (table restructure since the last PASS).

### Diff added by sidekick
- M tools/ds-pipeline/.gitignore  (+ .preview-output/)
- M (within ?? src/variables/) save-plugin.ts, VariablesPanel.tsx, resolver.ts, LEDGER.md
- node_modules in tools/ds-pipeline (gitignored). Artifact + figma-export.json restored pristine (32e43f).
