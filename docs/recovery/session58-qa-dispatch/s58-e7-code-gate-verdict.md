# E7 Components Canvas — code/write-safety gate — s58-lead verdict

Reviewer: Kai (s58-lead). Requested by @s58-designer. FROZEN HEAD `64d609b` (diff `e44f265..64d609b`,
6 commits + package repo `~/Dev/onemo-dev/onemo-component-library`). Contract: architecture v4.1
(my sign-off). Method: full diff read (lib.ts, tagging-loader.cjs, next.config.ts, editor-source,
editor-sandbox, components-canvas host, page.tsx) + live resolution probes + tsc. No code changes
(tree frozen). @s58-qa runs the live-probe gate in parallel.

## Verdict: **FAIL-with-findings** — one MED write-safety residual (F3 stale-arm), plus 2 LOW hardening + 1 visual-lane coherence note. Everything else PASS, execution-verified.

---

## PASS — verified against my own F1–F5/N1/N2

**F1 · resolveEditorPath dispatch is COMPLETE.** All three jails route through it —
`jailModuleCss` (lib.ts:82), `jailComponent` (:89), `jailComponentWrite` (:101) — and
`editor-source` imports + calls it (route.ts). Package-prefixed input resolves to `LIB_ROOT`;
repo-relative resolves to `ROOT`. **Traversal is blocked**: `resolveEditorPath('onemo-component-library/../../etc/passwd')`
resolves outside every allowed root, so the `startsWith(root+sep)` backstop 403s it (verified the
resolution logic; jail is the authority, not the prefix string). No path resolves package-prefixed
input against ROOT.

**LIB_ROOT workaround sound.** `realpathSync(ROOT/node_modules/onemo-component-library)` (lib.ts) —
I confirmed live it resolves identically to the tagging-loader/next.config `require.resolve` form
(both → `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`). The createRequire-broke-in-webpack
rationale is real. Symlink-injection is not a new vector: rewriting `node_modules/<name>` requires
write access to node_modules, which already lets an attacker edit any dep — game-over independent of
this code.

**N2 · barrel is genuinely never a client-write surface.** `regenerateLibraryBarrel` (lib.ts:706)
fs-walks `LIB_ROOT/src`, reads exported names via `exportedTsxNames`, writes `src/index.ts` server-side.
Client input reaches it ONLY as the validated PascalCase `name` + slug `category`
(`/^[a-z0-9][a-z0-9-]{0,40}$/`, checked before any path join, lib.ts). `index.ts` is `.ts` → outside
the `.tsx`-only write jail by construction; it's server-derived output, not a write target. Jail law
intact.

**F2 · per-root history correct, no cross-contamination.** `historyPathsFor(root)` returns `['src']`
for the package root, the app's 3 seed dirs otherwise; `rootFor(sel)` maps `'package'→LIB_ROOT`,
`'app'/default→ROOT`, rejects other values 422. The delete-guard in `checkoutHistoryRef` keys off
`historyPathsFor(root)` (route.ts:120) — so package restore only deletes inside the package `src/`,
app restore only inside app seed dirs. `['src']` = whole package surface deletable-on-time-travel is
correct (the package IS the editable surface). Each root gets its own `.editor-history`.

**F4 · introspection hardened.** `collectFrames` filters `isValidElementType(val) && typeof val !== 'string'`
(covers memo/forwardRef objects, rejects hooks/strings); every frame renders inside `FrameBoundary`
(getDerivedStateFromError) so one throwing module degrades one frame, not the gallery. `react-is`
imported, `.d.ts` shim added. Sound.

**tsc = 0** on the frozen tree.

---

## FAIL

### F6 · MED · F3 draw-gate is UI-only — a stale arm leaks a write into the gallery HOST file
`canvasMode` gates the InsertIsland UI (buttons `disabled`, `onInsert` nulled, early-return at
page.tsx:3257), the iframe src (:3264), and hostDims (:2825) — but NOT the draw state machine.
`onDown` (:2955), `onMove`, `onUp` (:2972) and `insertDrawn` (:2879) check only `drawArm`, and the
mode toggle `onClick={() => setCanvasMode(m)}` (:3091) does **not** clear `drawArm`.

