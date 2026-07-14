# E9 QA gate — react-figma pages model + 2.9 + 3.6 — s58-lead (Kai) verdict + evidence ledger

Reviewer: Kai (s58-lead), acting as the SOLE QA gate (both Codex lanes @s58-qa/@s58-meta-qa
usage-capped to Jul 11). FROZEN HEAD `f9b4e4b`, branch `session58-task/react-figma-engine`.
Meta review by @s58-expert follows this (Dan-ordered QA→meta).
**Isolation:** all source analysis in my OWN detached worktree at `f9b4e4b` (scratchpad/e9-review,
shared node_modules) — the designer's worktree was never touched. Live probes on :3025 were
**read-only or rejection-only** (never mutated a file). Zero reliance on the capped lanes' evidence.

## Verdict: **FAIL-with-findings** — one MED write-escape (F-E9a) is the bounce; 3 LOW. Everything else (traversal, editor-self, home, structural guards, route-uniqueness, 2.9, 3.6 engine rebuild, tsc) PASS and execution-backed.

---

## Evidence ledger (what I ran)
- Detached worktree @ f9b4e4b; `git diff f214ddc..f9b4e4b` read in full for editor-pages/route.ts,
  editor/lib.ts (page ops), engine.ts, page.tsx (selection-colors/recolor).
- **tsc `--noEmit` → exit 0** on f9b4e4b (SelectionColor shape change threaded consistently).
- **Isolated fs test** (scratchpad/symtest, my own throwaway dirs): proved `fs.rm(appDir/link/sub,
  {recursive:true})` where `link→outside` DELETES `outside/sub` — escape through a mid-path symlink;
  and a page dir with only page.tsx passes `assertDeletablePage`.
- **Live :3025 (read/reject only, no writes):** `/react-figma`→200; `GET /api/dev/editor-pages`→ real
  collapsed routes (home first; `(store)/community`→`/community`, `(admin)/admin/moderation`→
  `/admin/moderation`), buildName `onemo-next-temp`; `delete-page {route:'/'}`→**422**;
  `delete-page {route:'/react-figma/canvas'}`→**422**; `delete-page {route:'/nonexistent'}`→**404**;
  `rename-page {route:'/react-figma'}`→**422**.

## PASS — adversarial write-surface, execution-backed
- **Route-derived targeting is traversal-safe by construction.** delete/rename/duplicate resolve
  `op.route` via `dirForRoute` — an fs scan that only returns a dir *under appDir* whose derived
  `routeOfDir` equals the route. You cannot point an op at an arbitrary path; a non-matching route → 404.
- **newSlug / slugBase traversal — CLOSED.** rename `base = newSlug.replace(/[^a-z0-9-]/gi,'-')
  .toLowerCase().replace(/^-+|-+$/g,'')`, empty→422; create sanitizes the same class. Verified
  `../../etc/passwd` → `etc-passwd`, `../../etc` → `etc` — no separators survive.
- **editor-self exclusion — CLOSED, defense-in-depth.** `assertNotEditorSelf(/^\/react-figma(\/|$)/)`
  on delete/rename/duplicate → live 422 for `/react-figma/canvas` and `/react-figma`. Encoded/nested:
  `/react-figma/../x` matches the regex → 422; `//react-figma` misses the regex but 404s at lookup
  (no dir derives that route). GET also marks these `mutable:false`.
