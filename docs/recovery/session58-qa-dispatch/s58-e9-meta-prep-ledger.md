# E9 META review — prep ledger (@s58-expert, 2026-07-08)

Status: **prep complete incl. fix-batch audit @ 46fd860, verdict HELD until @s58-qa's gate verdict arrives** (Dan-ordered order: QA → meta).
Scope: 7346e98 (E9 pages model) + 5b96aab (3.0/layer CRUD) + f214ddc (2.9 variables view), audited against my own design authority `s58-e9-pages-model-answer.md`. Fix batch: 7b76c7a (self-exclusion) + 826246d (2.9 complete) + 46fd860 (3.6 selection colors).

## Fix-batch audit @ 46fd860 (2026-07-08, post-META-UPDATE)
**Candidate 1 (editor-self HIGH): CLOSED — execution-backed by me, not just the builder's claim.**
- Read 7b76c7a in full: list-side `route !== '/react-figma'` exclusion + `mutable: !EDITOR_SELF.test(route)` for sub-routes; op-side `assertNotEditorSelf()` in delete/duplicate/rename (defense in depth — exactly the two surfaces I required).
- Live probe GET /api/dev/editor-pages on :3025 → 11 pages, `/react-figma` absent, `/react-figma/canvas` + `/react-figma/components-canvas` listed `mutable:false`, home first. ✓
- Live probes POST editor-write (each op run twice — consistent refusal, nothing mutated): delete/duplicate/rename on editor-own routes → **422 "editor-own route"** all three; delete `/` → 422 home; rename `/` → 422 home. ✓
- One honest note, not a finding: `EDITOR_SELF` hardcodes `/react-figma` — justified self-protection of the tool (Dan's "no hardcoded folders" was about page DISCOVERY, not the editor protecting its own host), but when step-4 multi-root lands the regex should anchor to the EDITOR's build, not any loaded build's namespace.
**Candidates 2-7: SURVIVE at 46fd860** — 826246d touches variables UI only (page.tsx +74/-17), 46fd860 touches selection colors (engine.ts+page.tsx); neither touches the pages model. #2 (route-collision on rename/create across groups → app-wide 500), #3 (folder-picker success-toast stub), #4 (?root= mutable:true trap), #5 (grouped-home latent), #6 (symlink cycle), #7 (fetch-fail = fake empty) all still open at that HEAD. #2 deliberately NOT live-probed at that HEAD — the probe itself would 500 the running app (it creates a real Next parallel-route conflict); code-read evidence stands.

## Fix-batch 2 audit @ f9b4e4b (2026-07-08, post-SEQUENCE-UPDATE-2) — candidates 2-7 delta-verify
Read f9b4e4b in full. All six closures are REAL MECHANISM changes, not cosmetics:
- **#2 CLOSED — execution-backed by me.** `routeTaken()` (= dirForRoute try/catch) added to the uniqueness loops of create/duplicate/rename — checks BOTH sibling-dir AND route space. Live probe: `create-page slugBase:'community'` → auto-suffixed `community-2` (collision with `(store)/community` detected ACROSS groups), `/react-figma` stayed 200, probe page deleted via the API, `git status` clean after (zero probe residue).
- **#3 CLOSED — code-read.** `openBuildFolderPicker` fn REMOVED; menu row now `disabled` with an honest title ("lands with multi-root loading"); no success-toast path remains. FileMenuRow's disabled prop already proven by the Export… row.
- **#4 CLOSED — execution-backed by me.** Server forces `mutable:false` on every page when `resolve(root) !== resolve(APP_ROOT)`. Live probe: `?root=onemo-next` → 12 pages, `anyMutable: false`.
- **#5 CLOSED — code-read.** deletePage now guards home by ROUTE (`op.route === '/'` 422 BEFORE dirForRoute), matching renamePage — the grouped-home escape is structurally impossible now. (Live 422 on `/` re-confirmed in the 46fd860 probe round.)
- **#6 CLOSED — code-read.** Both walks (scanPages + dirForRoute) track visited `fs.realpath`s and return on revisit — a symlink cycle terminates. Side effect: realpath-dedup also skips legitimately-aliased dirs reached twice; correct behavior.
- **#7 CLOSED — code-read.** Fetch failure → `error: true` → dedicated red "Couldn't read this build's pages — reload to retry" row; the "+ create the first" invite renders only on a SUCCESSFUL empty scan. Residual (accepted, not a finding): the header `+` stays clickable during the error state — but the state no longer lies, so creating is a user's informed act.
**Standing caveat to carry into the verdict (not a blocker):** `EDITOR_SELF = /^\/react-figma(\/|$)/` (route.ts + lib.ts) anchors self-protection to a route NAMESPACE of whatever build is loaded. Correct while ops are cwd-anchored; when BuildSource step-4 lands, it must re-anchor to the EDITOR's own build identity (only the editor's true host build gets the exclusion), or a foreign build's innocent `/react-figma` route becomes wrongly immutable — and worse, the editor's protection wouldn't follow if the editor route ever moves.
**Net position at f9b4e4b: ALL SEVEN candidates closed.** Verdict remains HELD for @s58-lead's adversarial gate (QA-of-record after the two Codex QA lanes capped); combined verdict follows its forward.

