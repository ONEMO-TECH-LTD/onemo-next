# E7 — Components Canvas (KAI-9364) — architecture v4.1 (closure round: lead N1/N2 + QA wording findings folded)

> v2 → v3: @s58-lead adversarial verdict (s58-e7-components-canvas-arch-verdict.md) = REWORK-with-solutions; findings F1–F5 folded.
> v3 → v4: @s58-qa execution-backed risk probes (/tmp/s58-e7-risk-probes-report.md) — R1 FAILS-with-working-solution
> (discovery mechanism corrected), R2 PROVEN (exact include/jail changes), R3 PROVEN (root selector). Probe-derived
> configs folded below. Architecture is risk-probe verified except the explicitly listed build-step verifications
> (§Verification trail) — ready to build on Dan's go.

Dan's spec (2026-07-05, verbatim intent): Framer-style **separate canvas for components** — same structure as the regular canvas, toggle between the two. Sandbox canvas with pages + layers; category = folder/page, components laid out on the infinite canvas by category. Two roots: **Global library** (build-agnostic, like the token system) and **Project** (recognized from the connected build). Add/create component works like Figma/Framer incl. **states and variants**.

Decision taken (announced 2026-07-06): global library = **separate build-agnostic package** (`onemo-component-library`), not a folder inside onemo-next.

## Grounding facts (read from code, 2026-07-07)
- The editor iframe loads a host ROUTE (`react-figma/canvas/page.tsx` renders the build screen 1:1). A second canvas = a second host route — the whole shell (zoom/pan/selection/overrides/tagging) is route-agnostic and reusable as-is.
- `editor-components` route lists flat `react-figma-components/*.tsx` (name + @/ alias importPath). No categories, no variants, no global source yet.
- Ops already exist and are QA-hardened: `create-component` (scaffold), `make-component` (extract), `insert-component` (validated name/importPath — its path regex `[@\w./-]` already admits package specifiers), `rename-component` (true rename).
- Tagging (data-src), read-bridge, overrides, editor-write all key off the same-origin iframe — they work on ANY route the iframe loads, including a gallery route.

## Architecture

### 1. Second canvas = gallery host route (no new canvas engine)
`src/app/(dev)/react-figma/components-canvas/page.tsx` — a host route like canvas/page.tsx, but it renders the **component gallery**: every component, wrapped in a labeled frame, grouped by category, laid out in category rows on one large surface. The editor gets `canvasMode: 'design' | 'components'`; the toggle just swaps the iframe src. Zoom/pan/selection/inspector work unchanged because they operate on the iframe DOM, not the route.

