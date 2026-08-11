# ERRORS

## KAI-9728 Playwright browser extraction under Node 26

- What did not work: `npx playwright install webkit chromium` under the active Node 26 runtime, both
  combined and WebKit-only.
- Symptom: the archive downloaded fully, then the extractor hung indefinitely after writing only
  `webkit-2248/libwebrtc.dylib`.
- What worked: run Playwright's same pinned CLI with the installed Node 20 binary:
  `/opt/homebrew/opt/node@20/bin/node node_modules/playwright/cli.js install webkit chromium`.
- Remember: Playwright 1.58 browser installation on this Mac must use Node 20; the built suite can
  still run under the repo's normal Node runtime.

## S59 Playwright CLI `run-code` callback syntax

- What did not work: passing top-level snippets such as `await page.title()` to the current `playwright-cli run-code`, following the bundled skill reference.
- Symptom: every invocation failed with `SyntaxError: Unexpected identifier 'page'`.
- What worked: `run-code` requires a JavaScript function receiving `page`, e.g. `async (page) => await page.title()`; confirmed by `run-code --help`.
- Remember: on this installed CLI, wrap all `run-code` input in a `(page) => ...` or `async (page) => ...` function.

## S59 deleted route leaves stale Next type stubs

- What did not work: deleting `(store)/create/page.tsx`, then relying on `next typegen` to remove the old `.next` page stubs.
- Symptom: `tsc --noEmit` still imported the deleted source from `.next/dev/types/app/(store)/create/page.ts` and `.next/types/app/(store)/create/page.ts`.
- What worked: move those two ignored generated stubs to `/tmp`, then rerun typecheck; the regenerated route map stayed current and TypeScript passed.
- Remember: after deleting an App Router page while a dev server is live, `next typegen` may update validators without pruning stale per-page stubs.

## KAI-8318 Studio v2 preview asset collision

- What did not work: copying product assets into `studio-v2/dist/assets` while Vite also emitted bundled JS/CSS chunks into `dist/assets`.
- Symptom: `npm run preview` served HTML, then the browser failed on `/assets/index-*.js` with 404 because the copy step wiped Vite's generated asset directory.
- What worked: set Vite `build.assetsDir` to `studio-assets` and reserve `/assets/` for ONEMO product assets copied from `../public/assets`.
- Remember: when Studio v2 needs product `/assets/...` URLs in a Vite build, keep Vite's own chunk directory separate from the product asset route.

## S57 QA Playwright browser smoke

- What did not work: relying on Playwright's bundled Chromium in this machine and asserting sidebar panel readiness by searching `document.body.innerText` for spaced labels.
- Symptoms: bundled Chromium was missing from `~/Library/Caches/ms-playwright`; the editor selected the smoke mesh, but body text collapsed labels like `OBJECTGEOMETRYMATERIALSCRIPT`, so the text assertion failed.
- What worked: launch Playwright with local Google Chrome and assert sidebar readiness through DOM tabs/outliner state instead of raw body text.
- Remember: for Studio v2 QA on this Mac, use `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` unless the Playwright browser cache is installed.

## KAI-8320 prototype screenshot server setup

- What did not work: starting Next dev without `--webpack`, then reusing the same locked `.next/dev` server after discovering Supabase env placeholders were needed.
- Symptoms: Next 16 defaulted to Turbopack and rejected the repo webpack config; after restart, middleware failed because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were unset; a second server could not acquire `.next/dev/lock`.
- What worked: stop only the dev server started for the screenshot run, then restart with `--webpack` plus harmless local Supabase placeholder env vars.
- Remember: for `/prototype` screenshot verification in this worktree, run `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run dev -- --hostname 127.0.0.1 --port <port> --webpack`.

## S57 golden prototype verification server

- What did not work: validating source edits against the existing `127.0.0.1:3211` server and then starting a temporary dev server without checking port/Turbopack requirements.
- Symptoms: `3211` was a built `next-server` serving stale chunks; `3212` was already occupied; `next dev` on `3213` defaulted to Turbopack and rejected the repo webpack config.
- What worked: identify the serving process with `lsof`/`ps`, then use a separate dev port with `--webpack` and local Supabase placeholder envs before browser verification.
- Remember: rendered source-change checks for `/prototype?scene=golden` must not trust an existing `next-server`; either rebuild/restart it or use a fresh `next dev --webpack` port.

