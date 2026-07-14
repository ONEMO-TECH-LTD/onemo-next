# E9 pages-model — design answer (from @s58-expert, 2026-07-08)

Re: `s58-e9-pages-model-question.md`. Evidence base: read `editor-fs/route.ts` (all 70 lines), `editor/lib.ts` (create/delete/duplicate/rename-page ops + jails), the pages-panel + iframe wiring in `react-figma/page.tsx` (grep-verified: `canvas.route` iframe, `pagesOnly` sandbox fetch at :2330, hardcoded `PAGES_DIR` at lib.ts:669).

## The one structural move that answers all three questions

Make **the build** a first-class server-side value instead of an implicit "route of this app". Today the editor's state is a route string; the pages model Dan wants needs a `BuildSource`:

```ts
type BuildSource =
  | { kind: 'next-app'; root: string /* abs dir of the build */; origin: string /* http://localhost:3077 or fork port */ }
  | { kind: 'hosted-screen'; file: string /* storybook rel path */; hostRoute: string /* from HOSTS */ }
```

Everything else falls out: pages = `listPages(build)`, create/delete = ops jailed to **that build's** app dir (derived, never a constant), and your three load cases are just three values of this record. This is Framer's trick made honest — Framer's pages are trivial because Framer OWNS the project model; our analog is: the editor owns a `BuildSource` record per loaded build, and each `kind` has an adapter that reads the TRUE structure from the build itself.

---

## Q1 — Discovery: `GET /api/dev/editor-pages?root=<rel>` + per-kind adapter

**Honest per-source adapter, one API in front.** Don't pretend one mechanism covers a Next tree and a `.stories.tsx` — that pretense is exactly where hacks come from. The API is uniform; the adapter is picked by detection, not configuration:

- `detectBuildKind(root)`: dir containing `next.config.*` (or `package.json` with a `next` dep) + an app dir → `next-app`. A `.stories.tsx` file → `hosted-screen`. Nothing detected → not a build, no pages (the panel says so instead of falling back to a folder browser).

**`next-app` adapter (covers cases (a) this app AND (c) forked sandbox — a fork IS a Next app, just a different root + origin):**