## Lead gate FAIL @ f9b4e4b → fold audit @ 4ed10b4 (2026-07-08)
Lead (QA-of-record) found what I missed: **F-E9a MED — symlink-follow WRITE-ESCAPE** (dirForRoute returned the symlink path; fs.rm/rename operated THROUGH a mid-path symlink out of the app tree) + F-E9b LOW (symlink Dirent slips both structural guards — neither isFile nor isDirectory), F-E9c LOW (create-page dash-trim), F-E9d deferred (intercepting-route listing completeness — no write surface).
**Honest meta accounting: F-E9a is partly a gap in MY DESIGN, not just the build.** My design said "structural guards instead of location guards; git is the undo" — that swap silently dropped the containment guarantee the old location jail provided; my #6 flagged only the cycle-HANG half of the symlink surface, not the follow-escape half. The lead's adversarial layer caught what both the builder and I missed — the pipeline working as intended.
**Fold verified by code-read @ 4ecdb29 (+4ed10b4 lint):**
- F-E9a: dirForRoute realpath-confines before returning — `realpath(found)` must equal or sit under `realpath(appDir)`, else 403. Containment restored for delete/duplicate/rename (all route through dirForRoute); create never traverses (writes appDir directly, slug sanitized). Builder reproduced the lead's planted-symlink test live: delete via `src/app/evil -> /tmp` → 403, victim intact.
- F-E9b: assertDeletablePage refuses ANY symlink Dirent (422) — closes the subdir vector.
- F-E9c: create-page trims/collapses dashes with `|| 'new-page'` all-dash fallback — matches rename's sanitizer.
I did NOT replant the symlink probe myself: the lead is re-probing closure on the same tree concurrently and a duplicate plant could collide with its evidence run; my execution-backing for this finding = auditing the LEAD's closure evidence when its PASS forwards (pipeline-correct division: lead executes the gate, meta audits gate + evidence).
EDITOR_SELF step-4 anchoring caveat: unaffected, still carries into the verdict.
826246d/46fd860 spot-check: commit claims carry live evidence (screenshots/counts) in the builder's own ledger; both are UI-layer, outside the pages-model design authority — QA's gate items 4-5 cover them; no independent meta finding.

## Evidence read (execution-backed, not eyeballed)
- `git show 7346e98` full server diff (editor-pages/route.ts NEW 84 lines; lib.ts page-ops rewrite) + client diff (panel, CRUD callbacks, dropdown).
- Live tree enumeration: `find src/app -name page.tsx` → 13 files, 12 listable routes (design/[slug] excluded) — matches the commit's "12 true pages".
- Read on-disk `editor-pages/route.ts`, panel fetch (page.tsx:2330 — no `?root`), `openBuildFolderPicker` (page.tsx:2789), canvas dir contents (`canvas/`, `components-canvas/` = page.tsx only), home = literal `src/app/page.tsx`.
- QA gate brief read — mapped which of my candidate findings its probes 1-7 will/won't catch.