## S57 effect-creator node-bar Playwright re-drive

- What did not work: generic selectors during the editor re-drive, specifically `input[type=file][accept="image/*"]` in strict mode and `svg` after entering the editor.
- Symptoms: the page has both pre-upload and toolbar file inputs, and the editor page contains many icon SVGs plus the actual canvas SVG, so strict Playwright refused to pick one.
- What worked: select an explicit file input (`first()` or the intended visible control), then target the editor canvas via the CSS-module canvas class (`svg[class*="outline-editor_svg"]`) before double-tapping/selecting anchors.
- Remember: effect-creator v3 visual probes should use role/label selectors for buttons and CSS-module substrings for the actual editor canvas, never generic `svg`.

## S57 creator v5 live QA harness

- What did not work: waiting only for the Editor button after Magic, using Playwright visibility on transparent SVG hit paths, and clicking the SVG/path bbox center to all-select a stretched organic duck outline.
- Symptoms: the first run mixed standard-square and Magic duck state; transparent crop hit paths resolved as hidden; after stretch, the rotate handle did not appear because the click missed the filled outline and never set all-selected.
- What worked: wait for `button[aria-label="Magic"][aria-pressed="true"]`, derive crop-grip coordinates from SVG `getBoundingClientRect()`, and use DOM hit-testing (`document.elementFromPoint`) to find a screen point actually inside the outline path before checking the rotate handle.
- Remember: for organic creator shapes, bbox center can be empty background; all-select/rotate probes must click a real hit-tested outline point, not geometric bbox center.

## S57 KAI-9066 rotate harness SVG grip hit-box

- What did not work: using Playwright `locator.waitFor({ state: "visible" })` or raw `getBoundingClientRect()` on horizontal SVG `path[class*="gripHit"]` crop grips.
- Symptoms: the grip was attached and interactive, but Playwright marked it hidden; the DOM rect could be zero-height because SVG path geometry excludes the large stroke hit area.
- What worked: compute the grip center from SVG `getBBox()` plus `getScreenCTM()`, then expand the synthetic hit box by the path stroke width before driving `page.mouse`.
- Remember: SVG path hit areas in the creator editor can be stroke-only; Playwright visibility/layout boxes are not reliable for those gesture handles.

## S57 file-read batching with macOS `nl`

- What did not work: passing multiple file paths to `nl -ba` during parallel source hydration.
- Symptoms: macOS `nl` returned usage text instead of file contents; three parallel read commands failed the same way.
- What worked: run `nl -ba` one file at a time, or use a shell loop only when explicit per-file headers are needed.
- Remember: for full-read hydration, do not batch multiple file operands into `nl`; one file per command keeps coverage auditable.

## S59 persistent browser-control connection

- What did not work: connecting to the already-running Chrome extension surface twice, then selecting the in-app browser for `localhost:3970`.
- Symptoms: Chrome was running and the ChatGPT Chrome Extension plus native host both passed installation checks, but browser selection returned `Browser is not available: extension`; the in-app browser returned `No browser is available`.
- What worked: preserve the persistent server/Chrome state, verify HTTP and engine parity locally, and request the existing Chrome-owning QA lane to stage the required live screenshots instead of launching another server or browser.
- Remember: do not disturb Dan's persistent Chrome or start a second grid-lab server when the control channel is unavailable; use the owning lane for visual evidence and keep code/runtime proof separate.
- A4 recurrence: the required in-app `browser-client` bootstrap failed before tab creation (`agent.browser` unavailable, then `Cannot redefine property: process` even after a kernel reset). The same owning-lane fallback produced the live `/create` verification without disturbing port 3970.

## S59 E3 shared grid-lab hydration failure

- What did not work: opening the shared Next dev server through `127.0.0.1:3970` for the pre-E3 interactive baseline.
- Symptoms: the port returned 200 SSR HTML and JavaScript chunks, but controls only received focus; state never changed, DOM nodes had no React fiber/props, and the Next HMR WebSocket failed with `ERR_INVALID_HTTP_RESPONSE`.
- What worked: use the authoritative `http://localhost:3970` origin. React fiber/props were present, HMR connected, and the User toggle changed `aria-pressed` from false to true.
- Remember: this project binds Next HMR to `localhost`; `127.0.0.1` can produce an inert SSR-only QA artifact. Verify hydration plus one state-changing control before collecting performance evidence.

