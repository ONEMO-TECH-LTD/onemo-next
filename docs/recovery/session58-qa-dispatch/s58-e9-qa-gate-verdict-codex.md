# s58-qa E9 gate verdict — Codex independent QA

Target requested: `4ed10b4c01f327d6eccfa035b698a7f14f8304bf` (`session58-task/react-figma-engine`).

Verdict: **FAIL-with-findings**

## Finding

### MED — Pages registry still follows escaped symlink routes and marks them mutable

Source:
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-qa-e9-4ed10b4/src/app/api/dev/editor-pages/route.ts:57`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-qa-e9-4ed10b4/src/app/api/dev/editor-pages/route.ts:69`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-qa-e9-4ed10b4/src/app/api/dev/editor-pages/route.ts:75`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-qa-e9-4ed10b4/src/app/api/dev/editor/lib.ts:716`

Repro, clean `4ed10b4` server on `:3035`:

1. Planted `src/app/qa-e9-symlink -> /tmp/s58-e9-symlink-victim`.
2. Added `/tmp/s58-e9-symlink-victim/victim/page.tsx`.
3. `GET /api/dev/editor-pages` returned:

```json
{
  "name": "victim",
  "route": "/qa-e9-symlink/victim",
  "file": "src/app/qa-e9-symlink/victim/page.tsx",
  "home": false,
  "mutable": true
}
```

4. `POST /api/dev/editor-write {"kind":"delete-page","route":"/qa-e9-symlink/victim"}` returned `403 {"error":"resolved page dir escapes the build (symlink)"}` and the victim file stayed intact.

Write safety is closed, but the pages registry/UI contract is not: the panel can expose an outside-realpath page as a mutable loaded-build route. Root cause: `editor-pages` walks `e.isSymbolicLink()` and pushes pages with `mutable: !EDITOR_SELF.test(route)` without the realpath-under-app check that write ops apply later.

Expected fix: the page scanner should realpath-confine before descending/listing symlinked dirs. Escaped symlink pages should not be listed as build pages; at minimum they must not be mutable.

## Passed Evidence

- Own checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-qa-e9-4ed10b4`, clean at `4ed10b4`.
- Clean server: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npm run dev -- --webpack --port 3035`.
- `npm run typecheck`: exit `0`.
- Routes: `/react-figma` `200`; `/react-figma/components-canvas` `200`; `/api/dev/editor-pages` `200`.
- `node editor-engine/audit/audit-export.mjs` twice: `269/269` conformance, `28/28` behavior, byte-identical output.
- `node editor-engine/audit/input-behavior.mjs`: `28/28 PASS`.
- Editor-self page ops: delete/duplicate/rename `/react-figma/canvas` all returned `422 editor-own route — not editable as a page`.
- Structural page guards: delete `/` returned `422`; delete `/effect-creator/v5.3.1` returned `422 page has child pages`; traversal-like `/../../etc/passwd` returned `404 no page`.
- Cross-group create: create `community` returned `/community-2`, source file existed, `/react-figma` stayed `200`, cleanup removed the page.
- Layer write probe: temp page created, `set-layer-name` wrote `data-name="CodexLayer"`, cleanup removed the page.
- UI Playwright probe on clean `:3035`: Variables Groups visible/clickable (`All127`, `base 7`, `grey 12`, etc.); variable picker text had Figma names and no `var(--`/CSS-var rows; selection colors showed `grey/12` var capsule. Known `data-eng-id` hydration warning was excluded as previously named.

## Process Notes

- The requested live port `:3025` was initially dirty, then later moved to `6e001b5b757114b7a659efbfa7c8f6bde947c683`; I did not certify it as `4ed10b4`.
- I used an isolated clean checkout and clean server on `:3035` for the target verdict.
- Own QA checkout ended clean. The shared designer worktree was dirty at the end (`src/app/(dev)/react-figma/page.tsx`, `editor-engine/audit/figma-vars-census.js`); I did not revert those external changes.