**Reachable sequence:** Design mode → click Frame/Text in InsertIsland (`setDrawArm` set, "drag on
the frame" banner shows) → *without dragging*, click the **Components** tab → arm persists, iframe
swaps to the gallery → drag on the gallery → `onUp` fires `insertDrawn(arm.tag,…)` → it targets the
first `body [data-src]`, which on `/react-figma/components-canvas` is an element of the gallery HOST
(`components-canvas/page.tsx` is under `src/`, so its lowercase JSX carries data-src) → splices a
`<span>/<div>` into the gallery route file. Valid TSX, so `assertValidTsx` passes it. **This is
exactly the F3 failure mode** (JSX into the gallery host), reached via the one state the UI gate
doesn't cover.

**Solution (pick one, both are one line — write when the freeze lifts):**
- Clear the arm on mode change: `onClick={() => { setDrawArm(null); setCanvasMode(m) }}` (or a
  `useEffect([canvasMode])` that nulls drawArm/draw.current/drawRect), AND
- Gate the entry too: `if (drawArm && e.button === 0 && canvasMode !== 'components')` in `onDown`
  (defense-in-depth so the write path is dead regardless of arm state).

Both together make the draw write-path unreachable in components mode by state, not just by UI.

---

## LOW / hardening

### F7 · LOW · Two LIB_ROOT resolution mechanisms can diverge under hoisting
lib.ts uses `path.join(ROOT, 'node_modules', LIB_NAME)`; tagging-loader + next.config use
`require.resolve(...,{paths:[cwd]})`. Identical in THIS install (verified). But `path.join` only
checks `ROOT/node_modules` directly, while `require.resolve` walks the node_modules chain — under a
workspace/hoisted layout where the package materializes in a PARENT node_modules, lib.ts's `LIB_ROOT`
→ null while the loader still tags package files → tagging emits package-prefixed identities that
`resolveEditorPath` then 403s (global editing silently dead). **Fix:** resolve LIB_ROOT once via
`require.resolve('onemo-component-library/package.json',{paths:[ROOT]})` in lib.ts too (same form as
the loader), so all three sites agree by construction.

### F8 · LOW · N1's explicit `..` guard not added (backstop covers it today)
`resolveEditorPath` has no explicit `rel.split(/[\\/]/).includes('..') → 403`; traversal is caught
only by the jail `startsWith` backstop. That's sufficient for the three jails, but `editor-source`
and any future caller of `resolveEditorPath` inherit the raw resolver — add the explicit guard inside
`resolveEditorPath` so the traversal reject travels with the resolver, not each caller (my N1 ask).

---

## Coherence note (visual lane — Codex/designer, not my gate)
v4.1 §4 says the gallery "renders every export as a **sub-frame under the component's frame**" with
"component → variant children" nesting. The **rail** (`ComponentsRail`) nests correctly
(component → exports-minus-self as variant children). The **gallery** (`collectFrames`) renders every
export as a **flat top-level frame** in its category, not sub-framed under a parent — and for GLOBAL
it can't do otherwise from the barrel namespace alone (exports are flat; file-grouping is lost, as the
host comment acknowledges). Not a code-safety issue; flag to confirm intended vs the doc wording, and
that Codex's visual gate accounts for it.

## Bottom line
The security-critical spine is clean and verified — resolver dispatch complete, traversal blocked,
barrel server-derived, per-root history isolated, introspection hardened, tsc 0. The one real defect
is F6: F3 was implemented as a UI gate but the draw STATE MACHINE isn't mode-gated, so a stale arm
carried across the toggle writes into the gallery host file. Fold F6 (two one-liners), F7/F8
(hardening), confirm the §4 gallery-nesting wording — I re-probe the stale-arm sequence at the fixed
HEAD for closure.

---

# CLOSURE — re-audit @ `4a9f3f7` → **PASS (my code/write-safety gate)**

One commit over the target; diff = page.tsx (8) + lib.ts (22/8). Each finding re-verified, not taken on the DM's word.

**F6 · CLOSED — draw is dead BY STATE, statically decisive.** Both guards landed: `onDown`'s draw
branch now requires `canvasMode !== 'components'` (page.tsx:2955), AND the toggle clears
`drawArm`/`draw.current`/`drawRect` (:3095). I traced provenance to prove unreachability, not just
read the diff: `insertDrawn` has exactly ONE reachable caller (`onUp` :2976), which fires only when
`draw.current` is truthy; `draw.current` is set truthy at exactly ONE site (:2960) — inside the now
mode-gated `onDown` branch (every other `draw.current =` is a null-clear). So in components mode
`onDown` never arms → `onUp`'s draw branch never runs → `insertDrawn` is unreachable, independent of
any stale arm (which the toggle also clears). The JSX-into-gallery-host write path is closed by the
state machine, not merely hidden UI. tsc 0.

