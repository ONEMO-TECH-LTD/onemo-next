# ERRORS

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