- **home guard — CLOSED.** `route==='/'`→422 (live) AND `assertDeletablePage` refuses dir===appDir;
  grouped home `(g)/page.tsx` collapses to `/`→refused (candidate #5).
- **Structural delete guards hold.** leaf-only (any subdirectory→422, descendant page.tsx→422 "child
  pages") + page-owned-files-only (`page.(t|j)sx?`/`.module.css`/images; any other file→422 —
  confirmed in the fs test that `data.txt` triggers the block).
- **Route-space uniqueness (candidate #2) — CLOSED.** `routeTaken` = `dirForRoute` over the whole
  registry, so cross-group collisions are caught (`create community` when `(store)/community` exists →
  both derive `/community` → routeTaken → suffixes). This is the parallel-route-500 class, genuinely fixed.
- **?root mutability trap (candidate #3) — CLOSED.** any root ≠ APP_ROOT → all pages `mutable=false`;
  GET root-jail (`root.startsWith(FS_ROOT+sep)`) 403s `?root=../..`.
- **symlink-cycle HANG guard (candidate #6) — CLOSED** for its stated class: realpath `seen` set stops
  a cycle from hanging the walk. (But see F-E9a — closing the *cycle* is not closing symlink *follow*.)
- **2.9 / 3.6 — no regression.** engine `collectSelectionColors` return type widened to
  `SelectionColor` (count/ids/varName/props); tsc 0 proves every consumer (SelectionColorRow,
  SelectionVarRow, recolorSelection, liveSelColors) is threaded. `recolorSelection` still recolors by
  hex value (signature unchanged) — no write-path regression. The census 305→269 is the **intended**
  over-collection fix (visible-ownership filter: skips 0-area boxes, transparent bg, inherited text
  color on non-text wrappers, 0-width/none borders) — a correctness gain, not a regression (KAI-9406
  conformance is hand-written contract, alarm-only per the brief).

---

## FAIL

### F-E9a · MED · Page ops FOLLOW symlinks → delete/rename can escape the app tree (structural jail regressed the old location jail's guarantee)
The old model jailed page ops to a hardcoded `react-figma-pages` dir with a `[a-z0-9-]` slug regex —
structurally impossible to touch anything else. The E9 model replaces that with route→dir resolution
over the **real** fs, and `dirForRoute` returns the **symlink path**, not its realpath (it computes
`fs.realpath` only for the cycle `seen`-set, but sets `found = dir`). So if a symlink exists under the
scanned appDir pointing outside it, `fs.rm(dir,{recursive:true})` / `fs.rename(dir,…)` operate
**through** the link.
**Proven (isolated fs test):** `appDir/evil → /outside`; `fs.rm(appDir/evil/victim2,{recursive:true})`
deleted `/outside/victim2`; and a dir with only `page.tsx` passes `assertDeletablePage`. So a
`delete-page` whose route resolves through such a symlink deletes outside the build's app tree.
**Exploitability: LOW-MED.** The API can't *create* the symlink (create-page only mkdirs a sanitized
slug). It requires a pre-planted symlink under `src/app` — and repo write is normally game-over. BUT:
(a) this is precisely the guarantee the old jail gave and the new one silently dropped; (b) **this repo
uses symlinks** (`node_modules/onemo-component-library`, git worktrees) so a stray in-tree symlink
under the app dir is not far-fetched; (c) it's the exact class I exist to catch when the jail model
flips from location to structural. Dev-only + worktree + git-undo keep impact bounded, hence MED not HIGH.
**Solution:** realpath-confine the resolved dir before any mutation. In `dirForRoute`, before
returning: `const realDir = await fs.realpath(found); const realApp = await fs.realpath(appDir);
if (realDir !== realApp && !realDir.startsWith(realApp + path.sep)) throw 403`. One assert kills the
whole escape class (delete + rename), and it composes with the existing structural guards. (Same
realpath-confine belongs on the eventual `create`/`duplicate` targets too, though those mkdir a
sanitized slug so they can't currently escape.)

## LOW
- **F-E9b · LOW · `assertDeletablePage` ignores symlink entries.** A `Dirent` symlink is neither
  `isFile()` nor `isDirectory()`, so it slips past both the "page-owned files only" and "no subdir"
  guards. No escape on its own (`fs.rm` unlinks a leaf symlink), but combined with F-E9a a symlinked
  *subdir* is the vector. **Fix:** classify `e.isSymbolicLink()` as non-page content → 422.
- **F-E9c · LOW · create-page base doesn't trim leading/trailing dashes** (rename does). `slugBase`
  of all-special-chars → dir/route like `/------etc`. Cosmetic (stays under appDir), but align with
  rename's `.replace(/^-+|-+$/g,'')` + empty→422.
- **F-E9d · LOW (completeness, not security) · `routeOfDir` doesn't model parallel/intercepting
  routes.** `@slot` and `(.)x` dirs derive odd routes in the listing. No write-escape (write resolves
  via the same fn, so it's self-consistent), but the registry mis-lists them. v1 already excludes
  `[param]`/`api`; add `@`/`(.)`/`(..)` to the exclusion or document the limit.

## Candidate-fix verification (the 6 you claimed, #2–#7)
| # | Candidate | Verdict |
|---|---|---|
| 2 | route-space uniqueness incl cross-group | **CLOSED** (routeTaken via dirForRoute; GET confirms group-collapse) |
| 3 | ?root mutable:false | **CLOSED** (non-APP_ROOT → mutable=false; root-jail 403) |
| 4 | home-by-route | **CLOSED** (live 422; grouped-home collapses to `/`) |
| 5 | symlink-cycle guard | **CLOSED for cycles/hang** — but does NOT cover symlink-*follow* escape (F-E9a) |
| 6 | fetch-error state | client-only, out of my write-safety lens — trust + Codex/visual on return |
| 7 | folder-picker stub honest-disabled | client-only — trust + Codex/visual on return |

## Bottom line
The pages-model redesign is architecturally right and its guards are mostly solid — route-derived
targeting is traversal-safe, newSlug/slugBase are sanitized, editor-self and home are refused
(live-confirmed), the structural delete guards fire, cross-group route collisions are closed, and the
3.6 engine rebuild is a type-safe correctness gain with no recolor regression. The one real defect is
F-E9a: flipping from a location jail to a structural jail dropped the "can't touch anything outside
the sandbox" guarantee — the ops now follow symlinks and can delete/rename outside the app tree
(proven), fixable with a one-line realpath-confine in `dirForRoute`. Fold F-E9a (+ F-E9b/c/d), send
the fixed HEAD, I re-probe the symlink-confine + re-run the reject battery for closure. Meta (@s58-expert)
follows this verdict per Dan's sequence.

---

# CLOSURE — re-audit @ `4ed10b4` → **PASS (my write-safety gate)**

Re-verified independently in a fresh detached worktree (designer tree untouched, frozen 4ed10b4).

- **F-E9a · CLOSED — verified independently, not on the DM's word.** `dirForRoute` now realpaths
  `found` + `appDir` and throws 403 unless `realFound === realApp || realFound.startsWith(realApp+sep)`,
  placed before the return so **all three ops (delete/rename/duplicate) inherit it**. I replicated the
  exact confine logic against a planted mid-path symlink: (a) the exact escape shape I proved before
  → **403** now; (b) a legit nested page dir → **passes** (no false-positive — realpath-vs-realpath is
  consistent even if the whole worktree sits under a symlinked path); (c) home (appDir itself) → passes.
  The symlink-follow escape class is dead.
- **F-E9b · CLOSED.** `assertDeletablePage` refuses any `e.isSymbolicLink()` Dirent → 422 (the subdir
  vector is shut independent of F-E9a).
- **F-E9c · CLOSED.** create-page base now `.replace(/-+/g,'-').replace(/^-+|-+$/g,'') || 'new-page'`
  (collapse + trim + fallback), matching rename.
- **F-E9d · DEFERRED — agreed.** `@slot`/`(.)` intercepting routes are listing-only; the write ops
  resolve via the same `routeOfDir` (self-consistent) and are now realpath-confined regardless, so
  there is no write-escape. Fine to defer with the documented v1 limit.
- **Regression — clean.** Live reject battery unchanged: `delete-page {'/'}`→422, `{'/react-figma/canvas'}`
  →422, `{'/nonexistent'}`→404, `rename-page {'/react-figma'}`→422; `/react-figma`→200; **tsc 0**.

**E9 write-safety gate: PASS on my lens @ `4ed10b4`.** (The conformance 269/269 two-run / earlier
"5 failures" load-race is the hand-written KAI-9406 tool — visual/conformance lane, alarm-only, not my
gate.) @s58-expert's meta review follows per Dan's QA→meta sequence; this ledger is the audit trail.
