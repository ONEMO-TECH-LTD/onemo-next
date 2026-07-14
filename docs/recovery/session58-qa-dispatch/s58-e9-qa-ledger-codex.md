# s58-qa E9 gate ledger — react-figma @ 7346e98

Verdict: FAIL-with-findings.

Target:
- Branch: `session58-task/react-figma-engine`
- Remote HEAD: `7346e981aac54ceae199dd44b366f65b67f0ad01`
- QA checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-qa-e9-7346e98`
- Live server: `:3025`, cwd `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine`, HEAD `7346e981aac54ceae199dd44b366f65b67f0ad01`

Brief/design reads:
- Full read: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-e9-qa-gate-brief.md`
- Full read: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-e9-pages-model-answer.md`
- Full read: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-e9-pages-model-question.md`

Source evidence:
- `src/app/api/dev/editor-pages/route.ts:73-83` accepts optional `root` and scans `root` for true Next pages.
- `src/app/(dev)/react-figma/page.tsx:2328-2333` fetches `/api/dev/editor-pages` without passing any loaded-build root.
- `src/app/(dev)/react-figma/page.tsx:2270-2273` stores canvas as `{name, route}` and `BuildSource` from editor-sources has no root.
- `src/app/(dev)/react-figma/page.tsx:2789-2794` `openBuildFolderPicker` only notifies selected path; it does not register a loaded build root.
- `src/app/api/dev/editor/lib.ts:267-275` page write ops have no `root`.
- `src/app/api/dev/editor/lib.ts:672-674` `buildAppDir()` derives app dir from server `ROOT` only.

Finding 1 HIGH:
- The E9 implementation is same-app route CRUD, not the design-authority build-root model.
- Impact: it passes the current `:3025` same-app surface, but it cannot create/delete/rename pages in an arbitrary loaded build because the UI never stores/sends a build root and write ops are anchored to server `process.cwd()`.
- Why this matters: Dan's requirement and expert design say loaded build root is first-class and ops apply to that loaded build, not implicitly the editor server repo.

Execution evidence that passed:
- `/api/dev/editor-pages`: `kind=next-app`, `buildName=onemo-next-temp`, `appDir=src/app`, `pages.length=12`; home first; dynamic `/design/[slug]` excluded; route groups collapsed.
- `/api/dev/editor-write delete-page /`: 422 `cannot delete the home page`.
- `/api/dev/editor-write delete-page /effect-creator/v5.3.1`: 422 `page has child pages — delete them first`.
- CRUD temp route probe: create `/qa-e9-codex`, rename to `/qa-e9-renamed`, duplicate to `/qa-e9-renamed-copy`, duplicate home to `/home-copy`, cleanup all via delete ops.
- Non-page-file guard: temp route `/qa-e9-guard` plus `extra.ts` refused delete with 422 `dir contains non-page file extra.ts — not deletable as a page`; cleanup succeeded after removing temp file.
- `editor-pages?root=../../../../../../etc`: 403 `outside build jail`.
- `rename-page` traversal payload `../../qa-e9-outside` did not escape jail; it sanitized to `/qa-e9-outside`. Hardening note: this is not a 422 reject.
- UI pages/dropdown: title `onemo-next-temp`, finder toggle gone, Find only in Layers header, home context menu only `Duplicate`, non-home page menu `Rename/Duplicate/Delete`, build dropdown has `Recent builds` and `Actions`, click-away closes it.
- Variables page: Figma view loaded, group headers present (`grey`, `raspberry-plum`, ...), 127/127 visible rows had type icons.
- Layer CRUD: real context-menu Duplicate and Delete each changed `storybook/prototypes/create-studio/Editor402.tsx`; `git restore` returned tree clean after each.

Regression gates:
- `npm run typecheck`: pass.
- `/react-figma`: 200.
- `/react-figma/components-canvas`: 200.
- Fresh console capture after load + real iframe selection: `[]`.
- `node editor-engine/audit/input-behavior.mjs`: 28/28 pass.
- `node editor-engine/audit/inspector-conformance.mjs`: 305/305 pass.
- `node editor-engine/audit/audit-export.mjs`: first run was RED 295/300 on picker/pill rows, then rerun and third run were GREEN 305/305 + 28/28. Residual note: first-run audit flake/warmup observed; not the main blocker.

Cleanup:
- Designer worktree tracked clean after probes.
- QA worktree tracked clean.
