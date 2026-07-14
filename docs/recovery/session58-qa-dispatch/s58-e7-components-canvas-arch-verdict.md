# E7 Components Canvas architecture v2 — s58-lead verification verdict

Reviewer: Kai (s58-lead). Requested by @s58-designer. Doc: `s58-e7-components-canvas-design.md` (v2).
Ground truth: worktree `onemo-next/.claude/worktrees/s58-figma-engine` @ `e44f265`, Next **16.1.6**.
Method: every architecture claim traced to code (next.config.ts, tagging-loader.cjs, editor/lib.ts,
editor-sandbox/route.ts, editor-components/route.ts, page.tsx shell). No code changes.

## Verdict: **REWORK-with-solutions** — direction sound, §3's global-editing claim overstated; 4 findings, each with a concrete fix that keeps the architecture intact.

## Verified-accurate claims (code-backed ✓)
- Second canvas = route swap: canvas is already state `{name, route}` (page.tsx:1980), iframe
  `src={canvas.route}` + `key={canvas.route}` (:3187), screen list is already multi-route (:1892).
  wireCanvas/MutationObserver operate on `doc.body` generically — route-agnostic ✓.
- editor-components route is a flat readdir of `react-figma-components/*.tsx` today ✓ (route.ts:20-23).
- Ops exist as described; `insert-component` importPath validator (lib.ts:838) admits
  `onemo-component-library/<cat>/<Name>` ✓ — and create-component scaffolds a NAMED export
  (`export function ${name}()`) ✓ so named-import insertion + variant-by-named-export compose.
- History engine root-agnostic ✓ — `ensureHistory(root)`/`hgit(root,…)`/`snapshot(root,…)`
  (editor-sandbox/route.ts:63-91) genuinely parameterize the root. (But see F2.)

## F1 · HIGH · §3 "in-editor EDITING of global components work (editor-write paths resolve through the symlinked package source)" — NOT true as-is; 3 gaps + a portability trap
1. Tagging include = `cwd/src` + `cwd/storybook` only (next.config.ts:38) → package files carry **no
   data-src** at all. (Doc knows — "one-line loader change" — but see 3 before writing that line.)
2. **All three** jails 403 anything outside `ROOT/src|storybook`: `jailComponent` (lib.ts:63),
   `jailComponentWrite` (:73), **and `jailModuleCss` (:53)** — the doc's risk note names the write
   jail singular; without extending `jailModuleCss` too, global components' `.module.css` (the
   editor's primary op) is uneditable.
3. **Identity trap:** the loader stamps `data-src = path.relative(rootContext, resourcePath)`
   (tagging-loader.cjs:20) and webpack resolves the `file:` symlink to the real path — so a package
   file's data-src becomes `../../../../onemo-component-library/src/…`, and the `..`-count depends
   on where the app checkout lives (primary clone vs `.claude/worktrees/*` differ by 2 levels).
   Same component → different identity per checkout; jails, history, and anything keyed on data-src
   diverge across clones.