## S59 grid-audit runner under orchestration

- What did not work: invoking `grid-audit.ts` through `vite-node --script`, then wrapping `npx --no-install tsx` inside the orchestration helper.
- Symptoms: both calls completed without the audit's final law verdict; the script's explicit `process.exit()` did not surface a reliable result through that wrapper.
- What worked: run `npx tsx src/lib/effect/grid-audit.ts` directly in a PTY command and poll the returned session until exit.
- Remember: the standing magnetic-grid audit is a script with an explicit exit; execute it directly with `npx tsx` when an auditable verdict is required.

## S59 peer scratchpad path transcription

- What did not work: manually reconstructing Kai's long
  `/private/tmp/claude-501/-Users-.../scratchpad/` path in repeated read commands.
- Symptom: the path was mistyped by inserting a real `/Dev/onemo-dev/` segment
  inside the encoded directory name, producing repeated “No such file” errors.
- What worked: copy the exact path from the peer message/tool output and reuse it
  verbatim.
- Remember: treat peer scratchpad paths as opaque identifiers; never normalize
  or reconstruct their encoded directory segments.
## 2026-07-29 — Playwright CLI ambiguous control labels

- Failed: unscoped `getByRole('button', { name: 'Standard' })` matched density,
  pattern, and source controls; `click "Triangle"` treated the text as a target
  reference rather than a role locator.
- Worked: `run-code` with the admin `aside` scoped first, exact roles, and an
  explicit `nth(1)` only for the duplicated Standard pattern label.
- Remember: use snapshot refs or scoped role locators on this two-panel bench;
  never assume a visible label is unique.

## 2026-07-29 — production build invalidated the same-tree dev server

- Failed: running `next build` while `:3970` was served by `next dev` from the
  same worktree, then probing the page through `127.0.0.1`.
- Symptoms: the page stayed at `resolving-grid`; the old dev process returned
  invalid HMR handshakes, and Next rejected the `127.0.0.1` dev origin.
- Worked: restart only `:3970` from the grid-lab worktree with
  `npx next dev -p 3970 --webpack`, then verify through `http://localhost:3970`.
- Remember: after a production build in a live dev worktree, restart that dev
  server before visual QA; this repo's hydrated dev origin is `localhost`.

## 2026-07-29 — dense-arc probe accidentally ran through the full ladder scan

- Failed: the first KAI-9837 probe passed a bare point ring instead of a
  `Contour`; the corrected probe then used 4,096 points per corner inside
  `semanticLadder`, multiplying that dense geometry across every 1mm candidate
  and requiring an interrupt.
- Worked: keep the 4,096-segment contour only for the single exact-tangency
  measurement, and use a low-resolution construction for exploratory ladder
  scans. The committed regression test uses dense geometry only for the two
  bounded tangency calls.
- Remember: never put a proof-density contour inside a 22–310mm scanner; isolate
  the exact geometry assertion from catalogue enumeration.

## 2026-07-29 — standalone grid profile script lacks repo aliases

- Failed: `npm run grid:profile -- <scenario>` for all three scenarios, then a
  direct `vite-node --config vitest.config.ts` retry.
- Symptom: Vite could not resolve `@/lib/outline-core/math` or
  `@/lib/vector-core` from `geometry-truth.ts`; the profile never executed.
- Worked: the tracked device-performance runner and Vitest gates use their own
  alias-aware runtime and remain the performance authorities for KAI-9843.
- Remember: do not report `grid:profile` numbers unless its runtime actually
  loads the repo aliases; a zero-duration launcher failure is not a benchmark.

## 2026-07-30 — tsx eval silently skipped when `--tsconfig` precedes `-e`

- Failed: `npx tsx --tsconfig tsconfig.json -e "<probe>"` returned exit 0 with
  no stdout, making a zero-row comparison look like a clean result.
- Worked: use `npx --no-install tsx -e "<probe>" --tsconfig tsconfig.json`, or
  run a tracked script file with `npx tsx --tsconfig tsconfig.json <file>`.
