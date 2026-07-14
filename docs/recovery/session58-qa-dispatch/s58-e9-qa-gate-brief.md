# E9 QA gate — react-figma batch @ frozen `7346e98` (KAI-9392)

**From:** Kai-Claude-s58-designer · **To:** @s58-qa · 2026-07-08
**Worktree:** `onemo-next/.claude/worktrees/s58-figma-engine` · branch `session58-task/react-figma-engine`
**Scope:** commits `5b96aab` (3.0 iter-1 + layer CRUD + digit-slug crash fix), `f214ddc` (2.9 variables groups/icons), `7346e98` (E9 pages model — supersedes 5b96aab's sandbox pages approach).
**Design authority for the pages model:** `__qa-dispatch/s58-e9-pages-model-answer.md` (expert, Dan-directed). Dan's verbatim requirements are quoted in `s58-e9-pages-model-question.md`.

## Execution-backed checks required (probe live on :3025, own checkout for source reads — do NOT detach my worktree)

1. **True pages list:** panel shows the loaded build's REAL routes (expect 12: home first, routes as secondary text), title = build name from package.json (`onemo-next-temp`), current page highlighted. NOT a folder browser; "show all build files" toggle gone.
2. **True CRUD:** `+` creates a real top-level route dir in `src/app/` (verify on disk), appears in list; right-click page → Rename/Duplicate/Delete; **home = Duplicate only** (no rename/delete — server 422s too, probe the API directly with `{"kind":"delete-page","route":"/"}`). Structural guards: try deleting a route with children (e.g. `/effect-creator/v5.3.1` has child pages → must 422 "child pages"); try a dir with non-page files. Clean up any pages you create via the delete op.
3. **Layer CRUD (5b96aab):** right-click layer → Duplicate inserts real JSX / Delete removes (git-restore after probing).
4. **2.9:** Variables page (Figma view) shows group headers + a type icon on every row.
5. **Dropdown:** closes on click-away; RECENT BUILDS / ACTIONS section groups; Find icon on Layers header only.
6. **Regressions:** `npm run typecheck` 0 · conformance 305/305 · behavior 28/28 · `/react-figma` 200 · console clean. NOTE the conformance tool's known limits (hand-written contract — Dan flagged; treat as regression alarm only, KAI-9406).
7. **Adversarial:** anything the structural guards miss (e.g. delete-page on a route whose dir holds layout.tsx, traversal via newSlug, duplicate of home). The write jail must hold.

Verdict PASS/FAIL-with-findings → DM @s58-designer. Meta review by @s58-expert follows your verdict (Dan-ordered) — include your evidence ledger path so meta can audit it.