**Solution (design it in, don't patch):** namespaced stable identity + single resolver.
- Loader: when `resourcePath` is under the package root, stamp
  `data-src="onemo-component-library/src/<cat>/<Name>.tsx:l:c"` (package-name-prefixed, checkout-independent).
- Server: one `resolveEditorPath(rel)` — prefix `onemo-component-library/` → configured package
  absolute root; else `ROOT`-relative — and ALL jails (component read, `.tsx` write, `.module.css`
  write) dispatch through it, keeping per-root extension rules. Add an explicit
  `rel.split(/[\\/]/).includes('..') → 403` so extending to a second root never legalizes traversal.
- `root: 'project'|'global'` and `category` stay server-side enums/slugs: `category` must match
  `/^[a-z][a-z0-9-]*$/` before joining any path (same class as the E4 injection fix — validate before splice).

## F2 · MED · History on the package root: engine is root-agnostic, its PATH SET isn't
`HISTORY_PATHS` is hardcoded to 3 in-repo dirs (editor-sandbox/route.ts:29-33) and
`checkoutHistoryRef`'s delete-guard keys off the same list (:105). `snapshot(packageRoot, …)` would
commit nothing meaningful on first run and the restore path would never treat package files as
editor-owned.
**Solution:** per-root path sets — `{ project: [existing 3], global: ['src'] }` — selected by the
same server-side root enum; publish snapshots BOTH roots when an edit batch touched both.

## F3 · MED · "Shell reusable as-is" is ~90% true; the single-screen frameRoot heuristic leaks
`insertDrawn` (page.tsx:2879-2883) targets the FIRST `body [data-src]` element as "the frame" —
on the gallery route that's the gallery host's own wrapper, so draw-to-place would splice
absolutely-positioned JSX **into the gallery route file** (editor chrome pollution, parse-guard
won't stop it — it's valid TSX). Same first-element heuristic at :2090/:2851/:2881.
**Solution (E7 scope):** gate the draw tool off when `canvasMode==='components'` (one conditional),
tracked follow-up = resolve the target to the component frame under the pointer
(`closest('[data-component-frame]')` → that component's own data-src). Assets scan (:2716+) will
inventory the whole gallery — harmless, caps at 40/30 already.

## F4 · MED · Variant introspection: `Object.entries(mod)` → "function exports" has 4 failure modes
(a) helper/hook exports (`export function useX`) render-crash; (b) `React.memo`/`forwardRef`
results are **objects**, not functions → real variants silently missed; (c) `require.context` is
EAGER — any top-level side effect in any module runs at gallery load, and one throwing module takes
down the whole gallery render; (d) exported arrow-function non-components pass `typeof === 'function'`.
**Solution:** filter by name `/^[A-Z]/` **and** `react-is`'s `isValidElementType` (covers memo/forwardRef,
kills hooks/helpers); render every variant frame inside a per-frame ErrorBoundary so one bad module
degrades one frame, not the canvas; keep package modules side-effect-free as scaffold discipline.

## F5 · LOW · Accuracy nits + verify-first additions
- Doc quotes the importPath regex as `[@\w./-]`; actual is `/^[@\w./()-]+$/` (lib.ts:838). Conclusion holds.
- **Unstated hard constraint:** `require.context` + tagging exist ONLY under `next dev --webpack`
  (next.config.ts:31 — bare `next dev` is Turbopack on Next 16.1.6 and skips both). Pin this in the
  doc as a build-mode dependency; the package-barrel fallback is the Turbopack end-state.
- §2's "appear via normal HMR" is verified-plausible for `src/` but UNVERIFIED for the symlinked
  package (Next's watcher ignores node_modules; symlink→real-path usually watched). Add to the
  verify-first list next to the require.context probe.

## Bottom line
Architecture v2 is the right shape — route-swap canvas, `file:`-dep package library, named-export
variants are all grounded in code that exists. Rework = fold F1's resolver/identity design (it
changes the loader line and the op contracts, so it must precede build step 1), F2's per-root
history paths, F3's draw-gate, F4's introspection filter+boundary. None of these change the
architecture; all four prevent QA bounces I would otherwise file at E7 review.

---

# CLOSURE — v4 sign-off pass (same day)

Read v4 in full. **All five folds faithful:** F1 = §3 package-prefixed data-src + `resolveEditorPath()`
through ALL jails incl. `jailModuleCss` + enum/slug params ✓; F2 = §3 per-root history path sets +
QA R3 live-proved round-trip ✓; F3 = §5 draw gated OFF in components mode (phase-2 re-enable
tracked) ✓; F4 = §4 `react-is` `isValidElementType` + per-frame ErrorBoundary ✓; F5 = webpack-only
pinned in probe-configs + honest verify-at-build residual for in-repo require.context ✓. QA's
barrel-primary correction does NOT contradict my F1 identity scheme (identity comes from the
tagging loader, discovery from the barrel — orthogonal), and the probe note already says to
normalize the probe's `..`-relative data-src to the prefixed form.

Two folding seams found (doc-line fixes, solutions binding):

**N1 · LOW · Probe-config paragraph can be executed against F1.** §Probe-proven says "use these
exactly" and describes the write path as "add the package src root to `COMPONENT_ROOTS` AND
`jailModuleCss` roots AND `editor-source` ROOTS" — the probe's roots-append pattern. That pattern
alone cannot resolve the F1 package-prefixed form (`path.resolve(ROOT, 'onemo-component-library/…')`
lands inside the app repo → 403), so a builder following it verbatim ships the `..`-relative
identity F1 bans, or dead writes. **Fix:** one line in that bullet — "roots-append was the probe's
proof; the build implements it as `resolveEditorPath()` (F1) which all three jails + editor-source
call."

**N2 · MED · Barrel append vs the `.tsx`-only write jail.** §2 has `create-component {root:'global'}`
"append its export to the barrel in the same op" — but the barrel is `src/index.ts`, and
`jailComponentWrite` is `.tsx`-ONLY by design (lib.ts:71-75, the rule this codebase credits to my
earlier F3: keeps non-component `.ts` sources unwritable). As written, the op 403s on its own
second write, and the tempting ad-hoc fix (relax the jail to `.ts`) reopens the surface that rule
exists to close. **Fix (binding):** the barrel is never a client-write surface — the server
REGENERATES `src/index.ts` as a pure function of an fs walk of the package `src/` (validated
name/category are the only client inputs, and they land in the barrel only via the walked
filenames). Internal server write, no client path/content, `.tsx`-only jail law untouched.

**Verdict: SIGNED-OFF** — conditional on folding N1 + N2 as one-line/one-paragraph doc edits
(no architecture change; N2's resolution is design-binding for build step 1). I delta-confirm the
fold on the next doc version.

---

# DELTA-CONFIRM — v4.1 → **SIGNED-OFF (unconditional)**

- **N1 ✓** — probe write-path bullet now states the roots-append was the probe's proof mechanism
  only and the build implements `resolveEditorPath()` (my 403 rationale carried verbatim).
- **N2 ✓** — §2 build requirement: barrel never a client-write surface; server regenerates
  `src/index.ts` from an fs walk, client inputs reach barrel-gen only as validated filenames,
  `.tsx`-only jail law (lib.ts:71-75) explicitly preserved.
- QA wording folds coherent (barrel-HMR evidence stated as-probed + build-step-1 re-check; split
  discovery named in build order; header softened to match the actual residual verifications).

**Errata (fold at will, no re-confirm needed):** two pre-fold phrasings survived — build order
step 1 says "in-op barrel **append**" (should be *regeneration*, per §2's normative N2 paragraph)
and §5 Create says "write jail **extended** to the package path" (mechanism is `resolveEditorPath()`,
per F1/N1). Both are overridden by the normative paragraphs; fixing the words prevents a builder
skimming only those lines from reintroducing the append pattern.

E7 architecture is signed off on my gate — build may start on Dan's go.