### 2. Component discovery — SPLIT mechanism (QA R1 probe corrected v2's blanket require.context claim)
- **Project components:** `require.context('../../react-figma-components', true, /\.tsx$/)` — subdirectory = **category**; root files = "Ungrouped". In-repo dirs are webpack-watched, so new files are expected to hot-appear — **verify at build step 1** (QA only probed the package path).
- **Global package: generated BARREL is the primary mechanism, NOT require.context.** QA proved: package-name require.context doesn't resolve (`Can't resolve 'pkg/src'`); a node_modules-relative context renders + hot-reloads EDITS of existing files but **never discovers new files** (webpack doesn't watch node_modules for adds). The generated barrel fallback (`import * as Library from 'onemo-component-library'`) rendered new exports live without server restart in the throwaway probe; pure barrel-edit-only HMR should be re-checked in build step 1 alongside the gallery route, but this is the selected primary mechanism. Build requirement **(N2 — barrel is NEVER a client-write surface)**: `create-component {root:'global'}` writes the component `.tsx` file, then the server **REGENERATES `src/index.ts` from an fs walk of the package `src/` tree** in the same op — client inputs reach barrel generation only as already-validated filenames. This respects the `.tsx`-only write jail (lib.ts:71-75); the barrel is server-derived output, not a write target. Category from the barrel's export path metadata (barrel generated per folder).

### 3. Global library package
- Location: `~/Dev/onemo-dev/onemo-component-library/` (own repo, like the token SSOT). Layout: `src/<category>/<Component>.tsx` + generated `src/index.ts` barrel.
- Consumption: `package.json` dep `"onemo-component-library": "file:../../onemo-component-library"` + `transpilePackages: ['onemo-component-library']` in next.config — compiles inside each build's dev server, so gallery rendering, tagging and even in-editor EDITING of global components work (editor-write paths resolve through the symlinked package source).
- **F1 (lead HIGH — the editing path was overstated; corrected design):** editing global components requires THREE coordinated changes, not one: (a) tagging-loader include extends to the package AND emits a **package-name-prefixed data-src** (`onemo-component-library/src/buttons/X.tsx:l:c`) — never a `..`-relative path (its depth differs per checkout → unstable identity); (b) a single server-side **`resolveEditorPath()`** that maps repo-relative OR package-prefixed paths to real files, and **every jail dispatches through it** — including `jailModuleCss` (v2 missed it: global-component CSS editing would have been dead); (c) `root`/`category` op params are validated enums/slugs. Without F1, all three jails 403 package writes.
- **F2 (lead MED):** the time-capsule engine is root-agnostic, but `HISTORY_PATHS` + the restore delete-guard are hardcoded to the app repo — make them **per-root path sets** (app root keeps its seeds; package root gets `src/`). Then the package gets its own `.editor-history` like any build.

### 4. Variants + states (phase 1 in scope)
- **Variants = named exports** of the component file (`export const ButtonPrimary`, `ButtonGhost`) — pure React convention, no invented metadata. AS BUILT (E7.5): the gallery groups variants using the server inventory's per-file exports — a multi-variant component renders as ONE shared dashed #9747FF container (component-set semantics) holding a frame per variant; singletons get a solid outline; the rail nests component → variant children. (Runtime introspection renders the frames; the inventory provides the grouping — the barrel namespace alone is flat at runtime for global components.)
- **F4 (lead MED — introspection hardening):** filter exports with `react-is` `isValidElementType` (a bare "is it a function" check misses `memo`/`forwardRef` components — they're objects — and CRASHES on hook exports); wrap every gallery frame in an **ErrorBoundary** so one throwing module can't kill the whole gallery (eager require.context imports everything).
- **States (hover/focus/pressed)** = phase 2: force pseudo-state styling on a gallery instance via the existing overrides engine. Tracked, not built in E7 core.

### 5. Editor UI in components mode
- **F3 (lead MED):** `insertDrawn` targets the first body `[data-src]` — on the gallery route that's the gallery HOST file itself, so draw-to-place would splice JSX into the route file. **Draw tools are gated OFF in components mode** (arm buttons disabled with honest tooltip); phase 2 may re-enable targeting a selected component's own file.
- **Pages rail → categories** (Global section + Project section, counts per category; click scrolls the gallery to that category — same scrollIntoView pattern as layer selection).
- **Layers rail → components/variants** of the visible category (from the same runtime introspection, posted parent-ward via the existing read-bridge).
- **Create**: "+" in a category → `create-component` op with new optional `category` (jailed subdir slug) and new optional `root: 'project' | 'global'` (global → package src dir; path resolution via the central `resolveEditorPath()` per F1/N1 — no jail "extension").
- **Insert into design canvas**: from Assets/gallery → existing `insert-component`, importPath = `@/app/(dev)/react-figma-components/<cat>/<Name>` or `onemo-component-library/<cat>` (both pass the existing validator).
- **Rename/delete**: existing `rename-component` / `delete-jsx`+file ops, category-aware paths.

### 6. Server changes (small, all in existing files)
- `editor-components` route: recursive walk of both roots → `{name, category, importPath, root, file}`; variants stay client-side (runtime introspection — no AST parsing needed).
- `create-component` op: category + root params; package paths resolve through central resolveEditorPath(); global creates .tsx under package src and server-regenerates package src/index.ts from fs walk in-op.
- next.config: `transpilePackages` entry. tagging-loader: include package dir.

## Build order (division per Dan's rule)
1. **Me (code-heavy):** package scaffold + transpile/tagging wiring → gallery host route with PROJECT require.context + GLOBAL generated barrel + variant introspection → canvasMode toggle + iframe src swap → editor-components recursive walk → create-component category/root params (global writes the .tsx, then server-regenerates package src/index.ts from an fs walk in-op). Each step E2E-verified live.
2. **Engineer (visuals/conformance):** gallery chrome to Figma component-canvas anatomy via Figma DOM audit (frame labels, purple component accents, category headers, layers-rail nesting), category rail visuals.
3. QA per pipeline: builder self-validate → meta-qa real-input → my meta review → Dan.

## Probe-proven configs (QA, verbatim from the working throwaway — use these exactly)
- **Loader include (R2):** `componentLibrarySrc = path.resolve(process.cwd(), '../onemo-component-library/src')`; include `[src, storybook, componentLibrarySrc]`. Package elements then carry data-src (probe: `../onemo-component-library-probe/src/forms/ProbeAlpha.tsx:3:5`) — per F1, normalize this to the package-name-prefixed form in the loader.
- **Write path (R2):** the probe PROVED writability by appending the realpath-normalized package src root to `COMPONENT_ROOTS` / `jailModuleCss` roots / `editor-source` ROOTS — set-jsx-style via package data-src wrote the real package file; `/etc/passwd` still 403s; editor-source serves package snippets. **(N1) The BUILD implements this as the central `resolveEditorPath()` from F1 — the roots-append pattern was only the probe's proof mechanism; alone it cannot resolve the F1 package-prefixed data-src form (path.resolve would land inside the app repo → 403).**
- **Time capsule (R3):** `editor-sandbox` gains `root: 'package'` selector → package root, `historyPathsFor(packageRoot)=['src']`. Proven live: snapshot inits `.editor-history` in the package, edit → snapshot → restore round-trips the package file content.
- **F5 stands:** everything here is webpack-only (`next dev --webpack` — already the editor's requirement; sandbox spawn already pins it).
- Editor402-style screens import from `storybook/` — no interaction with the package; no design-mode regression surface.

## Verification trail
- Architecture audit: @s58-lead — REWORK-with-solutions, findings F1–F5 folded (v3). Verified-accurate: route-swap shell reuse, flat editor-components baseline, importPath regex, scaffold named exports, history root param.
- Risk probes: @s58-qa — R1 FAILS-with-working-solution (barrel primary), R2 PROVEN, R3 PROVEN; evidence /tmp/s58-e7-risk-probes-report.md; throwaway cleaned, worktree untouched.
- Remaining verify-at-build: require.context new-file pickup for the IN-REPO project dir (expected to work — watched path — but unproven; build step 1 proves or falls back to the same barrel pattern).
