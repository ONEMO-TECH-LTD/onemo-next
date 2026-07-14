# [Kai-Claude-s58-expert] [REVIEW] Live-run rework — independent validation request

**To:** @s58-qa · **Report verdict to:** @s58-expert (+ admin) · **Repo:** `~/Dev/onemo-dev/onemo-next-editor` (branch `main`, local, NOT pushed)

Your prior verdict: **Finding 2 CLOSED / build-clear; full live-run REWORK** on findings 1, 3, 4. All three are now folded, fixed, and self-verified **live in the running editor**. Requesting your independent validation → CLEAR or REWORK(file:line).

## Commits to read (per-finding)
- `d5656081` — **F1** `fix(parser): retainLines:false` — `packages/parser/src/parse.ts`
- `f6c80b42` — **F3** `fix(sandbox): bound preload-ensure, always resolve INJECTED` — `apps/web/client/src/components/store/editor/sandbox/index.ts`
- `f61ef486` — **F4** `fix(frame): guard async getTheme` — `.../editor-bar/frame-selected/theme-group.tsx`

## Root causes (so you can falsify, not take my word)
- **F1 (OID/index):** `getContentFromAst` used `@babel/generator` `retainLines:true`, which mangled identifiers on real files (`INITIAL_DESIGN`→`INITIAL_DEGN`) → build error (492 issues). `retainLines:false` emits valid code. **The "No metadata found for OID" flood was a startup transient** — the frame maps DOM oids before the index finishes building, then it catches up. DOM oids DO resolve once settled (see repro).
- **F3 (preload/overlay):** NOT "router returns null." `ensurePreloadScriptExists` `await`s `getRouterConfig()` on the provider RPC, which **saturates/hangs during cold-start sync**; when it hangs the method never completes, so `preloadScriptState` stays `!== INJECTED` forever → frame gate never clears → overlay hangs. The preload `<Script>` is *separately* injected into the root layout during sync and actually works (penpal connects). Fix: bound every provider call with a timeout and **always resolve to INJECTED** (graceful degradation, matching the existing code comment's intent).
- **F4 (getTheme):** `frameData.view.getTheme()` called unguarded; remote methods attach async after penpal → `TypeError` in the pre-connect window. Guarded like the sibling `changeTheme`'s `setTheme?.()`.

## Contract to verify live (fresh reload of `http://localhost:3011/project/ff9b64f9-8e0d-4eee-adf5-fa5a27ac48bf`)
1. **Overlay clears + app renders** — effect-creator "Add your image" card (no login, no build-error overlay, no spinner).
2. **`preloadScriptState === 'injected'`** for the active branch's sandbox (was `not-injected`).
3. **0 `getTheme is not a function`** in the fresh console slice.
4. **DOM oids resolve** through `CodeFileSystem.getJsxElementMetadata(oid)`:
   `ejhf._s`→page.tsx:131 · `azc4rsl`→page.tsx:254 · `d4q9-ej`→TopBar.tsx:76 · `fewlvvv`→icons.tsx:129.
   (Reach it: fiber-walk to the EditorEngine → `branches.branchMap.get(currentBranchId).sandbox.fs`.)
5. **Click→select→source:** clicking an element selects it and maps oid→source (svg `fewlvvv` → icons.tsx / breadcrumb `main › icons.tsx › EmptyState.tsx`).
6. **Real source byte-clean:** `git -C ~/Dev/onemo-dev/onemo-next status --porcelain` empty; `grep -rIl data-oid src` = 0. Sandbox copy (`~/.onemo-framer/sandboxes/local-onemo/src`) has oids (injection on the COPY only).

## One flagged product trade-off (NOT a code blocker — Dan's call)
`/public` is excluded from the sandbox seed (that's what un-wedged the agent). App renders fine, but **preview images / materials under `/public` will 404**. Note it in your verdict as an explicit trade-off; don't treat it as a bug.

Return: **CLEAR** or **REWORK** with file:line + the failing repro step.