**F7 · CLOSED.** LIB_ROOT now walks node_modules upward 10 levels (lib.ts) — mirrors node/the
loader's `require.resolve` semantics; hoisted installs resolve identically. Live: resolves to the
real library root.

**F8 · CLOSED — verified live, not asserted.** Traversal reject moved inside `resolveEditorPath`
(every caller inherits it). Exercised the exact committed logic against the real LIB_ROOT:
`onemo-component-library/../x` → **403**, `src/../../../etc/passwd.tsx` → **403**, valid
`onemo-component-library/src/buttons/DemoButton.tsx` → **200** (real library path),
valid project `…/react-figma-components/X.tsx` → **200**. Reject travels with the resolver.

**Visual note:** answer accepted — flat gallery is intentional for E7 core; E7.5 (engineer chrome)
groups frames via the same inventory data and aligns the v4.1 §4 wording. Designer-owned, tracked,
outside my gate.

**E7 code/write-safety gate: PASS LOCKED @ `4a9f3f7`.** Codex's live-probe gate remains the
independent second gate for Dan's Done.

---

# LOCK REFRESH — @ `0bca3d3` (post QA-live-gate fixes) → **PASS-lock CARRIES**

Codex's live gate failed 4a9f3f7 (2 HIGH: SSR-thrown library component 500'd the gallery route;
package publishes snapshotted APP history not package · 2 MED: island carets not honestly disabled;
create-UI lacked root/category). Fixed in one commit → `0bca3d3` (page.tsx + components-canvas only).
My lock was on code/write-safety — I re-checked exactly the surfaces that could move it.

**Server/loader surfaces I locked are BYTE-IDENTICAL** — empty diff on lib.ts, editor-sandbox/route.ts,
editor-source/route.ts, editor-components/route.ts, tagging-loader.cjs, next.config.ts. Every jail,
`resolveEditorPath`, `rootFor`, `historyPathsFor`, barrel regen, traversal guard = unchanged. The
F1/F2/F8 verifications carry unmodified.

**Change 1 — SSR-safe gallery (client-mount-only):** frames now collected in a `useEffect`-gated
`mounted` pass; SSR serves the shell only. No write surface; removes the SSR 500, doesn't touch F6.

**Change 2 — island caret honest-disable (QA MED):** the two carets F6's UI-gate missed (Region/Type
tools) now honor `drawDisabled`. Cosmetic completeness — my **F6 closure was proven at the STATE
level** (`onDown` gated on `canvasMode!=='components'` + arm cleared on toggle; `insertDrawn` single-
caller unreachable), so it never depended on which UI button is disabled. F6 guarantee intact.

**Change 3 — create-component root/category UI:** `newComponent(name, root, category)` now sends
`root` + optional `category` to the create-component op — the **already-locked** validated op (server
rechecks `root∈{project,global}` and `category` against the slug regex BEFORE any path join; lib.ts
byte-unchanged). Client surfaces the params; it cannot skip server validation. No new write surface.

**Change 4 — per-root publish partition (the write-relevant one):** `splitFilesByHistoryRoot` routes
package-prefixed paths (`onemo-component-library/…`, prefix stripped) to `root:'package'`, others to
`root:'app'`, for the `track`/`snapshot` calls. Write-safety trace:
- Targets the SAME locked `track`/`snapshot` actions on editor-sandbox; `rootFor('package')→LIB_ROOT`,
  else `ROOT` (unchanged). No new server op.
- These write `.editor-history` git only — never source files.
- Misroute is impossible-to-harmful: partition is by the same `LIB_PREFIX` identity the tagging loader
  emits, and even a hypothetical misroute degrades to a **no-op** — a package-relative path doesn't
  exist under the app work-tree, and the server's `track` filter (`!f.includes('..') && !f.startsWith('/')`)
  + `git add -- <path>` refuse anything outside the root's work-tree. No cross-root write, no traversal.
- This actually **strengthens** F2: pre-fix, package edits were snapshotting into the APP history
  (Codex's HIGH #2) — the leak I'd have flagged; now isolated to the package capsule.

tsc = 0 on `0bca3d3`. **E7 code/write-safety PASS-lock carries to `0bca3d3`.** Codex's live-probe gate
concludes independent; both land for Dan's Done.