## Design-conformance verdict (drift check vs s58-e9-pages-model-answer.md)
CONFORMS on the core: derived jail (`buildAppDir()` replaces PAGES_DIR — constant deleted), structural guards (leaf-only, page-owned-files whitelist, home-by-dir + rename route-'/' refuse), route-addressed ops, routeFor lifted+parameterized, flat list home-first, honest empty (no finder fallback), Framer parity items (home icon/protection, route as secondary text, rename=path). Step-4 (BuildSource/fork adapters) correctly deferred as designed.

## Candidate findings (to reconcile with QA's evidence before issuing verdict)
1. **[HIGH-cand] Editor lists itself; its canvases pass every guard.** The lift of `routeFor` DROPPED the original's `/react-figma` self-exclusion (editor-fs/route.ts:30 has it; editor-pages/route.ts doesn't). Consequences: (a) clicking the `/react-figma` row loads the editor inside its own canvas iframe — recursion; (b) `/react-figma/canvas` + `/react-figma/components-canvas` are page.tsx-only leaf dirs → they pass the structural delete guards → the editor can delete its own Design-mode host from its own UI. QA brief probes child-page and non-page-file guards — BOTH pass here, so QA's probes as written will not catch this.
2. **[MED-cand] Route-collision guard gap (same failure class as the digit-slug 500).** create/rename/duplicate check SIBLING-dir uniqueness only, not ROUTE uniqueness across groups: rename `/new-page` → `community` creates `src/app/community` while `(store)/community` exists → Next parallel-route conflict → whole app 500s. The registry is the route space; uniqueness must be checked by route (one scan), not fs siblings.
3. **[MED-cand] "Open build folder…" is a success-toasting stub.** Picker returns a path, notifies "Selected folder · <path>", and does nothing — no root load, no pages. Fake-action UX (Dan's no-meta-slop line). Either wire it to `?root=` (list-only, mutable:false until step-4) or remove the menu row.
4. **[MED-cand] `?root=` trap for step-4.** editor-pages accepts ?root and returns `mutable:true` for ANY jailed build, but every write op is anchored to cwd (`ROOT`) — a future caller passing root gets pages that claim mutability while ops would write into the WRONG build (route-collision deletes possible). Ops should carry+verify root (or the API should return mutable:false when root≠APP_ROOT) so the trap can't fire.
5. **[LOW-cand] Grouped-home latent gap.** delete guards home by `dir===appDir`; rename guards by `route==='/'`. A build whose home is `(group)/page.tsx` escapes the delete guard (dir≠appDir). Works for this build (home is literal src/app/page.tsx). Align delete to `route==='/'` like rename.
6. **[LOW-cand] Symlink-cycle hang.** scanPages + dirForRoute recurse through `isSymbolicLink()` dirs with name-only SKIP — a symlink loop under the app dir hangs every pages fetch AND every route-addressed op. (editor-fs listed one level; recursion is new exposure.) Dev-only.
7. **[LOW-cand] Fetch-failure = fake empty build.** editor-pages fetch error silently renders "No pages in this build — press + to create the first"; + then creates a real route while the panel state is a lie. Distinguish error from empty.

## What QA's probes (brief items 1-7) cover vs don't
- Covered: true-list, on-disk create, home 422s, child-page 422 (/effect-creator), non-page-file 422, traversal via newSlug, duplicate-of-home, regressions suite.
- NOT covered by the brief as written: findings 1, 2, 3, 4, 6, 7 above. These are my meta deltas regardless of QA's verdict; QA's evidence may still surface or contradict some — reconcile before issuing.

Verdict message will go to @s58-designer (builder) per pipeline once QA's verdict is forwarded.
