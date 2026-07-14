# E9 META verdict — @s58-expert · 2026-07-08 · frozen HEAD `4ed10b4`

**Scope:** E9 pages model + fix batches (7346e98 → 7b76c7a → 826246d → 46fd860 → f9b4e4b → 4ecdb29 → 4ed10b4) + 2.9 (f214ddc/826246d) + 3.0/layer CRUD (5b96aab) + 3.6 (46fd860).
**Authorities:** my design doc `s58-e9-pages-model-answer.md` (Dan-directed) + Dan's verbatim requirements in `s58-e9-pages-model-question.md`.
**QA-of-record:** @s58-lead write-safety gate — PASS @ 4ed10b4 (`s58-e9-qa-gate-verdict-kai.md`).
**My audit trail:** `s58-e9-meta-prep-ledger.md` (per-HEAD, execution-backed).

## VERDICT: **META PASS @ 4ed10b4** — ready for Dan's sign-off.

### 1. Design conformance — no drift survived
The implementation is faithful to the design on every load-bearing element, verified by full-diff reads across all seven commits plus live probes I ran myself:
- **Discovery**: one API (`/api/dev/editor-pages`), fs-scan of the loaded build's real app tree, `routeFor` lifted + parameterized, groups collapsed, api/[param] excluded, honest empty (no finder fallback). Live: 11 true pages, home first, build name from package.json.
- **Derived jail + structural guards**: `PAGES_DIR` constant deleted; ops route-addressed via `dirForRoute`; leaf-only / page-owned-files / home-by-route / editor-self guards all live-422-verified by me (twice each, nothing mutated).
- **Framer parity**: flat list, home icon + protection, route as secondary text, rename=path, folder browser dead. Matches the parity delta section of the design.
- **Deferred-by-design, correctly**: BuildSource step-4 (multi-root ops) — and the ?root trap that deferral created is now guarded (`mutable:false` for any foreign root, live-verified `anyMutable:false`).

### 2. Dan's verbatim requirements — all met at this HEAD
- "recognise where the pages are on ANY build — no hacks or hardcoded folders" → fs-scan of the build's own app dir; the one hardcode that remains (`EDITOR_SELF /react-figma`) is tool self-protection, not page discovery (see caveat).
- "if the build has 1 page shows 1 page, if many shows all. not a finder" → true list, finder removed.
- "creating and deleting pages is a TRUE action in the build" → real route dirs created/removed in `src/app/` (I created and deleted a probe page through the API myself; git-clean after).
- "how does Framer do it — repeat" → measured live by the builder, parity delta implemented.

### 3. Findings lifecycle — everything closed or honestly deferred
- **My 7 meta candidates**: ALL CLOSED, each verified by me at its fix HEAD (#1 editor-self: live 422×3 + list exclusion; #2 route-space uniqueness: live cross-group probe `community`→`community-2`, app 200, zero residue; #4 ?root: live `anyMutable:false`; #3/#5/#6/#7 code-read of real mechanism changes).
- **Lead's F-E9a/b/c**: CLOSED — realpath-confinement in `dirForRoute` (403 before any mutation; all three mutating ops inherit), symlink Dirents refused, dash-trim aligned. Lead independently re-probed with a planted symlink (403, victim intact); I code-read the mechanism and re-ran the reject battery at 4ed10b4 (422/422/422/404, editor 200, tree clean).
- **F-E9d**: DEFERRED by agreement — `@slot`/`(.)` intercepting-route listing completeness only; writes are self-consistent AND realpath-confined regardless. Documented v1 limit. I concur.

### 4. QA evidence audit (the strand question)
The lead's gate is **auditable and clean**: own detached worktree at the frozen HEAD, designer's tree untouched, live probes read/reject-only, **explicit zero reliance on the capped Codex lanes' stranded evidence**, and closure re-verified independently rather than on the builder's word. The @s58-qa strand is therefore NOT material — the evidence chain of record is the lead's ledger, complete and reproducible. Coverage split is also sound: lead's write-safety lens + my client-side code-reads (#7 error row, #3 disabled stub) + my design-conformance audit together cover what the lead's lens explicitly punted.

### 5. Honest accounting — a design gap, owned
**F-E9a traces partly to MY design**: "structural guards instead of location guards; git is the undo" silently dropped the containment guarantee the old location jail gave for free. The builder implemented the design faithfully; my own #6 caught only the cycle-hang half of the symlink surface. The lead's adversarial layer caught the follow-escape half. The pipeline's layering worked exactly as intended — and the fix (realpath-confine) restores the old guarantee inside the new model, which is strictly better than either previous state.

### 6. Caveats & residuals to carry forward (none blocking)
1. **EDITOR_SELF step-4 re-anchoring** (standing caveat): `/^\/react-figma(\/|$)/` anchors self-protection to a route NAMESPACE of whatever build is loaded. Correct while ops are cwd-anchored; when BuildSource step-4 lands, re-anchor to the editor's own build identity — otherwise a foreign build's innocent `/react-figma` route is wrongly frozen, and the protection wouldn't follow if the editor route moves.
2. **Visual-lane deferral**: the Codex visual/conformance lane is capped until Jul 11; panel visuals (home icon, menus, 2.9 groups sidebar, 3.6 capsules) rest on the builder's live-proofs + my structural diff reads + Dan's own eyes at sign-off. The KAI-9406 conformance tool (269/269) is alarm-only per its known-limits flag.
3. **Header `+` active during pages-fetch error** (accepted residual): the error state no longer lies, so creating there is a user's informed act.
4. **BuildSource step-4** remains the designed next slice: multi-root loading, root-carrying+verifying ops, folder-picker re-wire, hosted-screen adapter.

**→ @s58-designer: E9 batch is clear on my gate. Route to Dan for sign-off.**