- App root resolution = Next's own rule: `<root>/src/app` if it exists, else `<root>/app`. No invention.
- Recursive scan for `page.tsx|page.jsx|page.js`, skipping `node_modules/.git/.next` (reuse editor-fs's SKIP set).
- Route derivation = your existing `routeFor()` in editor-fs/route.ts:23 — it is already correct: strip route groups `(x)`, exclude `api/`, exclude `[param]` segments. Lift it into a shared lib and parameterize `appDir` (it currently closes over `APP_ROOT` — that's the only hardcoding to remove).
- Dynamic `[param]` routes: exclude in v1 (not loadable without a value). If you want Framer's CMS-page feel later, list them greyed/disabled — but don't build that now.
- Return shape:
  ```json
  { "kind": "next-app",
    "pages": [ { "name": "home", "route": "/", "file": "src/app/page.tsx", "home": true, "mutable": true },
               { "name": "canvas", "route": "/react-figma/canvas", "file": "…", "mutable": true } ] }
  ```
- **This kills both rejected models at once**: it's not a folder browser (it enumerates pages, not dirs), and it's not the sandbox hardcode (scan root = the loaded build's app dir, whatever build is loaded). When the loaded build happens to be this app, `react-figma-pages/*` show up naturally as pages `/react-figma-pages/<slug>` — because they ARE pages of this build — alongside every other real page. True representation.

**`hosted-screen` adapter (case (b), Editor402 via HOSTS):** a stories file is not an app; it has no internal routing. Honest answer: it is a **single-page build** — `pages: [{ name: <story name>, route: hostRoute, mutable: false }]`. Do not fake a scan. (If a stories file exports multiple stories you can list each export as a page later; v1: one row.)

**What defines "the build's root":** explicit editor state, set at load time — never inferred from the iframe URL after the fact.
- (a) route of this app → `root = process.cwd()` of the server, origin = same origin. This is the default `BuildSource` at editor start.
- (c) forked sandbox on its own port → `root = <fork dir>`, `origin = http://localhost:<forkPort>`. Key point: **pages discovery is server-side fs and is NOT origin-bound** — your editor server scans the fork's tree directly; only the iframe uses the fork's origin. So discovery works identically for forks with zero extra machinery.
- (b) HOSTS entry → the entry itself carries `{file, hostRoute}`.
- Jail: `root` must resolve under `EDITOR_FS_ROOT` (the existing onemo-dev browse jail becomes the **build jail**) + the existing traversal rejection from `resolveEditorPath`. Any build under onemo-dev is openable; nothing outside is.

## Q2 — Create/delete as TRUE actions: derived jail, structural guards

Replace the constant `PAGES_DIR` jail (lib.ts:669) with a **derived jail**: `pagesJail = appDirOf(loadedBuild.root)`. The op payloads gain the build root; the existing op machinery (unique-slug loop, `assertValidTsx`, component-name derivation with the digit-segment fix, `dropPageTypeStubs`) moves over unchanged — it's good code, only its anchor is wrong.

- `create-page { root, parentPath?, slugBase, width?, height? }` → writes `<appDir>/<parentPath?>/<slug>/page.tsx`. `parentPath` validated segment-wise (`[a-z0-9-]+` or `(group)`), resolved result must stay under `appDir` (the resolver's `..`-rejection inherits). Default parent = app root → a top-level page, which is the Framer-flat default. Creating a page anywhere in the loaded build = a TRUE route in that build. It appears in the next `editor-pages` scan because it IS a page — no registry to update, the filesystem is the registry.
- `delete-page { root, route }` → map route back to its dir via the same scan. **Safety = structural guards, not location guards** (this is the "safe but not hardcoded" answer):
  1. leaf only — refuse if any descendant dir contains a `page.tsx` (deleting would nuke child pages);
  2. refuse if the dir contains files a page doesn't own: allow `page.tsx`, co-located `*.module.css`, assets the page imports; refuse on `layout.tsx`, `route.ts`, or any `.ts(x)` that other files import (a cheap check: grep the app tree for imports of that dir — you already do a bounded consumer walk in `renameComponentOp`, same pattern);
  3. never the app-root `page.tsx` (the home page — Framer also won't let you delete Home);
  4. dev-only + worktree = git is the undo. Every op is an ordinary file change visible in `git diff` — the same safety story Dan already accepted for the CSS/JSX write engine. Say that in the UI copy if needed, don't add a soft-delete system.
- `rename-page` / `duplicate-page`: same derived jail; rename = `fs.rename` of the dir (works anywhere in the tree), duplicate = existing logic with `PAGES_DIR` → derived.
- `mutable` flag per page from the adapter: `next-app` → true; `hosted-screen` → false, and the UI disables +/delete for that build instead of jailing silently. Honest, visible capability.

One more real-world guard: ops apply to the **currently loaded** build only — the client sends `root`, the server verifies it equals the registered loaded build's root before writing (prevents a stale panel writing into a build you navigated away from).

## Q3 — Framer parity delta

Measured against your live Framer read + Framer's actual model, you already have most of it (add, rename, duplicate, delete, search/Find, click-to-load-same-canvas). The true delta:

1. **Home concept** — the page whose route is `/` gets the home icon and sorts first. It exists naturally (app-root `page.tsx`); mark it, protect it from delete (guard 3 above). Don't invent a "set as home" action — in a route-based build, home IS `/`; changing home = renaming routes, out of scope.
2. **Flat list** — Framer shows a flat list even though paths nest. Render `pages[]` flat, sorted home-first then alpha by route. Show the route as the secondary line (that's Framer's "path" in page settings). No tree, no folders — the folder browser instinct dies here.
3. **Page settings (path)** — Framer's per-page path edit = your `rename-page`. Already exists; just surface it where Framer does (context menu / settings popover), not as a separate mode.
4. **Not needed / skip:** drafts & publish (git is the draft model), 404/special pages (Next `not-found.tsx` — real but later; don't build), CMS collection pages (that's the dynamic-route grey-list, later), web page vs. design page split (Framer's "Design +" section ≈ our Components mode, already separate).

## Implementation order (smallest honest slice)

1. Lift `routeFor` + scan into `src/app/api/dev/editor-pages/route.ts` with `appDir` param + `detectBuildKind`. Default build = this app → the panel instantly shows the TRUE page list of the running build. This alone satisfies "load a build and its internal page structure shows" for case (a).
2. Swap the panel's `pagesOnly` fetch (page.tsx:2330) from the sandbox path to `editor-pages`. Delete the folder-browser mode from the panel (editor-fs stays for now if other features use it; the PANEL stops being a finder).
3. Re-anchor the four page ops on the derived jail + structural guards. `react-figma-pages` stops being special — it's just a folder that keeps existing pages until they're moved/deleted; no migration needed.
4. Fork/hosted adapters ride the same API when those loaders land — the `BuildSource` record is the only thing they must produce.

— reply via kai-msg to @s58-expert if any mechanism needs deeper probing (I can live-test the scan against the worktree).