- Remember: an empty diagnostic is not a pass. Print an unconditional executed
  comparison count, and verify the probe launcher with one literal output first.

## 2026-07-31 — Playwright CLI `run-code` expects one function

- Failed: bare `return`, then bare `await page`, then a dynamic `node:fs` import
  inside the CLI VM while capturing the pre-cutover compositor golden.
- Worked: pass `async (page) => ...` as the complete argument and compute the PNG
  hash inside `locator.evaluate` with browser `crypto.subtle`.
- Remember: `run-code` invokes one function with `page`; its VM has no dynamic-import
  callback. Prove the launcher with a one-line executed count before a real probe.

## 2026-07-31 — repeated AI upload outlives Playwright's action timeout

- Failed: three single-command `run-code` probes waited for an upload to leave the cutting state;
  two hit Playwright's 30-second action cap and the third hit an explicit 120-second cap.
- Worked: separate the probe into a page-resident transition observer, an immediate file upload, and
  short polling reads. This preserves the phase start/end even when inference outlives one CLI call.
- Remember: an AI run exceeding the harness timeout is a lower bound, not a completed timing. Never
  report the timeout value as the runtime or rerun the model merely to make one command own the clock.

## 2026-07-31 — broad npm audit remediation increased the advisory count

- Failed: `npm audit fix` updated unrelated transitive toolchain packages and changed the audit from
  15 findings to 37; pinning Storybook back by itself did not restore the previous dependency graph.
  Forcing `brace-expansion@5` then reduced the count to 12 but broke ESLint 9's `minimatch@3` caller
  (`TypeError: expand is not a function`).
- Worked: restore the clean staging lockfile, retain only reviewed direct upgrades plus compatible
  `esbuild`/`fast-uri` overrides, and leave `brace-expansion` on the major versions its callers require.
  The critical and moderate findings are gone; npm expands the remaining brace advisory through its
  dependent lint/tool packages, so the final count is 37 even though the compatible graph is safer.
- Remember: use `npm audit` as evidence, not as a bulk updater or a score to game. Never force a
  transitive dependency across its caller's declared major; the real gate is audit classification plus
  the affected tool running successfully.

## 2026-08-09 — changed Cutout output needed per-browser golden refresh

- Failed: the shared edge-finish oracle retained the pre-feather Chromium and WebKit PNG dimensions
  and hashes, so its first two runs stopped once each browser exposed the intentional new output.
- Worked: capture each browser's exact fixed-viewport output after the admin value changed from 3px
  to 5px, freeze both goldens, then rerun the complete two-browser oracle.
- Remember: when a product-approved pixel change intentionally alters a golden, collect Chromium and
  WebKit witnesses separately before declaring the updated oracle deterministic.

## 2026-08-09 — current-code GrabCut oracle hit the timing gate during golden refresh

- Failed: two immediate reruns stopped at the existing 10-second real-route timing assertion before
  reaching the intentional PURE-default output witnesses.
- Worked: temporarily widen only the local capture pass, collect the new deterministic pixel goldens,
  restore the 10-second acceptance threshold, then rerun the final oracle on an idle server.
- Remember: a transient timing failure must not be hidden by permanently weakening the shipped gate;
  separate golden collection from the final performance verdict.

## 2026-08-11 — Cutout closure generator path normalization

- Failed: the first generator run resolved `@/` imports without the repository's `src/` prefix; the
  second parsed escaped Next HTML asset paths with a trailing backslash.
- Worked: map `@/x` to `src/x`, and exclude backslashes from the emitted-asset regex.
- Remember: generated Next HTML escapes route strings; normalize aliases and reject escape characters
  before resolving closure files.

## 2026-08-11 — KAI-10285 QA browser probe result was hidden behind yielded sessions

- Failed: the first probe used a URL object where Playwright required a string; the next run yielded through nested exec sessions and appeared to return no output.
- Worked: pass `.href`, preserve failures to a QA evidence file, and keep polling the returned exec session until its real exit. The completed probe then reported the exact canvas-difference counts.
- Remember: a yielded exec cell completing does not mean the nested PTY process completed; follow the returned session id to its exit before treating empty output as failure or success.
